import { randomUUID } from "node:crypto";
import cors from "cors";
import express from "express";
import pinoHttp from "pino-http";
import { z } from "zod";
import { ORDER_STATUSES } from "@openclaw/shared-types";
import { logger } from "./lib/logger";
import { SalesService } from "./salesService";

const orderStatusSchema = z.enum(ORDER_STATUSES);
const imageUrlSchema = z
  .string()
  .trim()
  .url()
  .refine((value) => /^https?:\/\//i.test(value), { message: "imageUrl must be an http(s) URL" });

const schemas = {
  catalogList: z.object({
    query: z.string().optional(),
    category: z.string().optional(),
    page: z.coerce.number().int().positive().optional(),
    limit: z.coerce.number().int().positive().max(50).optional(),
  }),
  catalogGet: z.object({
    sku_or_id: z.string().min(1),
  }),
  orderCreate: z.object({
    customer: z.object({
      telegramId: z.string().min(1),
      name: z.string().min(1),
      phone: z.string().min(3),
      address: z.string().min(3),
    }),
    items: z.array(z.object({ sku: z.string().min(1), qty: z.coerce.number().int().positive() })).min(1),
    payment_method: z.enum(["bank_transfer", "cod"]),
    note: z.string().optional(),
  }),
  orderGet: z.object({
    order_code: z.string().regex(/^ORD-\d{8}-\d{4}$/),
  }),
  orderList: z.object({
    status: orderStatusSchema.optional(),
    from: z.string().optional(),
    to: z.string().optional(),
  }),
  orderSetStatus: z.object({
    order_code: z.string().regex(/^ORD-\d{8}-\d{4}$/),
    status: orderStatusSchema,
    reason: z.string().optional(),
  }),
  paymentSubmit: z.object({
    order_code: z.string().regex(/^ORD-\d{8}-\d{4}$/),
    transfer_ref: z.string().trim().min(1).optional(),
    proof_text: z.string().trim().min(1).optional(),
  }),
  paymentConfirm: z.object({
    order_code: z.string().regex(/^ORD-\d{8}-\d{4}$/),
    approved: z.boolean(),
    note: z.string().optional(),
  }),
  faqAnswer: z.object({
    question: z.string().min(3),
    product_sku: z.string().optional(),
  }),
  adminAuth: z.object({
    telegramId: z.string().min(1),
    passphrase: z.string().min(1),
  }),
  productAdd: z.object({
    sku: z.string().trim().min(2),
    name: z.string().trim().min(2),
    category: z.string().optional(),
    imageUrl: imageUrlSchema.optional(),
    priceVnd: z.coerce.number().int().nonnegative(),
    stockQty: z.coerce.number().int().nonnegative(),
    description: z.string().trim().min(3),
    faq: z.array(z.object({ q: z.string().min(2), a: z.string().min(2) })).optional(),
  }),
  productUpdate: z.object({
    sku: z.string().trim().min(2),
    name: z.string().trim().min(2).optional(),
    category: z.string().optional(),
    imageUrl: imageUrlSchema.optional(),
    priceVnd: z.coerce.number().int().nonnegative().optional(),
    stockQty: z.coerce.number().int().nonnegative().optional(),
    description: z.string().trim().min(3).optional(),
    isActive: z.boolean().optional(),
    faq: z.array(z.object({ q: z.string().min(2), a: z.string().min(2) })).optional(),
  }),
  stockSet: z.object({
    sku: z.string().min(2),
    qty: z.coerce.number().int().nonnegative(),
  }),
};

type AppOptions = {
  apiKey: string;
};

export function createApp(service: SalesService, options: AppOptions) {
  const app = express();

  app.use(cors());
  app.use(express.json({ limit: "1mb" }));
  app.use(
    pinoHttp({
      logger,
      genReqId: (req) => (req.headers["x-correlation-id"] as string) || randomUUID(),
    }),
  );

  app.use((req, res, next) => {
    if (req.method !== "POST") {
      next();
      return;
    }

    if (!req.path.startsWith("/tools/") && !req.path.startsWith("/admin/")) {
      next();
      return;
    }

    const incomingApiKey = getHeaderValue(req.headers["x-api-key"]);
    if (!incomingApiKey || incomingApiKey !== options.apiKey) {
      res.status(401).json({ ok: false, error: "Unauthorized API key" });
      return;
    }

    next();
  });

  app.get("/health", (_req, res) => {
    res.json({ status: "ok", service: "sales-mcp" });
  });

  app.get("/ready", (_req, res) => {
    res.json({ status: "ready", service: "sales-mcp" });
  });

  app.post("/admin/authenticate", async (req, res) => {
    try {
      const payload = schemas.adminAuth.parse(req.body);
      const ok = await service.authenticateAdmin(payload);
      res.json({ ok, data: { authenticated: ok } });
    } catch (error) {
      handleError(res, error);
    }
  });

  app.post("/admin/check", (req, res) => {
    try {
      const payload = z.object({ telegramId: z.string().min(1) }).parse(req.body);
      const ok = service.isAdminWhitelisted(payload.telegramId);
      res.json({ ok: true, data: { whitelisted: ok } });
    } catch (error) {
      handleError(res, error);
    }
  });

  app.post("/tools/catalog_list", (req, res) => {
    try {
      const payload = schemas.catalogList.parse(req.body ?? {});
      const data = service.listProducts(payload);
      res.json({ ok: true, data });
    } catch (error) {
      handleError(res, error);
    }
  });

  app.post("/tools/catalog_categories", (_req, res) => {
    try {
      const data = service.listCategories();
      res.json({ ok: true, data });
    } catch (error) {
      handleError(res, error);
    }
  });

  app.post("/tools/catalog_get", (req, res) => {
    try {
      const payload = schemas.catalogGet.parse(req.body);
      const data = service.getProductBySkuOrId(payload.sku_or_id);
      res.json({ ok: true, data });
    } catch (error) {
      handleError(res, error);
    }
  });

  app.post("/tools/order_create", (req, res) => {
    try {
      const payload = schemas.orderCreate.parse(req.body);
      const data = service.createOrder(payload);
      res.json({ ok: true, data });
    } catch (error) {
      handleError(res, error);
    }
  });

  app.post("/tools/order_get", (req, res) => {
    try {
      const payload = schemas.orderGet.parse(req.body);
      const data = service.getOrderByCode(payload.order_code);
      res.json({ ok: true, data });
    } catch (error) {
      handleError(res, error);
    }
  });

  app.post("/tools/order_list", (req, res) => {
    try {
      const actorId = requireAdminActor(res, service, req.headers["x-actor-telegram-id"]);
      if (!actorId) {
        return;
      }
      const payload = schemas.orderList.parse(req.body ?? {});
      const data = service.listOrders(payload);
      res.json({ ok: true, data });
    } catch (error) {
      handleError(res, error);
    }
  });

  app.post("/tools/order_set_status", (req, res) => {
    try {
      const actorId = requireAdminActor(res, service, req.headers["x-actor-telegram-id"]);
      if (!actorId) {
        return;
      }
      const payload = schemas.orderSetStatus.parse(req.body);
      const data = service.setOrderStatus({
        orderCode: payload.order_code,
        status: payload.status,
        reason: payload.reason,
        actorTelegramId: actorId,
      });
      res.json({ ok: true, data });
    } catch (error) {
      handleError(res, error);
    }
  });

  app.post("/tools/payment_submit", (req, res) => {
    try {
      const payload = schemas.paymentSubmit.parse(req.body);
      const actorId = getActorTelegramId(req.headers["x-actor-telegram-id"]);
      const data = service.submitPayment({
        orderCode: payload.order_code,
        transferRef: payload.transfer_ref,
        proofText: payload.proof_text,
        actorTelegramId: actorId,
      });
      res.json({ ok: true, data });
    } catch (error) {
      handleError(res, error);
    }
  });

  app.post("/tools/payment_confirm", (req, res) => {
    try {
      const actorId = requireAdminActor(res, service, req.headers["x-actor-telegram-id"]);
      if (!actorId) {
        return;
      }
      const payload = schemas.paymentConfirm.parse(req.body);
      const data = service.confirmPayment({
        orderCode: payload.order_code,
        approved: payload.approved,
        note: payload.note,
        actorTelegramId: actorId,
      });
      res.json({ ok: true, data });
    } catch (error) {
      handleError(res, error);
    }
  });

  app.post("/tools/faq_answer", (req, res) => {
    try {
      const payload = schemas.faqAnswer.parse(req.body);
      const data = service.faqAnswer({
        question: payload.question,
        productSku: payload.product_sku,
      });
      res.json({ ok: true, data });
    } catch (error) {
      handleError(res, error);
    }
  });

  app.post("/admin/product_add", (req, res) => {
    try {
      const actorId = requireAdminActor(res, service, req.headers["x-actor-telegram-id"]);
      if (!actorId) {
        return;
      }
      const payload = schemas.productAdd.parse(req.body);
      const data = service.addProduct({ ...payload, actorTelegramId: actorId });
      res.json({ ok: true, data });
    } catch (error) {
      handleError(res, error);
    }
  });

  app.post("/admin/product_update", (req, res) => {
    try {
      const actorId = requireAdminActor(res, service, req.headers["x-actor-telegram-id"]);
      if (!actorId) {
        return;
      }
      const payload = schemas.productUpdate.parse(req.body);
      const data = service.updateProduct({ ...payload, actorTelegramId: actorId });
      res.json({ ok: true, data });
    } catch (error) {
      handleError(res, error);
    }
  });

  app.post("/admin/stock_set", (req, res) => {
    try {
      const actorId = requireAdminActor(res, service, req.headers["x-actor-telegram-id"]);
      if (!actorId) {
        return;
      }
      const payload = schemas.stockSet.parse(req.body);
      const data = service.setStock({ sku: payload.sku, qty: payload.qty, actorTelegramId: actorId });
      res.json({ ok: true, data });
    } catch (error) {
      handleError(res, error);
    }
  });

  app.post("/admin/customer_orders", (req, res) => {
    try {
      const actorId = requireAdminActor(res, service, req.headers["x-actor-telegram-id"]);
      if (!actorId) {
        return;
      }
      const payload = z.object({ telegramId: z.string().min(1) }).parse(req.body);
      const data = service.listOrdersByCustomer(payload.telegramId);
      res.json({ ok: true, data });
    } catch (error) {
      handleError(res, error);
    }
  });

  return app;
}

function handleError(res: express.Response, error: unknown): void {
  if (error instanceof z.ZodError) {
    res.status(400).json({ ok: false, error: error.flatten() });
    return;
  }

  const message = error instanceof Error ? error.message : "Unknown error";
  const status = /not found|invalid|missing|insufficient|accepting|bank_transfer|payment_review|pending/i.test(message)
    ? 400
    : 500;
  res.status(status).json({ ok: false, error: message });
}

function getActorTelegramId(header: string | string[] | undefined): string | undefined {
  return getHeaderValue(header);
}

function getHeaderValue(header: string | string[] | undefined): string | undefined {
  if (!header) {
    return undefined;
  }
  return Array.isArray(header) ? header[0] : header;
}

function requireAdminActor(
  res: express.Response,
  service: SalesService,
  header: string | string[] | undefined,
): string | null {
  const actorId = getActorTelegramId(header);
  if (!actorId) {
    res.status(401).json({ ok: false, error: "Missing x-actor-telegram-id header" });
    return null;
  }

  if (!service.isAdminWhitelisted(actorId)) {
    res.status(403).json({ ok: false, error: "Actor is not authorized as admin" });
    return null;
  }

  return actorId;
}
