import { beforeEach, describe, expect, it, vi } from "vitest";

type StoredItem = {
  value: string;
  expiresAtMs: number;
};

const { mockStore, MockRedis } = vi.hoisted(() => {
  const store = new Map<string, StoredItem>();

  class RedisMock {
    async setex(key: string, ttlSec: number, value: string): Promise<"OK"> {
      store.set(key, { value, expiresAtMs: Date.now() + ttlSec * 1000 });
      return "OK";
    }

    async del(key: string): Promise<number> {
      return store.delete(key) ? 1 : 0;
    }

    async exists(key: string): Promise<number> {
      this.cleanupExpired();
      return store.has(key) ? 1 : 0;
    }

    async get(key: string): Promise<string | null> {
      this.cleanupExpired();
      return store.get(key)?.value ?? null;
    }

    async mget(keys: string[]): Promise<Array<string | null>> {
      this.cleanupExpired();
      return keys.map((key) => store.get(key)?.value ?? null);
    }

    async keys(pattern: string): Promise<string[]> {
      this.cleanupExpired();
      if (pattern === "handoff:*") {
        return Array.from(store.keys()).filter((key) => key.startsWith("handoff:"));
      }
      return Array.from(store.keys());
    }

    async ping(): Promise<"PONG"> {
      return "PONG";
    }

    private cleanupExpired(): void {
      const now = Date.now();
      for (const [key, item] of store.entries()) {
        if (item.expiresAtMs <= now) {
          store.delete(key);
        }
      }
    }
  }

  return { mockStore: store, MockRedis: RedisMock };
});

vi.mock("ioredis", () => ({ Redis: MockRedis }));

import { HandoffStore } from "../src/handoffStore";

describe("HandoffStore", () => {
  beforeEach(() => {
    mockStore.clear();
  });

  it("activates and releases sessions", async () => {
    const store = new HandoffStore(60);
    expect(await store.isActive("web", "u1")).toBe(false);

    await store.activate("web", "u1", "gap nhan vien");
    expect(await store.isActive("web", "u1")).toBe(true);

    expect(await store.release("web", "u1")).toBe(true);
    expect(await store.isActive("web", "u1")).toBe(false);
  });

  it("expires sessions by ttl", async () => {
    vi.useFakeTimers();
    try {
      const store = new HandoffStore(1);
      await store.activate("messenger", "u2", "ho tro");
      expect(await store.isActive("messenger", "u2")).toBe(true);

      vi.advanceTimersByTime(1001);
      expect(await store.isActive("messenger", "u2")).toBe(false);
    } finally {
      vi.useRealTimers();
    }
  });
});
