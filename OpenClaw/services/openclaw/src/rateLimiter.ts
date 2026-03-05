import { Redis } from "ioredis";
import { logger } from "./logger";

export type RateLimitResult = {
  allowed: boolean;
  retryAfterSec: number;
};

export type RateLimiterHealth = {
  mode: "memory" | "redis" | "auto";
  activeBackend: "memory" | "redis";
  degraded: boolean;
  ok: boolean;
  detail?: string;
};

export interface ChatRateLimiter {
  hit(key: string): Promise<RateLimitResult>;
  healthCheck(): Promise<RateLimiterHealth>;
}

export type ChatRateLimiterConfig = {
  mode: "memory" | "redis" | "auto";
  maxRequests: number;
  windowSec: number;
  redisHost?: string;
  redisPort?: number;
  redisPassword?: string;
  redisDb?: number;
  redisKeyPrefix?: string;
};

type InMemoryBucket = {
  count: number;
  resetAt: number;
};

function createInMemoryLimiter(maxRequests: number, windowSec: number) {
  const buckets = new Map<string, InMemoryBucket>();
  const windowMs = Math.max(1, windowSec) * 1000;

  function cleanup(now: number): void {
    if (buckets.size < 10_000) {
      return;
    }
    for (const [key, bucket] of buckets.entries()) {
      if (bucket.resetAt <= now) {
        buckets.delete(key);
      }
    }
  }

  return {
    hit(key: string): RateLimitResult {
      const now = Date.now();
      cleanup(now);
      const current = buckets.get(key);
      if (!current || current.resetAt <= now) {
        buckets.set(key, { count: 1, resetAt: now + windowMs });
        return { allowed: true, retryAfterSec: 0 };
      }

      current.count += 1;
      if (current.count <= maxRequests) {
        return { allowed: true, retryAfterSec: 0 };
      }

      const retryAfterSec = Math.max(1, Math.ceil((current.resetAt - now) / 1000));
      return { allowed: false, retryAfterSec };
    },
  };
}

function createRedisLimiter(config: {
  host: string;
  port: number;
  password?: string;
  db: number;
  keyPrefix: string;
  maxRequests: number;
  windowSec: number;
}) {
  const redis = new Redis({
    host: config.host,
    port: config.port,
    password: config.password || undefined,
    db: config.db,
    lazyConnect: false,
    maxRetriesPerRequest: 1,
    enableOfflineQueue: false,
  });

  redis.on("error", (error) => {
    logger.warn({ error: String(error) }, "redis rate limiter connection error");
  });

  return {
    async hit(key: string): Promise<RateLimitResult> {
      const windowSec = Math.max(1, config.windowSec);
      const windowId = Math.floor(Date.now() / (windowSec * 1000));
      const redisKey = `${config.keyPrefix}:${windowId}:${key}`;

      const count = await redis.incr(redisKey);
      let ttl = await redis.ttl(redisKey);
      if (ttl <= 0) {
        await redis.expire(redisKey, windowSec + 1);
        ttl = windowSec + 1;
      }

      if (count <= config.maxRequests) {
        return { allowed: true, retryAfterSec: 0 };
      }

      return {
        allowed: false,
        retryAfterSec: Math.max(1, ttl),
      };
    },

    async ping(): Promise<void> {
      await redis.ping();
    },
  };
}

export function createChatRateLimiter(config: ChatRateLimiterConfig): ChatRateLimiter {
  const memoryLimiter = createInMemoryLimiter(config.maxRequests, config.windowSec);
  const mode = config.mode;

  const shouldEnableRedis = mode === "redis" || mode === "auto";
  const redisHost = config.redisHost || process.env.REDIS_HOST || "lowland_redis";
  const redisPort = Number(config.redisPort || process.env.REDIS_PORT || 6379);
  const redisDb = Number.isFinite(Number(config.redisDb)) ? Number(config.redisDb) : 0;
  const redisKeyPrefix = config.redisKeyPrefix || "openclaw:chatrl";

  const redisLimiter = shouldEnableRedis
    ? createRedisLimiter({
        host: redisHost,
        port: redisPort,
        password: config.redisPassword,
        db: redisDb,
        keyPrefix: redisKeyPrefix,
        maxRequests: config.maxRequests,
        windowSec: config.windowSec,
      })
    : null;

  let activeBackend: "memory" | "redis" = mode === "memory" || !redisLimiter ? "memory" : "redis";
  let degradedReason = mode === "memory" ? "" : redisLimiter ? "" : "redis_limiter_not_available";

  return {
    async hit(key: string): Promise<RateLimitResult> {
      if (mode === "memory" || !redisLimiter) {
        activeBackend = "memory";
        return memoryLimiter.hit(key);
      }

      try {
        const result = await redisLimiter.hit(key);
        activeBackend = "redis";
        degradedReason = "";
        return result;
      } catch (error) {
        activeBackend = "memory";
        degradedReason = String(error);
        logger.warn({ error: degradedReason, key }, "redis limiter failed, fallback to memory limiter");
        return memoryLimiter.hit(key);
      }
    },

    async healthCheck(): Promise<RateLimiterHealth> {
      if (mode === "memory" || !redisLimiter) {
        return {
          mode,
          activeBackend: "memory",
          degraded: false,
          ok: true,
          detail: mode === "memory" ? "memory_only" : degradedReason || "memory_fallback",
        };
      }

      try {
        await redisLimiter.ping();
        return {
          mode,
          activeBackend,
          degraded: activeBackend !== "redis",
          ok: true,
          detail: activeBackend === "redis" ? "redis_ok" : "redis_ok_using_memory_fallback",
        };
      } catch (error) {
        return {
          mode,
          activeBackend: "memory",
          degraded: true,
          ok: mode === "auto",
          detail: String(error),
        };
      }
    },
  };
}
