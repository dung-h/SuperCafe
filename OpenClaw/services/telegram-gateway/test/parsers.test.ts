import { describe, expect, it } from "vitest";
import { getArgs, parseOrderCommand } from "../src/parsers";

describe("telegram parser helpers", () => {
  it("extracts args after command", () => {
    expect(getArgs("/product CAFE-SUA-DA-L")).toBe("CAFE-SUA-DA-L");
    expect(getArgs("/products")).toBe("");
  });

  it("parses valid order command", () => {
    const parsed = parseOrderCommand("cafe-sua-da-l:2 | Nguyen Van A | 0909000001 | Ha Noi | cod", "123");
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) {
      return;
    }

    expect(parsed.data.customer.telegramId).toBe("123");
    expect(parsed.data.items[0]).toEqual({ sku: "CAFE-SUA-DA-L", qty: 2 });
    expect(parsed.data.payment_method).toBe("cod");
  });

  it("rejects malformed order command", () => {
    expect(parseOrderCommand("invalid", "123").ok).toBe(false);
    expect(parseOrderCommand("SKU:abc | A | B | C", "123").ok).toBe(false);
  });
});
