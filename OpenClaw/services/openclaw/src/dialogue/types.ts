import type { BackendChannel } from "../backends";

export type DialogueStateName =
  | "IDLE"
  | "BROWSING_MENU"
  | "ORDER_COLLECT_ITEMS"
  | "ORDER_COLLECT_NAME"
  | "ORDER_COLLECT_PHONE"
  | "ORDER_COLLECT_ADDRESS"
  | "ORDER_COLLECT_PAYMENT"
  | "ORDER_CONFIRM"
  | "HANDOFF_WAITING";

export type ActionType =
  | "ACTION_HELP"
  | "ACTION_VIEW_MENU"
  | "ACTION_CATEGORY"
  | "ACTION_ORDER_START"
  | "ACTION_ORDER_ADD"
  | "ACTION_ORDER_SET_QTY"
  | "ACTION_ORDER_NEXT"
  | "ACTION_ORDER_BACK"
  | "ACTION_ORDER_SET_NAME"
  | "ACTION_ORDER_SET_PHONE"
  | "ACTION_ORDER_SET_ADDRESS"
  | "ACTION_ORDER_SET_PAYMENT"
  | "ACTION_ORDER_CONFIRM"
  | "ACTION_ORDER_CANCEL"
  | "ACTION_ORDER_STATUS"
  | "ACTION_HANDOFF_REQUEST"
  | "ACTION_HANDOFF_RESUME"
  | "ACTION_UNKNOWN";

export type MenuItem = {
  sku: string;
  name: string;
  category?: string;
  description?: string;
  imageUrl?: string;
  priceVnd: number;
  stockQty: number;
};

export type UiSuggestion = {
  label: string;
  payload: string;
};

export type ChatUi = {
  type: "menu";
  title: string;
  items: MenuItem[];
  suggestions?: UiSuggestion[];
};

export type DialogueOrderContext = {
  flowId?: string;
  items: Array<{
    sku: string;
    qty: number;
  }>;
  name?: string;
  phone?: string;
  address?: string;
  paymentMethod?: "bank_transfer" | "cod";
};

export type DialogueSessionContext = {
  order: DialogueOrderContext;
  handoffRequestedAt?: string;
  lastOrderCode?: string;
  pendingOrderSuggestion?: {
    sku: string;
    qty: number;
    name: string;
  };
};

export type DialogueSession = {
  channel: BackendChannel;
  userId: string;
  state: DialogueStateName;
  context: DialogueSessionContext;
  version: number;
  expiresAt: Date;
};

export type PolicyInput = {
  userId: string;
  message: string;
  actionPayload?: string;
  channel: BackendChannel;
  correlationId: string;
  profile?: {
    name?: string;
    phone?: string;
    address?: string;
  };
};

export type ParsedAction = {
  type: ActionType;
  raw: string;
  category?: "coffee" | "milk_tea" | "fruit_tea" | "juice" | "other";
  sku?: string;
  qty?: number;
  text?: string;
  paymentMethod?: "bank_transfer" | "cod";
  orderCode?: string;
};

export type PolicyResult = {
  reply: string;
  ui?: ChatUi;
  alerts?: string[];
  state: {
    name: DialogueStateName;
    missingFields: string[];
  };
  intent?: string;
  toolCalls?: string[];
};

export type DialogueEventLog = {
  channel: BackendChannel;
  userId: string;
  correlationId: string;
  role: "user" | "bot" | "agent" | "system";
  inputText?: string;
  actionPayload?: string;
  sourceMessageId?: string;
  locale?: string;
  intent?: string;
  stateBefore?: DialogueStateName;
  stateAfter?: DialogueStateName;
  toolCallsJson?: string;
  latencyMs?: number;
};

export function defaultSessionContext(): DialogueSessionContext {
  return {
    order: {
      items: [],
    },
  };
}
