import path from "node:path";
import { config as loadDotenv } from "dotenv";
import { z } from "zod";

loadDotenv();

const envSchema = z.object({
  NODE_ENV: z.string().default("development"),
  SALES_MCP_PORT: z.coerce.number().default(8081),
  SALES_MCP_HOST: z.string().default("0.0.0.0"),
  SQLITE_PATH: z.string().default(path.resolve(process.cwd(), "../../infra/sqlite/sales.db")),
  DEFAULT_SHIPPING_VND: z.coerce.number().default(30000),
  DELIVERY_SHOP_LAT: z.coerce.number().default(10.772081646838936),
  DELIVERY_SHOP_LNG: z.coerce.number().default(106.65817769618629),
  DELIVERY_BASE_ETA_MINUTES: z.coerce.number().default(20),
  DELIVERY_PER_KM_ETA_MINUTES: z.coerce.number().default(4),
  DELIVERY_FALLBACK_ETA_MINUTES: z.coerce.number().default(45),
  SALES_MCP_API_KEY: z.string().default("dev-internal-key-change-me"),
  ADMIN_WHITELIST_IDS: z.string().default(""),
  ADMIN_PASSPHRASE_HASH: z.string().default(""),
  ADMIN_PASSPHRASE_PLAIN: z.string().default(""),
});

export type SalesConfig = {
  nodeEnv: string;
  host: string;
  port: number;
  sqlitePath: string;
  defaultShippingVnd: number;
  deliveryShopLat: number;
  deliveryShopLng: number;
  deliveryBaseEtaMinutes: number;
  deliveryPerKmEtaMinutes: number;
  deliveryFallbackEtaMinutes: number;
  apiKey: string;
  adminWhitelistIds: string[];
  adminPassphraseHash: string;
  adminPassphrasePlain?: string;
};

export function readConfig(): SalesConfig {
  const env = envSchema.parse(process.env);
  const whitelist = env.ADMIN_WHITELIST_IDS.split(",")
    .map((value) => value.trim())
    .filter(Boolean);

  return {
    nodeEnv: env.NODE_ENV,
    host: env.SALES_MCP_HOST,
    port: env.SALES_MCP_PORT,
    sqlitePath: env.SQLITE_PATH,
    defaultShippingVnd: env.DEFAULT_SHIPPING_VND,
    deliveryShopLat: env.DELIVERY_SHOP_LAT,
    deliveryShopLng: env.DELIVERY_SHOP_LNG,
    deliveryBaseEtaMinutes: Math.max(5, env.DELIVERY_BASE_ETA_MINUTES),
    deliveryPerKmEtaMinutes: Math.max(1, env.DELIVERY_PER_KM_ETA_MINUTES),
    deliveryFallbackEtaMinutes: Math.max(10, env.DELIVERY_FALLBACK_ETA_MINUTES),
    apiKey: env.SALES_MCP_API_KEY,
    adminWhitelistIds: whitelist,
    adminPassphraseHash: env.ADMIN_PASSPHRASE_HASH,
    adminPassphrasePlain: env.ADMIN_PASSPHRASE_PLAIN || undefined,
  };
}
