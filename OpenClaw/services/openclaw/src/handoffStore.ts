import { randomUUID } from "node:crypto";
import { Redis } from "ioredis";

type Channel = "telegram" | "web" | "messenger" | "modernfashion_web";
type ChatRole = "user" | "bot" | "agent";

export type ChatUiSuggestion = {
  label: string;
  payload: string;
};

export type ChatUiItem = {
  sku: string;
  name: string;
  category?: string;
  priceVnd: number;
  stockQty: number;
};

export type ChatMessageUi = {
  type: "menu";
  title: string;
  items: ChatUiItem[];
  suggestions?: ChatUiSuggestion[];
};

export type ChatMessage = {
  id: string;
  role: ChatRole;
  content: string;
  timestampMs: number;
  ui?: ChatMessageUi;
};

export type HandoffSession = {
  channel: Channel;
  userId: string;
  requestedAtMs: number;
  lastMessage: string;
  lastDeliveredAgentTimestampMs?: number;
  history: ChatMessage[];
};

const DEFAULT_TTL_SEC = 30 * 60;
const CONTEXT_TTL_SEC = 12 * 60 * 60;

export class HandoffStore {
  private redis: Redis;

  constructor(private readonly ttlSec = DEFAULT_TTL_SEC) {
    this.redis = new Redis({
      host: process.env.REDIS_HOST || "lowland_redis",
      port: Number(process.env.REDIS_PORT) || 6379,
    });
  }

  async activate(channel: Channel, userId: string, lastMessage: string): Promise<void> {
    const key = this.keyFor(channel, userId);
    const seededHistory = (await this.getConversationHistory(channel, userId)).slice(-40);
    const now = Date.now();
    const hasLatestUser = this.findLastUserMessage(seededHistory) === lastMessage;
    const history = hasLatestUser ? seededHistory : [...seededHistory, this.createMessage("user", lastMessage)];
    const session: HandoffSession = {
      channel,
      userId,
      requestedAtMs: now,
      lastMessage: this.findLastUserMessage(history) || lastMessage,
      history: history.length ? history : [this.createMessage("user", lastMessage)],
    };
    await this.redis.setex(key, this.ttlSec, JSON.stringify(session));
  }

  async release(channel: Channel, userId: string): Promise<boolean> {
    const deleted = await this.redis.del(this.keyFor(channel, userId));
    return deleted > 0;
  }

  async deleteSession(channel: Channel, userId: string, deleteContext = true): Promise<boolean> {
    const keys = [this.keyFor(channel, userId)];
    if (deleteContext) {
      keys.push(this.contextKeyFor(channel, userId));
    }
    const deleted = await this.redis.del(keys);
    return deleted > 0;
  }

  async isActive(channel: Channel, userId: string): Promise<boolean> {
    const exists = await this.redis.exists(this.keyFor(channel, userId));
    return exists > 0;
  }

  async getSession(channel: Channel, userId: string): Promise<HandoffSession | null> {
    const key = this.keyFor(channel, userId);
    const data = await this.redis.get(key);
    if (!data) {
      return null;
    }

    const parsed = this.parseSessionPayload(data, channel, userId);
    if (!parsed.session) {
      return null;
    }
    if (parsed.dirty) {
      await this.redis.setex(key, this.ttlSec, JSON.stringify(parsed.session));
    }
    return parsed.session;
  }

  async appendMessage(channel: Channel, userId: string, role: ChatRole, content: string, ui?: ChatMessageUi): Promise<void> {
    const text = String(content || "").trim();
    if (!text) {
      return;
    }

    const session = await this.getSession(channel, userId);
    if (!session) {
      return;
    }

    session.history.push(this.createMessage(role, text, ui));
    if (role === "user") {
      session.lastMessage = text;
    } else {
      session.lastMessage = this.findLastUserMessage(session.history) || session.lastMessage;
    }

    if (session.history.length > 80) {
      session.history = session.history.slice(-80);
    }

    await this.redis.setex(this.keyFor(channel, userId), this.ttlSec, JSON.stringify(session));
  }

  async appendConversation(channel: Channel, userId: string, role: ChatRole, content: string, ui?: ChatMessageUi): Promise<void> {
    const text = String(content || "").trim();
    if (!text) {
      return;
    }

    const history = await this.getConversationHistory(channel, userId);
    history.push(this.createMessage(role, text, ui));
    await this.redis.setex(this.contextKeyFor(channel, userId), CONTEXT_TTL_SEC, JSON.stringify(history.slice(-120)));
  }

  async consumeLatestAgentMessage(channel: Channel, userId: string): Promise<ChatMessage | null> {
    const session = await this.getSession(channel, userId);
    if (!session) {
      return null;
    }

    const deliveredAt = Number(session.lastDeliveredAgentTimestampMs || 0);
    let candidate: ChatMessage | null = null;
    for (let i = session.history.length - 1; i >= 0; i -= 1) {
      const current = session.history[i];
      if (current.role !== "agent") {
        continue;
      }
      if (Number(current.timestampMs || 0) <= deliveredAt) {
        break;
      }
      candidate = current;
      break;
    }

    if (!candidate) {
      return null;
    }

    session.lastDeliveredAgentTimestampMs = Number(candidate.timestampMs || Date.now());
    await this.redis.setex(this.keyFor(channel, userId), this.ttlSec, JSON.stringify(session));
    return candidate;
  }

  async deleteMessage(channel: Channel, userId: string, messageId: string): Promise<boolean> {
    const id = String(messageId || "").trim();
    if (!id) {
      return false;
    }

    let removed = false;

    const session = await this.getSession(channel, userId);
    if (session) {
      const before = session.history.length;
      session.history = session.history.filter((entry) => entry.id !== id);
      if (session.history.length !== before) {
        session.lastMessage = this.findLastUserMessage(session.history) || "";
        removed = true;
        await this.redis.setex(this.keyFor(channel, userId), this.ttlSec, JSON.stringify(session));
      }
    }

    const context = await this.getConversationHistory(channel, userId);
    if (context.length > 0) {
      const trimmed = context.filter((entry) => entry.id !== id);
      if (trimmed.length !== context.length) {
        removed = true;
        if (trimmed.length === 0) {
          await this.redis.del(this.contextKeyFor(channel, userId));
        } else {
          await this.redis.setex(this.contextKeyFor(channel, userId), CONTEXT_TTL_SEC, JSON.stringify(trimmed));
        }
      }
    }

    return removed;
  }

  async getConversationHistory(channel: Channel, userId: string): Promise<ChatMessage[]> {
    const key = this.contextKeyFor(channel, userId);
    const raw = await this.redis.get(key);
    if (!raw) {
      return [];
    }

    const parsed = this.parseConversationPayload(raw);
    if (parsed.dirty) {
      if (parsed.history.length === 0) {
        await this.redis.del(key);
      } else {
        await this.redis.setex(key, CONTEXT_TTL_SEC, JSON.stringify(parsed.history));
      }
    }
    return parsed.history;
  }

  async getAllActiveSessions(): Promise<HandoffSession[]> {
    const sessions: HandoffSession[] = [];
    let cursor = "0";

    do {
      const [nextCursor, keys] = await this.redis.scan(cursor, "MATCH", "handoff:*", "COUNT", 200);
      cursor = String(nextCursor);
      if (!Array.isArray(keys) || keys.length === 0) {
        continue;
      }

      const values = await this.redis.mget(keys);
      for (let i = 0; i < values.length; i += 1) {
        const value = values[i];
        const key = keys[i];
        if (!value) {
          continue;
        }
        const parsed = this.parseSessionPayload(value);
        if (!parsed.session) {
          continue;
        }
        sessions.push(parsed.session);
        if (parsed.dirty) {
          await this.redis.setex(key, this.ttlSec, JSON.stringify(parsed.session));
        }
      }
    } while (cursor !== "0");

    return sessions.sort((a, b) => b.requestedAtMs - a.requestedAtMs);
  }

  async healthCheck(): Promise<{ ok: boolean; detail: string }> {
    try {
      await this.redis.ping();
      return { ok: true, detail: "ok" };
    } catch (error) {
      return { ok: false, detail: String(error) };
    }
  }

  private parseSessionPayload(raw: string, fallbackChannel = "web" as Channel, fallbackUserId = ""): { session: HandoffSession | null; dirty: boolean } {
    try {
      const parsed = JSON.parse(raw);
      const channelRaw = String(parsed?.channel || fallbackChannel);
      const channel: Channel =
        channelRaw === "telegram" || channelRaw === "web" || channelRaw === "messenger" || channelRaw === "modernfashion_web"
          ? channelRaw
          : fallbackChannel;
      const userId = String(parsed?.userId || fallbackUserId || "").trim();
      if (!userId) {
        return { session: null, dirty: false };
      }

      const historyRaw = Array.isArray(parsed?.history) ? parsed.history : [];
      let dirty = !Array.isArray(parsed?.history);
      const history: ChatMessage[] = [];
      for (let i = 0; i < historyRaw.length; i += 1) {
        const normalized = this.normalizeMessage(historyRaw[i], i);
        if (!normalized.message) {
          if (historyRaw[i] !== null && historyRaw[i] !== undefined) {
            dirty = true;
          }
          continue;
        }
        dirty = dirty || normalized.dirty;
        history.push(normalized.message);
      }

      const requestedAtMs = Number(parsed?.requestedAtMs || Date.now());
      const lastMessageRaw = String(parsed?.lastMessage || "").trim();
      const computedLastMessage = this.findLastUserMessage(history) || lastMessageRaw;
      if (computedLastMessage !== lastMessageRaw) {
        dirty = true;
      }

      const session: HandoffSession = {
        channel,
        userId,
        requestedAtMs: Number.isFinite(requestedAtMs) && requestedAtMs > 0 ? requestedAtMs : Date.now(),
        lastMessage: computedLastMessage,
        lastDeliveredAgentTimestampMs:
          Number.isFinite(Number(parsed?.lastDeliveredAgentTimestampMs || 0)) && Number(parsed?.lastDeliveredAgentTimestampMs || 0) > 0
            ? Number(parsed.lastDeliveredAgentTimestampMs)
            : undefined,
        history,
      };
      return { session, dirty };
    } catch {
      return { session: null, dirty: false };
    }
  }

  private parseConversationPayload(raw: string): { history: ChatMessage[]; dirty: boolean } {
    try {
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) {
        return { history: [], dirty: true };
      }
      const history: ChatMessage[] = [];
      let dirty = false;
      for (let i = 0; i < parsed.length; i += 1) {
        const normalized = this.normalizeMessage(parsed[i], i);
        if (!normalized.message) {
          if (parsed[i] !== null && parsed[i] !== undefined) {
            dirty = true;
          }
          continue;
        }
        dirty = dirty || normalized.dirty;
        history.push(normalized.message);
      }
      return { history, dirty };
    } catch {
      return { history: [], dirty: true };
    }
  }

  private normalizeMessage(input: unknown, index: number): { message: ChatMessage | null; dirty: boolean } {
    const entry = (input || {}) as Record<string, unknown>;
    const roleRaw = String(entry.role || "").trim();
    const role: ChatRole | null = roleRaw === "user" || roleRaw === "bot" || roleRaw === "agent" ? roleRaw : null;
    const content = String(entry.content || "").trim();
    if (!role || !content) {
      return { message: null, dirty: true };
    }

    const timestampCandidate = Number(entry.timestampMs || 0);
    const timestampMs = Number.isFinite(timestampCandidate) && timestampCandidate > 0 ? timestampCandidate : Date.now();
    const providedId = String(entry.id || "").trim();
    const generatedId = `legacy-${timestampMs}-${index}`;
    const id = providedId || generatedId;
    const ui = this.sanitizeUi(entry.ui);

    return {
      message: {
        id,
        role,
        content,
        timestampMs,
        ...(ui ? { ui } : {}),
      },
      dirty: !providedId || timestampMs !== timestampCandidate || (!!entry.ui && !ui),
    };
  }

  private sanitizeUi(input: unknown): ChatMessageUi | undefined {
    const raw = (input || {}) as Record<string, unknown>;
    if (raw.type !== "menu") {
      return undefined;
    }

    const title = String(raw.title || "").trim();
    if (!title) {
      return undefined;
    }

    const itemsRaw = Array.isArray(raw.items) ? raw.items : [];
    const items: ChatUiItem[] = itemsRaw
      .map((entry) => {
        const item = (entry || {}) as Record<string, unknown>;
        const sku = String(item.sku || "").trim().toUpperCase();
        const name = String(item.name || "").trim();
        if (!sku || !name) {
          return null;
        }
        const category = String(item.category || "").trim() || undefined;
        return {
          sku,
          name,
          ...(category ? { category } : {}),
          priceVnd: Number(item.priceVnd || 0),
          stockQty: Number(item.stockQty || 0),
        };
      })
      .filter((entry): entry is ChatUiItem => Boolean(entry))
      .slice(0, 24);

    const suggestionsRaw = Array.isArray(raw.suggestions) ? raw.suggestions : [];
    const suggestions: ChatUiSuggestion[] = suggestionsRaw
      .map((entry) => {
        const suggestion = (entry || {}) as Record<string, unknown>;
        const label = String(suggestion.label || "").trim();
        const payload = String(suggestion.payload || "").trim();
        if (!label || !payload) {
          return null;
        }
        return { label, payload };
      })
      .filter((entry): entry is ChatUiSuggestion => Boolean(entry))
      .slice(0, 16);

    return {
      type: "menu",
      title,
      items,
      ...(suggestions.length ? { suggestions } : {}),
    };
  }

  private findLastUserMessage(history: ChatMessage[]): string {
    for (let i = history.length - 1; i >= 0; i -= 1) {
      const current = history[i];
      if (current.role === "user" && current.content.trim()) {
        return current.content.trim();
      }
    }
    return "";
  }

  private createMessage(role: ChatRole, content: string, ui?: ChatMessageUi): ChatMessage {
    const text = String(content || "").trim();
    return {
      id: randomUUID(),
      role,
      content: text,
      timestampMs: Date.now(),
      ...(ui ? { ui } : {}),
    };
  }

  private keyFor(channel: Channel, userId: string): string {
    return `handoff:${channel}:${userId}`;
  }

  private contextKeyFor(channel: Channel, userId: string): string {
    return `handoff_ctx:${channel}:${userId}`;
  }
}
