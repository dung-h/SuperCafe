import { describe, expect, it, vi } from "vitest";
import { createChatRateLimiter } from "../src/rateLimiter";

describe("chat rate limiter", () => {
  it("limits requests in memory mode", async () => {
    const limiter = createChatRateLimiter({
      mode: "memory",
      maxRequests: 2,
      windowSec: 30,
    });

    expect((await limiter.hit("web:u1")).allowed).toBe(true);
    expect((await limiter.hit("web:u1")).allowed).toBe(true);
    const third = await limiter.hit("web:u1");
    expect(third.allowed).toBe(false);
    expect(third.retryAfterSec).toBeGreaterThan(0);
  });

  it("resets memory window after expiry", async () => {
    vi.useFakeTimers();
    try {
      const limiter = createChatRateLimiter({
        mode: "memory",
        maxRequests: 1,
        windowSec: 2,
      });

      expect((await limiter.hit("messenger:u2")).allowed).toBe(true);
      expect((await limiter.hit("messenger:u2")).allowed).toBe(false);
      vi.advanceTimersByTime(2100);
      expect((await limiter.hit("messenger:u2")).allowed).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });
});
