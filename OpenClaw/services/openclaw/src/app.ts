import { randomUUID } from "node:crypto";
import express from "express";
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
import { HandoffStore } from "./handoffStore";
import { LlmClient } from "./llmClient";
import { logger } from "./logger";

type ChatChannel = "telegram" | "web" | "messenger";

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

type ChatResult = {
  reply: string;
  alerts?: string[];
  state?: {
    name: string;
    missingFields: string[];
  };
  ui?: {
    type: "menu";
    title: string;
    items: MenuUiItem[];
    suggestions?: Array<string | UiSuggestion>;
  };
};

const chatSchema = z.object({
  userId: z.string().min(1),
  message: z.string().optional().default(""),
  actionPayload: z.preprocess((value) => (value === null ? undefined : value), z.string().max(255).optional()),
  correlationId: z.string().optional(),
  channel: z.enum(["telegram", "web", "messenger"]).optional(),
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
  channel: z.enum(["telegram", "web", "messenger"]),
  userId: z.string().min(1),
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

export function createApp(config: OpenClawConfig) {
  const app = express();
  const toolHttpClient = new HttpClient(config.timeoutMs);
  const llmHttpClient = new HttpClient(config.llmTimeoutMs);
  const llmClient = new LlmClient(config, llmHttpClient);
  const handoffStore = new HandoffStore();
  const chatRateLimiter = createFixedWindowLimiter(config.chatRateLimitMax, config.chatRateLimitWindowSec);
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

  app.post("/chat", async (req, res) => {
    try {
      const payload = chatSchema.parse(req.body) as ChatRequest;
      const correlationId = payload.correlationId ?? randomUUID();
      const channel = payload.channel ?? "telegram";
      const messageText = payload.message.trim();
      const actionPayload = (payload.actionPayload || "").trim() || undefined;
      const rateKey = `${channel}:${payload.userId}`;
      const rateLimit = chatRateLimiter.hit(rateKey);
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

      const backend = buildBackend(channel as BackendChannel, config, toolHttpClient);
      let result: ChatResult | null = null;

      if (config.dialogEngineV2Enabled && dialogueStateStore && dialogueEventLogger) {
        try {
          result = await handleWithDialogueEngine(
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
        } catch (error) {
          req.log.error({ error: String(error) }, "dialogue engine v2 failed; fallback to legacy");
        }
      }

      if (!result) {
        const legacyMessage = legacyTextFromAction(messageText, actionPayload);
        const legacyPayload: ChatRequest = {
          ...payload,
          message: legacyMessage,
          actionPayload,
          channel,
        };
        const classification = await classifyIntent(llmClient, legacyMessage);
        if (await handoffStore.isActive(channel, payload.userId) && classification.intent !== "handoff_resume") {
          await handoffStore.appendMessage(channel, payload.userId, "user", legacyMessage);
          res.json({
            ok: true,
            data: normalizeChatResult(buildHandoffWaitingReply(channel)),
          });
          return;
        }
        result = await handleIntent(config, llmClient, backend, legacyPayload, classification, correlationId);

        if (classification.intent === "handoff_request") {
          await handoffStore.activate(channel, payload.userId, legacyMessage);
        } else if (classification.intent === "handoff_resume") {
          await handoffStore.release(channel, payload.userId);
        }
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

  const replySchema = z.object({
    channel: z.enum(["telegram", "web", "messenger"]),
    userId: z.string().min(1),
    message: z.string().min(1),
  });

  app.post("/admin/handoff/reply", async (req, res) => {
    try {
      const payload = replySchema.parse(req.body);
      const session = await handoffStore.getSession(payload.channel, payload.userId);
      if (!session) {
        res.status(404).json({ ok: false, error: "Handoff session not active" });
        return;
      }

      await handoffStore.appendMessage(payload.channel, payload.userId, "agent", payload.message);

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
): Promise<ChatResult> {
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
    reply,
    alerts,
    ui,
    state: result.state,
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

    return {
      reply: `Đã tạo đơn ${order.orderCode} thành công. Tổng thanh toán: ${formatVnd(order.totalVnd)}.${paymentGuide}`,
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
  return `Đơn ${order.orderCode}\nTrạng thái: ${order.status}\nTổng: ${formatVnd(order.totalVnd)}\nSản phẩm:\n${itemText}`;
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
  if (!result.ui?.suggestions?.length) {
    return result;
  }

  const suggestions = result.ui.suggestions
    .map((entry) => normalizeSuggestion(entry))
    .filter((entry): entry is UiSuggestion => Boolean(entry));

  return {
    ...result,
    ui: {
      ...result.ui,
      suggestions,
    },
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

type RateLimitBucket = {
  count: number;
  resetAt: number;
};

type RateLimitResult = {
  allowed: boolean;
  retryAfterSec: number;
};

function createFixedWindowLimiter(maxRequests: number, windowSec: number) {
  const buckets = new Map<string, RateLimitBucket>();
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
