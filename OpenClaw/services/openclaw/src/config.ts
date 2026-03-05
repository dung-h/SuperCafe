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
  TELEGRAM_BOT_TOKEN: z.string().optional(),
  MESSENGER_PAGE_ACCESS_TOKEN: z.string().optional(),
  OPENCLAW_DB_HOST: z.string().default("lowland_db"),
  OPENCLAW_DB_PORT: z.coerce.number().default(3306),
  OPENCLAW_DB_NAME: z.string().default("lowland_coffee"),
  OPENCLAW_DB_USER: z.string().default("web251"),
  OPENCLAW_DB_PASS: z.string().default("Webhk251!"),
  DIALOG_ENGINE_V2_ENABLED: z.string().optional(),
  DIALOG_SESSION_TTL_HOURS: z.coerce.number().default(24),
  DIALOG_HYBRID_ASSIST_ENABLED: z.string().optional(),
  DIALOG_HYBRID_ASSIST_THRESHOLD: z.coerce.number().default(0.55),
  OPENCLAW_CHAT_RATE_LIMIT_WINDOW_SEC: z.coerce.number().default(30),
  OPENCLAW_CHAT_RATE_LIMIT_MAX: z.coerce.number().default(30),
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
  telegramToken?: string;
  messengerToken?: string;
  openclawDbHost: string;
  openclawDbPort: number;
  openclawDbName: string;
  openclawDbUser: string;
  openclawDbPass: string;
  dialogEngineV2Enabled: boolean;
  dialogSessionTtlHours: number;
  dialogHybridAssistEnabled: boolean;
  dialogHybridAssistThreshold: number;
  chatRateLimitWindowSec: number;
  chatRateLimitMax: number;
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
    telegramToken: env.TELEGRAM_BOT_TOKEN,
    messengerToken: env.MESSENGER_PAGE_ACCESS_TOKEN,
    openclawDbHost: env.OPENCLAW_DB_HOST,
    openclawDbPort: env.OPENCLAW_DB_PORT,
    openclawDbName: env.OPENCLAW_DB_NAME,
    openclawDbUser: env.OPENCLAW_DB_USER,
    openclawDbPass: env.OPENCLAW_DB_PASS,
    dialogEngineV2Enabled: parseBoolean(env.DIALOG_ENGINE_V2_ENABLED),
    dialogSessionTtlHours: Math.max(1, env.DIALOG_SESSION_TTL_HOURS),
    dialogHybridAssistEnabled: parseBoolean(env.DIALOG_HYBRID_ASSIST_ENABLED || "true"),
    dialogHybridAssistThreshold: Math.min(0.95, Math.max(0.2, env.DIALOG_HYBRID_ASSIST_THRESHOLD)),
    chatRateLimitWindowSec: Math.max(5, env.OPENCLAW_CHAT_RATE_LIMIT_WINDOW_SEC),
    chatRateLimitMax: Math.max(1, env.OPENCLAW_CHAT_RATE_LIMIT_MAX),
  };
}

function parseBoolean(input?: string): boolean {
  if (!input) {
    return false;
  }
  const normalized = input.trim().toLowerCase();
  return normalized === "1" || normalized === "true" || normalized === "yes" || normalized === "on";
}
