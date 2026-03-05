import argon2 from "argon2";
import { createHash, timingSafeEqual } from "node:crypto";
import type Database from "better-sqlite3";
import type {
  CreateOrderInput,
  Order,
  OrderItem,
  OrderStatus,
  Product,
  ProductFaq,
  PaymentMethod,
} from "@openclaw/shared-types";
import { ORDER_STATUS_SET } from "./domain/orderStatus";
import { allowedTransitions, canTransition } from "./domain/orderStatus";
import { createId, nowIso } from "./lib/database";

export type SalesServiceConfig = {
  defaultShippingVnd: number;
  adminWhitelistIds: string[];
  adminPassphraseHash: string;
  adminPassphrasePlain?: string;
};

type ProductRow = {
  id: string;
  sku: string;
  name: string;
  category: string;
  image_url: string | null;
  price_vnd: number;
  stock_qty: number;
  description: string;
  faq_json: string;
  is_active: number;
  created_at: string;
  updated_at: string;
};

type OrderRow = {
  id: string;
  order_code: string;
  customer_telegram_id: string;
  customer_name: string;
  customer_phone: string;
  customer_address: string;
  items_json: string;
  subtotal_vnd: number;
  shipping_vnd: number;
  total_vnd: number;
  payment_method: PaymentMethod;
  payment_ref: string | null;
  note: string | null;
  status: OrderStatus;
  stock_released: number;
  created_at: string;
  updated_at: string;
};

type FaqRow = {
  id: string;
  product_sku: string | null;
  question: string;
  answer: string;
  tags_json: string;
};

type IdempotencyRow = {
  id: string;
  idempotency_key: string;
  customer_telegram_id: string;
  request_hash: string;
  order_code: string | null;
  response_json: string | null;
  created_at: string;
  updated_at: string;
};

export class SalesService {
  constructor(
    private readonly db: Database.Database,
    private readonly config: SalesServiceConfig,
  ) {}

  listProducts(input: { query?: string; category?: string; page?: number; limit?: number }): { items: Product[]; page: number; limit: number; total: number } {
    const page = Math.max(input.page ?? 1, 1);
    const limit = Math.min(Math.max(input.limit ?? 10, 1), 50);
    const offset = (page - 1) * limit;
    const query = input.query?.trim();
    const category = normalizeCategory(input.category);

    let rows: ProductRow[];
    let total = 0;

    if (query || category) {
      const params: unknown[] = [];
      const where: string[] = ["is_active=1"];
      if (query) {
        const like = `%${query.toLowerCase()}%`;
        where.push(`(
            lower(sku) LIKE ? OR
            lower(name) LIKE ? OR
            lower(description) LIKE ?
          )`);
        params.push(like, like, like);
      }
      if (category) {
        where.push("lower(category) = lower(?)");
        params.push(category);
      }

      rows = this.db
        .prepare(
          `
          SELECT * FROM products
          WHERE ${where.join(" AND ")}
          ORDER BY updated_at DESC
          LIMIT ? OFFSET ?
        `,
        )
        .all(...params, limit, offset) as ProductRow[];

      total = (this.db
        .prepare(
          `SELECT COUNT(*) as count FROM products WHERE ${where.join(" AND ")}`,
        )
        .get(...params) as { count: number }).count;
    } else {
      rows = this.db
        .prepare(
          `SELECT * FROM products WHERE is_active=1 ORDER BY updated_at DESC LIMIT ? OFFSET ?`,
        )
        .all(limit, offset) as ProductRow[];
      total = (this.db.prepare(`SELECT COUNT(*) as count FROM products WHERE is_active=1`).get() as { count: number }).count;
    }

    return {
      items: rows.map((row) => this.toProduct(row)),
      page,
      limit,
      total,
    };
  }

  listCategories(): Array<{ name: string; count: number }> {
    const rows = this.db
      .prepare(
        `
        SELECT category as name, COUNT(*) as count
        FROM products
        WHERE is_active=1
        GROUP BY category
        ORDER BY count DESC, category ASC
      `,
      )
      .all() as Array<{ name: string; count: number }>;
    return rows;
  }

  getProductBySkuOrId(skuOrId: string): Product | null {
    const row = this.db
      .prepare(`SELECT * FROM products WHERE (sku = ? OR id = ?) AND is_active=1 LIMIT 1`)
      .get(skuOrId, skuOrId) as ProductRow | undefined;
    return row ? this.toProduct(row) : null;
  }

  addProduct(input: {
    sku: string;
    name: string;
    category?: string;
    imageUrl?: string;
    priceVnd: number;
    stockQty: number;
    description: string;
    faq?: ProductFaq[];
    actorTelegramId?: string;
  }): Product {
    const now = nowIso();
    const id = createId("prd");
    const faq = input.faq ?? [];

    this.db
      .prepare(
        `
      INSERT INTO products (id, sku, name, category, image_url, price_vnd, stock_qty, description, faq_json, is_active, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)
    `,
      )
      .run(
        id,
        input.sku,
        input.name,
        normalizeCategory(input.category) ?? inferCategoryFromText(input.sku, input.name),
        normalizeImageUrl(input.imageUrl) ?? inferImageUrl(input.sku, input.name, input.category),
        input.priceVnd,
        input.stockQty,
        input.description,
        JSON.stringify(faq),
        now,
        now,
      );

    for (const item of faq) {
      this.db
        .prepare(
          `INSERT INTO faq_entries (id, product_sku, question, answer, tags_json, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        )
        .run(createId("faq"), input.sku, item.q, item.a, JSON.stringify([]), now, now);
    }

    if (input.actorTelegramId) {
      this.logAudit(input.actorTelegramId, "product_add", "product", input.sku, { sku: input.sku });
    }

    const created = this.getProductBySkuOrId(input.sku);
    if (!created) {
      throw new Error("Failed to create product");
    }
    return created;
  }

  updateProduct(input: {
    sku: string;
    name?: string;
    category?: string;
    imageUrl?: string;
    priceVnd?: number;
    stockQty?: number;
    description?: string;
    isActive?: boolean;
    faq?: ProductFaq[];
    actorTelegramId?: string;
  }): Product {
    const existing = this.db.prepare(`SELECT * FROM products WHERE sku = ? LIMIT 1`).get(input.sku) as ProductRow | undefined;
    if (!existing) {
      throw new Error("Product not found");
    }

    const next = {
      name: input.name ?? existing.name,
      category: normalizeCategory(input.category) ?? existing.category,
      image_url: normalizeImageUrl(input.imageUrl) ?? existing.image_url,
      price_vnd: input.priceVnd ?? existing.price_vnd,
      stock_qty: input.stockQty ?? existing.stock_qty,
      description: input.description ?? existing.description,
      faq_json: input.faq ? JSON.stringify(input.faq) : existing.faq_json,
      is_active: input.isActive === undefined ? existing.is_active : input.isActive ? 1 : 0,
      updated_at: nowIso(),
    };

    this.db
      .prepare(
        `
      UPDATE products
      SET name=@name, category=@category, image_url=@image_url, price_vnd=@price_vnd, stock_qty=@stock_qty, description=@description,
          faq_json=@faq_json, is_active=@is_active, updated_at=@updated_at
      WHERE sku=@sku
    `,
      )
      .run({ ...next, sku: input.sku });

    if (input.faq) {
      this.db.prepare(`DELETE FROM faq_entries WHERE product_sku = ?`).run(input.sku);
      for (const item of input.faq) {
        this.db
          .prepare(
            `INSERT INTO faq_entries (id, product_sku, question, answer, tags_json, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          )
          .run(createId("faq"), input.sku, item.q, item.a, JSON.stringify([]), nowIso(), nowIso());
      }
    }

    if (input.actorTelegramId) {
      this.logAudit(input.actorTelegramId, "product_update", "product", input.sku, { fields: Object.keys(input) });
    }

    return this.getProductBySkuOrId(input.sku) as Product;
  }

  setStock(input: { sku: string; qty: number; actorTelegramId?: string }): Product {
    const row = this.db.prepare(`SELECT * FROM products WHERE sku = ? LIMIT 1`).get(input.sku) as ProductRow | undefined;
    if (!row) {
      throw new Error("Product not found");
    }
    this.db.prepare(`UPDATE products SET stock_qty = ?, updated_at = ? WHERE sku = ?`).run(input.qty, nowIso(), input.sku);

    this.db
      .prepare(`INSERT INTO inventory_movements (id, order_code, sku, qty_change, reason, created_at) VALUES (?, NULL, ?, ?, ?, ?)`)
      .run(createId("inv"), input.sku, input.qty - row.stock_qty, "manual_set", nowIso());

    if (input.actorTelegramId) {
      this.logAudit(input.actorTelegramId, "stock_set", "product", input.sku, { qty: input.qty });
    }

    return this.getProductBySkuOrId(input.sku) as Product;
  }

  createOrder(input: CreateOrderInput): Order {
    if (input.items.length === 0) {
      throw new Error("Order must contain at least one item");
    }

    const idempotencyKey = normalizeIdempotencyKey(input.idempotency_key);
    if (input.idempotency_key && !idempotencyKey) {
      throw new Error("Invalid idempotency key");
    }
    const requestHash = idempotencyKey ? buildOrderRequestHash(input) : "";

    const tx = this.db.transaction((payload: CreateOrderInput, idemKey: string | undefined, idemRequestHash: string) => {
      const now = nowIso();

      if (idemKey) {
        const existing = this.db
          .prepare(`SELECT * FROM order_idempotency WHERE idempotency_key = ? LIMIT 1`)
          .get(idemKey) as IdempotencyRow | undefined;

        if (existing) {
          if (existing.request_hash !== idemRequestHash) {
            throw new Error("Idempotency key conflict");
          }
          if (existing.order_code) {
            return existing.order_code;
          }
        } else {
          this.db
            .prepare(
              `INSERT INTO order_idempotency (
                 id, idempotency_key, customer_telegram_id, request_hash, order_code, response_json, created_at, updated_at
               ) VALUES (?, ?, ?, ?, NULL, NULL, ?, ?)`,
            )
            .run(createId("idem"), idemKey, payload.customer.telegramId, idemRequestHash, now, now);
        }
      }

      const datePart = now.slice(0, 10).replace(/-/g, "");
      const prefix = `ORD-${datePart}-`;
      const count = (this.db
        .prepare(`SELECT COUNT(*) as count FROM orders WHERE order_code LIKE ?`)
        .get(`${prefix}%`) as { count: number }).count;
      const orderCode = `${prefix}${String(count + 1).padStart(4, "0")}`;

      let subtotal = 0;
      const items: OrderItem[] = [];

      for (const item of payload.items) {
        const product = this.db
          .prepare(`SELECT * FROM products WHERE sku = ? AND is_active=1 LIMIT 1`)
          .get(item.sku) as ProductRow | undefined;
        if (!product) {
          throw new Error(`Product not found: ${item.sku}`);
        }
        if (item.qty <= 0) {
          throw new Error(`Invalid qty for ${item.sku}`);
        }
        if (product.stock_qty < item.qty) {
          throw new Error(`Insufficient stock for ${item.sku}`);
        }

        subtotal += product.price_vnd * item.qty;
        items.push({
          sku: product.sku,
          qty: item.qty,
          unitPriceVnd: product.price_vnd,
          productName: product.name,
        });

        this.db.prepare(`UPDATE products SET stock_qty = stock_qty - ?, updated_at = ? WHERE sku = ?`).run(item.qty, now, product.sku);

        this.db
          .prepare(`INSERT INTO inventory_movements (id, order_code, sku, qty_change, reason, created_at) VALUES (?, ?, ?, ?, ?, ?)`)
          .run(createId("inv"), orderCode, product.sku, -item.qty, "order_create", now);
      }

      const shipping = this.config.defaultShippingVnd;
      const total = subtotal + shipping;
      const orderStatus: OrderStatus = payload.payment_method === "bank_transfer" ? "awaiting_payment" : "new";
      const orderId = createId("ord");

      this.db
        .prepare(
          `
        INSERT INTO orders (
          id, order_code, customer_telegram_id, customer_name, customer_phone, customer_address,
          items_json, subtotal_vnd, shipping_vnd, total_vnd, payment_method, payment_ref, note,
          status, stock_released, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, ?, 0, ?, ?)
      `,
        )
        .run(
          orderId,
          orderCode,
          payload.customer.telegramId,
          payload.customer.name,
          payload.customer.phone,
          payload.customer.address,
          JSON.stringify(items),
          subtotal,
          shipping,
          total,
          payload.payment_method,
          payload.note ?? null,
          orderStatus,
          now,
          now,
        );

      if (idemKey) {
        const snapshot: Order = {
          id: orderId,
          orderCode,
          customerTelegramId: payload.customer.telegramId,
          customerName: payload.customer.name,
          customerPhone: payload.customer.phone,
          customerAddress: payload.customer.address,
          items,
          subtotalVnd: subtotal,
          shippingVnd: shipping,
          totalVnd: total,
          paymentMethod: payload.payment_method,
          paymentRef: undefined,
          note: payload.note ?? undefined,
          status: orderStatus,
          stockReleased: false,
          createdAt: now,
          updatedAt: now,
        };
        this.db
          .prepare(
            `UPDATE order_idempotency
             SET order_code = ?, response_json = ?, updated_at = ?
             WHERE idempotency_key = ?`,
          )
          .run(orderCode, JSON.stringify(snapshot), now, idemKey);
      }

      return orderCode;
    });

    const code = tx(input, idempotencyKey || undefined, requestHash);
    return this.getOrderByCode(code) as Order;
  }

  getOrderByCode(orderCode: string): Order | null {
    const row = this.db.prepare(`SELECT * FROM orders WHERE order_code = ? LIMIT 1`).get(orderCode) as OrderRow | undefined;
    return row ? this.toOrder(row) : null;
  }

  listOrders(input: { status?: string; from?: string; to?: string }): Order[] {
    const where: string[] = [];
    const params: unknown[] = [];

    if (input.status) {
      where.push("status = ?");
      params.push(input.status);
    }
    if (input.from) {
      where.push("created_at >= ?");
      params.push(input.from);
    }
    if (input.to) {
      where.push("created_at <= ?");
      params.push(input.to);
    }

    const sql = `SELECT * FROM orders ${where.length > 0 ? `WHERE ${where.join(" AND ")}` : ""} ORDER BY created_at DESC LIMIT 200`;
    const rows = this.db.prepare(sql).all(...params) as OrderRow[];
    return rows.map((row) => this.toOrder(row));
  }

  listOrdersByCustomer(telegramId: string): Order[] {
    const rows = this.db
      .prepare(`SELECT * FROM orders WHERE customer_telegram_id = ? ORDER BY created_at DESC LIMIT 50`)
      .all(telegramId) as OrderRow[];
    return rows.map((row) => this.toOrder(row));
  }

  setOrderStatus(input: {
    orderCode: string;
    status: OrderStatus;
    reason?: string;
    actorTelegramId?: string;
  }): Order {
    if (!ORDER_STATUS_SET.has(input.status)) {
      throw new Error("Invalid status");
    }

    const tx = this.db.transaction((payload: typeof input) => {
      const row = this.db.prepare(`SELECT * FROM orders WHERE order_code = ? LIMIT 1`).get(payload.orderCode) as OrderRow | undefined;
      if (!row) {
        throw new Error("Order not found");
      }

      if (!canTransition(row.status, payload.status)) {
        throw new Error(
          `Invalid status transition ${row.status} -> ${payload.status}. Allowed: ${allowedTransitions(row.status).join(", ") || "none"}`,
        );
      }

      let stockReleased = row.stock_released;
      const now = nowIso();

      if (payload.status === "cancelled" && row.stock_released === 0) {
        const items = JSON.parse(row.items_json) as OrderItem[];
        for (const item of items) {
          this.db.prepare(`UPDATE products SET stock_qty = stock_qty + ?, updated_at = ? WHERE sku = ?`).run(item.qty, now, item.sku);
          this.db
            .prepare(`INSERT INTO inventory_movements (id, order_code, sku, qty_change, reason, created_at) VALUES (?, ?, ?, ?, ?, ?)`)
            .run(createId("inv"), payload.orderCode, item.sku, item.qty, "order_cancel_restock", now);
        }
        stockReleased = 1;
      }

      this.db.prepare(`UPDATE orders SET status = ?, stock_released = ?, updated_at = ? WHERE order_code = ?`).run(
        payload.status,
        stockReleased,
        now,
        payload.orderCode,
      );

      if (payload.status === "cancelled") {
        this.db
          .prepare(`UPDATE payments SET status = 'rejected', reviewed_by = ?, reviewed_at = ? WHERE order_code = ? AND status = 'pending'`)
          .run(payload.actorTelegramId ?? "system", now, payload.orderCode);
      }

      if (payload.actorTelegramId) {
        this.logAudit(payload.actorTelegramId, "order_set_status", "order", payload.orderCode, {
          nextStatus: payload.status,
          reason: payload.reason,
        });
      }
    });

    tx(input);
    return this.getOrderByCode(input.orderCode) as Order;
  }

  submitPayment(input: {
    orderCode: string;
    transferRef?: string;
    proofText?: string;
    actorTelegramId?: string;
  }): Order {
    const tx = this.db.transaction((payload: typeof input) => {
      const order = this.db.prepare(`SELECT * FROM orders WHERE order_code = ? LIMIT 1`).get(payload.orderCode) as OrderRow | undefined;
      if (!order) {
        throw new Error("Order not found");
      }
      if (order.payment_method !== "bank_transfer") {
        throw new Error("Order payment method is not bank_transfer");
      }
      if (!["awaiting_payment", "payment_review"].includes(order.status)) {
        throw new Error("Order is not accepting payment submission");
      }

      const now = nowIso();
      const pendingPayment = this.db
        .prepare(`SELECT id FROM payments WHERE order_code = ? AND status = 'pending' ORDER BY created_at DESC LIMIT 1`)
        .get(payload.orderCode) as { id: string } | undefined;

      if (pendingPayment) {
        this.db
          .prepare(`UPDATE payments SET transfer_ref = ?, proof_text = ?, created_at = ? WHERE id = ?`)
          .run(payload.transferRef ?? null, payload.proofText ?? null, now, pendingPayment.id);
      } else {
        this.db
          .prepare(
            `INSERT INTO payments (id, order_code, transfer_ref, proof_text, status, reviewed_by, reviewed_at, created_at)
           VALUES (?, ?, ?, ?, 'pending', NULL, NULL, ?)`,
          )
          .run(createId("pay"), payload.orderCode, payload.transferRef ?? null, payload.proofText ?? null, now);
      }

      this.db
        .prepare(`UPDATE orders SET payment_ref = ?, status = 'payment_review', updated_at = ? WHERE order_code = ?`)
        .run(payload.transferRef ?? order.payment_ref, now, payload.orderCode);

      if (payload.actorTelegramId) {
        this.logAudit(payload.actorTelegramId, "payment_submit", "order", payload.orderCode, {
          transferRef: payload.transferRef,
          replacedPending: Boolean(pendingPayment),
        });
      }
    });

    tx(input);
    return this.getOrderByCode(input.orderCode) as Order;
  }

  confirmPayment(input: {
    orderCode: string;
    approved: boolean;
    note?: string;
    actorTelegramId: string;
  }): Order {
    const tx = this.db.transaction((payload: typeof input) => {
      const order = this.db.prepare(`SELECT * FROM orders WHERE order_code = ? LIMIT 1`).get(payload.orderCode) as OrderRow | undefined;
      if (!order) {
        throw new Error("Order not found");
      }
      if (order.payment_method !== "bank_transfer") {
        throw new Error("Order payment method is not bank_transfer");
      }
      if (order.status !== "payment_review") {
        throw new Error("Order is not in payment_review status");
      }

      const payment = this.db
        .prepare(`SELECT * FROM payments WHERE order_code = ? AND status = 'pending' ORDER BY created_at DESC LIMIT 1`)
        .get(payload.orderCode) as { id: string } | undefined;

      if (!payment) {
        throw new Error("No pending payment found for this order");
      }

      const now = nowIso();
      if (payload.approved) {
        this.db.prepare(`UPDATE payments SET status = 'approved', reviewed_by = ?, reviewed_at = ? WHERE id = ?`).run(
          payload.actorTelegramId,
          now,
          payment.id,
        );
        this.db.prepare(`UPDATE orders SET status = 'paid', updated_at = ? WHERE order_code = ?`).run(now, payload.orderCode);
      } else {
        this.db.prepare(`UPDATE payments SET status = 'rejected', reviewed_by = ?, reviewed_at = ? WHERE id = ?`).run(
          payload.actorTelegramId,
          now,
          payment.id,
        );
        this.db.prepare(`UPDATE orders SET status = 'awaiting_payment', updated_at = ? WHERE order_code = ?`).run(now, payload.orderCode);
      }

      this.logAudit(payload.actorTelegramId, "payment_confirm", "order", payload.orderCode, {
        approved: payload.approved,
        note: payload.note,
      });
    });

    tx(input);
    return this.getOrderByCode(input.orderCode) as Order;
  }

  faqAnswer(input: { question: string; productSku?: string }):
    | { answer: string; sourceQuestion: string; productSku?: string; confidence: number }
    | null {
    const normalized = normalizeText(input.question);
    if (!normalized) {
      return null;
    }

    let rows: FaqRow[] = [];
    if (input.productSku) {
      rows = this.db
        .prepare(`
          SELECT id, product_sku, question, answer, tags_json
          FROM faq_entries
          WHERE product_sku = ? OR product_sku IS NULL
        `)
        .all(input.productSku) as FaqRow[];
    } else {
      rows = this.db
        .prepare(`SELECT id, product_sku, question, answer, tags_json FROM faq_entries`)
        .all() as FaqRow[];
    }

    let best: { row: FaqRow; score: number } | null = null;

    for (const row of rows) {
      const question = normalizeText(row.question);
      const answer = normalizeText(row.answer);
      const tags = normalizeText(JSON.parse(row.tags_json).join(" "));
      const score = overlapScore(normalized, question) * 0.6 + overlapScore(normalized, answer) * 0.3 + overlapScore(normalized, tags) * 0.1;

      if (!best || score > best.score) {
        best = { row, score };
      }
    }

    if (!best || best.score < 0.1) {
      return null;
    }

    return {
      answer: best.row.answer,
      sourceQuestion: best.row.question,
      productSku: best.row.product_sku ?? undefined,
      confidence: Number(best.score.toFixed(2)),
    };
  }

  async authenticateAdmin(input: { telegramId: string; passphrase: string }): Promise<boolean> {
    const isWhitelisted = this.config.adminWhitelistIds.includes(input.telegramId);
    if (!isWhitelisted) {
      return false;
    }
    const passphrase = input.passphrase.trim();

    if (this.config.adminPassphraseHash) {
      try {
        if (await argon2.verify(this.config.adminPassphraseHash, passphrase)) {
          return true;
        }
      } catch {
        // Invalid hash format (often caused by env interpolation). Fallback below.
      }
    }

    if (this.config.adminPassphrasePlain) {
      return safeEquals(passphrase, this.config.adminPassphrasePlain);
    }

    return false;
  }

  isAdminWhitelisted(telegramId: string): boolean {
    return this.config.adminWhitelistIds.includes(telegramId);
  }

  private logAudit(actorTelegramId: string, action: string, entityType: string, entityId: string, payload: unknown): void {
    this.db
      .prepare(
        `INSERT INTO audit_logs (id, actor_telegram_id, action, entity_type, entity_id, payload_json, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(createId("audit"), actorTelegramId, action, entityType, entityId, JSON.stringify(payload), nowIso());
  }

  private toProduct(row: ProductRow): Product {
    return {
      id: row.id,
      sku: row.sku,
      name: row.name,
      category: row.category,
      imageUrl: row.image_url ?? undefined,
      priceVnd: row.price_vnd,
      stockQty: row.stock_qty,
      description: row.description,
      faq: JSON.parse(row.faq_json) as ProductFaq[],
      isActive: row.is_active === 1,
    };
  }

  private toOrder(row: OrderRow): Order {
    return {
      id: row.id,
      orderCode: row.order_code,
      customerTelegramId: row.customer_telegram_id,
      customerName: row.customer_name,
      customerPhone: row.customer_phone,
      customerAddress: row.customer_address,
      items: JSON.parse(row.items_json) as OrderItem[],
      subtotalVnd: row.subtotal_vnd,
      shippingVnd: row.shipping_vnd,
      totalVnd: row.total_vnd,
      paymentMethod: row.payment_method,
      paymentRef: row.payment_ref ?? undefined,
      note: row.note ?? undefined,
      status: row.status,
      stockReleased: row.stock_released === 1,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}

function normalizeCategory(value?: string): string | undefined {
  if (!value) {
    return undefined;
  }
  const trimmed = value.trim().toLowerCase();
  return trimmed || undefined;
}

function normalizeImageUrl(value?: string): string | undefined {
  if (!value) {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed || undefined;
}

function inferCategoryFromText(sku: string, name: string): string {
  const text = `${sku} ${name}`.toLowerCase();
  if (text.includes("tra-sua") || text.includes("tra sua")) {
    return "milk_tea";
  }
  if (text.includes("tra-") || text.includes(" tra ")) {
    return "fruit_tea";
  }
  if (text.includes("nuoc-ep") || text.includes("nuoc ep")) {
    return "juice";
  }
  if (text.includes("cafe") || text.includes("ca phe") || text.includes("bac-xiu") || text.includes("bac xiu")) {
    return "coffee";
  }
  return "other";
}

function inferImageUrl(sku: string, name: string, category?: string): string {
  const normalizedName = name
    .replaceAll("đ", "d")
    .replaceAll("Đ", "D")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9\s]/g, " ")
    .trim()
    .replace(/\s+/g, "+");
  if (normalizedName) {
    return `https://placehold.co/640x420/png?text=${normalizedName}`;
  }

  const fallback = normalizeCategory(category) ?? inferCategoryFromText(sku, name);
  return `https://placehold.co/640x420/png?text=${fallback}`;
}
function normalizeText(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeIdempotencyKey(value?: string): string {
  if (!value) {
    return "";
  }
  const trimmed = value.trim();
  if (!trimmed) {
    return "";
  }
  if (trimmed.length > 96) {
    return "";
  }
  if (!/^[A-Za-z0-9:_\-.]+$/.test(trimmed)) {
    return "";
  }
  return trimmed;
}

function buildOrderRequestHash(input: CreateOrderInput): string {
  const canonical = {
    customer: {
      telegramId: String(input.customer.telegramId || "").trim(),
      name: String(input.customer.name || "").trim(),
      phone: String(input.customer.phone || "").trim(),
      address: String(input.customer.address || "").trim(),
    },
    payment_method: input.payment_method,
    note: input.note ? String(input.note).trim() : "",
    items: [...input.items]
      .map((item) => ({
        sku: String(item.sku || "").trim().toUpperCase(),
        qty: Number(item.qty || 0),
      }))
      .filter((item) => item.sku && Number.isInteger(item.qty) && item.qty > 0)
      .sort((left, right) => (left.sku === right.sku ? left.qty - right.qty : left.sku.localeCompare(right.sku))),
  };
  return createHash("sha256").update(JSON.stringify(canonical)).digest("hex");
}

function overlapScore(a: string, b: string): number {
  if (!a || !b) {
    return 0;
  }
  const aTokens = new Set(a.split(" ").filter((token) => token.length > 2));
  const bTokens = new Set(b.split(" ").filter((token) => token.length > 2));
  if (aTokens.size === 0 || bTokens.size === 0) {
    return 0;
  }

  let hit = 0;
  for (const token of aTokens) {
    if (bTokens.has(token)) {
      hit += 1;
    }
  }

  return hit / aTokens.size;
}

function safeEquals(a: string, b: string): boolean {
  const left = Buffer.from(a, "utf8");
  const right = Buffer.from(b, "utf8");
  if (left.length !== right.length) {
    return false;
  }
  return timingSafeEqual(left, right);
}
