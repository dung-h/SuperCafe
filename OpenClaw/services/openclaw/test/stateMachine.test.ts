import { describe, expect, it } from "vitest";
import {
  getMissingFields,
  getNextWizardState,
  getPreviousWizardState,
  sanitizeStateName,
  stateForMissingField,
} from "../src/dialogue/stateMachine";
import { defaultSessionContext } from "../src/dialogue/types";

describe("stateMachine", () => {
  it("moves through wizard states correctly", () => {
    expect(getNextWizardState("ORDER_COLLECT_ITEMS")).toBe("ORDER_COLLECT_NAME");
    expect(getNextWizardState("ORDER_COLLECT_NAME")).toBe("ORDER_COLLECT_PHONE");
    expect(getPreviousWizardState("ORDER_COLLECT_PHONE")).toBe("ORDER_COLLECT_NAME");
    expect(getPreviousWizardState("ORDER_CONFIRM")).toBe("ORDER_COLLECT_PAYMENT");
  });

  it("reports missing fields", () => {
    const context = defaultSessionContext();
    context.order.items = [{ sku: "CAFE-SUA", qty: 1 }];
    const missing = getMissingFields(context);
    expect(missing).toEqual(["name", "phone", "address", "paymentMethod"]);
  });

  it("maps missing fields to collection states", () => {
    expect(stateForMissingField("items")).toBe("ORDER_COLLECT_ITEMS");
    expect(stateForMissingField("name")).toBe("ORDER_COLLECT_NAME");
    expect(sanitizeStateName("INVALID")).toBe("IDLE");
  });
});
