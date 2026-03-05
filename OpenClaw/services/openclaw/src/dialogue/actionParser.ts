import type { ParsedAction } from "./types";

const ACTION_PREFIX = "ACTION_";
const CATEGORY_SET = new Set(["coffee", "milk_tea", "fruit_tea", "juice", "other"]);
const QUANTITY_WORD_PATTERN = "(?:mot|hai|ba|bon|tu|nam|sau|bay|tam|chin|muoi)";

const HELP_TERMS = [
  "tro giup",
  "help",
  "huong dan",
  "support",
  "bot lam duoc gi",
  "lam duoc gi",
  "co the lam gi",
  "giup duoc gi",
  "chi toi cach dat",
  "huong dan dat mon",
  "chi toi cach dung",
  "cach su dung bot",
  "co the ho tro gi",
  "can huong dan",
];

const HANDOFF_REQUEST_TERMS = [
  "gap tu van vien",
  "gap nhan vien",
  "noi chuyen nguoi that",
  "noi chuyen voi nguoi that",
  "nguoi that",
  "tu van truc tiep",
  "cho minh gap admin",
  "live agent",
  "human support",
];

const HANDOFF_RESUME_TERMS = [
  "tiep tuc voi bot",
  "tro lai bot",
  "bot xu ly tiep",
  "resume bot",
  "quay lai bot",
];

const ORDER_STATUS_TERMS = [
  "kiem tra don",
  "kiem tra don hang",
  "tinh trang don",
  "trang thai don",
  "xem don",
  "ma don",
  "theo doi don",
  "don cua toi",
  "don toi dau",
  "don den dau roi",
  "order status",
  "track order",
];

const VIEW_MENU_TERMS = [
  "xem menu",
  "menu",
  "thuc don",
  "danh muc",
  "danh sach mon",
  "xem mon",
  "co mon gi",
  "co cac mon nao",
  "do uong",
  "san pham",
  "best seller",
  "mon ban chay",
  "goi y mon",
  "tham khao mon",
];

const ORDER_START_TERMS = [
  "dat hang",
  "dat mon",
  "goi mon",
  "len don",
  "order",
  "mua hang",
  "cho toi dat",
  "bat dau dat",
  "dat ngay",
  "tao don",
  "chot mon",
  "minh muon dat",
  "toi muon dat",
];

const NEXT_TERMS = ["tiep", "tiep tuc", "xong", "next", "continue"];
const BACK_TERMS = ["quay lai", "tro lai", "back", "lui", "ve buoc truoc"];
const CANCEL_TERMS = ["huy", "huy don", "cancel", "dung dat", "thoi khong dat"];
const CONFIRM_TERMS = ["xac nhan", "xac nhan dat don", "chot don", "confirm order", "xac nhan don"];

export function parseActionPayload(actionPayload?: string): ParsedAction | null {
  const raw = (actionPayload || "").trim();
  if (!raw) {
    return null;
  }

  if (!raw.startsWith(ACTION_PREFIX)) {
    return null;
  }

  if (raw === "ACTION_HELP") return { type: "ACTION_HELP", raw };
  if (raw === "ACTION_VIEW_MENU") return { type: "ACTION_VIEW_MENU", raw };
  if (raw === "ACTION_ORDER_START") return { type: "ACTION_ORDER_START", raw };
  if (raw === "ACTION_ORDER_NEXT") return { type: "ACTION_ORDER_NEXT", raw };
  if (raw === "ACTION_ORDER_BACK") return { type: "ACTION_ORDER_BACK", raw };
  if (raw === "ACTION_ORDER_CONFIRM") return { type: "ACTION_ORDER_CONFIRM", raw };
  if (raw === "ACTION_ORDER_CANCEL") return { type: "ACTION_ORDER_CANCEL", raw };
  if (raw === "ACTION_ORDER_STATUS") return { type: "ACTION_ORDER_STATUS", raw };
  if (raw === "ACTION_HANDOFF_REQUEST") return { type: "ACTION_HANDOFF_REQUEST", raw };
  if (raw === "ACTION_HANDOFF_RESUME") return { type: "ACTION_HANDOFF_RESUME", raw };

  if (raw.startsWith("ACTION_CATEGORY:")) {
    const category = raw.slice("ACTION_CATEGORY:".length).trim();
    if (CATEGORY_SET.has(category)) {
      return { type: "ACTION_CATEGORY", raw, category: category as ParsedAction["category"] };
    }
    return { type: "ACTION_UNKNOWN", raw };
  }

  if (raw.startsWith("ACTION_ORDER_ADD:")) {
    const sku = raw.slice("ACTION_ORDER_ADD:".length).trim().toUpperCase();
    if (!sku) {
      return { type: "ACTION_UNKNOWN", raw };
    }
    return { type: "ACTION_ORDER_ADD", raw, sku, qty: 1 };
  }

  if (raw.startsWith("ACTION_ORDER_SET_QTY:")) {
    const body = raw.slice("ACTION_ORDER_SET_QTY:".length);
    const [skuRaw, qtyRaw] = body.split(":");
    const sku = (skuRaw || "").trim().toUpperCase();
    const qty = Number((qtyRaw || "").trim());
    if (!sku || !Number.isInteger(qty) || qty <= 0) {
      return { type: "ACTION_UNKNOWN", raw };
    }
    return { type: "ACTION_ORDER_SET_QTY", raw, sku, qty };
  }

  if (raw.startsWith("ACTION_ORDER_SET_NAME:")) {
    const text = raw.slice("ACTION_ORDER_SET_NAME:".length).trim();
    if (!text) {
      return { type: "ACTION_UNKNOWN", raw };
    }
    return { type: "ACTION_ORDER_SET_NAME", raw, text };
  }

  if (raw.startsWith("ACTION_ORDER_SET_PHONE:")) {
    const text = raw.slice("ACTION_ORDER_SET_PHONE:".length).trim();
    if (!text) {
      return { type: "ACTION_UNKNOWN", raw };
    }
    return { type: "ACTION_ORDER_SET_PHONE", raw, text };
  }

  if (raw.startsWith("ACTION_ORDER_SET_ADDRESS:")) {
    const text = raw.slice("ACTION_ORDER_SET_ADDRESS:".length).trim();
    if (!text) {
      return { type: "ACTION_UNKNOWN", raw };
    }
    return { type: "ACTION_ORDER_SET_ADDRESS", raw, text };
  }

  if (raw.startsWith("ACTION_ORDER_SET_PAYMENT:")) {
    const methodRaw = raw.slice("ACTION_ORDER_SET_PAYMENT:".length).trim();
    if (methodRaw === "bank_transfer" || methodRaw === "cod") {
      return { type: "ACTION_ORDER_SET_PAYMENT", raw, paymentMethod: methodRaw };
    }
    return { type: "ACTION_UNKNOWN", raw };
  }

  return { type: "ACTION_UNKNOWN", raw };
}

export function inferActionFromText(message: string): ParsedAction | null {
  const raw = message.trim();
  if (!raw) {
    return null;
  }

  const normalized = normalizeVietnamese(raw);

  if (isHelpQuery(normalized)) {
    return { type: "ACTION_HELP", raw };
  }

  if (isHandoffRequestQuery(normalized)) {
    return { type: "ACTION_HANDOFF_REQUEST", raw };
  }

  if (isHandoffResumeQuery(normalized)) {
    return { type: "ACTION_HANDOFF_RESUME", raw };
  }

  if (isOrderStatusQuery(normalized)) {
    const orderCode = extractOrderCode(raw);
    return { type: "ACTION_ORDER_STATUS", raw, orderCode: orderCode || undefined };
  }

  if (isViewMenuQuery(normalized)) {
    return { type: "ACTION_VIEW_MENU", raw };
  }

  // Defer product matching with quantity to policy engine (needs backend catalog lookup).
  if (looksLikeNaturalOrderPhrase(normalized)) {
    return null;
  }

  const category = inferCategory(normalized);
  if (category) {
    return { type: "ACTION_CATEGORY", raw, category };
  }

  if (isOrderStartQuery(normalized)) {
    const parsedOrder = parseInlineOrder(raw);
    if (parsedOrder) {
      return parsedOrder;
    }
    return { type: "ACTION_ORDER_START", raw };
  }

  if (isNextCommand(normalized)) {
    return { type: "ACTION_ORDER_NEXT", raw };
  }

  if (isBackCommand(normalized)) {
    return { type: "ACTION_ORDER_BACK", raw };
  }

  if (isCancelCommand(normalized)) {
    return { type: "ACTION_ORDER_CANCEL", raw };
  }

  if (isOrderConfirmCommand(normalized)) {
    return { type: "ACTION_ORDER_CONFIRM", raw };
  }

  return null;
}

export function isValidPhone(value: string): boolean {
  const digits = value.replace(/\D+/g, "");
  return digits.length >= 9 && digits.length <= 11;
}

export function extractOrderCode(input: string): string | null {
  const match = input.toUpperCase().match(/ORD-\d{8}-\d{4}/);
  return match ? match[0] : null;
}

export function parseInlineOrder(input: string): ParsedAction | null {
  const body = input.replace(/^\/?order\s+/i, "").trim();
  const firstChunk = body.split("|")[0]?.trim() || "";
  if (!firstChunk.includes(":")) {
    return null;
  }

  const firstItem = firstChunk.split(",")[0]?.trim() || "";
  const [skuRaw, qtyRaw] = firstItem.split(":");
  const sku = (skuRaw || "").trim().toUpperCase();
  const qty = Number((qtyRaw || "").trim());

  if (!sku || !Number.isInteger(qty) || qty <= 0) {
    return null;
  }

  return {
    type: "ACTION_ORDER_ADD",
    raw: input,
    sku,
    qty,
  };
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

function containsAny(source: string, terms: string[]): boolean {
  return terms.some((term) => hasTerm(source, term));
}

function equalsAny(source: string, terms: string[]): boolean {
  return terms.some((term) => source === term);
}

function containsAll(source: string, terms: string[]): boolean {
  return terms.every((term) => hasTerm(source, term));
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

function isHelpQuery(normalized: string): boolean {
  if (containsAny(normalized, HELP_TERMS)) {
    return true;
  }
  return containsAll(normalized, ["bot", "lam", "duoc", "gi"]);
}

function isHandoffRequestQuery(normalized: string): boolean {
  if (containsAny(normalized, HANDOFF_REQUEST_TERMS)) {
    return true;
  }
  return containsAll(normalized, ["gap", "nhan vien"]);
}

function isHandoffResumeQuery(normalized: string): boolean {
  if (containsAny(normalized, HANDOFF_RESUME_TERMS)) {
    return true;
  }
  return containsAll(normalized, ["tro", "lai", "bot"]);
}

function isOrderStatusQuery(normalized: string): boolean {
  if (containsAny(normalized, ORDER_STATUS_TERMS)) {
    return true;
  }
  if (containsAll(normalized, ["don", "toi dau"])) {
    return true;
  }
  if (containsAll(normalized, ["kiem tra", "don"])) {
    return true;
  }
  return containsAll(normalized, ["ship", "toi dau"]);
}

function isViewMenuQuery(normalized: string): boolean {
  if (containsAny(normalized, VIEW_MENU_TERMS)) {
    return true;
  }
  if (containsAll(normalized, ["co", "nhung", "mon", "nao"])) {
    return true;
  }
  return containsAll(normalized, ["xem", "thuc don"]);
}

function isOrderStartQuery(normalized: string): boolean {
  if (containsAny(normalized, ORDER_START_TERMS)) {
    return true;
  }
  if (containsAll(normalized, ["cho", "dat", "don"])) {
    return true;
  }
  return containsAll(normalized, ["muon", "dat", "hang"]);
}

function isNextCommand(normalized: string): boolean {
  if (equalsAny(normalized, NEXT_TERMS)) {
    return true;
  }
  return containsAny(normalized, ["qua buoc tiep", "sang buoc tiep", "qua buoc sau"]);
}

function isBackCommand(normalized: string): boolean {
  if (equalsAny(normalized, BACK_TERMS)) {
    return true;
  }
  return containsAll(normalized, ["ve", "buoc", "truoc"]);
}

function isCancelCommand(normalized: string): boolean {
  if (equalsAny(normalized, CANCEL_TERMS)) {
    return true;
  }
  return containsAny(normalized, ["khong dat nua", "dung dat", "thoi khong dat"]);
}

function isOrderConfirmCommand(normalized: string): boolean {
  if (equalsAny(normalized, CONFIRM_TERMS)) {
    return true;
  }
  return containsAll(normalized, ["xac nhan", "don"]);
}

function inferCategory(normalized: string): ParsedAction["category"] | undefined {
  if (containsAny(normalized, ["ca phe", "espresso", "latte", "bac xiu", "americano", "cappuccino", "cold brew"])) {
    return "coffee";
  }
  if (containsAny(normalized, ["tra sua", "milk tea", "tran chau", "matcha latte"])) {
    return "milk_tea";
  }
  if (containsAny(normalized, ["tra dao", "tra vai", "tra trai cay", "oolong", "hong tra", "fruit tea", "tra hoa qua"])) {
    return "fruit_tea";
  }
  if (containsAny(normalized, ["nuoc ep", "juice", "cam ep", "detox", "sinh to"])) {
    return "juice";
  }
  return undefined;
}

function looksLikeNaturalOrderPhrase(normalized: string): boolean {
  if (!normalized) {
    return false;
  }
  if (new RegExp(`\\b(?:\\d{1,2}|${QUANTITY_WORD_PATTERN})\\s*(?:ly|coc|chai|phan)\\b`).test(normalized)) {
    return true;
  }
  if (containsAny(normalized, ORDER_START_TERMS)) {
    return false;
  }
  return /^(cho|lay|them|mua|goi)\b/.test(normalized);
}
