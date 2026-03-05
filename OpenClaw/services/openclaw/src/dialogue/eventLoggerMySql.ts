import type { Pool } from "mysql2/promise";
import { logger } from "../logger";
import type { DialogueEventLog } from "./types";

export class DialogueEventLoggerMySql {
  constructor(private readonly pool: Pool) {}

  async log(event: DialogueEventLog): Promise<void> {
    try {
      await this.pool.query(
        `INSERT INTO chat_dialogue_events (
          channel, user_id, correlation_id, role, input_text, action_payload,
          source_message_id, locale, intent, state_before, state_after, tool_calls_json, latency_ms
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          event.channel,
          event.userId,
          event.correlationId,
          event.role,
          event.inputText ?? null,
          event.actionPayload ?? null,
          event.sourceMessageId ?? null,
          event.locale ?? null,
          event.intent ?? null,
          event.stateBefore ?? null,
          event.stateAfter ?? null,
          event.toolCallsJson ?? null,
          event.latencyMs ?? null,
        ],
      );
    } catch (error) {
      logger.warn({ error: String(error), event }, "failed to write chat_dialogue_events");
    }
  }
}
