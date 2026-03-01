import { describe, expect, it } from "vitest";
import { parseClassifierJson } from "../src/clients";

describe("parseClassifierJson", () => {
  it("parses valid classifier output", () => {
    const raw = JSON.stringify({
      intent: "catalog_list",
      query: "tra sua",
      sku: "",
      orderCode: "",
      paymentMethod: "",
    });

    const parsed = parseClassifierJson(raw);
    expect(parsed.intent).toBe("catalog_list");
    expect(parsed.query).toBe("tra sua");
    expect(parsed.sku).toBeUndefined();
    expect(parsed.orderCode).toBeUndefined();
    expect(parsed.paymentMethod).toBeUndefined();
  });

  it("throws on invalid intent", () => {
    const raw = JSON.stringify({ intent: "unknown", query: "" });
    expect(() => parseClassifierJson(raw)).toThrow();
  });
});
