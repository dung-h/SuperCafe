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
     - `MESSENGER_AUTO_PROFILE_SETUP=true|false` (default `true`)
     - `TELEGRAM_MINI_APP_URL` (optional, must be public HTTPS)
     - `EXTERNAL_SESSION_SECRET` (shared signing secret for Telegram->Web identity bridge)
     - `EXTERNAL_SESSION_TTL_SEC` (default `86400`)
     - `DIALOG_ENGINE_V2_ENABLED=true|false` (default `false`, rollout safe)
     - `DIALOG_SESSION_TTL_HOURS` (default `24`)
     - `DB_NAME` (production DB name; fallback now supports both `lowland_coffee` and `lowland_db`)
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
./scripts/omnichannel-smoke.sh
./scripts/sre-alert-check.sh
```

Regression quality gate (NLU/FSM):

```bash
cd OpenClaw
npm run -w @openclaw/openclaw eval:dialogue
```

Report path:
- `OpenClaw/services/openclaw/.artifacts/dialogue-eval-report.json`

Observability alert check (5-minute window by default):

- KPI thresholds:
  - `MAX_FALLBACK_RATE` (default `12`)
  - `MAX_ACTION_ERROR_RATE` (default `3`)
  - `MIN_ORDER_COMPLETION_RATE` (default `55`)
  - `MIN_ORDER_START_COUNT_FOR_COMPLETION_ALERT` (default `5`, avoid low-traffic false positives)
- Delivery thresholds:
  - `MAX_WEBHOOK_SEND_FAIL_RATE` (default `3`)
  - `MAX_DB_ERROR_RATE` (default `1`)

Install cron (every 10 minutes) for continuous check:

```bash
chmod +x scripts/install-sre-cron.sh
./scripts/install-sre-cron.sh install
```

Runbook:
- `docs/ops-runbook.md`

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

## KPI summary (dialogue v2)

When `DIALOG_ENGINE_V2_ENABLED=true`, OpenClaw exposes:

- `GET /admin/kpi/summary?windowMinutes=60`

Response includes:
- `channels[].rates.fallbackRate`
- `channels[].rates.orderWizardCompletionRate`
- `channels[].rates.actionErrorRate`
- `overall` aggregated counters/rates for all channels

## Security warning

- Do not commit real secrets.
- Keep secrets only in local/server `.env` files and rotate any leaked keys before release.

## Deploy under `/lowlandcoffee`

Supported, but set base URL explicitly:
- `PUBLIC_BASE_URL=https://dungho.io.vn/lowlandcoffee`

Nginx sample:

```nginx
location ^~ /lowlandcoffee/ {
    alias /var/www/supercafe/LTW251/public/;
    index index.php;
    try_files $uri $uri/ /lowlandcoffee/index.php?$query_string;
}

location ~ ^/lowlandcoffee/(.+\\.php)$ {
    alias /var/www/supercafe/LTW251/public/$1;
    include fastcgi_params;
    fastcgi_param SCRIPT_FILENAME /var/www/supercafe/LTW251/public/$1;
    fastcgi_pass unix:/run/php/php8.2-fpm.sock;
}
```

Note:
- Legacy links dạng `/?r=...` đã có lớp rewrite runtime để tương thích khi chạy dưới subpath.
