import { Redis } from "ioredis";

type Channel = "telegram" | "web" | "messenger";

export type ChatMessage = {
  role: "user" | "agent";
  content: string;
  timestampMs: number;
};

export type HandoffSession = {
  channel: Channel;
  userId: string;
  requestedAtMs: number;
  lastMessage: string;
  history: ChatMessage[];
};

const DEFAULT_TTL_SEC = 30 * 60; // 30 mins

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
    const session: HandoffSession = {
      channel,
      userId,
      requestedAtMs: Date.now(),
      lastMessage,
      history: [{ role: "user", content: lastMessage, timestampMs: Date.now() }],
    };
    await this.redis.setex(key, this.ttlSec, JSON.stringify(session));
  }

  async release(channel: Channel, userId: string): Promise<boolean> {
    const key = this.keyFor(channel, userId);
    const deleted = await this.redis.del(key);
    return deleted > 0;
  }

  async isActive(channel: Channel, userId: string): Promise<boolean> {
    const key = this.keyFor(channel, userId);
    const exists = await this.redis.exists(key);
    return exists > 0;
  }

  async getSession(channel: Channel, userId: string): Promise<HandoffSession | null> {
    const key = this.keyFor(channel, userId);
    const data = await this.redis.get(key);
    if (!data) return null;
    return JSON.parse(data) as HandoffSession;
  }

  async appendMessage(channel: Channel, userId: string, role: "user" | "agent", content: string): Promise<void> {
    const session = await this.getSession(channel, userId);
    if (!session) return;

    session.history.push({ role, content, timestampMs: Date.now() });
    if (role === "user") {
      session.lastMessage = content;
    }

    // Keep max 50 messages to avoid huge keys
    if (session.history.length > 50) {
      session.history = session.history.slice(-50);
    }

    const key = this.keyFor(channel, userId);
    await this.redis.setex(key, this.ttlSec, JSON.stringify(session));
  }

  async getAllActiveSessions(): Promise<HandoffSession[]> {
    const keys = await this.redis.keys("handoff:*");
    if (!keys || keys.length === 0) return [];

    const values = await this.redis.mget(keys);
    const sessions: HandoffSession[] = [];

    for (const val of values) {
      if (val) {
        sessions.push(JSON.parse(val) as HandoffSession);
      }
    }

    return sessions.sort((a, b) => b.requestedAtMs - a.requestedAtMs);
  }

  private keyFor(channel: Channel, userId: string): string {
    return `handoff:${channel}:${userId}`;
  }
}
