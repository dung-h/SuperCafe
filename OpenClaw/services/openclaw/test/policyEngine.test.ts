import { describe, expect, it, vi } from "vitest";
import type { SalesBackend } from "../src/backends";
import type { OpenClawConfig } from "../src/config";
import { DialoguePolicyEngine } from "../src/dialogue/policyEngine";
import { defaultSessionContext, type DialogueSession } from "../src/dialogue/types";

function createConfig(): OpenClawConfig {
  return {
    host: "0.0.0.0",
    port: 8082,
    llmBaseUrl: "https://api.openai.com/v1",
    llmApiKey: "k",
    llmModel: "gpt-oss-120b",
    llmTimeoutMs: 20000,
    salesMcpUrl: "http://sales-mcp:8081",
    salesMcpApiKey: "sales-key",
    webBridgeBaseUrl: "http://lowland-app",
    webBridgeApiKey: "bridge-key",
    timeoutMs: 20000,
    bankName: "Vietcombank",
    bankAccountName: "A",
    bankAccountNumber: "1",
    openclawDbHost: "lowland_db",
    openclawDbPort: 3306,
    openclawDbName: "lowland_coffee",
    openclawDbUser: "web251",
    openclawDbPass: "Webhk251!",
    dialogEngineV2Enabled: true,
    dialogSessionTtlHours: 24,
  };
}

function createSession(state: DialogueSession["state"]): DialogueSession {
  return {
    channel: "web",
    userId: "web-user-1",
    state,
    context: defaultSessionContext(),
    version: 1,
    expiresAt: new Date(Date.now() + 3600_000),
  };
}

describe("policyEngine", () => {
  it("starts order wizard with ACTION_ORDER_START", async () => {
    const backend: SalesBackend = {
      channel: "web",
      postTool: vi.fn(),
    };
    const engine = new DialoguePolicyEngine(createConfig(), backend);

    const result = await engine.run(
      {
        userId: "web-user-1",
        channel: "web",
        message: "",
        actionPayload: "ACTION_ORDER_START",
        correlationId: "cid-1",
      },
      createSession("IDLE"),
    );

    expect(result.nextState).toBe("ORDER_COLLECT_ITEMS");
    expect(result.reply).toContain("Bắt đầu đặt đơn");
  });

  it("asks for missing fields on confirm", async () => {
    const backend: SalesBackend = {
      channel: "web",
      postTool: vi.fn(),
    };
    const engine = new DialoguePolicyEngine(createConfig(), backend);

    const session = createSession("ORDER_CONFIRM");
    session.context.order.items = [{ sku: "CAFE-SUA", qty: 1 }];

    const result = await engine.run(
      {
        userId: "web-user-1",
        channel: "web",
        message: "",
        actionPayload: "ACTION_ORDER_CONFIRM",
        correlationId: "cid-2",
      },
      session,
    );

    expect(result.nextState).toBe("ORDER_COLLECT_NAME");
    expect(result.state.missingFields).toContain("name");
    expect((backend.postTool as any).mock.calls.length).toBe(0);
  });

  it("creates order when wizard data is complete", async () => {
    const postTool = vi.fn().mockImplementation(async (tool: string) => {
      if (tool === "order_create") {
        return {
          ok: true,
          data: {
            orderCode: "ORD-20260302-0001",
            totalVnd: 120000,
            paymentMethod: "cod",
            status: "new",
          },
        };
      }
      return { ok: true, data: { items: [] } };
    });

    const backend: SalesBackend = {
      channel: "web",
      postTool,
    };
    const engine = new DialoguePolicyEngine(createConfig(), backend);

    const session = createSession("ORDER_CONFIRM");
    session.context.order.items = [{ sku: "CAFE-SUA", qty: 2 }];
    session.context.order.name = "Nguyen Van A";
    session.context.order.phone = "0909000001";
    session.context.order.address = "HCM";
    session.context.order.paymentMethod = "cod";

    const result = await engine.run(
      {
        userId: "web-user-1",
        channel: "web",
        message: "",
        actionPayload: "ACTION_ORDER_CONFIRM",
        correlationId: "cid-3",
      },
      session,
    );

    expect(result.nextState).toBe("IDLE");
    expect(result.reply).toContain("ORD-20260302-0001");
    expect(postTool).toHaveBeenCalledWith(
      "order_create",
      expect.objectContaining({
        customer: expect.objectContaining({ name: "Nguyen Van A" }),
      }),
      "cid-3",
    );
  });

  it("does not validate name message as phone in ORDER_COLLECT_NAME", async () => {
    const backend: SalesBackend = {
      channel: "web",
      postTool: vi.fn(),
    };
    const engine = new DialoguePolicyEngine(createConfig(), backend);
    const session = createSession("ORDER_COLLECT_NAME");
    session.context.order.items = [{ sku: "CAFE-SUA", qty: 1 }];

    const result = await engine.run(
      {
        userId: "web-user-1",
        channel: "web",
        message: "Dung Ho",
        correlationId: "cid-4",
      },
      session,
    );

    expect(result.nextState).toBe("ORDER_COLLECT_PHONE");
    expect(result.reply).toContain("số điện thoại");
    expect(result.reply).not.toContain("chưa hợp lệ");
    expect(result.nextContext.order.name).toBe("Dung Ho");
  });

  it("skips name step when profile already has name", async () => {
    const backend: SalesBackend = {
      channel: "web",
      postTool: vi.fn(),
    };
    const engine = new DialoguePolicyEngine(createConfig(), backend);
    const session = createSession("ORDER_COLLECT_ITEMS");
    session.context.order.items = [{ sku: "CAFE-SUA", qty: 1 }];

    const result = await engine.run(
      {
        userId: "web-tg-7533183645",
        channel: "web",
        message: "",
        actionPayload: "ACTION_ORDER_NEXT",
        correlationId: "cid-5",
        profile: {
          name: "Dung Ho",
        },
      },
      session,
    );

    expect(result.nextState).toBe("ORDER_COLLECT_PHONE");
    expect(result.reply).toContain("số điện thoại");
    expect(result.nextContext.order.name).toBe("Dung Ho");
  });

  it("rejects too-short address in address step", async () => {
    const backend: SalesBackend = {
      channel: "web",
      postTool: vi.fn(),
    };
    const engine = new DialoguePolicyEngine(createConfig(), backend);
    const session = createSession("ORDER_COLLECT_ADDRESS");

    const result = await engine.run(
      {
        userId: "web-user-1",
        channel: "web",
        message: "Q1",
        correlationId: "cid-6",
      },
      session,
    );

    expect(result.nextState).toBe("ORDER_COLLECT_ADDRESS");
    expect(result.reply).toContain("Google Maps");
  });

  it("accepts google maps link as address", async () => {
    const backend: SalesBackend = {
      channel: "web",
      postTool: vi.fn(),
    };
    const engine = new DialoguePolicyEngine(createConfig(), backend);
    const session = createSession("ORDER_COLLECT_ADDRESS");

    const result = await engine.run(
      {
        userId: "web-user-1",
        channel: "web",
        message: "https://www.google.com/maps/@10.7558775,106.678116,16z",
        correlationId: "cid-7",
      },
      session,
    );

    expect(result.nextState).toBe("ORDER_COLLECT_PAYMENT");
    expect(result.nextContext.order.address).toContain("google.com/maps");
  });

  it("adds OPEN_WEB_REVIEW suggestion at ORDER_CONFIRM", async () => {
    const backend: SalesBackend = {
      channel: "web",
      postTool: vi.fn(),
    };
    const engine = new DialoguePolicyEngine(createConfig(), backend);
    const session = createSession("ORDER_CONFIRM");
    session.context.order.items = [
      { sku: "WEB-P36", qty: 1 },
      { sku: "WEB-P22", qty: 2 },
    ];
    session.context.order.name = "Nguyen Van A";
    session.context.order.phone = "0909000001";
    session.context.order.address = "TP HCM";
    session.context.order.paymentMethod = "cod";

    const result = await engine.run(
      {
        userId: "web-user-1",
        channel: "web",
        message: "",
        actionPayload: "ACTION_ORDER_NEXT",
        correlationId: "cid-8",
      },
      session,
    );

    const suggestions = result.ui?.suggestions ?? [];
    const reviewSuggestion = suggestions.find((s) => typeof s !== "string" && String(s.payload).startsWith("OPEN_WEB_REVIEW:"));
    expect(reviewSuggestion).toBeTruthy();
    expect(typeof reviewSuggestion === "string" ? "" : reviewSuggestion.payload).toContain("WEB-P36:1");
    expect(typeof reviewSuggestion === "string" ? "" : reviewSuggestion.payload).toContain("WEB-P22:2");
  });

  it("maps natural order phrase to exact item and quantity", async () => {
    const postTool = vi.fn().mockResolvedValue({
      ok: true,
      data: {
        items: [
          { sku: "WEB-P02", name: "Cà phê Bạc Xỉu", category: "coffee", priceVnd: 40000, stockQty: 50 },
          { sku: "WEB-P01", name: "Americano", category: "coffee", priceVnd: 35000, stockQty: 50 },
        ],
      },
    });

    const backend: SalesBackend = {
      channel: "messenger",
      postTool,
    };
    const engine = new DialoguePolicyEngine(createConfig(), backend);
    const session = createSession("BROWSING_MENU");

    const result = await engine.run(
      {
        userId: "messenger-1",
        channel: "messenger",
        message: "cho 2 ly bac xiu",
        correlationId: "cid-9",
      },
      session,
    );

    expect(result.nextState).toBe("ORDER_COLLECT_ITEMS");
    expect(result.nextContext.order.items).toEqual([{ sku: "WEB-P02", qty: 2 }]);
    expect(result.reply).toContain("Đã thêm 2 x Cà phê Bạc Xỉu");
  });

  it("maps natural order phrase with vietnamese quantity words", async () => {
    const postTool = vi.fn().mockResolvedValue({
      ok: true,
      data: {
        items: [{ sku: "WEB-P02", name: "Cà phê Bạc Xỉu", category: "coffee", priceVnd: 40000, stockQty: 50 }],
      },
    });

    const backend: SalesBackend = {
      channel: "messenger",
      postTool,
    };
    const engine = new DialoguePolicyEngine(createConfig(), backend);

    const result = await engine.run(
      {
        userId: "messenger-word-qty",
        channel: "messenger",
        message: "mình muốn hai ly bạc xỉu",
        correlationId: "cid-9b",
      },
      createSession("BROWSING_MENU"),
    );

    expect(result.nextState).toBe("ORDER_COLLECT_ITEMS");
    expect(result.nextContext.order.items).toEqual([{ sku: "WEB-P02", qty: 2 }]);
    expect(result.reply).toContain("Đã thêm 2 x Cà phê Bạc Xỉu");
  });

  it("asks for confirmation when natural order is fuzzy typo in wizard step", async () => {
    const postTool = vi.fn().mockImplementation(async (_tool: string, payload: any) => {
      if (payload?.query) {
        return {
          ok: true,
          data: { items: [], page: 1, limit: 12, total: 0 },
        };
      }
      if (payload?.page === 1) {
        return {
          ok: true,
          data: {
            items: [{ sku: "WEB-P01", name: "Americano", category: "coffee", priceVnd: 35000, stockQty: 20 }],
            page: 1,
            limit: 50,
            total: 51,
          },
        };
      }
      if (payload?.page === 2) {
        return {
          ok: true,
          data: {
            items: [{ sku: "WEB-P02", name: "Cà phê Bạc Xỉu", category: "coffee", priceVnd: 40000, stockQty: 50 }],
            page: 2,
            limit: 50,
            total: 51,
          },
        };
      }
      return {
        ok: true,
        data: { items: [], page: 3, limit: 50, total: 51 },
      };
    });

    const backend: SalesBackend = {
      channel: "messenger",
      postTool,
    };
    const engine = new DialoguePolicyEngine(createConfig(), backend);
    const session = createSession("ORDER_COLLECT_ITEMS");

    const result = await engine.run(
      {
        userId: "messenger-2",
        channel: "messenger",
        message: "cho 2 ly bac siu",
        correlationId: "cid-10",
      },
      session,
    );

    expect(result.nextState).toBe("ORDER_COLLECT_ITEMS");
    expect(result.nextContext.order.items).toEqual([]);
    expect(result.reply).toContain("Mình đoán bạn muốn đặt 2 x Cà phê Bạc Xỉu");
    const suggestions = result.ui?.suggestions ?? [];
    const confirm = suggestions.find((item) => typeof item !== "string" && item.payload === "ACTION_ORDER_SET_QTY:WEB-P02:2");
    expect(confirm).toBeTruthy();
    expect(postTool).toHaveBeenCalledTimes(3);
  });

  it("accepts free-text confirmation after fuzzy suggestion", async () => {
    const postTool = vi.fn().mockImplementation(async (_tool: string, payload: any) => {
      if (payload?.query) {
        return {
          ok: true,
          data: { items: [], page: 1, limit: 12, total: 0 },
        };
      }
      if (payload?.page === 1) {
        return {
          ok: true,
          data: {
            items: [{ sku: "WEB-P01", name: "Americano", category: "coffee", priceVnd: 35000, stockQty: 20 }],
            page: 1,
            limit: 50,
            total: 51,
          },
        };
      }
      if (payload?.page === 2) {
        return {
          ok: true,
          data: {
            items: [{ sku: "WEB-P02", name: "Cà phê Bạc Xỉu", category: "coffee", priceVnd: 40000, stockQty: 50 }],
            page: 2,
            limit: 50,
            total: 51,
          },
        };
      }
      return {
        ok: true,
        data: { items: [], page: 3, limit: 50, total: 51 },
      };
    });

    const backend: SalesBackend = {
      channel: "messenger",
      postTool,
    };
    const engine = new DialoguePolicyEngine(createConfig(), backend);
    const initialSession = createSession("ORDER_COLLECT_ITEMS");

    const first = await engine.run(
      {
        userId: "messenger-3",
        channel: "messenger",
        message: "cho 5 ly bac siu",
        correlationId: "cid-11",
      },
      initialSession,
    );

    expect(first.reply).toContain("Mình đoán bạn muốn đặt 5 x Cà phê Bạc Xỉu");
    expect(first.nextContext.pendingOrderSuggestion).toEqual({
      sku: "WEB-P02",
      qty: 5,
      name: "Cà phê Bạc Xỉu",
    });

    const second = await engine.run(
      {
        userId: "messenger-3",
        channel: "messenger",
        message: "đúng rồi",
        correlationId: "cid-12",
      },
      {
        channel: "messenger",
        userId: "messenger-3",
        state: first.nextState,
        context: first.nextContext,
        version: 1,
        expiresAt: new Date(Date.now() + 3600_000),
      },
    );

    expect(second.nextState).toBe("ORDER_COLLECT_ITEMS");
    expect(second.nextContext.order.items).toEqual([{ sku: "WEB-P02", qty: 5 }]);
    expect(second.nextContext.pendingOrderSuggestion).toBeUndefined();
    expect(second.reply).toContain("Đã thêm 5 x Cà phê Bạc Xỉu");
  });

  it("accepts colloquial confirmation words after fuzzy suggestion", async () => {
    const postTool = vi.fn().mockImplementation(async (_tool: string, payload: any) => {
      if (payload?.query) {
        return {
          ok: true,
          data: { items: [], page: 1, limit: 12, total: 0 },
        };
      }
      return {
        ok: true,
        data: {
          items: [{ sku: "WEB-P02", name: "Cà phê Bạc Xỉu", category: "coffee", priceVnd: 40000, stockQty: 50 }],
          page: 1,
          limit: 50,
          total: 1,
        },
      };
    });

    const backend: SalesBackend = {
      channel: "messenger",
      postTool,
    };
    const engine = new DialoguePolicyEngine(createConfig(), backend);

    for (const phrase of ["chính xác", "ừ"]) {
      const first = await engine.run(
        {
          userId: `messenger-confirm-${phrase}`,
          channel: "messenger",
          message: "cho 1 ly bac siu",
          correlationId: `cid-confirm-pre-${phrase}`,
        },
        createSession("ORDER_COLLECT_ITEMS"),
      );

      const second = await engine.run(
        {
          userId: `messenger-confirm-${phrase}`,
          channel: "messenger",
          message: phrase,
          correlationId: `cid-confirm-post-${phrase}`,
        },
        {
          channel: "messenger",
          userId: `messenger-confirm-${phrase}`,
          state: first.nextState,
          context: first.nextContext,
          version: 1,
          expiresAt: new Date(Date.now() + 3600_000),
        },
      );

      expect(second.nextContext.order.items).toEqual([{ sku: "WEB-P02", qty: 1 }]);
      expect(second.reply).toContain("Đã thêm 1 x Cà phê Bạc Xỉu");
    }
  });
});
