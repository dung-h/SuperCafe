import { createHmac, randomUUID } from "node:crypto";
import express from "express";
import { Markup, Telegraf } from "telegraf";
import { message } from "telegraf/filters";
import { readConfig } from "./config";
import { logger } from "./logger";
import { getArgs, parseOrderCommand } from "./parsers";

type ApiResult<T> = { ok: boolean; data: T; error?: string };
type OpenClawSuggestion = { label: string; payload: string };
type OpenClawChatData = {
  reply: string;
  alerts?: string[];
  ui?: {
    type: "menu";
    title?: string;
    items?: Array<{
      sku: string;
      name: string;
      category?: string;
      priceVnd?: number;
      stockQty?: number;
    }>;
    suggestions?: Array<OpenClawSuggestion | string>;
  };
};

type BotContext = {
  adminSessions: Map<string, number>;
};

const CATEGORY_LABELS: Record<string, string> = {
  coffee: "Cà phê",
  milk_tea: "Trà sữa",
  fruit_tea: "Trà trái cây",
  juice: "Nước ép",
  other: "Khác",
};

const config = readConfig();
if (config.salesMcpApiKey === "dev-internal-key-change-me") {
  logger.warn("SALES_MCP_API_KEY is using default value; change it for non-demo environments.");
}
const MAIN_MENU_KEYBOARD = buildMainMenuKeyboard();
const bot = new Telegraf(config.token);
const state: BotContext = {
  adminSessions: new Map(),
};

bot.catch((error, ctx) => {
  logger.error({ error: String(error), updateType: ctx.updateType }, "telegram handler error");
});

bot.start(async (ctx) => {
  const miniAppHint = config.miniAppUrl
    ? "Mở Mini App: /miniapp hoặc bấm nút Mở cửa hàng."
    : "Mini App chưa cấu hình URL công khai.";

  await ctx.reply(
    [
      "Xin chào! Đây là trợ lý bán đồ uống.",
      miniAppHint,
      "",
      "Lệnh khách:",
      "/menu",
      "/categories",
      "/products_cat <category>",
      "/miniapp",
      "/products [từ_khóa]",
      "/product <sku>",
      "/order <sku:sl,... | họ tên | sđt | địa chỉ | bank_transfer|cod>",
      "/order_status <mã_đơn>",
      "/pay <mã_đơn> <mã_giao_dịch>",
      "",
      "Lệnh admin:",
      "/admin <passphrase>",
      "/orders [status]",
      "/order <mã_đơn>",
      "/confirm_payment <mã_đơn>",
      "/reject_payment <mã_đơn> [lý_do]",
      "/set_status <mã_đơn> <status> [reason]",
      "/product_add <sku|name|category|price|stock|description|imageUrl?>",
      "/product_update <sku|field=value|...>",
      "/stock_set <sku> <qty>",
    ].join("\n"),
    MAIN_MENU_KEYBOARD,
  );
});

bot.command("menu", async (ctx) => {
  await showProducts(ctx, undefined, true);
});

bot.command("categories", async (ctx) => {
  await showCategories(ctx);
});

bot.command("products_cat", async (ctx) => {
  const categoryInput = getArgs(ctx.message.text);
  const category = resolveCategoryKey(categoryInput);
  if (!category) {
    await ctx.reply("Cú pháp: /products_cat <coffee|milk_tea|fruit_tea|juice|other>", MAIN_MENU_KEYBOARD);
    return;
  }
  await showProducts(ctx, undefined, false, category);
});

bot.command("miniapp", async (ctx) => {
  await sendMiniAppLaunch(ctx);
});

bot.command("products", async (ctx) => {
  const raw = getArgs(ctx.message.text);
  await showProducts(ctx, raw, false);
});

bot.command("product", async (ctx) => {
  if (/^\/products(@\w+)?(?:\s|$)/i.test(ctx.message.text)) {
    const raw = getArgs(ctx.message.text);
    await showProducts(ctx, raw, false);
    return;
  }

  const correlationId = buildCorrelationId(ctx.message.message_id);
  const sku = getArgs(ctx.message.text);
  if (!sku) {
    await ctx.reply("Cú pháp: /product <sku>", MAIN_MENU_KEYBOARD);
    return;
  }

  const result = await postSales<any>("/tools/catalog_get", { sku_or_id: sku.trim().toUpperCase() }, correlationId);
  if (!result.ok) {
    await ctx.reply(`Không lấy được thông tin đồ uống: ${result.error}`, MAIN_MENU_KEYBOARD);
    return;
  }
  if (!result.data) {
    await ctx.reply("Không tìm thấy sản phẩm.", MAIN_MENU_KEYBOARD);
    return;
  }

  const p = result.data;
  const caption = `${p.name} (${p.sku})\nDanh mục: ${labelForCategory(p.category)}\nGiá: ${formatVnd(p.priceVnd)}\nTồn: ${p.stockQty}\nMô tả: ${p.description}`;
  if (typeof p.imageUrl === "string" && p.imageUrl.trim() !== "") {
    try {
      await ctx.replyWithPhoto(p.imageUrl, { caption, ...MAIN_MENU_KEYBOARD });
      return;
    } catch {
      // If Telegram cannot load the image URL, fallback to text response.
    }
  }
  await ctx.reply(caption, MAIN_MENU_KEYBOARD);
});

bot.command("order_status", async (ctx) => {
  const correlationId = buildCorrelationId(ctx.message.message_id);
  const orderCode = getArgs(ctx.message.text).toUpperCase();
  if (!/^ORD-\d{8}-\d{4}$/.test(orderCode)) {
    await ctx.reply("Cú pháp: /order_status ORD-YYYYMMDD-XXXX", MAIN_MENU_KEYBOARD);
    return;
  }

  const result = await postSales<any>("/tools/order_get", { order_code: orderCode }, correlationId);
  if (!result.ok || !result.data) {
    await ctx.reply("Không tìm thấy đơn hàng.", MAIN_MENU_KEYBOARD);
    return;
  }

  const requester = String(ctx.from.id);
  if (result.data.customerTelegramId !== requester && !isAdminSessionValid(requester)) {
    await ctx.reply("Bạn không có quyền xem đơn này.", MAIN_MENU_KEYBOARD);
    return;
  }

  await ctx.reply(renderOrder(result.data), MAIN_MENU_KEYBOARD);
});

bot.command("pay", async (ctx) => {
  const correlationId = buildCorrelationId(ctx.message.message_id);
  const args = getArgs(ctx.message.text).split(" ").filter(Boolean);
  if (args.length < 2) {
    await ctx.reply("Cú pháp: /pay <mã_đơn> <mã_giao_dịch> [ghi_chú]", MAIN_MENU_KEYBOARD);
    return;
  }

  const orderCode = args[0].toUpperCase();
  const transferRef = args[1];
  const proofText = args.slice(2).join(" ") || undefined;

  const result = await postSales<any>(
    "/tools/payment_submit",
    { order_code: orderCode, transfer_ref: transferRef, proof_text: proofText },
    correlationId,
    String(ctx.from.id),
  );

  if (!result.ok) {
    await ctx.reply(`Gửi thông tin thanh toán thất bại: ${result.error}`, MAIN_MENU_KEYBOARD);
    return;
  }

  await ctx.reply(`Đã ghi nhận thanh toán cho ${orderCode}. Admin sẽ xác nhận sớm.`, MAIN_MENU_KEYBOARD);
  await sendAdminAlert(`Cần duyệt thanh toán: ${orderCode} | transfer_ref=${maskTransferRef(transferRef)}`);
});

bot.command("order", async (ctx) => {
  const correlationId = buildCorrelationId(ctx.message.message_id);
  const raw = getArgs(ctx.message.text);

  if (!raw) {
    await ctx.reply(
      "Dùng để tạo đơn: /order SKU:SL,SKU:SL | Họ tên | Số điện thoại | Địa chỉ | bank_transfer|cod\nDùng để xem đơn (admin): /order ORD-YYYYMMDD-XXXX",
      MAIN_MENU_KEYBOARD,
    );
    return;
  }

  if (/^ORD-\d{8}-\d{4}$/i.test(raw)) {
    const code = raw.toUpperCase();
    const detail = await postSales<any>("/tools/order_get", { order_code: code }, correlationId);
    if (!detail.ok || !detail.data) {
      await ctx.reply("Không tìm thấy đơn hàng.", MAIN_MENU_KEYBOARD);
      return;
    }

    const userId = String(ctx.from.id);
    if (detail.data.customerTelegramId !== userId && !isAdminSessionValid(userId)) {
      await ctx.reply("Bạn không có quyền xem đơn này.", MAIN_MENU_KEYBOARD);
      return;
    }

    await ctx.reply(renderOrder(detail.data), MAIN_MENU_KEYBOARD);
    return;
  }

  const parsed = parseOrderCommand(raw, String(ctx.from.id));
  if (!parsed.ok) {
    await ctx.reply(
      "Sai định dạng. Mẫu: /order SKU:SL,SKU:SL | Họ tên | Số điện thoại | Địa chỉ | bank_transfer|cod\nVí dụ: /order CAFE-SUA-DA-L:2 | Nguyễn Văn A | 0909000001 | Hà Nội | bank_transfer",
      MAIN_MENU_KEYBOARD,
    );
    return;
  }

  const created = await postSales<any>("/tools/order_create", parsed.data, correlationId);
  if (!created.ok) {
    await ctx.reply(`Tạo đơn thất bại: ${created.error}`, MAIN_MENU_KEYBOARD);
    return;
  }

  await ctx.reply(
    `Đã tạo đơn ${created.data.orderCode}. Tổng ${formatVnd(created.data.totalVnd)}. Trạng thái ${created.data.status}.`,
    MAIN_MENU_KEYBOARD,
  );
  await sendAdminAlert(
    `Đơn mới ${created.data.orderCode} | ${created.data.customerName} | ${formatVnd(created.data.totalVnd)} | ${created.data.status}`,
  );
});

bot.command("admin", async (ctx) => {
  const correlationId = buildCorrelationId(ctx.message.message_id);
  const passphrase = normalizeAdminPassphrase(getArgs(ctx.message.text));
  if (!passphrase) {
    await ctx.reply("Cú pháp: /admin <passphrase>", MAIN_MENU_KEYBOARD);
    return;
  }

  const auth = await postSales<{ authenticated: boolean }>(
    "/admin/authenticate",
    { telegramId: String(ctx.from.id), passphrase },
    correlationId,
  );

  if (!auth.ok || !auth.data.authenticated) {
    await ctx.reply("Đăng nhập admin thất bại.", MAIN_MENU_KEYBOARD);
    return;
  }

  state.adminSessions.set(String(ctx.from.id), Date.now() + config.adminSessionTtlMs);
  await ctx.reply("Đăng nhập admin thành công.", MAIN_MENU_KEYBOARD);
});

bot.command("orders", async (ctx) => {
  if (!requireAdmin(ctx)) {
    return;
  }

  const correlationId = buildCorrelationId(ctx.message.message_id);
  const status = getArgs(ctx.message.text);
  const result = await postSales<any[]>(
    "/tools/order_list",
    { status: status || undefined },
    correlationId,
    String(ctx.from.id),
  );

  if (!result.ok) {
    await ctx.reply(`Không lấy được danh sách đơn: ${result.error}`, MAIN_MENU_KEYBOARD);
    return;
  }

  if (result.data.length === 0) {
    await ctx.reply("Không có đơn hàng nào.", MAIN_MENU_KEYBOARD);
    return;
  }

  const lines = result.data
    .slice(0, 20)
    .map((order) => `${order.orderCode} | ${order.customerName} | ${formatVnd(order.totalVnd)} | ${order.status}`);
  await ctx.reply(`Danh sách đơn (tối đa 20):\n${lines.join("\n")}`, MAIN_MENU_KEYBOARD);
});

bot.command("confirm_payment", async (ctx) => {
  if (!requireAdmin(ctx)) {
    return;
  }

  const correlationId = buildCorrelationId(ctx.message.message_id);
  const orderCode = getArgs(ctx.message.text).toUpperCase();
  if (!/^ORD-\d{8}-\d{4}$/.test(orderCode)) {
    await ctx.reply("Cú pháp: /confirm_payment ORD-YYYYMMDD-XXXX", MAIN_MENU_KEYBOARD);
    return;
  }

  const result = await postSales<any>(
    "/tools/payment_confirm",
    { order_code: orderCode, approved: true },
    correlationId,
    String(ctx.from.id),
  );

  if (!result.ok) {
    await ctx.reply(`Xác nhận thanh toán thất bại: ${translatePaymentError(result.error)}`, MAIN_MENU_KEYBOARD);
    return;
  }

  await ctx.reply(`Đã xác nhận thanh toán đơn ${orderCode}. Trạng thái mới: ${result.data.status}.`, MAIN_MENU_KEYBOARD);
});

bot.command("reject_payment", async (ctx) => {
  if (!requireAdmin(ctx)) {
    return;
  }

  const correlationId = buildCorrelationId(ctx.message.message_id);
  const args = getArgs(ctx.message.text).split(" ").filter(Boolean);
  if (args.length < 1) {
    await ctx.reply("Cú pháp: /reject_payment ORD-YYYYMMDD-XXXX [lý_do]", MAIN_MENU_KEYBOARD);
    return;
  }

  const [orderCodeRaw, ...noteParts] = args;
  const orderCode = orderCodeRaw.toUpperCase();
  const note = noteParts.join(" ").trim() || "admin_rejected";
  if (!/^ORD-\d{8}-\d{4}$/.test(orderCode)) {
    await ctx.reply("Cú pháp: /reject_payment ORD-YYYYMMDD-XXXX [lý_do]", MAIN_MENU_KEYBOARD);
    return;
  }

  const result = await postSales<any>(
    "/tools/payment_confirm",
    { order_code: orderCode, approved: false, note },
    correlationId,
    String(ctx.from.id),
  );

  if (!result.ok) {
    await ctx.reply(`Từ chối thanh toán thất bại: ${translatePaymentError(result.error)}`, MAIN_MENU_KEYBOARD);
    return;
  }

  await ctx.reply(`Đã từ chối thanh toán đơn ${orderCode}. Trạng thái mới: ${result.data.status}.`, MAIN_MENU_KEYBOARD);
});

bot.command("set_status", async (ctx) => {
  if (!requireAdmin(ctx)) {
    return;
  }

  const correlationId = buildCorrelationId(ctx.message.message_id);
  const args = getArgs(ctx.message.text).split(" ").filter(Boolean);
  if (args.length < 2) {
    await ctx.reply("Cú pháp: /set_status <mã_đơn> <status> [reason]", MAIN_MENU_KEYBOARD);
    return;
  }

  const [orderCodeRaw, status, ...rest] = args;
  const orderCode = orderCodeRaw.toUpperCase();
  const reason = rest.join(" ") || undefined;

  const result = await postSales<any>(
    "/tools/order_set_status",
    { order_code: orderCode, status, reason },
    correlationId,
    String(ctx.from.id),
  );

  if (!result.ok) {
    await ctx.reply(`Cập nhật trạng thái thất bại: ${result.error}`, MAIN_MENU_KEYBOARD);
    return;
  }

  await ctx.reply(`Đơn ${orderCode} đã chuyển sang ${result.data.status}.`, MAIN_MENU_KEYBOARD);
});

bot.command("product_add", async (ctx) => {
  if (!requireAdmin(ctx)) {
    return;
  }

  const correlationId = buildCorrelationId(ctx.message.message_id);
  const raw = getArgs(ctx.message.text);
  const chunks = raw.split("|").map((item) => item.trim());
  if (chunks.length < 5) {
    await ctx.reply("Cú pháp: /product_add <sku|name|category|price|stock|description|imageUrl?>", MAIN_MENU_KEYBOARD);
    return;
  }

  const hasCategory = chunks.length >= 6 && Number.isNaN(Number(chunks[2]));
  const sku = chunks[0];
  const name = chunks[1];
  const category = hasCategory ? chunks[2] : undefined;
  const priceRaw = hasCategory ? chunks[3] : chunks[2];
  const stockRaw = hasCategory ? chunks[4] : chunks[3];
  const descriptionStart = hasCategory ? 5 : 4;
  const maybeImageUrl = chunks[chunks.length - 1];
  const hasImageUrl = /^https?:\/\//i.test(maybeImageUrl) && chunks.length >= (hasCategory ? 7 : 6);
  const descriptionChunks = hasImageUrl ? chunks.slice(descriptionStart, -1) : chunks.slice(descriptionStart);
  const imageUrl = hasImageUrl ? maybeImageUrl : undefined;
  const result = await postSales<any>(
    "/admin/product_add",
    {
      sku,
      name,
      category,
      imageUrl,
      priceVnd: Number(priceRaw),
      stockQty: Number(stockRaw),
      description: descriptionChunks.join("|").trim(),
    },
    correlationId,
    String(ctx.from.id),
  );

  if (!result.ok) {
    await ctx.reply(`Thêm sản phẩm thất bại: ${result.error}`, MAIN_MENU_KEYBOARD);
    return;
  }

  await ctx.reply(`Đã thêm sản phẩm ${result.data.sku}.`, MAIN_MENU_KEYBOARD);
});

bot.command("product_update", async (ctx) => {
  if (!requireAdmin(ctx)) {
    return;
  }

  const correlationId = buildCorrelationId(ctx.message.message_id);
  const raw = getArgs(ctx.message.text);
  const chunks = raw.split("|").map((item) => item.trim()).filter(Boolean);
  if (chunks.length < 2) {
    await ctx.reply("Cú pháp: /product_update <sku|field=value|...>", MAIN_MENU_KEYBOARD);
    return;
  }

  const [sku, ...fields] = chunks;
  const payload: Record<string, unknown> = { sku };
  for (const field of fields) {
    const [key, ...valueParts] = field.split("=");
    const valueRaw = valueParts.join("=").trim();
    const valueLower = valueRaw.toLowerCase();
    if (!key || !valueRaw) {
      continue;
    }

    if (key === "priceVnd" || key === "stockQty") {
      payload[key] = Number(valueRaw);
    } else if (key === "isActive") {
      payload[key] = valueLower === "true" || valueLower === "1";
    } else {
      payload[key] = valueRaw;
    }
  }

  const result = await postSales<any>("/admin/product_update", payload, correlationId, String(ctx.from.id));
  if (!result.ok) {
    await ctx.reply(`Cập nhật sản phẩm thất bại: ${result.error}`, MAIN_MENU_KEYBOARD);
    return;
  }

  await ctx.reply(`Đã cập nhật sản phẩm ${result.data.sku}.`, MAIN_MENU_KEYBOARD);
});

bot.command("stock_set", async (ctx) => {
  if (!requireAdmin(ctx)) {
    return;
  }

  const correlationId = buildCorrelationId(ctx.message.message_id);
  const args = getArgs(ctx.message.text).split(" ").filter(Boolean);
  if (args.length !== 2) {
    await ctx.reply("Cú pháp: /stock_set <sku> <qty>", MAIN_MENU_KEYBOARD);
    return;
  }

  const [sku, qtyRaw] = args;
  const qty = Number(qtyRaw);
  if (!Number.isInteger(qty) || qty < 0) {
    await ctx.reply("Số lượng tồn kho phải là số nguyên >= 0.", MAIN_MENU_KEYBOARD);
    return;
  }

  const result = await postSales<any>("/admin/stock_set", { sku, qty }, correlationId, String(ctx.from.id));
  if (!result.ok) {
    await ctx.reply(`Cập nhật tồn thất bại: ${result.error}`, MAIN_MENU_KEYBOARD);
    return;
  }

  await ctx.reply(`Đã cập nhật tồn ${result.data.sku} = ${result.data.stockQty}.`, MAIN_MENU_KEYBOARD);
});

bot.on("callback_query", async (ctx) => {
  const callbackData = "data" in ctx.callbackQuery ? String(ctx.callbackQuery.data || "").trim() : "";
  if (!callbackData) {
    await ctx.answerCbQuery("Dữ liệu không hợp lệ");
    return;
  }

  const correlationId = `tg-cb-${randomUUID().slice(0, 8)}`;
  const response = await postOpenClaw<OpenClawChatData>(
    "/chat",
    {
      userId: String(ctx.from.id),
      message: callbackData,
      actionPayload: callbackData,
      channel: "telegram",
      correlationId,
      clientContext: {
        sourceMessageId: String((ctx.callbackQuery as any).message?.message_id || ""),
        locale: "vi-VN",
      },
      profile: {
        name: [ctx.from.first_name, ctx.from.last_name].filter(Boolean).join(" ") || undefined,
      },
    },
    correlationId,
  );

  if (!response.ok) {
    await ctx.answerCbQuery("Lỗi hệ thống", { show_alert: true });
    await ctx.reply(`Hệ thống tạm lỗi: ${response.error}`, MAIN_MENU_KEYBOARD);
    return;
  }

  await ctx.answerCbQuery();
  await sendOpenClawReply(ctx, response.data);
});

bot.on(message("text"), async (ctx) => {
  const text = ctx.message.text.trim();
  if (!text || text.startsWith("/")) {
    return;
  }

  if (text === "Xem menu đồ uống") {
    await showProducts(ctx, undefined, true);
    return;
  }

  if (text === "Danh mục đồ uống") {
    await showCategories(ctx);
    return;
  }

  const categoryFromLabel = resolveCategoryKey(text);
  if (categoryFromLabel) {
    await showProducts(ctx, undefined, false, categoryFromLabel);
    return;
  }

  if (text === "Mở cửa hàng") {
    await sendMiniAppLaunch(ctx);
    return;
  }

  if (text === "Đặt món nhanh") {
    await ctx.reply(
      "Bạn gửi theo mẫu:\n/order SKU:SL,SKU:SL | Họ tên | Số điện thoại | Địa chỉ | bank_transfer|cod\nVí dụ:\n/order CAFE-SUA-DA-L:2 | Nguyễn Văn A | 0909000001 | Hà Nội | bank_transfer",
      MAIN_MENU_KEYBOARD,
    );
    return;
  }

  if (text === "Kiểm tra đơn hàng") {
    await ctx.reply("Bạn gửi: /order_status ORD-YYYYMMDD-XXXX", MAIN_MENU_KEYBOARD);
    return;
  }

  if (text === "Hướng dẫn thanh toán") {
    await ctx.reply("Bạn gửi: /pay ORD-YYYYMMDD-XXXX <mã_giao_dịch>", MAIN_MENU_KEYBOARD);
    return;
  }

  const correlationId = buildCorrelationId(ctx.message.message_id);

  // UX Enhancement: Send native typing indicator while waiting for LLM
  try {
    await ctx.sendChatAction("typing");
  } catch (err) {
    logger.warn({ error: String(err) }, "Failed to send typing action to Telegram");
  }

  const response = await postOpenClaw<OpenClawChatData>(
    "/chat",
    {
      userId: String(ctx.from.id),
      message: text,
      channel: "telegram",
      correlationId,
      clientContext: {
        sourceMessageId: String(ctx.message.message_id),
        locale: "vi-VN",
      },
      profile: {
        name: [ctx.from.first_name, ctx.from.last_name].filter(Boolean).join(" ") || undefined,
      },
    },
    correlationId,
  );

  if (!response.ok) {
    await ctx.reply(`Hệ thống tạm lỗi: ${response.error}`, MAIN_MENU_KEYBOARD);
    return;
  }

  await sendOpenClawReply(ctx, response.data);
});

async function sendOpenClawReply(ctx: any, data: OpenClawChatData): Promise<void> {
  const suggestions = normalizeSuggestions(data.ui?.suggestions);
  const menuItems = normalizeUiItems(data.ui?.items);
  if (menuItems.length) {
    await sendOpenClawMenuReply(ctx, data.reply, menuItems, suggestions);
  } else if (suggestions.length) {
    await ctx.reply(data.reply, Markup.inlineKeyboard(buildInlineButtons(ctx, suggestions)));
  } else {
    await ctx.reply(data.reply, MAIN_MENU_KEYBOARD);
  }

  if (data.alerts?.length) {
    for (const alert of data.alerts) {
      await sendAdminAlert(alert);
    }
  }
}

function normalizeSuggestions(raw?: Array<OpenClawSuggestion | string>): OpenClawSuggestion[] {
  if (!Array.isArray(raw)) {
    return [];
  }

  const normalized: OpenClawSuggestion[] = [];
  for (const entry of raw) {
    if (typeof entry === "string") {
      const text = entry.trim();
      if (text) {
        normalized.push({ label: text, payload: text });
      }
      continue;
    }

    const label = String(entry.label || "").trim();
    const payload = String(entry.payload || "").trim();
    if (label && payload) {
      normalized.push({ label, payload });
    }
  }
  return normalized;
}

function normalizeUiItems(raw?: Array<{ sku?: string; name?: string; category?: string; priceVnd?: number; stockQty?: number }>): Array<{
  sku: string;
  name: string;
  category?: string;
  priceVnd: number;
  stockQty: number;
}> {
  if (!Array.isArray(raw)) {
    return [];
  }
  return raw
    .map((item) => ({
      sku: String(item?.sku || "").trim().toUpperCase(),
      name: String(item?.name || "").trim(),
      category: item?.category ? String(item.category).trim() : undefined,
      priceVnd: Number(item?.priceVnd || 0),
      stockQty: Number(item?.stockQty || 0),
    }))
    .filter((item) => item.sku !== "" && item.name !== "");
}

async function sendOpenClawMenuReply(
  ctx: any,
  replyText: string,
  items: Array<{ sku: string; name: string; category?: string; priceVnd: number; stockQty: number }>,
  suggestions: OpenClawSuggestion[],
): Promise<void> {
  const previewItems = items.slice(0, 8);
  const lines = previewItems.map(
    (item, index) =>
      `${index + 1}. ${item.name} (${item.sku}) • ${formatVnd(item.priceVnd)} • còn ${Math.max(0, item.stockQty)}`,
  );

  const text = `${replyText}\n\n${lines.join("\n")}`;
  const keyboardRows: any[][] = previewItems.map((item) => [
    Markup.button.callback(`➕ ${truncateLabel(item.name, 26)}`, `ACTION_ORDER_ADD:${item.sku}`),
  ]);

  const quickRows = chunkArray(suggestions.slice(0, 6), 2).map((row) =>
    row.map((entry) => buildInlineButtonFromSuggestion(ctx?.from, entry)),
  );
  keyboardRows.push(...quickRows);

  const miniAppUrl = buildMiniAppUrlForUser(ctx?.from);
  if (miniAppUrl) {
    keyboardRows.push([Markup.button.url("🌐 Xem menu web", miniAppUrl)]);
  }

  await ctx.reply(text, Markup.inlineKeyboard(keyboardRows));
}

function buildInlineButtons(ctx: any, suggestions: OpenClawSuggestion[]): any[][] {
  const rows: any[][] = [];
  for (let i = 0; i < suggestions.length && i < 8; i += 2) {
    const row: any[] = [];
    const first = suggestions[i];
    row.push(buildInlineButtonFromSuggestion(ctx?.from, first));
    const second = suggestions[i + 1];
    if (second) {
      row.push(buildInlineButtonFromSuggestion(ctx?.from, second));
    }
    rows.push(row);
  }
  const miniAppUrl = buildMiniAppUrlForUser(ctx?.from);
  if (miniAppUrl) {
    rows.push([Markup.button.url("🌐 Xem menu web", miniAppUrl)]);
  }
  return rows;
}

function buildInlineButtonFromSuggestion(
  from: { id?: number; first_name?: string; last_name?: string; username?: string } | undefined,
  suggestion: OpenClawSuggestion,
): any {
  const reviewUrl = buildOrderReviewUrlForUser(from, suggestion.payload);
  if (reviewUrl) {
    return Markup.button.url(suggestion.label, reviewUrl);
  }
  return Markup.button.callback(suggestion.label, suggestion.payload);
}

const healthApp = express();
healthApp.get("/health", (_req, res) => {
  res.json({ status: "ok", service: "telegram-gateway", adminSessions: state.adminSessions.size });
});
healthApp.get("/ready", (_req, res) => {
  res.json({ status: "ready", service: "telegram-gateway" });
});

healthApp.listen(config.port, config.host, () => {
  logger.info({ host: config.host, port: config.port }, "telegram-gateway health server listening");
});

void launchBotWithRetry();

process.once("SIGINT", () => bot.stop("SIGINT"));
process.once("SIGTERM", () => bot.stop("SIGTERM"));

function requireAdmin(ctx: any): boolean {
  const telegramId = String(ctx.from.id);
  if (!isAdminSessionValid(telegramId)) {
    ctx.reply("Bạn chưa đăng nhập admin. Dùng /admin <passphrase>.", MAIN_MENU_KEYBOARD);
    return false;
  }
  return true;
}

function isAdminSessionValid(telegramId: string): boolean {
  const expiresAt = state.adminSessions.get(telegramId);
  if (!expiresAt) {
    return false;
  }
  if (Date.now() >= expiresAt) {
    state.adminSessions.delete(telegramId);
    return false;
  }
  return true;
}

function renderOrder(order: any): string {
  const lines = order.items.map((item: any) => `- ${item.sku} x${item.qty} = ${formatVnd(item.qty * item.unitPriceVnd)}`);
  return [
    `Đơn ${order.orderCode}`,
    `Trạng thái: ${order.status}`,
    `Khách: ${order.customerName}`,
    `Tổng: ${formatVnd(order.totalVnd)}`,
    "Sản phẩm:",
    ...lines,
  ].join("\n");
}

function formatVnd(value: number): string {
  return new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
    maximumFractionDigits: 0,
  }).format(value);
}

function buildCorrelationId(messageId: number): string {
  return `tg-${messageId}-${randomUUID().slice(0, 8)}`;
}

async function showProducts(ctx: any, query?: string, withGuide?: boolean, category?: string): Promise<void> {
  const correlationId = buildCorrelationId(ctx.message.message_id);
  const result = await postSales<{ items: Array<{ sku: string; name: string; category?: string; priceVnd: number; stockQty: number }> }>(
    "/tools/catalog_list",
    { query: query || undefined, category: category || undefined, page: 1, limit: 20 },
    correlationId,
  );

  if (!result.ok) {
    await ctx.reply(`Không lấy được menu đồ uống: ${result.error}`, MAIN_MENU_KEYBOARD);
    return;
  }

  if (result.data.items.length === 0) {
    await ctx.reply("Hiện chưa có món phù hợp với bộ lọc bạn chọn.", MAIN_MENU_KEYBOARD);
    return;
  }

  const previewItems = result.data.items.slice(0, 8);
  const lines = previewItems.map(
    (item, index) => `${index + 1}. ${item.name} (${item.sku}) • ${formatVnd(item.priceVnd)} • còn ${item.stockQty}`,
  );

  const title = category ? `Menu ${labelForCategory(category)}:` : "Menu đồ uống hiện có:";
  const guide = withGuide ? "\n\nTip: Bấm nút để thêm món nhanh, hoặc mở menu web để xem trực quan hơn." : "";
  const totalHint = result.data.items.length > previewItems.length ? `\n(Hiển thị ${previewItems.length}/${result.data.items.length} món đầu)` : "";
  const keyboardRows: any[][] = previewItems.map((item) => [
    Markup.button.callback(`➕ ${truncateLabel(item.name, 26)}`, `ACTION_ORDER_ADD:${item.sku}`),
  ]);
  keyboardRows.push([Markup.button.callback("🧾 Bắt đầu wizard đặt đơn", "ACTION_ORDER_START")]);
  const miniAppUrl = buildMiniAppUrlForUser(ctx.from);
  if (miniAppUrl) {
    keyboardRows.push([Markup.button.url("🌐 Mở menu web", miniAppUrl)]);
  }

  await ctx.reply(`${title}\n${lines.join("\n")}${totalHint}${guide}`, Markup.inlineKeyboard(keyboardRows));
}

async function showCategories(ctx: any): Promise<void> {
  const correlationId = buildCorrelationId(ctx.message.message_id);
  const result = await postSales<Array<{ name: string; count: number }>>("/tools/catalog_categories", {}, correlationId);
  if (!result.ok) {
    await ctx.reply(`Không lấy được danh mục: ${result.error}`, MAIN_MENU_KEYBOARD);
    return;
  }
  if (!result.data.length) {
    await ctx.reply("Hiện chưa có danh mục nào.", MAIN_MENU_KEYBOARD);
    return;
  }

  const lines = result.data.map((item) => `- ${labelForCategory(item.name)} (${item.count} món): /products_cat ${item.name}`);
  const categoryRows = chunkArray(result.data.map((item) => labelForCategory(item.name)), 2);
  const keyboardRows: any[] = [...categoryRows, ["Xem menu đồ uống", "Đặt món nhanh"], ["Kiểm tra đơn hàng", "Hướng dẫn thanh toán"]];
  await ctx.reply(
    `Danh mục hiện có:\n${lines.join("\n")}\n\nBạn có thể bấm trực tiếp tên danh mục ở bàn phím bên dưới.`,
    Markup.keyboard(keyboardRows).resize(),
  );
}

async function postSales<T>(path: string, body: unknown, correlationId: string, actorTelegramId?: string): Promise<ApiResult<T>> {
  return postJson<T>(`${config.salesMcpUrl}${path}`, body, correlationId, actorTelegramId, {
    "x-api-key": config.salesMcpApiKey,
  });
}

async function postOpenClaw<T>(path: string, body: unknown, correlationId: string): Promise<ApiResult<T>> {
  return postJson<T>(`${config.openclawUrl}${path}`, body, correlationId);
}

async function postJson<T>(
  url: string,
  body: unknown,
  correlationId: string,
  actorTelegramId?: string,
  extraHeaders?: Record<string, string>,
): Promise<ApiResult<T>> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), config.httpTimeoutMs);

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-correlation-id": correlationId,
        ...(actorTelegramId ? { "x-actor-telegram-id": actorTelegramId } : {}),
        ...(extraHeaders ?? {}),
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    const json = (await response.json()) as ApiResult<T>;
    if (!response.ok) {
      return { ok: false, data: json.data, error: json.error ?? `HTTP ${response.status}` };
    }
    return json;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { ok: false, data: undefined as T, error: message };
  } finally {
    clearTimeout(timeout);
  }
}

async function sendAdminAlert(messageText: string): Promise<void> {
  if (!config.adminAlertChatId) {
    return;
  }

  try {
    await bot.telegram.sendMessage(config.adminAlertChatId, `[ALERT] ${messageText}`);
  } catch (error) {
    logger.warn({ error: String(error), messageText }, "failed to send admin alert");
  }
}

async function launchBotWithRetry(): Promise<void> {
  while (true) {
    try {
      await bot.launch({
        dropPendingUpdates: false,
        allowedUpdates: ["message", "callback_query"],
      });
      await configureMiniAppMenuButton();
      const me = await bot.telegram.getMe();
      logger.info(
        { pollingTimeoutSec: config.pollingTimeoutSec, botUsername: me.username, botId: me.id },
        "telegram bot started (long polling)",
      );
      return;
    } catch (error) {
      logger.error({ error: String(error) }, "telegram bot failed to start; retrying in 5s");
      await sleep(5000);
    }
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function normalizeAdminPassphrase(raw: string): string {
  const value = raw.trim();
  const startsWithQuote = value.startsWith("\"") || value.startsWith("'");
  const endsWithQuote = value.endsWith("\"") || value.endsWith("'");
  if (value.length >= 2 && startsWithQuote && endsWithQuote) {
    return value.slice(1, -1).trim();
  }
  return value;
}

function buildMainMenuKeyboard() {
  const rows: any[] = [];
  rows.push(["Xem menu đồ uống", "Danh mục đồ uống"]);
  rows.push(["Đặt món nhanh", "Kiểm tra đơn hàng"]);
  rows.push(["Hướng dẫn thanh toán", "Mở cửa hàng"]);
  return Markup.keyboard(rows).resize();
}

async function sendMiniAppLaunch(ctx: any): Promise<void> {
  const miniAppUrl = buildMiniAppUrlForUser(ctx.from);
  if (!miniAppUrl) {
    await ctx.reply("Mini App chưa được cấu hình URL công khai.", MAIN_MENU_KEYBOARD);
    return;
  }

  await ctx.reply(
    `Nhấn nút bên dưới để mở menu web trực quan.\nLink trực tiếp: ${miniAppUrl}`,
    Markup.keyboard([[Markup.button.webApp("Mở cửa hàng", miniAppUrl)], ["Xem menu đồ uống", "Đặt món nhanh"]]).resize(),
  );
}

async function configureMiniAppMenuButton(): Promise<void> {
  if (!config.miniAppUrl) {
    return;
  }
  if (config.webSessionSecret) {
    logger.info("Skip setChatMenuButton because web session token is per-user; use keyboard button 'Mở cửa hàng'.");
    return;
  }

  try {
    await bot.telegram.callApi("setChatMenuButton", {
      menu_button: {
        type: "web_app",
        text: "Cửa hàng",
        web_app: { url: config.miniAppUrl },
      },
    });
    logger.info({ miniAppUrl: config.miniAppUrl }, "telegram mini app menu button configured");
  } catch (error) {
    logger.warn({ error: String(error), miniAppUrl: config.miniAppUrl }, "failed to configure mini app menu button");
  }
}

function labelForCategory(category?: string): string {
  if (!category) {
    return CATEGORY_LABELS.other;
  }
  return CATEGORY_LABELS[category] ?? category;
}

function resolveCategoryKey(value: string): string | undefined {
  const normalized = value.trim().toLowerCase();
  if (!normalized) {
    return undefined;
  }
  if (CATEGORY_LABELS[normalized]) {
    return normalized;
  }
  for (const [key, label] of Object.entries(CATEGORY_LABELS)) {
    if (normalized === label.toLowerCase()) {
      return key;
    }
  }
  return undefined;
}

function translatePaymentError(error?: string): string {
  const text = (error || "").toLowerCase();
  if (text.includes("no pending payment")) {
    return "Đơn này chưa có thanh toán chờ duyệt. Khách cần gửi /pay trước hoặc đây là đơn COD.";
  }
  if (text.includes("not bank_transfer")) {
    return "Đơn này không phải chuyển khoản nên không thể xác nhận thanh toán.";
  }
  if (text.includes("payment_review")) {
    return "Đơn chưa ở trạng thái payment_review. Hãy yêu cầu khách gửi /pay trước khi xác nhận.";
  }
  return error || "Lỗi không xác định";
}

function truncateLabel(value: string, maxLength: number): string {
  const text = value.trim();
  if (text.length <= maxLength) {
    return text;
  }
  return `${text.slice(0, Math.max(1, maxLength - 1))}…`;
}

function buildMiniAppUrlForUser(from?: { id?: number; first_name?: string; last_name?: string; username?: string }): string | undefined {
  if (!config.miniAppUrl) {
    return undefined;
  }

  const url = new URL(config.miniAppUrl);
  if (!from || !from.id) {
    return url.toString();
  }

  const token = buildTelegramSessionToken({
    id: from.id,
    first_name: from.first_name,
    last_name: from.last_name,
    username: from.username,
  });
  if (token) {
    url.searchParams.set("tg_session", token);
    url.searchParams.set("src", "telegram");
  }
  return url.toString();
}

function buildOrderReviewUrlForUser(
  from: { id?: number; first_name?: string; last_name?: string; username?: string } | undefined,
  payload: string,
): string | undefined {
  const parsed = parseOrderReviewPayload(payload);
  if (!parsed) {
    return undefined;
  }

  const base = buildMiniAppUrlForUser(from) || config.miniAppUrl;
  if (!base) {
    return undefined;
  }

  const url = new URL(base);
  url.searchParams.set("r", "site/orderReview");
  url.searchParams.set("items", parsed.items);
  url.searchParams.set("ch", "telegram");
  if (from?.id) {
    url.searchParams.set("uid", String(from.id));
  }
  if (parsed.name) {
    url.searchParams.set("rn", parsed.name);
  }
  if (parsed.phone) {
    url.searchParams.set("rp", parsed.phone);
  }
  if (parsed.address) {
    url.searchParams.set("ra", parsed.address);
  }
  if (parsed.payment) {
    url.searchParams.set("rm", parsed.payment);
  }
  return url.toString();
}

function parseOrderReviewPayload(rawPayload: string): { items: string; name?: string; phone?: string; address?: string; payment?: string } | undefined {
  const prefix = "OPEN_WEB_REVIEW:";
  if (!rawPayload || !rawPayload.startsWith(prefix)) {
    return undefined;
  }
  const body = String(rawPayload.slice(prefix.length) || "").trim();
  if (!body || body.length > 1200) {
    return undefined;
  }

  const chunks = body.split("|").map((part) => part.trim()).filter(Boolean);
  const itemsRaw = chunks.shift() || "";
  const parsedItems = normalizeReviewItemsPayload(itemsRaw);
  if (!parsedItems) {
    return undefined;
  }

  const meta: { items: string; name?: string; phone?: string; address?: string; payment?: string } = {
    items: parsedItems,
  };
  for (const chunk of chunks) {
    const pivot = chunk.indexOf("=");
    if (pivot <= 0) {
      continue;
    }
    const key = chunk.slice(0, pivot).trim().toLowerCase();
    const value = chunk.slice(pivot + 1).trim();
    if (!value) {
      continue;
    }
    if (key === "n") {
      const decoded = decodeReviewField(value);
      if (decoded) {
        meta.name = decoded;
      }
      continue;
    }
    if (key === "a") {
      const decoded = decodeReviewField(value);
      if (decoded) {
        meta.address = decoded;
      }
      continue;
    }
    if (key === "p") {
      const digits = value.replace(/\D+/g, "").slice(0, 15);
      if (digits) {
        meta.phone = digits;
      }
      continue;
    }
    if (key === "m") {
      const payment = value.toLowerCase();
      if (payment === "bank_transfer" || payment === "cod") {
        meta.payment = payment;
      }
    }
  }

  return meta;
}

function normalizeReviewItemsPayload(rawItems: string): string | undefined {
  const parts = String(rawItems || "")
    .split(",")
    .map((part) => part.trim().toUpperCase())
    .filter(Boolean);
  if (!parts.length) {
    return undefined;
  }

  const normalized: string[] = [];
  for (const part of parts) {
    const matched = part.match(/^([A-Z0-9_-]{2,40}):([1-9][0-9]{0,2})$/);
    if (!matched) {
      continue;
    }
    normalized.push(`${matched[1]}:${matched[2]}`);
    if (normalized.length >= 20) {
      break;
    }
  }

  if (!normalized.length) {
    return undefined;
  }
  return normalized.join(",");
}

function decodeReviewField(encoded: string): string | undefined {
  const raw = String(encoded || "").trim();
  if (!raw || !/^[A-Za-z0-9\-_]+$/.test(raw)) {
    return undefined;
  }
  try {
    const decoded = Buffer.from(raw, "base64url").toString("utf8").trim();
    return decoded || undefined;
  } catch {
    return undefined;
  }
}

function buildTelegramSessionToken(from: { id: number; first_name?: string; last_name?: string; username?: string }): string | undefined {
  if (!config.webSessionSecret) {
    return undefined;
  }

  const nowSec = Math.floor(Date.now() / 1000);
  const payload = {
    src: "telegram",
    uid: String(from.id),
    name: [from.first_name, from.last_name].filter(Boolean).join(" ").trim(),
    username: from.username || "",
    iat: nowSec,
    exp: nowSec + config.webSessionTtlSec,
  };

  const encodedPayload = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  const signature = createHmac("sha256", config.webSessionSecret).update(encodedPayload).digest("base64url");
  return `${encodedPayload}.${signature}`;
}

function chunkArray<T>(items: T[], size: number): T[][] {
  const output: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    output.push(items.slice(i, i + size));
  }
  return output;
}

function maskTransferRef(value: string): string {
  const raw = value.trim();
  if (raw.length <= 4) {
    return "***";
  }
  return `${raw.slice(0, 2)}***${raw.slice(-2)}`;
}
