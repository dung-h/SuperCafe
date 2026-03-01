import { ORDER_STATUSES, type OrderStatus } from "@openclaw/shared-types";

export const ORDER_STATUS_SET = new Set<OrderStatus>(ORDER_STATUSES);

const TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  new: ["shipping", "completed", "cancelled"],
  awaiting_payment: ["payment_review", "paid", "cancelled"],
  payment_review: ["awaiting_payment", "paid", "cancelled"],
  paid: ["shipping", "completed", "cancelled"],
  shipping: ["completed", "cancelled"],
  completed: [],
  cancelled: [],
};

export function canTransition(from: OrderStatus, to: OrderStatus): boolean {
  if (from === to) {
    return true;
  }
  return TRANSITIONS[from].includes(to);
}

export function allowedTransitions(from: OrderStatus): OrderStatus[] {
  return [...TRANSITIONS[from]];
}
