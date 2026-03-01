import { createApp } from "./app";
import { readConfig } from "./config";
import { logger } from "./logger";

const config = readConfig();
if (config.salesMcpApiKey === "dev-internal-key-change-me") {
  logger.warn("SALES_MCP_API_KEY is using default value; change it for non-demo environments.");
}
if (!config.llmApiKey) {
  logger.warn("LLM_API_KEY is empty; LLM requests will fail until configured.");
}
const app = createApp(config);

app.listen(config.port, config.host, () => {
  logger.info({ host: config.host, port: config.port }, "openclaw listening");
});
