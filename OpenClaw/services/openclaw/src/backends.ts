import type { HttpClient } from "./clients";
import type { OpenClawConfig } from "./config";

export type BackendChannel = "telegram" | "web" | "messenger";

type ToolName =
  | "catalog_list"
  | "catalog_get"
  | "order_create"
  | "order_get"
  | "faq_answer";

type ToolResponse<T> = {
  ok: boolean;
  data: T;
  error?: string;
};

export interface SalesBackend {
  readonly channel: BackendChannel;
  postTool<T>(tool: ToolName, body: unknown, correlationId: string): Promise<ToolResponse<T>>;
}

const TELEGRAM_ROUTES: Record<ToolName, string> = {
  catalog_list: "/tools/catalog_list",
  catalog_get: "/tools/catalog_get",
  order_create: "/tools/order_create",
  order_get: "/tools/order_get",
  faq_answer: "/tools/faq_answer",
};

const WEB_ROUTES: Record<ToolName, string> = {
  catalog_list: "/?r=botBridge/catalogList",
  catalog_get: "/?r=botBridge/catalogGet",
  order_create: "/?r=botBridge/orderCreate",
  order_get: "/?r=botBridge/orderGet",
  faq_answer: "/?r=botBridge/faqAnswer",
};

export function buildBackend(
  channel: BackendChannel,
  config: OpenClawConfig,
  httpClient: HttpClient,
): SalesBackend {
  if (channel === "web" || channel === "messenger") {
    return {
      channel,
      postTool: async <T>(tool: ToolName, body: unknown, correlationId: string) =>
        httpClient.postJson<ToolResponse<T>>(
          `${config.webBridgeBaseUrl.replace(/\/$/, "")}${WEB_ROUTES[tool]}`,
          body,
          {
            "x-correlation-id": correlationId,
            "x-api-key": config.webBridgeApiKey,
          },
        ),
    };
  }

  return {
    channel: "telegram",
    postTool: async <T>(tool: ToolName, body: unknown, correlationId: string) =>
      httpClient.postJson<ToolResponse<T>>(
        `${config.salesMcpUrl.replace(/\/$/, "")}${TELEGRAM_ROUTES[tool]}`,
        body,
        {
          "x-correlation-id": correlationId,
          "x-api-key": config.salesMcpApiKey,
        },
      ),
  };
}
