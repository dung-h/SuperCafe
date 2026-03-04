import mysql, { type Pool } from "mysql2/promise";
import type { BackendChannel } from "../backends";
import type { OpenClawConfig } from "../config";
import { logger } from "../logger";
import { defaultSessionContext, type DialogueSession, type DialogueSessionContext, type DialogueStateName } from "./types";
import { sanitizeStateName } from "./stateMachine";

const CLEANUP_INTERVAL_MS = 10 * 60 * 1000;

export class DialogueStateStoreMySql {
  private readonly pool: Pool;
  private ensureSchemaPromise?: Promise<void>;
  private cleanupTimer?: NodeJS.Timeout;

  constructor(private readonly config: OpenClawConfig) {
    this.pool = mysql.createPool({
      host: config.openclawDbHost,
      port: config.openclawDbPort,
      database: config.openclawDbName,
      user: config.openclawDbUser,
      password: config.openclawDbPass,
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0,
      charset: "utf8mb4",
    });
  }

  getPool(): Pool {
    return this.pool;
  }

  async loadSession(channel: BackendChannel, userId: string): Promise<DialogueSession> {
    await this.ensureSchema();

    const [rows] = await this.pool.query<any[]>(
      `SELECT state, context_json, version, expires_at
       FROM chat_dialogue_sessions
       WHERE channel = ? AND user_id = ?
       LIMIT 1`,
      [channel, userId],
    );

    if (!Array.isArray(rows) || rows.length === 0) {
      return this.buildDefaultSession(channel, userId);
    }

    const row = rows[0];
    const expiresAt = new Date(row.expires_at);
    if (Number.isNaN(expiresAt.getTime()) || expiresAt.getTime() < Date.now()) {
      await this.deleteSession(channel, userId);
      return this.buildDefaultSession(channel, userId);
    }

    return {
      channel,
      userId,
      state: sanitizeStateName(String(row.state || "IDLE")),
      context: parseContextJson(row.context_json),
      version: Number(row.version) || 1,
      expiresAt,
    };
  }

  async saveSession(
    channel: BackendChannel,
    userId: string,
    state: DialogueStateName,
    context: DialogueSessionContext,
  ): Promise<DialogueSession> {
    await this.ensureSchema();

    const expiresAt = new Date(Date.now() + this.config.dialogSessionTtlHours * 60 * 60 * 1000);
    const contextJson = JSON.stringify(context);

    await this.pool.query(
      `INSERT INTO chat_dialogue_sessions (channel, user_id, state, context_json, version, updated_at, expires_at)
       VALUES (?, ?, ?, ?, 1, NOW(), ?)
       ON DUPLICATE KEY UPDATE
         state = VALUES(state),
         context_json = VALUES(context_json),
         version = version + 1,
         updated_at = NOW(),
         expires_at = VALUES(expires_at)`,
      [channel, userId, state, contextJson, toMySqlDateTime(expiresAt)],
    );

    const [rows] = await this.pool.query<any[]>(
      `SELECT version FROM chat_dialogue_sessions WHERE channel = ? AND user_id = ? LIMIT 1`,
      [channel, userId],
    );

    return {
      channel,
      userId,
      state,
      context,
      version: Array.isArray(rows) && rows[0] ? Number(rows[0].version) || 1 : 1,
      expiresAt,
    };
  }

  async deleteSession(channel: BackendChannel, userId: string): Promise<void> {
    await this.ensureSchema();
    await this.pool.query(`DELETE FROM chat_dialogue_sessions WHERE channel = ? AND user_id = ?`, [channel, userId]);
  }

  async cleanupExpiredSessions(): Promise<number> {
    await this.ensureSchema();
    const [result] = await this.pool.query<any>(`DELETE FROM chat_dialogue_sessions WHERE expires_at < NOW()`);
    return Number(result?.affectedRows || 0);
  }

  startCleanupJob(): void {
    if (this.cleanupTimer) {
      return;
    }

    this.cleanupTimer = setInterval(() => {
      void this.cleanupExpiredSessions().catch((error) => {
        logger.warn({ error: String(error) }, "dialogue session cleanup failed");
      });
    }, CLEANUP_INTERVAL_MS);
    this.cleanupTimer.unref();
  }

  async close(): Promise<void> {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = undefined;
    }
    await this.pool.end();
  }

  async ensureSchema(): Promise<void> {
    if (!this.ensureSchemaPromise) {
      this.ensureSchemaPromise = this.ensureSchemaInternal().catch((error) => {
        // Allow next request to retry schema initialization after transient DB errors.
        this.ensureSchemaPromise = undefined;
        throw error;
      });
    }
    await this.ensureSchemaPromise;
  }

  private async ensureSchemaInternal(): Promise<void> {
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS chat_dialogue_sessions (
        channel VARCHAR(32) NOT NULL,
        user_id VARCHAR(64) NOT NULL,
        state VARCHAR(64) NOT NULL,
        context_json LONGTEXT NOT NULL,
        version INT NOT NULL DEFAULT 1,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        expires_at DATETIME NOT NULL,
        PRIMARY KEY (channel, user_id),
        INDEX idx_chat_session_expires (expires_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS chat_dialogue_events (
        id BIGINT NOT NULL AUTO_INCREMENT,
        channel VARCHAR(32) NOT NULL,
        user_id VARCHAR(64) NOT NULL,
        correlation_id VARCHAR(64) NOT NULL,
        role ENUM('user','bot','agent','system') NOT NULL,
        input_text TEXT NULL,
        action_payload VARCHAR(255) NULL,
        intent VARCHAR(64) NULL,
        state_before VARCHAR(64) NULL,
        state_after VARCHAR(64) NULL,
        tool_calls_json LONGTEXT NULL,
        latency_ms INT NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        INDEX idx_chat_events_user_time (channel, user_id, created_at),
        INDEX idx_chat_events_correlation (correlation_id),
        INDEX idx_chat_events_intent_time (intent, created_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);
  }

  private buildDefaultSession(channel: BackendChannel, userId: string): DialogueSession {
    return {
      channel,
      userId,
      state: "IDLE",
      context: defaultSessionContext(),
      version: 1,
      expiresAt: new Date(Date.now() + this.config.dialogSessionTtlHours * 60 * 60 * 1000),
    };
  }
}

function parseContextJson(raw: unknown): DialogueSessionContext {
  if (typeof raw !== "string") {
    return defaultSessionContext();
  }
  try {
    const parsed = JSON.parse(raw) as DialogueSessionContext;
    if (!parsed || typeof parsed !== "object") {
      return defaultSessionContext();
    }

    const base = defaultSessionContext();
    const parsedAny = parsed as Record<string, unknown>;
    const incomingOrder =
      parsedAny.order && typeof parsedAny.order === "object" ? (parsedAny.order as Record<string, unknown>) : {};
    const incomingItems = Array.isArray(incomingOrder.items) ? (incomingOrder.items as Array<Record<string, unknown>>) : [];
    const items = incomingItems
      .map((item: Record<string, unknown>) => ({
        sku: String(item?.sku || "").toUpperCase(),
        qty: Number(item?.qty || 0),
      }))
      .filter((item: { sku: string; qty: number }) => !!item.sku && Number.isInteger(item.qty) && item.qty > 0);

    return {
      ...base,
      ...parsed,
      order: {
        ...base.order,
        ...incomingOrder,
        items,
      },
    };
  } catch {
    return defaultSessionContext();
  }
}

function toMySqlDateTime(date: Date): string {
  return date.toISOString().slice(0, 19).replace("T", " ");
}
