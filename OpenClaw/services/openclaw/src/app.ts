import { randomUUID } from "node:crypto";
import express from "express";
import { Redis } from "ioredis";
import type { Pool } from "mysql2/promise";
import pinoHttp from "pino-http";
import { z } from "zod";
import { buildBackend, type BackendChannel } from "./backends";
import { type ClassifyResult, HttpClient, parseClassifierJson } from "./clients";
import type { OpenClawConfig } from "./config";
import { DialogueEventLoggerMySql } from "./dialogue/eventLoggerMySql";
import { DialoguePolicyEngine } from "./dialogue/policyEngine";
import { CustomerProfileStoreMySql, type UpsertCustomerProfileInput } from "./dialogue/customerProfileStoreMySql";
import { DialogueStateStoreMySql } from "./dialogue/stateStoreMySql";
import type { DialogueEventLog, UiSuggestion } from "./dialogue/types";
import { HandoffStore, type ChatMessage, type ChatMessageUi, type ChatUiSuggestion } from "./handoffStore";
import { LlmClient } from "./llmClient";
import { logger } from "./logger";
import { createChatRateLimiter, type RateLimiterHealth } from "./rateLimiter";

type ChatChannel = "telegram" | "web" | "messenger" | "modernfashion_web";

type ChatRequest = {
  userId: string;
  message: string;
  actionPayload?: string;
  correlationId?: string;
  channel?: ChatChannel;
  clientContext?: {
    sourceMessageId?: string;
    locale?: string;
  };
  profile?: {
    name?: string;
    phone?: string;
    address?: string;
  };
  adminBypassHandoff?: boolean;
};

type IntentResult = ClassifyResult & {
  category?: string;
  confidence?: number;
};

type MenuUiItem = {
  sku: string;
  name: string;
  category?: string;
  priceVnd: number;
  stockQty: number;
};

type ChatMenuUi = {
  type: "menu";
  title: string;
  items: MenuUiItem[];
  suggestions?: Array<string | UiSuggestion>;
};

type HandoffClientMessage = {
  id: string;
  role: "user" | "bot" | "agent";
  content: string;
  timestampMs: number;
  ui?: ChatMenuUi;
};

type ChatResult = {
  reply: string;
  alerts?: string[];
  state?: {
    name: string;
    missingFields: string[];
  };
  ui?: ChatMenuUi;
  handoff?: {
    active: boolean;
    history?: HandoffClientMessage[];
  };
};

type DialogueChatExecution = {
  chat: ChatResult;
  intent?: string;
};

const chatSchema = z.object({
  userId: z.string().min(1),
  message: z.string().optional().default(""),
  actionPayload: z.preprocess((value) => (value === null ? undefined : value), z.string().max(255).optional()),
  correlationId: z.string().optional(),
  channel: z.enum(["telegram", "web", "messenger", "modernfashion_web"]).optional(),
  clientContext: z
    .object({
      sourceMessageId: z.string().optional(),
      locale: z.string().optional(),
    })
    .optional(),
  profile: z
    .object({
      name: z.string().optional(),
      phone: z.string().optional(),
      address: z.string().optional(),
    })
    .optional(),
  adminBypassHandoff: z.boolean().optional().default(false),
}).superRefine((value, ctx) => {
  const hasMessage = value.message.trim().length > 0;
  const hasAction = (value.actionPayload || "").trim().length > 0;
  if (!hasMessage && !hasAction) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "message or actionPayload is required",
      path: ["message"],
    });
  }
});

const kpiSchema = z.object({
  windowMinutes: z.coerce.number().int().min(5).max(7 * 24 * 60).default(60),
});

const profileQuerySchema = z.object({
  channel: z.enum(["telegram", "web", "messenger", "modernfashion_web"]),
  userId: z.string().min(1),
});

const opsSummaryQuerySchema = z.object({
  windowMinutes: z.coerce.number().int().min(5).max(24 * 60).default(60),
});

const KPI_ACTION_ERROR_INTENTS = [
  "wizard_invalid_input",
  "invalid_phone",
  "invalid_address",
  "order_next_missing_items",
  "order_next_missing_name",
  "order_next_missing_phone",
  "order_next_missing_address",
  "order_next_missing_payment",
  "order_confirm_missing",
  "order_create_failed",
  "order_status_missing_code",
] as const;

function isHealthRoute(url?: string): boolean {
  if (!url) {
    return false;
  }
  return url.startsWith("/health") || url.startsWith("/ready");
}

export function createApp(config: OpenClawConfig) {
  const app = express();
  const toolHttpClient = new HttpClient(config.timeoutMs);
  const llmHttpClient = new HttpClient(config.llmTimeoutMs);
  const llmClient = new LlmClient(config, llmHttpClient);
  const handoffStore = new HandoffStore();
  const messengerOpsRedis = config.messengerQueueAlertEnabled
    ? new Redis({
        host: config.messengerRedisHost,
        port: config.messengerRedisPort,
        password: config.messengerRedisPass,
        db: config.messengerRedisDb,
        lazyConnect: true,
        maxRetriesPerRequest: 1,
        enableOfflineQueue: false,
      })
    : null;
  if (messengerOpsRedis) {
    messengerOpsRedis.on("error", (error) => {
      logger.warn({ error: String(error) }, "messenger ops redis error");
    });
  }
  const chatRateLimiter = createChatRateLimiter({
    mode: config.chatRateLimitBackend,
    maxRequests: config.chatRateLimitMax,
    windowSec: config.chatRateLimitWindowSec,
    redisHost: config.chatRateLimitRedisHost,
    redisPort: config.chatRateLimitRedisPort,
    redisPassword: config.chatRateLimitRedisPass,
    redisDb: config.chatRateLimitRedisDb,
    redisKeyPrefix: config.chatRateLimitRedisKeyPrefix,
  });
  const dialogueStateStore = config.dialogEngineV2Enabled ? new DialogueStateStoreMySql(config) : null;
  const dialogueEventLogger = dialogueStateStore ? new DialogueEventLoggerMySql(dialogueStateStore.getPool()) : null;
  const customerProfileStore = dialogueStateStore ? new CustomerProfileStoreMySql(dialogueStateStore.getPool()) : null;

  if (dialogueStateStore) {
    dialogueStateStore.startCleanupJob();
  }
  if (customerProfileStore) {
    customerProfileStore.ensureSchema().catch((error) => {
      logger.error({ error: String(error) }, "customer profile schema ensure failed");
    });
  }

  app.use(express.json({ limit: "1mb" }));
  app.use(
    pinoHttp({
      logger,
      genReqId: (req) => (req.headers["x-correlation-id"] as string) || randomUUID(),
      autoLogging: {
        ignore: (req) => req.method === "GET" && isHealthRoute(req.url),
      },
      customLogLevel: (_req, res, err) => {
        if (err || res.statusCode >= 500) {
          return "error";
        }
        if (res.statusCode >= 400) {
          return "warn";
        }
        return "info";
      },
    }),
  );

  app.get("/health", (_req, res) => {
    res.json({ status: "ok", service: "openclaw" });
  });

  app.get("/admin/kpi/summary", async (req, res) => {
    if (!dialogueStateStore) {
      res.status(503).json({ ok: false, error: "Dialogue engine v2 is disabled" });
      return;
    }

    try {
      const query = kpiSchema.parse(req.query);
      const summary = await buildKpiSummary(dialogueStateStore.getPool(), query.windowMinutes);
      res.json({ ok: true, data: summary });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      req.log.error({ error: message }, "openclaw kpi summary failed");
      res.status(500).json({ ok: false, error: message });
    }
  });

  app.get("/admin/ops/summary", async (req, res) => {
    try {
      const query = opsSummaryQuerySchema.parse(req.query);
      const summary = await buildOpsSummary({
        config,
        messengerOpsRedis,
        dialoguePool: dialogueStateStore?.getPool() || null,
        handoffStore,
        rateLimiterHealth: await chatRateLimiter.healthCheck(),
        windowMinutes: query.windowMinutes,
      });
      res.json({ ok: true, data: summary });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      req.log.error({ error: message }, "openclaw ops summary failed");
      res.status(500).json({ ok: false, error: message });
    }
  });

  app.post("/chat", async (req, res) => {
    try {
      const payload = chatSchema.parse(req.body) as ChatRequest;
      const correlationId = payload.correlationId ?? randomUUID();
      const channel = payload.channel ?? "telegram";
      const messageText = payload.message.trim();
      const actionPayload = (payload.actionPayload || "").trim() || undefined;
      const inboundText = legacyTextFromAction(messageText, actionPayload);
      const adminBypassHandoff = Boolean(payload.adminBypassHandoff);
      const requestedResume = isHandoffResumeSignal(messageText, actionPayload);
      const handoffStatusPing = (actionPayload || "").toUpperCase() === "ACTION_HANDOFF_STATUS";
      const rateKey = `${channel}:${payload.userId}`;
      const rateLimit = await chatRateLimiter.hit(rateKey);
      if (!rateLimit.allowed) {
        req.log.warn(
          {
            key: rateKey,
            retryAfterSeconds: rateLimit.retryAfterSec,
            maxRequests: config.chatRateLimitMax,
            windowSec: config.chatRateLimitWindowSec,
          },
          "chat rate limited",
        );
        res.setHeader("Retry-After", String(rateLimit.retryAfterSec));
        res.status(429).json({
          ok: false,
          error: "Too many requests. Please retry later.",
          retryAfterSeconds: rateLimit.retryAfterSec,
        });
        return;
      }

      if (!adminBypassHandoff && !handoffStatusPing && inboundText.trim().length > 0) {
        await handoffStore.appendConversation(channel, payload.userId, "user", inboundText);
      }

      if (!adminBypassHandoff && await handoffStore.isActive(channel, payload.userId)) {
        if (!requestedResume) {
          if (!handoffStatusPing && inboundText.trim().length > 0) {
            await handoffStore.appendMessage(channel, payload.userId, "user", inboundText);
          }
          const pendingAgentMessage = await handoffStore.consumeLatestAgentMessage(channel, payload.userId);
          const includeHistory = handoffStatusPing || Boolean(pendingAgentMessage);
          const sessionSnapshot = includeHistory ? await handoffStore.getSession(channel, payload.userId) : null;
          const handoffData = {
            active: true,
            ...(includeHistory ? { history: serializeHandoffHistory(sessionSnapshot?.history || []) } : {}),
          };
          if (pendingAgentMessage?.content) {
            res.json({
              ok: true,
              data: normalizeChatResult({
                reply: pendingAgentMessage.content,
                ui: pendingAgentMessage.ui
                  ? toRuntimeMenuUi(pendingAgentMessage.ui)
                  : {
                      type: "menu",
                      title: "Hỗ trợ trực tiếp",
                      items: [],
                      suggestions: ["Tiếp tục với bot", "Xem menu"],
                    },
                handoff: handoffData,
              }),
            });
            return;
          }
          const waiting = buildHandoffWaitingReply(channel);
          res.json({
            ok: true,
            data: normalizeChatResult({
              ...waiting,
              handoff: handoffData,
            }),
          });
          return;
        }
      }

      if (adminBypassHandoff && handoffStatusPing) {
        res.json({
          ok: true,
          data: normalizeChatResult({
            reply: "Không thể kiểm tra trạng thái handoff ở chế độ bypass admin.",
            ui: {
              type: "menu",
              title: "Handoff status",
              items: [],
              suggestions: ["Tiếp tục với bot", "Xem menu"],
            },
          }),
        });
        return;
      }

      const backend = buildBackend(channel as BackendChannel, config, toolHttpClient);
      let result: ChatResult | null = null;
      let resolvedIntent: string | undefined;

      if (config.dialogEngineV2Enabled && dialogueStateStore && dialogueEventLogger) {
        try {
          const execution = await handleWithDialogueEngine(
            config,
            llmClient,
            dialogueStateStore,
            dialogueEventLogger,
            customerProfileStore,
            backend,
            {
              ...payload,
              message: messageText || actionPayload || "",
              actionPayload,
              channel,
              correlationId,
            },
          );
          result = execution.chat;
          resolvedIntent = execution.intent;
        } catch (error) {
          req.log.error({ error: String(error) }, "dialogue engine v2 failed; fallback to legacy");
        }
      }

      if (!result) {
        const legacyPayload: ChatRequest = {
          ...payload,
          message: inboundText,
          actionPayload,
          channel,
          adminBypassHandoff,
        };
        const classification = await classifyIntent(llmClient, inboundText);
        result = await handleIntent(config, llmClient, backend, legacyPayload, classification, correlationId);
        resolvedIntent = classification.intent;
      }

      const storedBotUi = toStoredMenuUi(result.ui);
      const hasBotReply = result.reply.trim().length > 0;

      if (!adminBypassHandoff && hasBotReply) {
        await handoffStore.appendConversation(channel, payload.userId, "bot", result.reply, storedBotUi);
      }

      if (!adminBypassHandoff) {
        if (resolvedIntent === "handoff_request") {
          await handoffStore.activate(channel, payload.userId, inboundText);
        } else if (resolvedIntent === "handoff_resume" || requestedResume) {
          await handoffStore.release(channel, payload.userId);
        }
      }

      if (!adminBypassHandoff) {
        await dispatchAdminAlerts(config, result.alerts, channel);
      }
      res.json({ ok: true, data: normalizeChatResult(result) });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      req.log.error({ error: message }, "openclaw chat failed");
      res.status(500).json({ ok: false, error: message });
    }
  });

  app.get("/admin/handoff", async (req, res) => {
    try {
      const activeSessions = await handoffStore.getAllActiveSessions();
      res.json({ ok: true, data: activeSessions });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      res.status(500).json({ ok: false, error: message });
    }
  });

  const sessionIdentitySchema = z.object({
    channel: z.enum(["telegram", "web", "messenger", "modernfashion_web"]),
    userId: z.string().min(1),
  });

  app.get("/admin/handoff/session", async (req, res) => {
    try {
      const query = sessionIdentitySchema.parse(req.query);
      const session = await handoffStore.getSession(query.channel, query.userId);
      if (!session) {
        res.status(404).json({ ok: false, error: "Handoff session not active" });
        return;
      }
      res.json({ ok: true, data: session });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      res.status(500).json({ ok: false, error: message });
    }
  });

  const deleteMessageSchema = sessionIdentitySchema.extend({
    messageId: z.string().min(1),
  });

  app.post("/admin/handoff/message/delete", async (req, res) => {
    try {
      const payload = deleteMessageSchema.parse(req.body);
      const removed = await handoffStore.deleteMessage(payload.channel, payload.userId, payload.messageId);
      if (!removed) {
        res.status(404).json({ ok: false, error: "Message not found" });
        return;
      }
      res.json({ ok: true });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      res.status(500).json({ ok: false, error: message });
    }
  });

  const deleteSessionSchema = sessionIdentitySchema.extend({
    deleteContext: z.boolean().optional().default(true),
  });

  app.post("/admin/handoff/session/delete", async (req, res) => {
    try {
      const payload = deleteSessionSchema.parse(req.body);
      const deleted = await handoffStore.deleteSession(payload.channel, payload.userId, payload.deleteContext);
      if (!deleted) {
        res.status(404).json({ ok: false, error: "Session not found" });
        return;
      }
      res.json({ ok: true });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      res.status(500).json({ ok: false, error: message });
    }
  });

  app.get("/admin/profile", async (req, res) => {
    if (!customerProfileStore) {
      res.status(503).json({ ok: false, error: "Dialogue engine v2 is disabled" });
      return;
    }
    try {
      const query = profileQuerySchema.parse(req.query);
      const profile = await customerProfileStore.getByIdentity(query.channel, query.userId);
      res.json({ ok: true, data: profile });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      req.log.error({ error: message }, "admin profile fetch failed");
      res.status(500).json({ ok: false, error: message });
    }
  });

  const replySuggestionSchema = z.object({
    label: z.string().min(1).max(64),
    payload: z.string().min(1).max(255),
  });

  const replyItemSchema = z.object({
    sku: z.string().min(1).max(64),
    name: z.string().min(1).max(120),
    category: z.string().max(80).optional(),
    priceVnd: z.coerce.number().min(0),
    stockQty: z.coerce.number().min(0),
  });

  const replyUiSchema = z.object({
    type: z.literal("menu"),
    title: z.string().min(1).max(120),
    items: z.array(replyItemSchema).max(24),
    suggestions: z.array(replySuggestionSchema).max(16).optional(),
  });

  const replySchema = z.object({
    channel: z.enum(["telegram", "web", "messenger", "modernfashion_web"]),
    userId: z.string().min(1),
    message: z.string().min(1),
    ui: replyUiSchema.optional(),
  });

  app.post("/admin/handoff/reply", async (req, res) => {
    try {
      const payload = replySchema.parse(req.body);
      const session = await handoffStore.getSession(payload.channel, payload.userId);
      if (!session) {
        res.status(404).json({ ok: false, error: "Handoff session not active" });
        return;
      }

      const uiPayload = payload.ui ? toStoredMenuUi(payload.ui) : undefined;
      await handoffStore.appendMessage(payload.channel, payload.userId, "agent", payload.message, uiPayload);
      await handoffStore.appendConversation(payload.channel, payload.userId, "agent", payload.message, uiPayload);

      if (payload.channel === "telegram" && config.telegramToken) {
        const tgRes = await fetch(`https://api.telegram.org/bot${config.telegramToken}/sendMessage`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ chat_id: payload.userId, text: payload.message }),
        });
        if (!tgRes.ok) {
          req.log.error({ status: tgRes.status, body: await tgRes.text() }, "Telegram sendMessage failed");
        }
      } else if (payload.channel === "messenger" && config.messengerToken) {
        const fbRes = await fetch(`https://graph.facebook.com/v21.0/me/messages?access_token=${config.messengerToken}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            recipient: { id: payload.userId },
            message: { text: payload.message },
          }),
        });
        if (!fbRes.ok) {
          req.log.error({ status: fbRes.status, body: await fbRes.text() }, "Messenger sendMessage failed");
        }
      }

      res.json({ ok: true });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      req.log.error({ error: message }, "admin handoff reply failed");
      res.status(500).json({ ok: false, error: message });
    }
  });

  return app;
}

async function handleWithDialogueEngine(
  config: OpenClawConfig,
  llmClient: LlmClient,
  stateStore: DialogueStateStoreMySql,
  eventLogger: DialogueEventLoggerMySql,
  profileStore: CustomerProfileStoreMySql | null,
  backend: ReturnType<typeof buildBackend>,
  payload: ChatRequest & { channel: ChatChannel; correlationId: string },
): Promise<DialogueChatExecution> {
  const startedAt = Date.now();
  const session = await stateStore.loadSession(payload.channel, payload.userId);
  const engine = new DialoguePolicyEngine(config, backend);

  const userEvent: DialogueEventLog = {
    channel: payload.channel,
    userId: payload.userId,
    correlationId: payload.correlationId,
    role: "user",
    inputText: payload.message,
    actionPayload: payload.actionPayload,
    sourceMessageId: payload.clientContext?.sourceMessageId,
    locale: payload.clientContext?.locale,
    stateBefore: session.state,
  };
  await eventLogger.log(userEvent);

  const result = await engine.run(
    {
      userId: payload.userId,
      channel: payload.channel,
      correlationId: payload.correlationId,
      message: payload.message,
      actionPayload: payload.actionPayload,
      profile: payload.profile,
    },
    session,
  );

  let reply: ChatResult["reply"] = result.reply;
  let alerts: ChatResult["alerts"] = result.alerts;
  let ui: ChatResult["ui"] = result.ui;
  let intent = result.intent;
  let confidence = result.confidence ?? 0.9;
  const toolCalls = [...(result.toolCalls || [])];

  if (shouldRunHybridAssist(config, result.intent, confidence, session.state, payload.message, payload.actionPayload)) {
    try {
      const assisted = await runHybridAssist(config, llmClient, backend, payload);
      if (assisted) {
        reply = assisted.reply;
        alerts = assisted.alerts;
        ui = assisted.ui;
        intent = assisted.intent;
        confidence = assisted.confidence;
        for (const tag of assisted.toolCalls) {
          toolCalls.push(tag);
        }
      }
    } catch {
      // Keep deterministic FSM result when hybrid assist fails.
    }
  }

  await stateStore.saveSession(payload.channel, payload.userId, result.nextState, result.nextContext);
  toolCalls.push(`policy_confidence:${confidence.toFixed(2)}`);

  if (profileStore) {
    try {
      const profileInput = buildProfileUpsertInput(payload, session, result, intent);
      await profileStore.upsertFromInteraction(profileInput);
    } catch (error) {
      logger.warn({ error: String(error), userId: payload.userId, channel: payload.channel }, "customer profile upsert failed");
    }
  }

  const latencyMs = Date.now() - startedAt;
  const botEvent: DialogueEventLog = {
    channel: payload.channel,
    userId: payload.userId,
    correlationId: payload.correlationId,
    role: "bot",
    inputText: reply,
    actionPayload: payload.actionPayload,
    sourceMessageId: payload.clientContext?.sourceMessageId,
    locale: payload.clientContext?.locale,
    intent,
    stateBefore: session.state,
    stateAfter: result.nextState,
    toolCallsJson: toolCalls.length ? JSON.stringify(toolCalls) : undefined,
    latencyMs,
  };
  await eventLogger.log(botEvent);

  return {
    chat: {
      reply,
      alerts,
      ui,
      state: result.state,
    },
    intent,
  };
}

function shouldRunHybridAssist(
  config: OpenClawConfig,
  policyIntent: string | undefined,
  policyConfidence: number,
  stateBefore: string,
  message: string,
  actionPayload?: string,
): boolean {
  if (!config.dialogHybridAssistEnabled) {
    return false;
  }
  if (policyIntent !== "fallback" && policyIntent !== "wizard_invalid_input") {
    return false;
  }
  if (policyConfidence >= config.dialogHybridAssistThreshold) {
    return false;
  }
  if ((actionPayload || "").trim().length > 0) {
    return false;
  }
  if (message.trim().length < 2) {
    return false;
  }
  return stateBefore === "IDLE" || stateBefore === "BROWSING_MENU";
}

function isGenericFallbackReply(reply: string): boolean {
  const normalized = normalizeVietnamese(reply);
  return (
    normalized.includes("chua co thong tin") ||
    normalized.includes("de lai cau hoi cu the hon") ||
    normalized.includes("khong co thong tin chinh xac")
  );
}

async function classifyIntent(llmClient: LlmClient, message: string): Promise<IntentResult> {
  const normalized = normalizeVietnamese(message);
  const upperRaw = message.toUpperCase();
  const orderCode = upperRaw.match(/ORD-\d{8}-\d{4}/)?.[0];
  const sku = message.toUpperCase().match(/[A-Z]{2,}-[A-Z0-9-]{2,}/)?.[0];
  const category = inferCategoryFromMessage(normalized);

  if (containsAny(normalized, ["xin chao", "chao", "hello", "hi", "alo", "hey"]) && normalized.length <= 24) {
    return { intent: "greeting", confidence: 0.95 };
  }

  if (
    containsAny(normalized, [
      "ban lam duoc gi",
      "bot lam duoc gi",
      "lam duoc gi",
      "co the lam gi",
      "giup duoc gi",
      "kha nang",
      "huong dan su dung",
      "tro giup",
      "help",
      "support",
      "lenh",
      "cach dat hang",
    ])
  ) {
    return { intent: "bot_help", confidence: 0.95 };
  }

  if (containsAny(normalized, [
    "gap nhan vien",
    "tu van vien",
    "ho tro vien",
    "nguoi that",
    "noi chuyen nguoi that",
    "human support",
    "live agent",
    "support staff",
  ])) {
    return { intent: "handoff_request", confidence: 0.95 };
  }

  if (containsAny(normalized, [
    "tiep tuc voi bot",
    "bat lai bot",
    "tro lai bot",
    "resume bot",
    "ket thuc ho tro",
  ])) {
    return { intent: "handoff_resume", confidence: 0.95 };
  }

  if (containsAny(normalized, ["bao quan", "han su dung", "co duong", "doi tra", "giao hang", "nhiet do", "thanh phan"])) {
    return { intent: "faq", sku, confidence: 0.9 };
  }

  if (containsAny(normalized, ["gio mo cua", "mo cua", "dong cua", "dia chi", "o dau", "hotline", "so dien thoai", "email", "lien he"])) {
    return { intent: "faq", sku, confidence: 0.9 };
  }

  if (containsAny(normalized, [
    "menu",
    "do uong",
    "thuc uong",
    "san pham",
    "danh sach",
    "product",
    "products",
    "mon nao",
    "mon gi",
    "co mon gi",
    "co cac mon nao",
    "co nhung mon nao",
    "co gi uong",
    "goi y mon",
    "dat mon",
    "dat nuoc",
    "mua nuoc",
    "oder",
    "order",
    "dat hang",
    "mua hang",
  ])) {
    const stripped = normalized
      .replace(
        /\b(cho toi|cho minh|toi muon|minh muon|xem|danh sach|menu|do uong|thuc uong|san pham|products?|mon nao|mon gi|co mon gi|co cac mon nao|co nhung mon nao|co gi uong|goi y mon|dat mon|dat nuoc|mua nuoc|oder|order|dat hang|mua hang)\b/g,
        " ",
      )
      .replace(/\s+/g, " ")
      .trim();
    return { intent: "catalog_list", query: stripped.length >= 2 ? stripped : undefined, category, confidence: 0.85 };
  }

  if (category && normalized.length <= 20 && !/\d/.test(normalized)) {
    return { intent: "catalog_list", category, confidence: 0.8 };
  }

  if (/\b(chi tiet|thong tin|product)\b/.test(normalized) && sku) {
    return { intent: "catalog_get", sku, confidence: 0.85 };
  }

  if (/\b(ma don|order status|tinh trang don|kiem tra don|kiem tra don hang)\b/.test(normalized)) {
    return { intent: "order_get", orderCode, confidence: 0.85 };
  }

  if (/\b(thanh toan|chuyen khoan|payment|huong dan thanh toan)\b/.test(normalized)) {
    return { intent: "payment_help", orderCode, confidence: 0.85 };
  }

  if (/\b(dat hang|len don|order|mua)\b/.test(normalized) && /:\d+/.test(normalized)) {
    return { intent: "order_create", confidence: 0.8 };
  }

  const classifierPrompt = [
    "Bạn là bộ phân loại ý định cho chatbot bán đồ uống.",
    "Trả về DUY NHẤT JSON theo schema:",
    '{"intent":"catalog_list|catalog_get|faq|order_get|order_create|payment_help|handoff_request|handoff_resume|greeting|bot_help|smalltalk","sku":"","orderCode":"","query":"","paymentMethod":"bank_transfer|cod"}',
    "Không giải thích thêm.",
    `Tin nhắn khách: ${message}`,
  ].join("\n");

  let raw = "";
  try {
    raw = await llmClient.complete(
      [
        {
          role: "system",
          content: "Bạn chỉ được trả về JSON hợp lệ đúng schema yêu cầu.",
        },
        {
          role: "user",
          content: classifierPrompt,
        },
      ],
      0,
    );
  } catch {
    return { intent: "smalltalk", confidence: 0.3 };
  }

  const parsed = parseClassifierJsonSafe(raw);
  if (parsed) {
    return { ...parsed, confidence: 0.6 };
  }

  return { intent: "smalltalk", confidence: 0.25 };
}

async function handleIntent(
  config: OpenClawConfig,
  llmClient: LlmClient,
  backend: ReturnType<typeof buildBackend>,
  payload: ChatRequest,
  classification: IntentResult,
  correlationId: string,
): Promise<ChatResult> {
  const primarySuggestions = getPrimarySuggestions();

  if (classification.intent === "handoff_request") {
    const reply =
      "Mình đã chuyển cuộc trò chuyện sang tư vấn viên. Bạn vui lòng chờ trong giây lát. " +
      "Khi muốn quay lại bot, hãy nhắn: 'tiếp tục với bot'.";
    return {
      reply,
      alerts: [
        `[handoff] ${backend.channel}:${payload.userId} yeu cau tu van vien | msg="${payload.message.replace(/\s+/g, " ").slice(0, 120)}"`,
      ],
      ui: {
        type: "menu",
        title: "Hỗ trợ trực tiếp",
        items: [],
        suggestions: ["Tiếp tục với bot", "Xem menu", "Món cà phê"],
      },
    };
  }

  if (classification.intent === "handoff_resume") {
    return {
      reply: "Bot đã hoạt động lại. Bạn muốn mình hỗ trợ menu, tạo đơn hay kiểm tra đơn?",
      ui: {
        type: "menu",
        title: "Bot đã sẵn sàng",
        items: [],
        suggestions: ["Xem menu", "Món cà phê", "Kiểm tra đơn hàng"],
      },
    };
  }

  if (classification.intent === "greeting") {
    return {
      reply: "Xin chào, mình là trợ lý đặt đồ uống của Lowland Coffee. Mình có thể gợi ý menu, tạo đơn và kiểm tra đơn cho bạn.",
      ui: {
        type: "menu",
        title: "Bắt đầu nhanh",
        items: [],
        suggestions: primarySuggestions,
      },
    };
  }

  if (classification.intent === "bot_help") {
    return {
      reply:
        "Mình hỗ trợ các việc sau:\n" +
        "1) Xem menu: nhắn 'xem menu' hoặc 'món cà phê'.\n" +
        "2) Lên đơn: ORDER SKU:SL | Họ tên | SĐT | Địa chỉ | bank_transfer|cod.\n" +
        "3) Tra đơn: nhắn 'kiểm tra đơn ORD-YYYYMMDD-XXXX'.\n" +
        "4) Gặp tư vấn viên: nhắn 'gặp tư vấn viên'.",
      ui: {
        type: "menu",
        title: "Bạn muốn làm gì?",
        items: [],
        suggestions: ["Xem menu", "Món cà phê", "Kiểm tra đơn hàng", "Gặp tư vấn viên"],
      },
    };
  }

  if (classification.intent === "catalog_list") {
    let list = await backend.postTool<{ items: Array<{ sku: string; name: string; category?: string; priceVnd: number; stockQty: number }> }>(
      "catalog_list",
      { query: classification.query, category: classification.category, page: 1, limit: 12 },
      correlationId,
    );

    if (!list.data.items.length && classification.query) {
      list = await backend.postTool<{ items: Array<{ sku: string; name: string; category?: string; priceVnd: number; stockQty: number }> }>(
        "catalog_list",
        { category: classification.category, page: 1, limit: 12 },
        correlationId,
      );
    }

    if (!list.data.items.length) {
      return {
        reply: "Hiện chưa tìm thấy món phù hợp. Bạn thử 'xem menu', 'món cà phê' hoặc 'món trà sữa' nhé.",
        ui: {
          type: "menu",
          title: "Gợi ý truy vấn",
          items: [],
          suggestions: ["Xem menu", "Món cà phê", "Món trà sữa", "Nước ép"],
        },
      };
    }

    const title = classification.category ? `Dạ, tham khảo qua gợi ý món ${labelForCategory(classification.category).toLowerCase()} bên em nhé:` : "Dạ, đây là danh sách đồ uống nổi bật bên em mời anh/chị xem qua:";
    return {
      reply: title,
      ui: {
        type: "menu",
        title: classification.category ? `Gợi ý ${labelForCategory(classification.category)}` : "Gợi ý đồ uống",
        items: list.data.items.slice(0, 8),
        suggestions: ["Xem menu", "Món cà phê", "Món trà sữa", "Gặp tư vấn viên"],
      },
    };
  }

  if (classification.intent === "catalog_get") {
    if (!classification.sku) {
      return {
        reply: "Bạn gửi thêm mã SKU để mình tra thông tin chi tiết nhé. Ví dụ: CAFE-SUA-DA-L",
        ui: {
          type: "menu",
          title: "Tra cứu sản phẩm",
          items: [],
          suggestions: ["Xem menu", "Món cà phê", "Món trà sữa"],
        },
      };
    }

    const detail = await backend.postTool<any>(
      "catalog_get",
      { sku_or_id: classification.sku },
      correlationId,
    );

    if (!detail.data) {
      return {
        reply: "Mình chưa có thông tin sản phẩm này. Bạn thử mã SKU khác hoặc nhắn 'xem menu'.",
        ui: {
          type: "menu",
          title: "Không tìm thấy SKU",
          items: [],
          suggestions: ["Xem menu", "Món cà phê", "Gặp tư vấn viên"],
        },
      };
    }

    const p = detail.data;
    return {
      reply: `${p.name} (${p.sku})\nDanh mục: ${labelForCategory(p.category)}\nGiá: ${formatVnd(p.priceVnd)}\nTồn: ${p.stockQty}\nMô tả: ${p.description}`,
      ui: {
        type: "menu",
        title: "Thông tin sản phẩm",
        items: [],
        suggestions: [`ORDER ${p.sku}:1`, "Xem menu", "Gặp tư vấn viên"],
      },
    };
  }

  if (classification.intent === "order_get") {
    if (!classification.orderCode) {
      return {
        reply: "Bạn gửi mã đơn theo dạng ORD-YYYYMMDD-XXXX để mình kiểm tra nhé.",
        ui: {
          type: "menu",
          title: "Kiểm tra đơn hàng",
          items: [],
          suggestions: ["Kiểm tra đơn hàng", "Xem menu", "Gặp tư vấn viên"],
        },
      };
    }

    const order = await backend.postTool<any>(
      "order_get",
      { order_code: classification.orderCode },
      correlationId,
    );

    if (!order.data) {
      return {
        reply: "Không tìm thấy đơn hàng này. Bạn kiểm tra lại mã đơn hoặc nhắn tư vấn viên nhé.",
        ui: {
          type: "menu",
          title: "Không tìm thấy đơn",
          items: [],
          suggestions: ["Kiểm tra đơn hàng", "Xem menu", "Gặp tư vấn viên"],
        },
      };
    }

    if (order.data.customerTelegramId !== payload.userId) {
      return {
        reply: "Bạn không có quyền xem đơn hàng này.",
        ui: {
          type: "menu",
          title: "Không đủ quyền",
          items: [],
          suggestions: ["Gặp tư vấn viên", "Xem menu"],
        },
      };
    }

    return {
      reply: renderOrder(order.data),
      ui: {
        type: "menu",
        title: "Đơn hàng của bạn",
        items: [],
        suggestions: ["Hướng dẫn thanh toán", "Xem menu", "Gặp tư vấn viên"],
      },
    };
  }

  if (classification.intent === "order_create") {
    const parsed = parseOrderFromText(payload.message, payload.userId, payload.profile, classification.paymentMethod);
    if (!parsed.ok) {
      return {
        reply:
          "Để lên đơn nhanh, bạn gửi theo mẫu:\nORDER SKU:SL,SKU:SL | Họ tên | Số điện thoại | Địa chỉ | bank_transfer|cod\nVí dụ: ORDER CAFE-SUA-DA-L:2 | Nguyễn Văn A | 0909000001 | Hà Nội | bank_transfer",
        ui: {
          type: "menu",
          title: "Mẫu đặt hàng",
          items: [],
          suggestions: ["Xem menu", "Món cà phê", "Gặp tư vấn viên"],
        },
      };
    }

    const created = await backend.postTool<any>(
      "order_create",
      parsed.data,
      correlationId,
    );
    const order = created.data;

    const paymentGuide =
      order.paymentMethod === "bank_transfer"
        ? `\nThanh toán: ${config.bankName} - ${config.bankAccountNumber} (${config.bankAccountName}).\nNội dung CK: ${order.orderCode}`
        : "";
    const etaMinutes = Number(order.estimatedDeliveryMinutes || 0);
    const distanceKm = Number(order.deliveryDistanceKm || 0);
    const deliveryGuide =
      etaMinutes > 0
        ? `\nDự kiến giao: khoảng ${etaMinutes} phút${distanceKm > 0 ? ` (~${distanceKm.toFixed(1)} km)` : ""}.`
        : "";

    return {
      reply: `Đã tạo đơn ${order.orderCode} thành công. Tổng thanh toán: ${formatVnd(order.totalVnd)}.${deliveryGuide}${paymentGuide}`,
      ui: {
        type: "menu",
        title: "Đơn đã tạo",
        items: [],
        suggestions:
          order.paymentMethod === "bank_transfer"
            ? ["Hướng dẫn thanh toán", "Kiểm tra đơn hàng", "Xem menu"]
            : ["Kiểm tra đơn hàng", "Xem menu", "Gặp tư vấn viên"],
      },
      alerts:
        backend.channel === "telegram"
          ? [`Đơn mới ${order.orderCode} | ${order.customerName} | ${formatVnd(order.totalVnd)} | ${order.status}`]
          : undefined,
    };
  }

  if (classification.intent === "payment_help") {
    const orderCode = classification.orderCode;
    const normalizedQuestion = normalizeVietnamese(payload.message);
    if (!orderCode && containsAny(normalizedQuestion, ["cod", "bank transfer", "chuyen khoan", "thanh toan"])) {
      return {
        reply: "Hiện hỗ trợ 2 phương thức thanh toán: bank_transfer (chuyển khoản) và cod (thanh toán khi nhận hàng).",
        ui: {
          type: "menu",
          title: "Phương thức thanh toán",
          items: [],
          suggestions: ["Đặt đơn nhanh", "Xem menu", "Gặp tư vấn viên"],
        },
      };
    }

    if (!orderCode) {
      return {
        reply: "Bạn gửi mã đơn để mình hướng dẫn thanh toán nhé. Ví dụ: ORD-20260302-0001",
        ui: {
          type: "menu",
          title: "Thanh toán",
          items: [],
          suggestions: ["Kiểm tra đơn hàng", "Xem menu"],
        },
      };
    }
    return {
      reply: `Vui lòng chuyển khoản vào ${config.bankName} - ${config.bankAccountNumber} (${config.bankAccountName}). Nội dung: ${orderCode}. Sau đó gửi /pay ${orderCode} <mã_giao_dịch>.`,
      ui: {
        type: "menu",
        title: "Hướng dẫn thanh toán",
        items: [],
        suggestions: ["Kiểm tra đơn hàng", "Gặp tư vấn viên"],
      },
    };
  }

  if (classification.intent === "faq") {
    const sku = classification.sku ?? payload.message.toUpperCase().match(/[A-Z]{2,}-[A-Z0-9-]{2,}/)?.[0];
    const faq = await backend.postTool<any>(
      "faq_answer",
      { question: payload.message, product_sku: sku },
      correlationId,
    );

    if (!faq.data) {
      return {
        reply: "Mình chưa có thông tin chính xác cho câu hỏi này. Bạn vui lòng liên hệ tư vấn viên để được hỗ trợ thêm.",
        ui: {
          type: "menu",
          title: "Hỗ trợ thêm",
          items: [],
          suggestions: ["Gặp tư vấn viên", "Xem menu", "Kiểm tra đơn hàng"],
        },
      };
    }

    return {
      reply: `${faq.data.answer}\n(Nguồn FAQ: ${faq.data.sourceQuestion})`,
      ui: {
        type: "menu",
        title: "Câu trả lời FAQ",
        items: [],
        suggestions: ["Xem menu", "Món cà phê", "Gặp tư vấn viên"],
      },
    };
  }

  const quickList = await backend.postTool<{ items: Array<{ name: string; sku: string; priceVnd: number }> }>(
    "catalog_list",
    { page: 1, limit: 4 },
    correlationId,
  );

  const context = quickList.data.items.map((item) => `${item.name} (${item.sku}) ${formatVnd(item.priceVnd)}`).join("\n");
  let normalized = "";
  try {
    const content = await llmClient.complete(
      [
        {
          role: "system",
          content:
            "Bạn là trợ lý bán đồ uống. Chỉ được trả lời dựa trên dữ liệu cung cấp. Nếu không chắc chắn, phải nói: 'chưa có thông tin'. Trả lời ngắn gọn bằng tiếng Việt có dấu.",
        },
        {
          role: "user",
          content: `Ngữ cảnh sản phẩm:\n${context}\n\nCâu hỏi khách: ${payload.message}`,
        },
      ],
      0.2,
    );
    normalized = content.trim();
  } catch {
    normalized = "";
  }

  return {
    reply: normalized || "Mình chưa có thông tin chính xác lúc này. Bạn để lại câu hỏi cụ thể hơn nhé.",
    ui: {
      type: "menu",
      title: "Gợi ý tiếp theo",
      items: [],
      suggestions: primarySuggestions,
    },
  };
}

function parseOrderFromText(
  message: string,
  userId: string,
  profile: { name?: string; phone?: string; address?: string } | undefined,
  paymentMethod?: "bank_transfer" | "cod",
): { ok: true; data: unknown } | { ok: false } {
  const cleaned = message.replace(/^\/?order\s*/i, "").trim();
  const segments = cleaned.split("|").map((segment) => segment.trim()).filter(Boolean);

  if (segments.length < 4) {
    return { ok: false };
  }

  const itemSegment = segments[0];
  const items = itemSegment
    .split(",")
    .map((chunk) => chunk.trim())
    .filter(Boolean)
    .map((chunk) => {
      const [sku, qtyRaw] = chunk.split(":").map((part) => part.trim());
      return { sku: sku.toUpperCase(), qty: Number(qtyRaw) };
    })
    .filter((item) => Boolean(item.sku) && Number.isFinite(item.qty) && item.qty > 0);

  if (!items.length) {
    return { ok: false };
  }

  const name = segments[1] || profile?.name;
  const phone = segments[2] || profile?.phone;
  const address = segments[3] || profile?.address;
  const payMethodRaw = (segments[4] || paymentMethod || "bank_transfer").toLowerCase();
  const finalPaymentMethod = payMethodRaw === "cod" ? "cod" : "bank_transfer";

  if (!name || !phone || !address) {
    return { ok: false };
  }

  return {
    ok: true,
    data: {
      customer: {
        channelUserId: userId,
        telegramId: userId,
        name,
        phone,
        address,
      },
      items,
      payment_method: finalPaymentMethod,
    },
  };
}

function renderOrder(order: any): string {
  const itemText = (order.items || [])
    .map((item: any) => `- ${item.sku} x${item.qty} = ${formatVnd(item.qty * item.unitPriceVnd)}`)
    .join("\n");
  const etaMinutes = Number(order.estimatedDeliveryMinutes || 0);
  const distanceKm = Number(order.deliveryDistanceKm || 0);
  const deliveryLine =
    etaMinutes > 0
      ? `\nDự kiến giao: ${etaMinutes} phút${distanceKm > 0 ? ` (~${distanceKm.toFixed(1)} km)` : ""}`
      : "";
  return [
    `Đơn ${order.orderCode}`,
    `Trạng thái: ${order.status}`,
    `Người nhận: ${order.customerName || "(chưa có)"}`,
    `SĐT: ${order.customerPhone || "(chưa có)"}`,
    `Địa chỉ: ${order.customerAddress || "(chưa có)"}`,
    `Thanh toán: ${order.paymentMethod || "(chưa có)"}`,
    `Tổng: ${formatVnd(order.totalVnd)}${deliveryLine}`,
    "Sản phẩm:",
    itemText || "(trống)",
  ].join("\n");
}

function formatVnd(value: number): string {
  return new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND", maximumFractionDigits: 0 }).format(value);
}

function normalizeVietnamese(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/[^a-z0-9\s:\-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function containsAny(source: string, patterns: string[]): boolean {
  return patterns.some((pattern) => hasTerm(source, pattern));
}

function hasTerm(source: string, term: string): boolean {
  const normalizedTerm = term.trim().toLowerCase();
  if (!normalizedTerm) {
    return false;
  }
  if (normalizedTerm.includes(" ")) {
    return source.includes(normalizedTerm);
  }
  const pattern = new RegExp(`(?:^|\\s)${escapeRegex(normalizedTerm)}(?:$|\\s)`);
  return pattern.test(source);
}

function escapeRegex(input: string): string {
  return input.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function getPrimarySuggestions(): string[] {
  return ["Xem menu", "Món cà phê", "Kiểm tra đơn hàng", "Gặp tư vấn viên"];
}

function inferCategoryFromMessage(normalized: string): string | undefined {
  if (containsAny(normalized, ["ca phe", "bac xiu", "espresso", "latte"])) {
    return "coffee";
  }
  if (containsAny(normalized, ["tra sua", "milk tea"])) {
    return "milk_tea";
  }
  if (containsAny(normalized, ["tra dao", "tra vai", "tra sua", "tra trai cay", "hong tra", "oolong", "fruit tea"])) {
    return "fruit_tea";
  }
  if (containsAny(normalized, ["nuoc ep", "juice"])) {
    return "juice";
  }
  return undefined;
}

function labelForCategory(category?: string): string {
  const labels: Record<string, string> = {
    coffee: "Cà phê",
    milk_tea: "Trà sữa",
    fruit_tea: "Trà trái cây",
    juice: "Nước ép",
    other: "Khác",
  };
  if (!category) {
    return labels.other;
  }
  return labels[category] ?? category;
}

function parseClassifierJsonSafe(raw: string): IntentResult | null {
  try {
    return parseClassifierJson(raw);
  } catch {
    const extracted = extractFirstJsonObject(raw);
    if (!extracted) {
      return null;
    }
    try {
      return parseClassifierJson(extracted);
    } catch {
      return null;
    }
  }
}

async function runHybridAssist(
  config: OpenClawConfig,
  llmClient: LlmClient,
  backend: ReturnType<typeof buildBackend>,
  payload: ChatRequest,
): Promise<{ reply: string; alerts?: string[]; ui?: ChatResult["ui"]; intent: string; confidence: number; toolCalls: string[] } | null> {
  const classification = await classifyIntent(llmClient, payload.message);
  const llmResult = await handleIntent(config, llmClient, backend, payload, classification, payload.correlationId ?? randomUUID());
  if (!llmResult.reply || isGenericFallbackReply(llmResult.reply)) {
    return null;
  }
  if (!passesHybridGuardrail(llmResult.reply)) {
    return null;
  }
  return {
    reply: llmResult.reply,
    alerts: llmResult.alerts,
    ui: llmResult.ui,
    intent: `hybrid_${classification.intent}`,
    confidence: Math.max(0.56, classification.confidence ?? 0.58),
    toolCalls: [`hybrid_assist:${classification.intent}`],
  };
}

function passesHybridGuardrail(reply: string): boolean {
  const trimmed = reply.trim();
  if (!trimmed) {
    return false;
  }
  if (trimmed.length > 600) {
    return false;
  }
  const normalized = normalizeVietnamese(trimmed);
  if (!normalized) {
    return false;
  }
  if (/\b(api key|token|password|mat khau|secret)\b/i.test(trimmed)) {
    return false;
  }
  return true;
}

function buildProfileUpsertInput(
  payload: ChatRequest & { channel: ChatChannel },
  session: { context: any },
  result: { nextContext: any },
  intent: string | undefined,
): UpsertCustomerProfileInput {
  const orderPrev = session.context?.order || {};
  const orderNext = result.nextContext?.order || {};
  return {
    channel: payload.channel,
    userId: payload.userId,
    locale: payload.clientContext?.locale,
    name: firstNonEmptyString(payload.profile?.name, orderNext.name, orderPrev.name),
    phone: firstNonEmptyString(payload.profile?.phone, orderNext.phone, orderPrev.phone),
    address: firstNonEmptyString(payload.profile?.address, orderNext.address, orderPrev.address),
    paymentMethod: (orderNext.paymentMethod || orderPrev.paymentMethod) as "bank_transfer" | "cod" | undefined,
    preferredCategory: inferCategoryPreference(payload.actionPayload, payload.message),
    lastIntent: intent,
  };
}

function inferCategoryPreference(actionPayload?: string, message?: string): string | undefined {
  const action = String(actionPayload || "").trim().toLowerCase();
  if (action.startsWith("action_category:")) {
    return action.slice("action_category:".length) || undefined;
  }
  const normalized = normalizeVietnamese(String(message || ""));
  if (!normalized) {
    return undefined;
  }
  return inferCategoryFromMessage(normalized);
}

function firstNonEmptyString(...values: Array<string | undefined>): string | undefined {
  for (const value of values) {
    const trimmed = String(value || "").trim();
    if (trimmed) {
      return trimmed;
    }
  }
  return undefined;
}

function extractFirstJsonObject(raw: string): string | null {
  const start = raw.indexOf("{");
  if (start < 0) {
    return null;
  }

  let depth = 0;
  for (let i = start; i < raw.length; i += 1) {
    const ch = raw[i];
    if (ch === "{") {
      depth += 1;
    } else if (ch === "}") {
      depth -= 1;
      if (depth === 0) {
        return raw.slice(start, i + 1);
      }
    }
  }
  return null;
}

function normalizeChatResult(result: ChatResult): ChatResult {
  const ui = normalizeRuntimeMenuUi(result.ui);
  const handoffHistory = result.handoff?.history?.map((entry) => ({
    ...entry,
    ...(entry.ui ? { ui: normalizeRuntimeMenuUi(entry.ui) } : {}),
  }));
  return {
    ...result,
    ...(ui ? { ui } : {}),
    ...(result.handoff
      ? {
          handoff: {
            ...result.handoff,
            ...(handoffHistory ? { history: handoffHistory } : {}),
          },
        }
      : {}),
  };
}

function normalizeSuggestion(entry: string | UiSuggestion): UiSuggestion | null {
  if (typeof entry === "object" && entry && typeof entry.label === "string" && typeof entry.payload === "string") {
    return {
      label: entry.label.trim(),
      payload: entry.payload.trim(),
    };
  }

  if (typeof entry !== "string") {
    return null;
  }

  const label = entry.trim();
  if (!label) {
    return null;
  }

  return {
    label,
    payload: legacySuggestionPayload(label),
  };
}

function normalizeRuntimeMenuUi(ui?: ChatMenuUi): ChatMenuUi | undefined {
  if (!ui) {
    return undefined;
  }
  if (!ui.suggestions?.length) {
    return ui;
  }
  const suggestions = ui.suggestions
    .map((entry) => normalizeSuggestion(entry))
    .filter((entry): entry is UiSuggestion => Boolean(entry));
  return {
    ...ui,
    suggestions,
  };
}

function toStoredMenuUi(ui?: ChatMenuUi): ChatMessageUi | undefined {
  if (!ui) {
    return undefined;
  }

  const normalized = normalizeRuntimeMenuUi(ui);
  if (!normalized) {
    return undefined;
  }

  const suggestions: ChatUiSuggestion[] = (normalized.suggestions || [])
    .map((entry) => normalizeSuggestion(entry))
    .filter((entry): entry is UiSuggestion => Boolean(entry))
    .map((entry) => ({ label: entry.label, payload: entry.payload }));

  return {
    type: "menu",
    title: normalized.title,
    items: normalized.items.map((item) => ({
      sku: item.sku,
      name: item.name,
      ...(item.category ? { category: item.category } : {}),
      priceVnd: Number(item.priceVnd || 0),
      stockQty: Number(item.stockQty || 0),
    })),
    ...(suggestions.length ? { suggestions } : {}),
  };
}

function toRuntimeMenuUi(ui?: ChatMessageUi): ChatMenuUi | undefined {
  if (!ui) {
    return undefined;
  }
  return {
    type: "menu",
    title: ui.title,
    items: ui.items.map((item) => ({
      sku: item.sku,
      name: item.name,
      ...(item.category ? { category: item.category } : {}),
      priceVnd: Number(item.priceVnd || 0),
      stockQty: Number(item.stockQty || 0),
    })),
    ...(ui.suggestions?.length
      ? {
          suggestions: ui.suggestions.map((entry) => ({
            label: entry.label,
            payload: entry.payload,
          })),
        }
      : {}),
  };
}

function serializeHandoffHistory(history: ChatMessage[]): HandoffClientMessage[] {
  return history
    .filter((entry) => String(entry.content || "").trim() !== "ACTION_HANDOFF_STATUS")
    .map((entry) => ({
      id: entry.id,
      role: entry.role,
      content: entry.content,
      timestampMs: entry.timestampMs,
      ...(entry.ui ? { ui: toRuntimeMenuUi(entry.ui) } : {}),
    }));
}

function legacySuggestionPayload(label: string): string {
  const normalized = normalizeVietnamese(label);
  if (containsAny(normalized, ["xem menu", "menu", "mon nao", "do uong"])) {
    return "ACTION_VIEW_MENU";
  }
  if (containsAny(normalized, ["ca phe"])) {
    return "ACTION_CATEGORY:coffee";
  }
  if (containsAny(normalized, ["tra sua"])) {
    return "ACTION_CATEGORY:milk_tea";
  }
  if (containsAny(normalized, ["tra trai cay", "tra dao", "tra vai"])) {
    return "ACTION_CATEGORY:fruit_tea";
  }
  if (containsAny(normalized, ["nuoc ep"])) {
    return "ACTION_CATEGORY:juice";
  }
  if (containsAny(normalized, ["kiem tra don"])) {
    return "ACTION_ORDER_STATUS";
  }
  if (containsAny(normalized, ["tiep tuc voi bot"])) {
    return "ACTION_HANDOFF_RESUME";
  }
  if (containsAny(normalized, ["tu van vien", "nguoi that"])) {
    return "ACTION_HANDOFF_REQUEST";
  }
  if (containsAny(normalized, ["dat don", "dat hang"])) {
    return "ACTION_ORDER_START";
  }
  return label;
}

function legacyTextFromAction(messageText: string, actionPayload?: string): string {
  if (messageText.trim()) {
    return messageText.trim();
  }
  const raw = (actionPayload || "").trim();
  if (!raw) {
    return "";
  }

  if (raw === "ACTION_VIEW_MENU") return "xem menu";
  if (raw === "ACTION_HELP") return "bot lam duoc gi";
  if (raw === "ACTION_ORDER_START") return "dat hang";
  if (raw === "ACTION_ORDER_STATUS") return "kiem tra don hang";
  if (raw === "ACTION_HANDOFF_REQUEST") return "gap tu van vien";
  if (raw === "ACTION_HANDOFF_RESUME") return "tiep tuc voi bot";
  if (raw.startsWith("ACTION_CATEGORY:")) {
    const category = raw.slice("ACTION_CATEGORY:".length);
    if (category === "coffee") return "mon ca phe";
    if (category === "milk_tea") return "mon tra sua";
    if (category === "fruit_tea") return "mon tra trai cay";
    if (category === "juice") return "nuoc ep";
    return "xem menu";
  }
  if (raw.startsWith("ACTION_ORDER_ADD:")) {
    const sku = raw.slice("ACTION_ORDER_ADD:".length).trim();
    if (sku) {
      return `ORDER ${sku}:1 | Khach le | 0900000000 | Dia chi mac dinh | cod`;
    }
  }

  return raw;
}

function buildHandoffWaitingReply(channel: ChatChannel): ChatResult {
  const channelLabel = channel === "messenger" ? "Messenger" : channel === "telegram" ? "Telegram" : "web";
  return {
    reply: `Phiên ${channelLabel} của bạn đang được tư vấn viên tiếp nhận. Nhắn 'tiếp tục với bot' để quay lại bot tự động.`,
    ui: {
      type: "menu",
      title: "Đang chờ tư vấn viên",
      items: [],
      suggestions: ["Tiếp tục với bot", "Xem menu"],
    },
  };
}

function isHandoffResumeSignal(message: string, actionPayload?: string): boolean {
  const action = (actionPayload || "").trim().toUpperCase();
  if (action === "ACTION_HANDOFF_RESUME") {
    return true;
  }

  const normalized = normalizeVietnamese(legacyTextFromAction(message, actionPayload));
  return containsAny(normalized, ["tiep tuc voi bot", "quay lai bot", "tro lai bot", "resume bot"]);
}

async function dispatchAdminAlerts(config: OpenClawConfig, alerts: string[] | undefined, channel: ChatChannel): Promise<void> {
  if (!alerts?.length) {
    return;
  }
  if (channel === "telegram") {
    // Telegram gateway already forwards alerts to admin chat.
    return;
  }
  const alertToken = config.alertTelegramToken || config.telegramToken;
  const alertChatId = config.adminAlertChatId || config.alertTelegramChatId;
  if (!alertToken || !alertChatId) {
    return;
  }

  for (const alert of alerts) {
    const text = String(alert || "").trim();
    if (!text) {
      continue;
    }
    try {
      const response = await fetch(`https://api.telegram.org/bot${alertToken}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: alertChatId,
          text: `[ALERT] ${text}`,
        }),
      });
      if (!response.ok) {
        logger.warn({ status: response.status, body: await response.text(), channel }, "admin alert dispatch failed");
      }
    } catch (error) {
      logger.warn({ error: String(error), channel }, "admin alert dispatch failed");
    }
  }
}

type KpiCounters = {
  totalBotEvents: number;
  fallbackCount: number;
  orderStartCount: number;
  orderCreateSuccessCount: number;
  actionTotalCount: number;
  actionErrorCount: number;
};

type KpiSummaryRow = {
  channel: ChatChannel;
  counters: KpiCounters;
  rates: {
    fallbackRate: number;
    orderWizardCompletionRate: number;
    actionErrorRate: number;
  };
};

type KpiSummaryPayload = {
  windowMinutes: number;
  windowStartedAt: string;
  generatedAt: string;
  channels: KpiSummaryRow[];
  overall: {
    counters: KpiCounters;
    rates: {
      fallbackRate: number;
      orderWizardCompletionRate: number;
      actionErrorRate: number;
    };
  };
};

type MessengerWorkerQueueStats = {
  main: number;
  processing: number;
  retry: number;
  dead: number;
};

type MessengerWorkerMetrics = {
  startedAt?: string;
  lastHeartbeatAt?: string;
  lastUpdatedAt?: string;
  processedSuccess: number;
  processError: number;
  retryScheduled: number;
  retryRequeued: number;
  deadLettered: number;
  recoveredInFlight: number;
};

type MessengerWorkerCheck = {
  ok: boolean;
  detail: string;
  queues: MessengerWorkerQueueStats;
  metrics: MessengerWorkerMetrics;
  heartbeat: {
    seen: boolean;
    lastSeenAt?: string;
    staleSeconds?: number;
  };
  alerts: string[];
};

type OpsSummaryPayload = {
  generatedAt: string;
  uptimeSec: number;
  process: {
    pid: number;
    nodeVersion: string;
    platform: string;
  };
  memory: {
    rssMb: number;
    heapUsedMb: number;
    heapTotalMb: number;
    externalMb: number;
  };
  checks: {
    dialogueDb: { ok: boolean; detail: string };
    handoffRedis: { ok: boolean; detail: string };
    chatRateLimiter: RateLimiterHealth;
    messengerWorker: MessengerWorkerCheck;
  };
  kpi?: KpiSummaryPayload;
};

async function buildOpsSummary(input: {
  config: OpenClawConfig;
  messengerOpsRedis: Redis | null;
  dialoguePool: Pool | null;
  handoffStore: HandoffStore;
  rateLimiterHealth: RateLimiterHealth;
  windowMinutes: number;
}): Promise<OpsSummaryPayload> {
  const memory = process.memoryUsage();

  const dialogueDbCheck = await checkDialogueDb(input.dialoguePool);
  const handoffRedisCheck = await input.handoffStore.healthCheck();
  const messengerWorkerCheck = await collectMessengerWorkerCheck(input.config, input.messengerOpsRedis);

  let kpi: KpiSummaryPayload | undefined;
  if (input.dialoguePool) {
    try {
      kpi = await buildKpiSummary(input.dialoguePool, input.windowMinutes);
    } catch (error) {
      logger.warn({ error: String(error) }, "kpi summary skipped in ops summary");
    }
  }

  return {
    generatedAt: new Date().toISOString(),
    uptimeSec: Math.floor(process.uptime()),
    process: {
      pid: process.pid,
      nodeVersion: process.version,
      platform: process.platform,
    },
    memory: {
      rssMb: toMb(memory.rss),
      heapUsedMb: toMb(memory.heapUsed),
      heapTotalMb: toMb(memory.heapTotal),
      externalMb: toMb(memory.external),
    },
    checks: {
      dialogueDb: dialogueDbCheck,
      handoffRedis: handoffRedisCheck,
      chatRateLimiter: input.rateLimiterHealth,
      messengerWorker: messengerWorkerCheck,
    },
    ...(kpi ? { kpi } : {}),
  };
}

async function checkDialogueDb(pool: Pool | null): Promise<{ ok: boolean; detail: string }> {
  if (!pool) {
    return { ok: false, detail: "dialogue_engine_v2_disabled" };
  }
  try {
    await pool.query("SELECT 1");
    return { ok: true, detail: "ok" };
  } catch (error) {
    return { ok: false, detail: String(error) };
  }
}

async function collectMessengerWorkerCheck(config: OpenClawConfig, redis: Redis | null): Promise<MessengerWorkerCheck> {
  if (!config.messengerQueueAlertEnabled) {
    return {
      ok: true,
      detail: "disabled",
      queues: { main: 0, processing: 0, retry: 0, dead: 0 },
      metrics: emptyMessengerWorkerMetrics(),
      heartbeat: { seen: false },
      alerts: [],
    };
  }

  if (!redis) {
    return {
      ok: false,
      detail: "redis_not_initialized",
      queues: { main: 0, processing: 0, retry: 0, dead: 0 },
      metrics: emptyMessengerWorkerMetrics(),
      heartbeat: { seen: false },
      alerts: ["check_failed"],
    };
  }

  try {
    if (redis.status === "wait" || redis.status === "end") {
      await redis.connect();
    }

    const [mainLen, processingLen, retryLen, deadLen, metricsMap, heartbeatRaw] = await Promise.all([
      redis.llen(config.messengerQueueMainKey),
      redis.llen(config.messengerQueueProcessingKey),
      redis.zcard(config.messengerQueueRetryKey),
      redis.llen(config.messengerQueueDeadKey),
      redis.hgetall(config.messengerMetricsHashKey),
      redis.get(config.messengerHeartbeatKey),
    ]);

    const queues: MessengerWorkerQueueStats = {
      main: safeRedisInt(mainLen),
      processing: safeRedisInt(processingLen),
      retry: safeRedisInt(retryLen),
      dead: safeRedisInt(deadLen),
    };
    const metrics = parseMessengerWorkerMetrics(metricsMap);

    const heartbeatTs = safeRedisInt(heartbeatRaw);
    const hasHeartbeat = heartbeatTs > 0;
    const staleSeconds = hasHeartbeat ? Math.max(0, Math.floor(Date.now() / 1000) - heartbeatTs) : undefined;
    const alerts: string[] = [];
    if (queues.dead >= config.messengerDeadThreshold) {
      alerts.push(`dead_queue=${queues.dead} >= ${config.messengerDeadThreshold}`);
    }
    if (queues.retry >= config.messengerRetryThreshold) {
      alerts.push(`retry_queue=${queues.retry} >= ${config.messengerRetryThreshold}`);
    }
    if (queues.processing >= config.messengerProcessingThreshold) {
      alerts.push(`processing_queue=${queues.processing} >= ${config.messengerProcessingThreshold}`);
    }
    if (!hasHeartbeat) {
      alerts.push("heartbeat_missing");
    } else if ((staleSeconds || 0) >= config.messengerHeartbeatStaleSec) {
      alerts.push(`heartbeat_stale=${staleSeconds}s >= ${config.messengerHeartbeatStaleSec}s`);
    }

    return {
      ok: alerts.length === 0,
      detail: alerts.length === 0 ? "ok" : "threshold_breached",
      queues,
      metrics,
      heartbeat: {
        seen: hasHeartbeat,
        ...(hasHeartbeat ? { lastSeenAt: new Date(heartbeatTs * 1000).toISOString() } : {}),
        ...(typeof staleSeconds === "number" ? { staleSeconds } : {}),
      },
      alerts,
    };
  } catch (error) {
    return {
      ok: false,
      detail: String(error),
      queues: { main: 0, processing: 0, retry: 0, dead: 0 },
      metrics: emptyMessengerWorkerMetrics(),
      heartbeat: { seen: false },
      alerts: ["check_failed"],
    };
  }
}

function emptyMessengerWorkerMetrics(): MessengerWorkerMetrics {
  return {
    processedSuccess: 0,
    processError: 0,
    retryScheduled: 0,
    retryRequeued: 0,
    deadLettered: 0,
    recoveredInFlight: 0,
  };
}

function parseMessengerWorkerMetrics(input: Record<string, string>): MessengerWorkerMetrics {
  return {
    startedAt: trimString(input.startedAt),
    lastHeartbeatAt: trimString(input.lastHeartbeatAt),
    lastUpdatedAt: trimString(input.lastUpdatedAt),
    processedSuccess: safeRedisInt(input.processedSuccess),
    processError: safeRedisInt(input.processError),
    retryScheduled: safeRedisInt(input.retryScheduled),
    retryRequeued: safeRedisInt(input.retryRequeued),
    deadLettered: safeRedisInt(input.deadLettered),
    recoveredInFlight: safeRedisInt(input.recoveredInFlight),
  };
}

function trimString(value: unknown): string | undefined {
  const text = String(value ?? "").trim();
  return text ? text : undefined;
}

function safeRedisInt(value: unknown): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return 0;
  }
  return Math.max(0, Math.trunc(parsed));
}

async function buildKpiSummary(pool: Pool, windowMinutes: number): Promise<KpiSummaryPayload> {
  const placeholders = KPI_ACTION_ERROR_INTENTS.map(() => "?").join(", ");
  const [rows] = await pool.query<any[]>(
    `SELECT
       channel,
       COUNT(*) AS total_bot_events,
       SUM(CASE WHEN intent = 'fallback' THEN 1 ELSE 0 END) AS fallback_count,
       SUM(CASE WHEN intent = 'order_start' THEN 1 ELSE 0 END) AS order_start_count,
       SUM(CASE WHEN intent = 'order_create_success' THEN 1 ELSE 0 END) AS order_create_success_count,
       SUM(CASE WHEN action_payload IS NOT NULL AND action_payload <> '' THEN 1 ELSE 0 END) AS action_total_count,
       SUM(
         CASE
           WHEN action_payload IS NOT NULL
             AND action_payload <> ''
             AND intent IN (${placeholders})
           THEN 1 ELSE 0
         END
       ) AS action_error_count
     FROM chat_dialogue_events
     WHERE role = 'bot'
       AND created_at >= DATE_SUB(UTC_TIMESTAMP(), INTERVAL ? MINUTE)
     GROUP BY channel`,
    [...KPI_ACTION_ERROR_INTENTS, windowMinutes],
  );

  const mapped = new Map<ChatChannel, KpiCounters>();
  for (const row of rows || []) {
    const channel = String(row.channel || "");
    if (!isChatChannel(channel)) {
      continue;
    }
    mapped.set(channel, {
      totalBotEvents: toInt(row.total_bot_events),
      fallbackCount: toInt(row.fallback_count),
      orderStartCount: toInt(row.order_start_count),
      orderCreateSuccessCount: toInt(row.order_create_success_count),
      actionTotalCount: toInt(row.action_total_count),
      actionErrorCount: toInt(row.action_error_count),
    });
  }

  const channels: ChatChannel[] = ["web", "messenger", "telegram"];
  const channelRows = channels.map((channel) => toKpiRow(channel, mapped.get(channel) || emptyKpiCounters()));
  const overallCounters = channelRows.reduce<KpiCounters>(
    (acc, row) => ({
      totalBotEvents: acc.totalBotEvents + row.counters.totalBotEvents,
      fallbackCount: acc.fallbackCount + row.counters.fallbackCount,
      orderStartCount: acc.orderStartCount + row.counters.orderStartCount,
      orderCreateSuccessCount: acc.orderCreateSuccessCount + row.counters.orderCreateSuccessCount,
      actionTotalCount: acc.actionTotalCount + row.counters.actionTotalCount,
      actionErrorCount: acc.actionErrorCount + row.counters.actionErrorCount,
    }),
    emptyKpiCounters(),
  );

  return {
    windowMinutes,
    windowStartedAt: new Date(Date.now() - windowMinutes * 60_000).toISOString(),
    generatedAt: new Date().toISOString(),
    channels: channelRows,
    overall: {
      counters: overallCounters,
      rates: {
        fallbackRate: toRatePercent(overallCounters.fallbackCount, overallCounters.totalBotEvents),
        orderWizardCompletionRate: toRatePercent(overallCounters.orderCreateSuccessCount, overallCounters.orderStartCount),
        actionErrorRate: toRatePercent(overallCounters.actionErrorCount, overallCounters.actionTotalCount),
      },
    },
  };
}

function toKpiRow(channel: ChatChannel, counters: KpiCounters): KpiSummaryRow {
  return {
    channel,
    counters,
    rates: {
      fallbackRate: toRatePercent(counters.fallbackCount, counters.totalBotEvents),
      orderWizardCompletionRate: toRatePercent(counters.orderCreateSuccessCount, counters.orderStartCount),
      actionErrorRate: toRatePercent(counters.actionErrorCount, counters.actionTotalCount),
    },
  };
}

function emptyKpiCounters(): KpiCounters {
  return {
    totalBotEvents: 0,
    fallbackCount: 0,
    orderStartCount: 0,
    orderCreateSuccessCount: 0,
    actionTotalCount: 0,
    actionErrorCount: 0,
  };
}

function toRatePercent(numerator: number, denominator: number): number {
  if (!denominator) {
    return 0;
  }
  return Number(((numerator / denominator) * 100).toFixed(2));
}

function toMb(bytes: number): number {
  return Number((bytes / (1024 * 1024)).toFixed(2));
}

function toInt(value: unknown): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return 0;
  }
  return Math.trunc(parsed);
}

function isChatChannel(value: string): value is ChatChannel {
  return value === "web" || value === "messenger" || value === "telegram";
}
