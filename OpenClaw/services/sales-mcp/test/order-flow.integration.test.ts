import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import argon2 from "argon2";
import type Database from "better-sqlite3";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createApp } from "../src/app";
import { initDatabase, syncAdminWhitelist } from "../src/lib/database";
import { SalesService } from "../src/salesService";

const dbPath = path.join(os.tmpdir(), `openclaw-sales-test-${Date.now()}.db`);
const API_KEY = "test-internal-api-key";

let app: ReturnType<typeof createApp>;
let passphrase = "test-passphrase";
let db: Database.Database;

beforeAll(async () => {
  db = initDatabase(dbPath);
  const hash = await argon2.hash(passphrase, { type: argon2.argon2id });
  syncAdminWhitelist(db, ["999999"]);

  const service = new SalesService(db, {
    defaultShippingVnd: 10000,
    deliveryShopLat: 10.772081646838936,
    deliveryShopLng: 106.65817769618629,
    deliveryBaseEtaMinutes: 20,
    deliveryPerKmEtaMinutes: 4,
    deliveryFallbackEtaMinutes: 40,
    adminWhitelistIds: ["999999"],
    adminPassphraseHash: hash,
  });

  app = createApp(service, { apiKey: API_KEY });
});

afterAll(() => {
  db.close();
  if (fs.existsSync(dbPath)) {
    fs.unlinkSync(dbPath);
  }
});

describe("sales mcp integration", () => {
  it("lists product categories and filters by category", async () => {
    const categories = await request(app)
      .post("/tools/catalog_categories")
      .set("x-api-key", API_KEY)
      .send({})
      .expect(200);

    expect(categories.body.ok).toBe(true);
    expect(Array.isArray(categories.body.data)).toBe(true);
    expect(categories.body.data.some((item: any) => item.name === "coffee")).toBe(true);

    const filtered = await request(app)
      .post("/tools/catalog_list")
      .set("x-api-key", API_KEY)
      .send({ category: "coffee", page: 1, limit: 20 })
      .expect(200);

    expect(filtered.body.ok).toBe(true);
    expect(filtered.body.data.items.length).toBeGreaterThan(0);
    expect(filtered.body.data.items.every((item: any) => item.category === "coffee")).toBe(true);
  });

  it("creates order, submits payment, confirms payment", async () => {
    const create = await request(app)
      .post("/tools/order_create")
      .set("x-api-key", API_KEY)
      .send({
        customer: {
          telegramId: "12345",
          name: "Nguyen Van A",
          phone: "0909000001",
          address: "Ha Noi",
        },
        items: [{ sku: "CAFE-SUA-DA-L", qty: 2 }],
        payment_method: "bank_transfer",
      })
      .expect(200);

    expect(create.body.ok).toBe(true);
    const orderCode = create.body.data.orderCode as string;
    expect(orderCode).toMatch(/^ORD-\d{8}-\d{4}$/);
    expect(create.body.data.status).toBe("awaiting_payment");

    const submit = await request(app)
      .post("/tools/payment_submit")
      .set("x-api-key", API_KEY)
      .send({ order_code: orderCode, transfer_ref: "VCB998877" })
      .expect(200);

    expect(submit.body.data.status).toBe("payment_review");

    const confirm = await request(app)
      .post("/tools/payment_confirm")
      .set("x-api-key", API_KEY)
      .set("x-actor-telegram-id", "999999")
      .send({ order_code: orderCode, approved: true })
      .expect(200);

    expect(confirm.body.data.status).toBe("paid");
  });

  it("replays same order with identical idempotency_key", async () => {
    const payload = {
      customer: {
        telegramId: "idem-telegram-1",
        name: "Replay User",
        phone: "0909222333",
        address: "HCM",
      },
      items: [{ sku: "BAC-XIU-L", qty: 1 }],
      payment_method: "cod",
      idempotency_key: "sales-idem-same-001",
    };

    const first = await request(app)
      .post("/tools/order_create")
      .set("x-api-key", API_KEY)
      .send(payload)
      .expect(200);

    const second = await request(app)
      .post("/tools/order_create")
      .set("x-api-key", API_KEY)
      .send(payload)
      .expect(200);

    expect(first.body.ok).toBe(true);
    expect(second.body.ok).toBe(true);
    expect(second.body.data.orderCode).toBe(first.body.data.orderCode);
  });

  it("rejects idempotency_key conflict when payload differs", async () => {
    const key = "sales-idem-conflict-001";
    const payload1 = {
      customer: {
        telegramId: "idem-telegram-2",
        name: "Conflict User",
        phone: "0909555666",
        address: "Can Tho",
      },
      items: [{ sku: "BAC-XIU-L", qty: 1 }],
      payment_method: "cod",
      idempotency_key: key,
    };

    const payload2 = {
      ...payload1,
      items: [{ sku: "BAC-XIU-L", qty: 2 }],
    };

    await request(app)
      .post("/tools/order_create")
      .set("x-api-key", API_KEY)
      .send(payload1)
      .expect(200);

    const conflict = await request(app)
      .post("/tools/order_create")
      .set("x-api-key", API_KEY)
      .send(payload2)
      .expect(409);

    expect(conflict.body.ok).toBe(false);
    expect(String(conflict.body.error || "")).toContain("Idempotency key conflict");
  });

  it("reuses pending payment when customer resubmits transfer info", async () => {
    const create = await request(app)
      .post("/tools/order_create")
      .set("x-api-key", API_KEY)
      .send({
        customer: {
          telegramId: "12345",
          name: "Nguyen Van D",
          phone: "0909000004",
          address: "Can Tho",
        },
        items: [{ sku: "TRA-SUA-TRUYEN-THONG-L", qty: 1 }],
        payment_method: "bank_transfer",
      })
      .expect(200);

    const orderCode = create.body.data.orderCode as string;

    await request(app)
      .post("/tools/payment_submit")
      .set("x-api-key", API_KEY)
      .send({ order_code: orderCode, transfer_ref: "REF-FIRST", proof_text: "proof-a" })
      .expect(200);

    await request(app)
      .post("/tools/payment_submit")
      .set("x-api-key", API_KEY)
      .send({ order_code: orderCode, transfer_ref: "REF-SECOND", proof_text: "proof-b" })
      .expect(200);

    const pendingCount = (db
      .prepare(`SELECT COUNT(*) as count FROM payments WHERE order_code = ? AND status = 'pending'`)
      .get(orderCode) as { count: number }).count;
    const paymentRow = db
      .prepare(`SELECT transfer_ref, proof_text FROM payments WHERE order_code = ? AND status = 'pending' LIMIT 1`)
      .get(orderCode) as { transfer_ref: string; proof_text: string } | undefined;

    expect(pendingCount).toBe(1);
    expect(paymentRow?.transfer_ref).toBe("REF-SECOND");
    expect(paymentRow?.proof_text).toBe("proof-b");
  });

  it("blocks payment confirmation when order is not in payment_review", async () => {
    const createCod = await request(app)
      .post("/tools/order_create")
      .set("x-api-key", API_KEY)
      .send({
        customer: {
          telegramId: "12345",
          name: "Nguyen Van E",
          phone: "0909000005",
          address: "Hue",
        },
        items: [{ sku: "BAC-XIU-L", qty: 1 }],
        payment_method: "cod",
      })
      .expect(200);

    const codOrderCode = createCod.body.data.orderCode as string;
    const codConfirm = await request(app)
      .post("/tools/payment_confirm")
      .set("x-api-key", API_KEY)
      .set("x-actor-telegram-id", "999999")
      .send({ order_code: codOrderCode, approved: true })
      .expect(400);
    expect(String(codConfirm.body.error || "")).toContain("bank_transfer");
  });

  it("rolls stock back when order is cancelled", async () => {
    const before = await request(app).post("/tools/catalog_get").set("x-api-key", API_KEY).send({ sku_or_id: "BAC-XIU-L" }).expect(200);
    const beforeStock = before.body.data.stockQty as number;

    const create = await request(app)
      .post("/tools/order_create")
      .set("x-api-key", API_KEY)
      .send({
        customer: {
          telegramId: "12345",
          name: "Nguyen Van B",
          phone: "0909000002",
          address: "Da Nang",
        },
        items: [{ sku: "BAC-XIU-L", qty: 1 }],
        payment_method: "cod",
      })
      .expect(200);

    const orderCode = create.body.data.orderCode as string;

    await request(app)
      .post("/tools/order_set_status")
      .set("x-api-key", API_KEY)
      .set("x-actor-telegram-id", "999999")
      .send({ order_code: orderCode, status: "cancelled", reason: "customer_request" })
      .expect(200);

    const after = await request(app).post("/tools/catalog_get").set("x-api-key", API_KEY).send({ sku_or_id: "BAC-XIU-L" }).expect(200);
    const afterStock = after.body.data.stockQty as number;

    expect(afterStock).toBe(beforeStock);
  });

  it("blocks non-whitelisted admin authentication", async () => {
    const auth = await request(app)
      .post("/admin/authenticate")
      .set("x-api-key", API_KEY)
      .send({ telegramId: "111111", passphrase })
      .expect(200);
    expect(auth.body.ok).toBe(false);
    expect(auth.body.data.authenticated).toBe(false);
  });

  it("rejects mutating endpoint when actor is not admin", async () => {
    const create = await request(app)
      .post("/tools/order_create")
      .set("x-api-key", API_KEY)
      .send({
        customer: {
          telegramId: "12345",
          name: "Nguyen Van C",
          phone: "0909000003",
          address: "Hai Phong",
        },
        items: [{ sku: "BAC-XIU-L", qty: 1 }],
        payment_method: "cod",
      })
      .expect(200);

    const orderCode = create.body.data.orderCode as string;

    await request(app)
      .post("/tools/order_set_status")
      .set("x-api-key", API_KEY)
      .set("x-actor-telegram-id", "111111")
      .send({ order_code: orderCode, status: "cancelled" })
      .expect(403);
  });

  it("validates imageUrl for product admin APIs", async () => {
    await request(app)
      .post("/admin/product_add")
      .set("x-api-key", API_KEY)
      .set("x-actor-telegram-id", "999999")
      .send({
        sku: "TEST-INVALID-IMG",
        name: "Invalid Img",
        category: "coffee",
        imageUrl: "ftp://not-allowed.example/file.png",
        priceVnd: 10000,
        stockQty: 5,
        description: "demo",
      })
      .expect(400);
  });
});
