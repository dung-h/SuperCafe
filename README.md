# SuperCafe Monorepo

Milestone repository that combines:
- `LTW251`: PHP MVC beverage ecommerce website.
- `OpenClaw`: chatbot services (Telegram + web + Messenger channel).

## Public links

- Website: https://dungho.io.vn/
- Facebook bot/page: https://facebook.com/profile.php?id=61588610807836
- Telegram bot: https://t.me/Demo_015_bot

## Project lineage

This repository continues development from:
- https://github.com/dung-h/LowlandCoffee

Background:
- `LowlandCoffee` was a Web Programming assignment completed by the author and three teammates.
- Team/member details are kept in [LTW251 README](LTW251/README.md).
- `SuperCafe` focuses on extending that codebase with chatbot architecture and omnichannel bot flows.

## Quick start (local Docker demo)

1. Prepare env:
   - Copy `milestone.env.example` to `.env` and fill deploy values when using domain/Messenger.
     - `PUBLIC_BASE_URL=https://<your-domain>`
     - `WEB_BRIDGE_API_KEY=<shared-secret>`
     - `MESSENGER_VERIFY_TOKEN`, `MESSENGER_APP_SECRET`, `MESSENGER_PAGE_ACCESS_TOKEN`
      - `TELEGRAM_MINI_APP_URL` (optional, must be public HTTPS)
      - `EXTERNAL_SESSION_SECRET` (shared signing secret for Telegram->Web identity bridge)
      - `EXTERNAL_SESSION_TTL_SEC` (default `86400`)
      - `DIALOG_ENGINE_V2_ENABLED=true|false` (default `false`, rollout safe)
      - `DIALOG_SESSION_TTL_HOURS` (default `24`)
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
- Telegram -> Web bridge:
  - Gateway generates signed `tg_session` on Mini App link.
  - Web widget forwards token to `/?r=site/chatbot`.
  - `SiteController` verifies token and maps stable user id `web-tg-<telegram_id>`.
- Industrial Lite v1 dialogue engine:
  - Request supports `actionPayload` + `clientContext`.
  - Response `ui.suggestions` uses object contract: `{ label, payload }`.
  - Session state and event logs persist on MySQL (`chat_dialogue_sessions`, `chat_dialogue_events`).
  - Rollback by setting `DIALOG_ENGINE_V2_ENABLED=false`.

## Messenger webhook

- Callback URL: `https://<your-domain>/?r=messenger/webhook`
- Verify token env on website service: `MESSENGER_VERIFY_TOKEN`
- Optional hardening:
  - `MESSENGER_APP_SECRET` for signature validation (`X-Hub-Signature-256`)
  - `MESSENGER_PAGE_ACCESS_TOKEN` to send replies via Graph API

### Messenger webhook smoke test

Run after deploy:

```bash
./scripts/messenger-webhook-smoke.sh
```

This script verifies:
- GET challenge (`hub.mode/hub.verify_token/hub.challenge`)
- POST event is processed once
- duplicate POST is detected (`duplicates=1`)

Handoff command (all channels):
- Request human support: `gặp tư vấn viên`
- Return to bot: `tiếp tục với bot`

## Chatbot smoke test

Run after deploy:

```bash
./scripts/chatbot-smoke.sh
```

Or run manually:

```bash
curl -sS -H 'Content-Type: application/json' \
  -d '{"userId":"web-smoke","message":"có các món nào","channel":"web"}' \
  http://127.0.0.1:8082/chat
```

Expected:
- `ok: true`
- `data.reply` contains `Menu đồ uống`
- `data.ui.type` equals `menu`
- `data.ui.items` has menu cards for web widget
- `data.ui.suggestions[]` has `{label,payload}`

## Security warning

- Do not commit real secrets.
- Keep secrets only in local/server `.env` files and rotate any leaked keys before release.
