# SuperCafe Monorepo

Milestone repository that combines:
- `LTW251`: PHP MVC beverage ecommerce website.
- `OpenClaw`: chatbot services (Telegram + web channel).

## Quick start (local Docker demo)

1. Prepare env:
   - Edit `OpenClaw/infra/env/.env`.
   - Set `LLM_BASE_URL`, `LLM_API_KEY`, `LLM_MODEL`.
2. Start stack:
   - `powershell -ExecutionPolicy Bypass -File scripts/milestone-up.ps1 -Build`
3. Endpoints:
   - Website: `http://localhost:9999`
   - OpenClaw health: `http://localhost:8082/health`
   - Sales MCP health: `http://localhost:8081/health`
   - Telegram gateway health: `http://localhost:8083/health`
   - Mailhog: `http://localhost:8025`

Stop stack:
- `powershell -ExecutionPolicy Bypass -File scripts/milestone-down.ps1`

## Architecture notes

- Website widget -> `LTW251/?r=site/chatbot` -> `OpenClaw /chat` with `channel=web`.
- OpenClaw web channel uses `LTW251` bridge API (`BotBridgeController`) as product/order source.
- Telegram flow remains on existing `sales-mcp` backend.

## Security warning

- Do not commit real secrets.
- Keep secrets only in local/server `.env` files and rotate any leaked keys before release.
