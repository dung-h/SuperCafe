# OpenClaw Sales Bot Runbook

## 1) Khoi tao
1. Sao chep `infra/env/.env.example` thanh `infra/env/.env`.
2. Dien cac bien bat buoc:
   - `TELEGRAM_BOT_TOKEN`
   - `SALES_MCP_API_KEY`
   - `LLM_BASE_URL`
   - `LLM_API_KEY`
   - `LLM_MODEL`
   - `WEB_BRIDGE_BASE_URL` (neu su dung channel `web`)
   - `WEB_BRIDGE_API_KEY` (neu su dung channel `web`)
   - `ADMIN_WHITELIST_IDS`
   - `ADMIN_PASSPHRASE_HASH` (hoac `ADMIN_PASSPHRASE_PLAIN` cho local demo)
   - `ADMIN_ALERT_CHAT_ID`
   - `TELEGRAM_MINI_APP_URL` (URL HTTPS cong khai)
3. Tao hash passphrase admin (argon2id):
   - `npm run -w @openclaw/sales-mcp hash-passphrase -- "mat_khau_admin"`
4. Local demo nhanh (khong khuyen nghi production):
   - Dat `ADMIN_PASSPHRASE_PLAIN=mat_khau_admin` trong `.env`.

## 2) Chay local voi Docker Compose
1. `docker compose --env-file infra/env/.env up -d --build`
2. Kiem tra:
   - `http://localhost:8081/health`
   - `http://localhost:8082/health`
   - `http://localhost:8083/health`
   - `http://localhost:8084/health`
3. Kiem tra logs:
   - `docker compose logs -f telegram-gateway`
   - `docker compose logs -f openclaw`
   - `docker compose logs -f sales-mcp`
   - `docker compose logs -f telegram-miniapp`

## 3) Telegram command guide
Khach:
- `/miniapp`
- `/categories`
- `/products_cat <category>`
- `/products [tu_khoa]`
- `/product <sku>`
- `/order <sku:sl,... | ho ten | sdt | dia chi | bank_transfer|cod>`
- `/order_status <ma_don>`
- `/pay <ma_don> <ma_giao_dich> [ghi_chu]`

Admin:
- `/admin <passphrase>` (khong can dau nhay)
- `/orders [status]`
- `/order <ma_don>`
- `/confirm_payment <ma_don>`
- `/reject_payment <ma_don> [ly_do]`
- `/set_status <ma_don> <status> [reason]`
- `/product_add <sku|name|category|price|stock|description|imageUrl?>`
- `/product_update <sku|field=value|...>`
- `/stock_set <sku> <qty>`

## 4) Backup / Restore SQLite
PowerShell:
- Backup: `./infra/scripts/backup-sqlite.ps1`
- Restore: `./infra/scripts/restore-sqlite.ps1 -BackupFile infra/sqlite/backups/sales-YYYYMMDD-HHMMSS.db`

Bash:
- Backup: `./infra/scripts/backup-sqlite.sh`
- Restore: `./infra/scripts/restore-sqlite.sh infra/sqlite/backups/sales-YYYYMMDD-HHMMSS.db`

## 5) Mini App URL (Telegram)
1. Tao URL HTTPS cong khai toi `http://localhost:8084` (vi du `ngrok http 8084`).
2. Set `TELEGRAM_MINI_APP_URL=https://<domain-cong-khai>`.
3. Restart `telegram-gateway`:
   - `docker compose --env-file infra/env/.env up -d --build telegram-gateway`
4. (Khuyen nghi) Dat domain Mini App trong BotFather (`/setdomain`).

## 6) Rotate Telegram token
1. Tao token moi voi BotFather.
2. Cap nhat `TELEGRAM_BOT_TOKEN` trong `infra/env/.env`.
3. Restart gateway:
   - `docker compose up -d --build telegram-gateway`
4. Vo hieu token cu.

## 7) Troubleshooting
- Neu `openclaw` tra loi cham: kiem tra endpoint LLM (`LLM_BASE_URL`) va timeout (`LLM_TIMEOUT_MS`).
- Neu `openclaw` bi 401/403: kiem tra `LLM_API_KEY` va `LLM_MODEL`.
- Neu admin lenh bi tu choi: kiem tra whitelist ID + session `/admin <passphrase>`.
- Neu don hang khong duoc tao: kiem tra ton kho SKU va format lenh `/order`.
- Neu Mini App khong mo duoc: kiem tra `TELEGRAM_MINI_APP_URL` la HTTPS va truy cap duoc tu Internet.
