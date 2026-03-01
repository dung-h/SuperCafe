import path from "node:path";
import { randomUUID } from "node:crypto";
import express from "express";
import { z } from "zod";
import { readConfig } from "./config";
import { logger } from "./logger";

type ApiResult<T> = { ok: boolean; data: T; error?: string };

type UpstreamResult<T> = {
  ok: boolean;
  status: number;
  data?: T;
  error?: string;
};

const createOrderSchema = z.object({
  customerTelegramId: z.string().min(1),
  customerName: z.string().min(2),
  customerPhone: z.string().min(3),
  customerAddress: z.string().min(3),
  paymentMethod: z.enum(["bank_transfer", "cod"]),
  note: z.string().optional(),
  items: z.array(z.object({ sku: z.string().min(1), qty: z.coerce.number().int().positive() })).min(1),
});

const submitPaymentSchema = z.object({
  orderCode: z.string().regex(/^ORD-\d{8}-\d{4}$/),
  transferRef: z.string().min(1),
  proofText: z.string().optional(),
  customerTelegramId: z.string().min(1),
});

const config = readConfig();
if (config.salesMcpApiKey === "dev-internal-key-change-me") {
  logger.warn("SALES_MCP_API_KEY is using default value; change it for non-demo environments.");
}

const app = express();
app.use(express.json({ limit: "1mb" }));

app.get("/health", (_req, res) => {
  res.json({ status: "ok", service: "telegram-miniapp" });
});

app.get("/ready", (_req, res) => {
  res.json({ status: "ready", service: "telegram-miniapp" });
});

app.get("/api/config", (_req, res) => {
  res.json({
    ok: true,
    data: {
      shopName: config.shopName,
      bankName: config.bankName,
      bankAccountName: config.bankAccountName,
      bankAccountNumber: config.bankAccountNumber,
      paymentMethods: ["bank_transfer", "cod"],
      categoryLabels: {
        coffee: "Cà phê",
        milk_tea: "Trà sữa",
        fruit_tea: "Trà trái cây",
        juice: "Nước ép",
        other: "Khác",
      },
    },
  });
});

app.get("/api/products", async (req, res) => {
  const query = typeof req.query.query === "string" ? req.query.query.trim() : undefined;
  const category = typeof req.query.category === "string" ? req.query.category.trim().toLowerCase() : undefined;
  const result = await postSales<{ items: Array<Record<string, unknown>> }>(
    "/tools/catalog_list",
    { query: query || undefined, category: category || undefined, page: 1, limit: 30 },
    buildCorrelationId("products"),
  );

  if (!result.ok) {
    res.status(502).json({ ok: false, error: result.error ?? "Không lấy được danh sách sản phẩm" });
    return;
  }

  res.json({
    ok: true,
    data: { items: result.data?.items ?? [] },
  });
});

app.get("/api/categories", async (_req, res) => {
  const result = await postSales<Array<{ name: string; count: number }>>(
    "/tools/catalog_categories",
    {},
    buildCorrelationId("categories"),
  );

  if (!result.ok) {
    res.status(502).json({ ok: false, error: result.error ?? "Không lấy được danh mục" });
    return;
  }

  res.json({ ok: true, data: result.data ?? [] });
});

app.post("/api/orders", async (req, res) => {
  try {
    const payload = createOrderSchema.parse(req.body);
    const result = await postSales<any>(
      "/tools/order_create",
      {
        customer: {
          telegramId: payload.customerTelegramId,
          name: payload.customerName,
          phone: payload.customerPhone,
          address: payload.customerAddress,
        },
        items: payload.items.map((item) => ({
          sku: item.sku.toUpperCase(),
          qty: item.qty,
        })),
        payment_method: payload.paymentMethod,
        note: payload.note,
      },
      buildCorrelationId("order_create"),
    );

    if (!result.ok) {
      res.status(400).json({ ok: false, error: result.error ?? "Tạo đơn thất bại" });
      return;
    }

    res.json({
      ok: true,
      data: result.data,
    });
  } catch (error) {
    handleValidationError(res, error);
  }
});

app.get("/api/orders/:orderCode", async (req, res) => {
  const orderCode = String(req.params.orderCode || "").toUpperCase();
  const telegramUserId = typeof req.query.telegramUserId === "string" ? req.query.telegramUserId : undefined;

  if (!/^ORD-\d{8}-\d{4}$/.test(orderCode)) {
    res.status(400).json({ ok: false, error: "Mã đơn không hợp lệ" });
    return;
  }

  const result = await postSales<any>("/tools/order_get", { order_code: orderCode }, buildCorrelationId("order_get"));
  if (!result.ok || !result.data) {
    res.status(404).json({ ok: false, error: "Không tìm thấy đơn hàng" });
    return;
  }

  if (telegramUserId && result.data.customerTelegramId !== telegramUserId) {
    res.status(403).json({ ok: false, error: "Bạn không có quyền xem đơn này" });
    return;
  }

  res.json({ ok: true, data: result.data });
});

app.post("/api/pay", async (req, res) => {
  try {
    const payload = submitPaymentSchema.parse(req.body);
    const result = await postSales<any>(
      "/tools/payment_submit",
      {
        order_code: payload.orderCode,
        transfer_ref: payload.transferRef,
        proof_text: payload.proofText,
      },
      buildCorrelationId("payment_submit"),
      payload.customerTelegramId,
    );

    if (!result.ok) {
      res.status(400).json({ ok: false, error: result.error ?? "Gửi thanh toán thất bại" });
      return;
    }

    res.json({ ok: true, data: result.data });
  } catch (error) {
    handleValidationError(res, error);
  }
});

const publicDir = path.resolve(__dirname, "../public");
app.use(express.static(publicDir));
app.get("*", (_req, res) => {
  res.sendFile(path.join(publicDir, "index.html"));
});

app.listen(config.port, config.host, () => {
  logger.info({ host: config.host, port: config.port }, "telegram-miniapp listening");
});

async function postSales<T>(
  routePath: string,
  body: unknown,
  correlationId: string,
  actorTelegramId?: string,
): Promise<UpstreamResult<T>> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), config.httpTimeoutMs);

  try {
    const response = await fetch(`${config.salesMcpUrl}${routePath}`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-correlation-id": correlationId,
        "x-api-key": config.salesMcpApiKey,
        ...(actorTelegramId ? { "x-actor-telegram-id": actorTelegramId } : {}),
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    const text = await response.text();
    const parsed = safeParseJson<ApiResult<T>>(text);

    if (!response.ok) {
      return {
        ok: false,
        status: response.status,
        error: parsed?.error ?? `HTTP ${response.status}`,
      };
    }

    if (!parsed || !parsed.ok) {
      return {
        ok: false,
        status: 502,
        error: "Invalid response from sales-mcp",
      };
    }

    return {
      ok: true,
      status: response.status,
      data: parsed.data,
    };
  } catch (error) {
    return {
      ok: false,
      status: 502,
      error: error instanceof Error ? error.message : String(error),
    };
  } finally {
    clearTimeout(timeout);
  }
}

function safeParseJson<T>(raw: string): T | null {
  if (!raw) {
    return null;
  }
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function handleValidationError(res: express.Response, error: unknown): void {
  if (error instanceof z.ZodError) {
    res.status(400).json({ ok: false, error: error.flatten() });
    return;
  }
  res.status(500).json({ ok: false, error: error instanceof Error ? error.message : String(error) });
}

function buildCorrelationId(prefix: string): string {
  return `miniapp-${prefix}-${randomUUID().slice(0, 8)}`;
}
