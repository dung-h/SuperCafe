import { describe, expect, it, vi } from "vitest";
import { HandoffStore } from "../src/handoffStore";

describe("HandoffStore", () => {
  it("activates and releases sessions", () => {
    const store = new HandoffStore(60_000);
    expect(store.isActive("web", "u1")).toBe(false);

    store.activate("web", "u1", "gap nhan vien");
    expect(store.isActive("web", "u1")).toBe(true);

    expect(store.release("web", "u1")).toBe(true);
    expect(store.isActive("web", "u1")).toBe(false);
  });

  it("expires sessions by ttl", () => {
    vi.useFakeTimers();
    const store = new HandoffStore(1_000);

    store.activate("messenger", "u2", "ho tro");
    expect(store.isActive("messenger", "u2")).toBe(true);

    vi.advanceTimersByTime(1001);
    expect(store.isActive("messenger", "u2")).toBe(false);
    vi.useRealTimers();
  });
});
