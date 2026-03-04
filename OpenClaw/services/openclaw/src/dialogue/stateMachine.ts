import type { DialogueSessionContext, DialogueStateName } from "./types";

export const ORDER_WIZARD_STATES: DialogueStateName[] = [
  "ORDER_COLLECT_ITEMS",
  "ORDER_COLLECT_NAME",
  "ORDER_COLLECT_PHONE",
  "ORDER_COLLECT_ADDRESS",
  "ORDER_COLLECT_PAYMENT",
  "ORDER_CONFIRM",
];

export function isWizardState(state: DialogueStateName): boolean {
  return ORDER_WIZARD_STATES.includes(state);
}

export function getNextWizardState(state: DialogueStateName): DialogueStateName {
  switch (state) {
    case "ORDER_COLLECT_ITEMS":
      return "ORDER_COLLECT_NAME";
    case "ORDER_COLLECT_NAME":
      return "ORDER_COLLECT_PHONE";
    case "ORDER_COLLECT_PHONE":
      return "ORDER_COLLECT_ADDRESS";
    case "ORDER_COLLECT_ADDRESS":
      return "ORDER_COLLECT_PAYMENT";
    case "ORDER_COLLECT_PAYMENT":
      return "ORDER_CONFIRM";
    default:
      return state;
  }
}

export function getPreviousWizardState(state: DialogueStateName): DialogueStateName {
  switch (state) {
    case "ORDER_COLLECT_NAME":
      return "ORDER_COLLECT_ITEMS";
    case "ORDER_COLLECT_PHONE":
      return "ORDER_COLLECT_NAME";
    case "ORDER_COLLECT_ADDRESS":
      return "ORDER_COLLECT_PHONE";
    case "ORDER_COLLECT_PAYMENT":
      return "ORDER_COLLECT_ADDRESS";
    case "ORDER_CONFIRM":
      return "ORDER_COLLECT_PAYMENT";
    default:
      return state;
  }
}

export function getMissingFields(context: DialogueSessionContext): string[] {
  const missing: string[] = [];
  if (!context.order.items.length) {
    missing.push("items");
  }
  if (!context.order.name) {
    missing.push("name");
  }
  if (!context.order.phone) {
    missing.push("phone");
  }
  if (!context.order.address) {
    missing.push("address");
  }
  if (!context.order.paymentMethod) {
    missing.push("paymentMethod");
  }
  return missing;
}

export function stateForMissingField(field: string): DialogueStateName {
  if (field === "items") return "ORDER_COLLECT_ITEMS";
  if (field === "name") return "ORDER_COLLECT_NAME";
  if (field === "phone") return "ORDER_COLLECT_PHONE";
  if (field === "address") return "ORDER_COLLECT_ADDRESS";
  if (field === "paymentMethod") return "ORDER_COLLECT_PAYMENT";
  return "ORDER_CONFIRM";
}

export function sanitizeStateName(value: string): DialogueStateName {
  const whitelist: DialogueStateName[] = [
    "IDLE",
    "BROWSING_MENU",
    "ORDER_COLLECT_ITEMS",
    "ORDER_COLLECT_NAME",
    "ORDER_COLLECT_PHONE",
    "ORDER_COLLECT_ADDRESS",
    "ORDER_COLLECT_PAYMENT",
    "ORDER_CONFIRM",
    "HANDOFF_WAITING",
  ];

  if (whitelist.includes(value as DialogueStateName)) {
    return value as DialogueStateName;
  }
  return "IDLE";
}
