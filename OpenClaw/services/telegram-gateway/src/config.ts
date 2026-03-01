import { config as loadDotenv } from "dotenv";
import { z } from "zod";

loadDotenv();

const envSchema = z.object({
  TELEGRAM_BOT_TOKEN: z.string().min(20),
  TELEGRAM_POLLING_TIMEOUT: z.coerce.number().default(30),
  TELEGRAM_GATEWAY_HOST: z.string().default("0.0.0.0"),
  TELEGRAM_GATEWAY_PORT: z.coerce.number().default(8083),
  SALES_MCP_URL: z.string().url().default("http://sales-mcp:8081"),
  SALES_MCP_API_KEY: z.string().default("dev-internal-key-change-me"),
  OPENCLAW_URL: z.string().url().default("http://openclaw:8082"),
  TELEGRAM_MINI_APP_URL: z.string().default(""),
  ADMIN_ALERT_CHAT_ID: z.string().default(""),
  ADMIN_SESSION_TTL_MIN: z.coerce.number().default(480),
  HTTP_TIMEOUT_MS: z.coerce.number().default(20000),
});

export type GatewayConfig = {
  token: string;
  pollingTimeoutSec: number;
  host: string;
  port: number;
  salesMcpUrl: string;
  salesMcpApiKey: string;
  openclawUrl: string;
  miniAppUrl?: string;
  adminAlertChatId?: string;
  adminSessionTtlMs: number;
  httpTimeoutMs: number;
};

export function readConfig(): GatewayConfig {
  const env = envSchema.parse(process.env);
  return {
    token: env.TELEGRAM_BOT_TOKEN,
    pollingTimeoutSec: env.TELEGRAM_POLLING_TIMEOUT,
    host: env.TELEGRAM_GATEWAY_HOST,
    port: env.TELEGRAM_GATEWAY_PORT,
    salesMcpUrl: env.SALES_MCP_URL,
    salesMcpApiKey: env.SALES_MCP_API_KEY,
    openclawUrl: env.OPENCLAW_URL,
    miniAppUrl: env.TELEGRAM_MINI_APP_URL || undefined,
    adminAlertChatId: env.ADMIN_ALERT_CHAT_ID || undefined,
    adminSessionTtlMs: env.ADMIN_SESSION_TTL_MIN * 60 * 1000,
    httpTimeoutMs: env.HTTP_TIMEOUT_MS,
  };
}
