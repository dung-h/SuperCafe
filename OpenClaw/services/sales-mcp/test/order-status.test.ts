import { describe, expect, it } from "vitest";
import { allowedTransitions, canTransition } from "../src/domain/orderStatus";

describe("order status transitions", () => {
  it("allows valid transitions", () => {
    expect(canTransition("awaiting_payment", "payment_review")).toBe(true);
    expect(canTransition("payment_review", "paid")).toBe(true);
    expect(canTransition("paid", "shipping")).toBe(true);
    expect(canTransition("shipping", "completed")).toBe(true);
  });

  it("rejects invalid transitions", () => {
    expect(canTransition("completed", "shipping")).toBe(false);
    expect(canTransition("new", "paid")).toBe(false);
    expect(canTransition("cancelled", "new")).toBe(false);
  });

  it("exposes allowed list", () => {
    expect(allowedTransitions("payment_review")).toEqual(["awaiting_payment", "paid", "cancelled"]);
  });
});
