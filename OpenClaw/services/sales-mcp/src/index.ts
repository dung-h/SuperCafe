import { createApp } from "./app";
import { readConfig } from "./lib/config";
import { initDatabase, syncAdminWhitelist } from "./lib/database";
import { logger } from "./lib/logger";
import { SalesService } from "./salesService";

const config = readConfig();
const db = initDatabase(config.sqlitePath);
syncAdminWhitelist(db, config.adminWhitelistIds);

const service = new SalesService(db, {
  defaultShippingVnd: config.defaultShippingVnd,
  deliveryShopLat: config.deliveryShopLat,
  deliveryShopLng: config.deliveryShopLng,
  deliveryBaseEtaMinutes: config.deliveryBaseEtaMinutes,
  deliveryPerKmEtaMinutes: config.deliveryPerKmEtaMinutes,
  deliveryFallbackEtaMinutes: config.deliveryFallbackEtaMinutes,
  adminWhitelistIds: config.adminWhitelistIds,
  adminPassphraseHash: config.adminPassphraseHash,
  adminPassphrasePlain: config.adminPassphrasePlain,
});

if (config.apiKey === "dev-internal-key-change-me") {
  logger.warn("SALES_MCP_API_KEY is using default value; change it for non-demo environments.");
}

const app = createApp(service, { apiKey: config.apiKey });

app.listen(config.port, config.host, () => {
  logger.info({ host: config.host, port: config.port, sqlitePath: config.sqlitePath }, "sales-mcp listening");
});
