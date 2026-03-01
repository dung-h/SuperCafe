import { describe, expect, it, vi } from "vitest";
import { buildBackend } from "../src/backends";
import type { OpenClawConfig } from "../src/config";

describe("buildBackend", () => {
  const config: OpenClawConfig = {
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
  };

  it("routes telegram channel to sales-mcp tools", async () => {
    const postJson = vi.fn().mockResolvedValue({ ok: true, data: { items: [] } });
    const backend = buildBackend("telegram", config, { postJson } as any);

    await backend.postTool("catalog_list", { page: 1 }, "cid");

    expect(postJson).toHaveBeenCalledWith(
      "http://sales-mcp:8081/tools/catalog_list",
      { page: 1 },
      { "x-correlation-id": "cid", "x-api-key": "sales-key" },
    );
  });

  it("routes web channel to bot bridge endpoints", async () => {
    const postJson = vi.fn().mockResolvedValue({ ok: true, data: { items: [] } });
    const backend = buildBackend("web", config, { postJson } as any);

    await backend.postTool("catalog_get", { sku_or_id: "A" }, "cid2");

    expect(postJson).toHaveBeenCalledWith(
      "http://lowland-app/?r=botBridge/catalogGet",
      { sku_or_id: "A" },
      { "x-correlation-id": "cid2", "x-api-key": "bridge-key" },
    );
  });
});

