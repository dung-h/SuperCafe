import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";

const SAMPLE_PRODUCTS = [
  {
    sku: "CAFE-SUA-DA-L",
    name: "Cà phê sữa đá (Ly L)",
    category: "coffee",
    imageUrl: "https://placehold.co/640x420/png?text=Ca+phe+sua+da",
    priceVnd: 35000,
    stockQty: 120,
    description: "Cà phê phin đậm vị, sữa đặc cân bằng, đá viên sạch.",
    faq: [
      { q: "Mức độ ngọt có chỉnh được không?", a: "Có. Bạn có thể chọn ít ngọt, vừa ngọt hoặc đậm ngọt khi đặt món." },
      { q: "Có dùng được cho người không uống sữa đặc không?", a: "Có thể đổi sang cà phê đen đá hoặc dùng sữa tươi không đường." },
    ],
  },
  {
    sku: "BAC-XIU-L",
    name: "Bạc xỉu (Ly L)",
    category: "coffee",
    imageUrl: "https://placehold.co/640x420/png?text=Bac+xiu",
    priceVnd: 39000,
    stockQty: 100,
    description: "Sữa nhiều hơn cà phê, vị béo dịu, phù hợp uống buổi chiều.",
    faq: [
      { q: "Bạc xỉu có đắng không?", a: "Ít đắng, thiên về vị sữa béo và thơm nhẹ mùi cà phê." },
      { q: "Có thể đổi đá ít được không?", a: "Có, bạn chỉ cần ghi chú 'ít đá' khi lên đơn." },
    ],
  },
  {
    sku: "TRA-DAO-CAM-SA-L",
    name: "Trà đào cam sả (Ly L)",
    category: "fruit_tea",
    imageUrl: "https://placehold.co/640x420/png?text=Tra+dao+cam+sa",
    priceVnd: 42000,
    stockQty: 90,
    description: "Trà thanh mát, đào ngâm, lát cam tươi và hương sả tự nhiên.",
    faq: [
      { q: "Đồ uống này có caffeine không?", a: "Có caffeine nhẹ từ trà, thấp hơn cà phê." },
      { q: "Có thể giảm ngọt không?", a: "Có, có thể chọn 30%, 50%, 70% hoặc 100% đường." },
    ],
  },
  {
    sku: "TRA-SUA-TRUYEN-THONG-L",
    name: "Trà sữa truyền thống (Ly L)",
    category: "milk_tea",
    imageUrl: "https://placehold.co/640x420/png?text=Tra+sua+truyen+thong",
    priceVnd: 45000,
    stockQty: 110,
    description: "Trà đen ủ lạnh kết hợp nền sữa béo, topping trân châu đen.",
    faq: [
      { q: "Có topping mặc định không?", a: "Có, mặc định 1 phần trân châu đen." },
      { q: "Có thể đổi sang ít đá không?", a: "Có, bạn có thể chọn ít đá hoặc không đá." },
    ],
  },
  {
    sku: "NUOC-EP-CAM-TUOI-L",
    name: "Nước ép cam tươi (Ly L)",
    category: "juice",
    imageUrl: "https://placehold.co/640x420/png?text=Nuoc+ep+cam+tuoi",
    priceVnd: 40000,
    stockQty: 80,
    description: "Cam tươi ép tại chỗ, không pha hương liệu, vị chua ngọt tự nhiên.",
    faq: [
      { q: "Nước ép có thêm đường không?", a: "Mặc định không thêm đường, có thể thêm theo yêu cầu." },
      { q: "Có thể bỏ đá không?", a: "Có, bạn có thể chọn không đá." },
    ],
  },
];

export function initDatabase(sqlitePath: string): Database.Database {
  const folder = path.dirname(sqlitePath);
  if (!fs.existsSync(folder)) {
    fs.mkdirSync(folder, { recursive: true });
  }

  const db = new Database(sqlitePath);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");

  db.exec(`
    CREATE TABLE IF NOT EXISTS products (
      id TEXT PRIMARY KEY,
      sku TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      category TEXT NOT NULL DEFAULT 'other',
      image_url TEXT,
      price_vnd INTEGER NOT NULL,
      stock_qty INTEGER NOT NULL,
      description TEXT NOT NULL,
      faq_json TEXT NOT NULL,
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS faq_entries (
      id TEXT PRIMARY KEY,
      product_sku TEXT,
      question TEXT NOT NULL,
      answer TEXT NOT NULL,
      tags_json TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (product_sku) REFERENCES products(sku)
    );

    CREATE TABLE IF NOT EXISTS orders (
      id TEXT PRIMARY KEY,
      order_code TEXT NOT NULL UNIQUE,
      customer_telegram_id TEXT NOT NULL,
      customer_name TEXT NOT NULL,
      customer_phone TEXT NOT NULL,
      customer_address TEXT NOT NULL,
      items_json TEXT NOT NULL,
      subtotal_vnd INTEGER NOT NULL,
      shipping_vnd INTEGER NOT NULL,
      total_vnd INTEGER NOT NULL,
      payment_method TEXT NOT NULL,
      payment_ref TEXT,
      note TEXT,
      status TEXT NOT NULL,
      stock_released INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS payments (
      id TEXT PRIMARY KEY,
      order_code TEXT NOT NULL,
      transfer_ref TEXT,
      proof_text TEXT,
      status TEXT NOT NULL,
      reviewed_by TEXT,
      reviewed_at TEXT,
      created_at TEXT NOT NULL,
      FOREIGN KEY (order_code) REFERENCES orders(order_code)
    );

    CREATE TABLE IF NOT EXISTS admin_users (
      telegram_id TEXT PRIMARY KEY,
      display_name TEXT,
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS audit_logs (
      id TEXT PRIMARY KEY,
      actor_telegram_id TEXT NOT NULL,
      action TEXT NOT NULL,
      entity_type TEXT NOT NULL,
      entity_id TEXT NOT NULL,
      payload_json TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS inventory_movements (
      id TEXT PRIMARY KEY,
      order_code TEXT,
      sku TEXT NOT NULL,
      qty_change INTEGER NOT NULL,
      reason TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_orders_customer_telegram_id ON orders(customer_telegram_id);
    CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
    CREATE INDEX IF NOT EXISTS idx_payments_order_code ON payments(order_code);
    CREATE INDEX IF NOT EXISTS idx_faq_entries_product_sku ON faq_entries(product_sku);
  `);

  ensureProductCategoryColumn(db);
  ensureProductImageColumn(db);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_products_category ON products(category);`);
  seedData(db);
  return db;
}

export function nowIso(): string {
  return new Date().toISOString();
}

export function createId(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36)}`;
}

function seedData(db: Database.Database): void {
  const productCount = db.prepare("SELECT COUNT(*) as count FROM products").get() as { count: number };
  if (productCount.count > 0) {
    return;
  }

  const insertProduct = db.prepare(`
    INSERT INTO products (id, sku, name, category, image_url, price_vnd, stock_qty, description, faq_json, is_active, created_at, updated_at)
    VALUES (@id, @sku, @name, @category, @image_url, @price_vnd, @stock_qty, @description, @faq_json, 1, @created_at, @updated_at)
  `);

  const insertFaq = db.prepare(`
    INSERT INTO faq_entries (id, product_sku, question, answer, tags_json, created_at, updated_at)
    VALUES (@id, @product_sku, @question, @answer, @tags_json, @created_at, @updated_at)
  `);

  const now = nowIso();

  const seedTx = db.transaction(() => {
    for (const product of SAMPLE_PRODUCTS) {
      insertProduct.run({
        id: createId("prd"),
        sku: product.sku,
        name: product.name,
        category: product.category,
        image_url: product.imageUrl,
        price_vnd: product.priceVnd,
        stock_qty: product.stockQty,
        description: product.description,
        faq_json: JSON.stringify(product.faq),
        created_at: now,
        updated_at: now,
      });

      for (const faq of product.faq) {
        insertFaq.run({
          id: createId("faq"),
          product_sku: product.sku,
          question: faq.q,
          answer: faq.a,
          tags_json: JSON.stringify([]),
          created_at: now,
          updated_at: now,
        });
      }
    }

    insertFaq.run({
      id: createId("faq"),
      product_sku: null,
      question: "Chính sách giao hàng",
      answer: "Nội thành giao trong 2 giờ, ngoại thành trong ngày. Đơn xa từ 1-3 ngày tùy khu vực.",
      tags_json: JSON.stringify(["giao hàng", "shipping"]),
      created_at: now,
      updated_at: now,
    });

    insertFaq.run({
      id: createId("faq"),
      product_sku: null,
      question: "Đổi trả",
      answer: "Hỗ trợ đổi món trong 30 phút nếu giao sai sản phẩm hoặc đồ uống có lỗi từ cửa hàng.",
      tags_json: JSON.stringify(["đổi trả", "hoàn tiền"]),
      created_at: now,
      updated_at: now,
    });
  });

  seedTx();
}

export function syncAdminWhitelist(db: Database.Database, adminIds: string[]): void {
  if (adminIds.length === 0) {
    return;
  }

  const stmt = db.prepare(`
    INSERT INTO admin_users (telegram_id, display_name, is_active, created_at)
    VALUES (@telegram_id, @display_name, 1, @created_at)
    ON CONFLICT(telegram_id) DO UPDATE SET is_active=1
  `);

  const now = nowIso();
  const tx = db.transaction(() => {
    for (const id of adminIds) {
      stmt.run({ telegram_id: id, display_name: `admin_${id}`, created_at: now });
    }
  });
  tx();
}

function ensureProductCategoryColumn(db: Database.Database): void {
  const columns = db.prepare("PRAGMA table_info(products)").all() as Array<{ name: string }>;
  const hasCategory = columns.some((column) => column.name === "category");
  if (!hasCategory) {
    db.exec(`ALTER TABLE products ADD COLUMN category TEXT NOT NULL DEFAULT 'other';`);
  }

  const rows = db.prepare("SELECT sku, name, category FROM products").all() as Array<{ sku: string; name: string; category: string }>;
  const updateCategory = db.prepare("UPDATE products SET category = ? WHERE sku = ?");
  const tx = db.transaction(() => {
    for (const row of rows) {
      if (row.category && row.category.trim() !== "" && row.category !== "other") {
        continue;
      }
      updateCategory.run(inferCategory(row.sku, row.name), row.sku);
    }
  });
  tx();
}

function ensureProductImageColumn(db: Database.Database): void {
  const columns = db.prepare("PRAGMA table_info(products)").all() as Array<{ name: string }>;
  const hasImage = columns.some((column) => column.name === "image_url");
  if (!hasImage) {
    db.exec(`ALTER TABLE products ADD COLUMN image_url TEXT;`);
  }

  const rows = db
    .prepare("SELECT sku, name, category, image_url FROM products")
    .all() as Array<{ sku: string; name: string; category: string; image_url: string | null }>;
  const updateImage = db.prepare("UPDATE products SET image_url = ? WHERE sku = ?");
  const tx = db.transaction(() => {
    for (const row of rows) {
      if (row.image_url && row.image_url.trim() !== "") {
        continue;
      }
      updateImage.run(inferImageUrl(row.sku, row.name, row.category), row.sku);
    }
  });
  tx();
}

function inferCategory(sku: string, name: string): string {
  const text = `${sku} ${name}`.toLowerCase();
  if (text.includes("tra-sua") || text.includes("trà sữa")) {
    return "milk_tea";
  }
  if (text.includes("tra-") || text.includes(" trà ")) {
    return "fruit_tea";
  }
  if (text.includes("nuoc-ep") || text.includes("nước ép")) {
    return "juice";
  }
  if (text.includes("cafe") || text.includes("cà phê") || text.includes("bac-xiu") || text.includes("bạc xỉu")) {
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

  const fallback = category || inferCategory(sku, name);
  return `https://placehold.co/640x420/png?text=${fallback}`;
}
