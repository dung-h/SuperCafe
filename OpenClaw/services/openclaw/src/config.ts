import { config as loadDotenv } from "dotenv";
import { z } from "zod";

loadDotenv();

const envSchema = z.object({
  OPENCLAW_HOST: z.string().default("0.0.0.0"),
  OPENCLAW_PORT: z.coerce.number().default(8082),
  LLM_BASE_URL: z.string().url().default("https://api.openai.com/v1"),
  LLM_API_KEY: z.string().default(""),
  LLM_MODEL: z.string().default("gpt-oss-120b"),
  LLM_TIMEOUT_MS: z.coerce.number().optional(),
  SALES_MCP_URL: z.string().url().default("http://sales-mcp:8081"),
  SALES_MCP_API_KEY: z.string().default("dev-internal-key-change-me"),
  WEB_BRIDGE_BASE_URL: z.string().url().default("http://localhost:9999"),
  WEB_BRIDGE_API_KEY: z.string().default("dev-bridge-key-change-me"),
  OPENCLAW_TIMEOUT_MS: z.coerce.number().default(20000),
  BANK_NAME: z.string().default("Vietcombank"),
  BANK_ACCOUNT_NAME: z.string().default("CONG TY OPENCLAW DEMO"),
  BANK_ACCOUNT_NUMBER: z.string().default("0000000000"),
});

export type OpenClawConfig = {
  host: string;
  port: number;
  llmBaseUrl: string;
  llmApiKey: string;
  llmModel: string;
  llmTimeoutMs: number;
  salesMcpUrl: string;
  salesMcpApiKey: string;
  webBridgeBaseUrl: string;
  webBridgeApiKey: string;
  timeoutMs: number;
  bankName: string;
  bankAccountName: string;
  bankAccountNumber: string;
};

export function readConfig(): OpenClawConfig {
  const env = envSchema.parse(process.env);
  return {
    host: env.OPENCLAW_HOST,
    port: env.OPENCLAW_PORT,
    llmBaseUrl: env.LLM_BASE_URL,
    llmApiKey: env.LLM_API_KEY,
    llmModel: env.LLM_MODEL,
    llmTimeoutMs: env.LLM_TIMEOUT_MS ?? env.OPENCLAW_TIMEOUT_MS,
    salesMcpUrl: env.SALES_MCP_URL,
    salesMcpApiKey: env.SALES_MCP_API_KEY,
    webBridgeBaseUrl: env.WEB_BRIDGE_BASE_URL,
    webBridgeApiKey: env.WEB_BRIDGE_API_KEY,
    timeoutMs: env.OPENCLAW_TIMEOUT_MS,
    bankName: env.BANK_NAME,
    bankAccountName: env.BANK_ACCOUNT_NAME,
    bankAccountNumber: env.BANK_ACCOUNT_NUMBER,
  };
}
