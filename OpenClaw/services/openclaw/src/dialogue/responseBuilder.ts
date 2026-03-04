import type { ChatUi, MenuItem, UiSuggestion } from "./types";

export function suggestion(label: string, payload: string): UiSuggestion {
  return { label, payload };
}

export function rootSuggestions(): UiSuggestion[] {
  return [
    suggestion("Xem menu", "ACTION_VIEW_MENU"),
    suggestion("Đặt đơn", "ACTION_ORDER_START"),
    suggestion("Kiểm tra đơn", "ACTION_ORDER_STATUS"),
    suggestion("Gặp tư vấn viên", "ACTION_HANDOFF_REQUEST"),
  ];
}

export function categorySuggestions(): UiSuggestion[] {
  return [
    suggestion("Cà phê", "ACTION_CATEGORY:coffee"),
    suggestion("Trà sữa", "ACTION_CATEGORY:milk_tea"),
    suggestion("Trà trái cây", "ACTION_CATEGORY:fruit_tea"),
    suggestion("Nước ép", "ACTION_CATEGORY:juice"),
  ];
}

export function orderStepSuggestions(): UiSuggestion[] {
  return [
    suggestion("Tiếp tục", "ACTION_ORDER_NEXT"),
    suggestion("Quay lại", "ACTION_ORDER_BACK"),
    suggestion("Hủy đơn", "ACTION_ORDER_CANCEL"),
    suggestion("Gặp tư vấn viên", "ACTION_HANDOFF_REQUEST"),
  ];
}

export function paymentSuggestions(): UiSuggestion[] {
  return [
    suggestion("Chuyển khoản", "ACTION_ORDER_SET_PAYMENT:bank_transfer"),
    suggestion("COD", "ACTION_ORDER_SET_PAYMENT:cod"),
    suggestion("Quay lại", "ACTION_ORDER_BACK"),
    suggestion("Hủy đơn", "ACTION_ORDER_CANCEL"),
  ];
}

export function confirmSuggestions(extra: UiSuggestion[] = []): UiSuggestion[] {
  return [
    suggestion("Xác nhận đặt đơn", "ACTION_ORDER_CONFIRM"),
    suggestion("Quay lại", "ACTION_ORDER_BACK"),
    suggestion("Hủy đơn", "ACTION_ORDER_CANCEL"),
    ...extra,
  ];
}

export function handoffSuggestions(): UiSuggestion[] {
  return [
    suggestion("Tiếp tục với bot", "ACTION_HANDOFF_RESUME"),
    suggestion("Xem menu", "ACTION_VIEW_MENU"),
  ];
}

export function menuUi(title: string, items: MenuItem[] = [], suggestions?: UiSuggestion[]): ChatUi {
  return {
    type: "menu",
    title,
    items,
    suggestions,
  };
}

export function formatVnd(value: number): string {
  return new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
    maximumFractionDigits: 0,
  }).format(value);
}

export function categoryLabel(category?: string): string {
  const map: Record<string, string> = {
    coffee: "Cà phê",
    milk_tea: "Trà sữa",
    fruit_tea: "Trà trái cây",
    juice: "Nước ép",
    other: "Khác",
  };
  if (!category) {
    return "Khác";
  }
  return map[category] ?? category;
}
