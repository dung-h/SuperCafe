import { randomUUID } from "node:crypto";
import express from "express";
import pinoHttp from "pino-http";
import { z } from "zod";
import { buildBackend, type BackendChannel } from "./backends";
import { type ClassifyResult, HttpClient, parseClassifierJson } from "./clients";
import type { OpenClawConfig } from "./config";
import { LlmClient } from "./llmClient";
import { logger } from "./logger";
import { messengerNotEnabledReply } from "./messenger";

type ChatChannel = "telegram" | "web" | "messenger";

type ChatRequest = {
  userId: string;
  message: string;
  correlationId?: string;
  channel?: ChatChannel;
  profile?: {
    name?: string;
    phone?: string;
    address?: string;
  };
};

type IntentResult = ClassifyResult & {
  category?: string;
};

const chatSchema = z.object({
  userId: z.string().min(1),
  message: z.string().min(1),
  correlationId: z.string().optional(),
  channel: z.enum(["telegram", "web", "messenger"]).optional(),
  profile: z
    .object({
      name: z.string().optional(),
      phone: z.string().optional(),
      address: z.string().optional(),
    })
    .optional(),
});

export function createApp(config: OpenClawConfig) {
  const app = express();
  const toolHttpClient = new HttpClient(config.timeoutMs);
  const llmHttpClient = new HttpClient(config.llmTimeoutMs);
  const llmClient = new LlmClient(config, llmHttpClient);

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

  app.post("/chat", async (req, res) => {
    try {
      const payload = chatSchema.parse(req.body) as ChatRequest;
      const correlationId = payload.correlationId ?? randomUUID();
      const channel = payload.channel ?? "telegram";

      if (channel === "messenger") {
        res.json({
          ok: true,
          data: {
            reply: messengerNotEnabledReply(),
          },
        });
        return;
      }

      const backend = buildBackend(channel as BackendChannel, config, toolHttpClient);
      const classification = await classifyIntent(llmClient, payload.message);
      const result = await handleIntent(config, llmClient, backend, payload, classification, correlationId);

      res.json({ ok: true, data: result });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      req.log.error({ error: message }, "openclaw chat failed");
      res.status(500).json({ ok: false, error: message });
    }
  });

  return app;
}

async function classifyIntent(llmClient: LlmClient, message: string): Promise<IntentResult> {
  const normalized = normalizeVietnamese(message);
  const upperRaw = message.toUpperCase();
  const orderCode = upperRaw.match(/ORD-\d{8}-\d{4}/)?.[0];
  const sku = message.toUpperCase().match(/[A-Z]{2,}-[A-Z0-9-]{2,}/)?.[0];
  const category = inferCategoryFromMessage(normalized);

  if (containsAny(normalized, ["bao quan", "han su dung", "co duong", "doi tra", "giao hang", "nhiet do", "thanh phan"])) {
    return { intent: "faq", sku };
  }

  if (containsAny(normalized, ["menu", "do uong", "thuc uong", "san pham", "danh sach", "product", "products"])) {
    const stripped = normalized
      .replace(/\b(cho toi|cho minh|toi muon|minh muon|xem|danh sach|menu|do uong|thuc uong|san pham|products?)\b/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    return { intent: "catalog_list", query: stripped.length >= 2 ? stripped : undefined, category };
  }

  if (/\b(chi tiet|thong tin|product)\b/.test(normalized) && sku) {
    return { intent: "catalog_get", sku };
  }

  if (/\b(ma don|order status|tinh trang don|kiem tra don)\b/.test(normalized) && orderCode) {
    return { intent: "order_get", orderCode };
  }

  if (/\b(thanh toan|chuyen khoan|payment)\b/.test(normalized) && orderCode) {
    return { intent: "payment_help", orderCode };
  }

  if (/\b(dat hang|len don|order|mua)\b/.test(normalized) && /:\d+/.test(normalized)) {
    return { intent: "order_create" };
  }

  const classifierPrompt = [
    "Ban la bo phan loai y dinh cho chatbot ban do uong.",
    "Tra ve DUY NHAT JSON theo schema:",
    '{"intent":"catalog_list|catalog_get|faq|order_get|order_create|payment_help|smalltalk","sku":"","orderCode":"","query":"","paymentMethod":"bank_transfer|cod"}',
    "Khong giai thich them.",
    `Tin nhan khach: ${message}`,
  ].join("\n");

  let raw = "";
  try {
    raw = await llmClient.complete(
      [
        {
          role: "system",
          content: "Ban chi duoc tra ve JSON hop le dung schema yeu cau.",
        },
        {
          role: "user",
          content: classifierPrompt,
        },
      ],
      0,
    );
  } catch {
    return { intent: "smalltalk" };
  }

  const parsed = parseClassifierJsonSafe(raw);
  if (parsed) {
    return parsed;
  }

  return { intent: "smalltalk" };
}

async function handleIntent(
  config: OpenClawConfig,
  llmClient: LlmClient,
  backend: ReturnType<typeof buildBackend>,
  payload: ChatRequest,
  classification: IntentResult,
  correlationId: string,
): Promise<{ reply: string; alerts?: string[] }> {
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
      return { reply: "Hien chua tim thay mon phu hop. Ban thu tu khoa khac nhe." };
    }

    const lines = list.data.items.map(
      (item) => `- ${item.sku}: ${item.name} [${labelForCategory(item.category)}] | ${formatVnd(item.priceVnd)} | con ${item.stockQty}`,
    );
    const title = classification.category ? `Menu ${labelForCategory(classification.category)}:` : "Menu do uong:";
    return { reply: `${title}\n${lines.join("\n")}` };
  }

  if (classification.intent === "catalog_get") {
    if (!classification.sku) {
      return { reply: "Ban gui them ma SKU de minh tra thong tin chi tiet nhe." };
    }

    const detail = await backend.postTool<any>(
      "catalog_get",
      { sku_or_id: classification.sku },
      correlationId,
    );

    if (!detail.data) {
      return { reply: "Minh chua co thong tin san pham nay. Ban thu ma SKU khac hoac lien he tu van vien." };
    }

    const p = detail.data;
    return {
      reply: `${p.name} (${p.sku})\nDanh muc: ${labelForCategory(p.category)}\nGia: ${formatVnd(p.priceVnd)}\nTon: ${p.stockQty}\nMo ta: ${p.description}`,
    };
  }

  if (classification.intent === "order_get") {
    if (!classification.orderCode) {
      return { reply: "Ban gui ma don theo dang ORD-YYYYMMDD-XXXX de minh kiem tra nhe." };
    }

    const order = await backend.postTool<any>(
      "order_get",
      { order_code: classification.orderCode },
      correlationId,
    );

    if (!order.data) {
      return { reply: "Khong tim thay don hang nay." };
    }

    if (order.data.customerTelegramId !== payload.userId) {
      return { reply: "Ban khong co quyen xem don hang nay." };
    }

    return {
      reply: renderOrder(order.data),
    };
  }

  if (classification.intent === "order_create") {
    const parsed = parseOrderFromText(payload.message, payload.userId, payload.profile, classification.paymentMethod);
    if (!parsed.ok) {
      return {
        reply:
          "De len don nhanh, ban gui theo mau:\nORDER SKU:SL,SKU:SL | Ho ten | So dien thoai | Dia chi | bank_transfer|cod\nVi du: ORDER CAFE-SUA-DA-L:2 | Nguyen Van A | 0909000001 | Ha Noi | bank_transfer",
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
        ? `\nThanh toan: ${config.bankName} - ${config.bankAccountNumber} (${config.bankAccountName}).\nNoi dung CK: ${order.orderCode}`
        : "";

    return {
      reply: `Da tao don ${order.orderCode} thanh cong. Tong thanh toan: ${formatVnd(order.totalVnd)}.${paymentGuide}`,
      alerts:
        backend.channel === "telegram"
          ? [`Don moi ${order.orderCode} | ${order.customerName} | ${formatVnd(order.totalVnd)} | ${order.status}`]
          : undefined,
    };
  }

  if (classification.intent === "payment_help") {
    const orderCode = classification.orderCode;
    if (!orderCode) {
      return { reply: "Ban gui ma don de minh huong dan thanh toan nhe." };
    }
    return {
      reply: `Vui long chuyen khoan vao ${config.bankName} - ${config.bankAccountNumber} (${config.bankAccountName}). Noi dung: ${orderCode}. Sau do gui /pay ${orderCode} <ma_giao_dich>.`,
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
      return { reply: "Minh chua co thong tin chinh xac cho cau hoi nay. Ban vui long lien he tu van vien de ho tro them." };
    }

    return {
      reply: `${faq.data.answer}\n(Nguon FAQ: ${faq.data.sourceQuestion})`,
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
            "Ban la tro ly ban do uong. Chi duoc tra loi dua tren du lieu cung cap. Neu khong chac chan, phai noi: 'chua co thong tin'. Tra loi ngan gon bang tieng Viet co dau.",
        },
        {
          role: "user",
          content: `Ngu canh san pham:\n${context}\n\nCau hoi khach: ${payload.message}`,
        },
      ],
      0.2,
    );
    normalized = content.trim();
  } catch {
    normalized = "";
  }

  return {
    reply: normalized || "Minh chua co thong tin chinh xac luc nay. Ban de lai cau hoi cu the hon nhe.",
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
  return `Don ${order.orderCode}\nTrang thai: ${order.status}\nTong: ${formatVnd(order.totalVnd)}\nSan pham:\n${itemText}`;
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
  return patterns.some((pattern) => source.includes(pattern));
}

function inferCategoryFromMessage(normalized: string): string | undefined {
  if (containsAny(normalized, ["ca phe", "bac xiu", "espresso", "latte"])) {
    return "coffee";
  }
  if (containsAny(normalized, ["tra sua", "milk tea"])) {
    return "milk_tea";
  }
  if (containsAny(normalized, ["tra dao", "tra vai", "tra", "fruit tea"])) {
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
