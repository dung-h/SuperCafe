import { config as loadDotenv } from "dotenv";
import { z } from "zod";

loadDotenv();

const envSchema = z.object({
  TELEGRAM_MINIAPP_HOST: z.string().default("0.0.0.0"),
  TELEGRAM_MINIAPP_PORT: z.coerce.number().default(8084),
  SALES_MCP_URL: z.string().url().default("http://sales-mcp:8081"),
  SALES_MCP_API_KEY: z.string().default("dev-internal-key-change-me"),
  HTTP_TIMEOUT_MS: z.coerce.number().default(20000),
  SHOP_NAME: z.string().default("OpenClaw Drinks"),
  BANK_NAME: z.string().default("Vietcombank"),
  BANK_ACCOUNT_NAME: z.string().default("CONG TY ABC"),
  BANK_ACCOUNT_NUMBER: z.string().default("0123456789"),
});

export type MiniAppConfig = {
  host: string;
  port: number;
  salesMcpUrl: string;
  salesMcpApiKey: string;
  httpTimeoutMs: number;
  shopName: string;
  bankName: string;
  bankAccountName: string;
  bankAccountNumber: string;
};

export function readConfig(): MiniAppConfig {
  const env = envSchema.parse(process.env);
  return {
    host: env.TELEGRAM_MINIAPP_HOST,
    port: env.TELEGRAM_MINIAPP_PORT,
    salesMcpUrl: env.SALES_MCP_URL,
    salesMcpApiKey: env.SALES_MCP_API_KEY,
    httpTimeoutMs: env.HTTP_TIMEOUT_MS,
    shopName: env.SHOP_NAME,
    bankName: env.BANK_NAME,
    bankAccountName: env.BANK_ACCOUNT_NAME,
    bankAccountNumber: env.BANK_ACCOUNT_NUMBER,
  };
}
