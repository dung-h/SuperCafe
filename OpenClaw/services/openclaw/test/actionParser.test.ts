import { describe, expect, it } from "vitest";
import { inferActionFromText, parseActionPayload } from "../src/dialogue/actionParser";

describe("actionParser", () => {
  it("parses valid ACTION payloads", () => {
    expect(parseActionPayload("ACTION_VIEW_MENU")?.type).toBe("ACTION_VIEW_MENU");
    expect(parseActionPayload("ACTION_CATEGORY:coffee")?.category).toBe("coffee");
    expect(parseActionPayload("ACTION_ORDER_ADD:cafe-sua")?.sku).toBe("CAFE-SUA");

    const qty = parseActionPayload("ACTION_ORDER_SET_QTY:CAFE-SUA:3");
    expect(qty?.type).toBe("ACTION_ORDER_SET_QTY");
    expect(qty?.sku).toBe("CAFE-SUA");
    expect(qty?.qty).toBe(3);
  });

  it("rejects invalid payload formats", () => {
    expect(parseActionPayload("hello")).toBeNull();
    expect(parseActionPayload("ACTION_CATEGORY:invalid")?.type).toBe("ACTION_UNKNOWN");
    expect(parseActionPayload("ACTION_ORDER_SET_QTY:SKU:0")?.type).toBe("ACTION_UNKNOWN");
  });

  it("infers actions from natural text", () => {
    expect(inferActionFromText("xem menu")?.type).toBe("ACTION_VIEW_MENU");
    expect(inferActionFromText("kiểm tra đơn ORD-20260302-0001")?.type).toBe("ACTION_ORDER_STATUS");
    expect(inferActionFromText("gặp tư vấn viên")?.type).toBe("ACTION_HANDOFF_REQUEST");
  });

  it("covers colloquial vi-VN utterances for core intents", () => {
    const cases: Array<{ text: string; expected: string | null }> = [
      { text: "thực đơn hôm nay", expected: "ACTION_VIEW_MENU" },
      { text: "xem danh mục đồ uống", expected: "ACTION_VIEW_MENU" },
      { text: "menu có món gì", expected: "ACTION_VIEW_MENU" },
      { text: "cho xem mấy món bán chạy", expected: "ACTION_VIEW_MENU" },
      { text: "đơn hàng tới đâu rồi", expected: "ACTION_ORDER_STATUS" },
      { text: "xem đơn giúp mình", expected: "ACTION_ORDER_STATUS" },
      { text: "track order giúp mình", expected: "ACTION_ORDER_STATUS" },
      { text: "bắt đầu đặt món", expected: "ACTION_ORDER_START" },
      { text: "gọi món", expected: "ACTION_ORDER_START" },
      { text: "cho tôi đặt hàng", expected: "ACTION_ORDER_START" },
      { text: "mình muốn đặt món", expected: "ACTION_ORDER_START" },
      { text: "tiếp tục với bot", expected: "ACTION_HANDOFF_RESUME" },
      { text: "quay lại bot giúp mình", expected: "ACTION_HANDOFF_RESUME" },
      { text: "nói chuyện người thật", expected: "ACTION_HANDOFF_REQUEST" },
      { text: "cho mình gặp nhân viên hỗ trợ", expected: "ACTION_HANDOFF_REQUEST" },
      { text: "quay lại", expected: "ACTION_ORDER_BACK" },
      { text: "về bước trước", expected: "ACTION_ORDER_BACK" },
      { text: "hủy đơn", expected: "ACTION_ORDER_CANCEL" },
      { text: "không đặt nữa", expected: "ACTION_ORDER_CANCEL" },
      { text: "chốt đơn", expected: "ACTION_ORDER_CONFIRM" },
      { text: "xác nhận đơn", expected: "ACTION_ORDER_CONFIRM" },
      { text: "cho 2 ly bạc xỉu", expected: null },
      { text: "cho 1 ly bac siu", expected: null },
      { text: "mình muốn hai ly bạc xỉu", expected: null },
    ];

    for (const entry of cases) {
      const got = inferActionFromText(entry.text);
      expect(got?.type ?? null, entry.text).toBe(entry.expected);
    }
  });
});
