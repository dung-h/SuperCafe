# API Contract

## Sales MCP
Base URL: `http://sales-mcp:8081`

Security headers for `POST /tools/*` and `POST /admin/*`:
- `x-api-key: <SALES_MCP_API_KEY>`
- `x-correlation-id: <request-id>`
- `x-actor-telegram-id: <telegram-id>` (required for admin/mutating endpoints)

### Health
- `GET /health`
- `GET /ready`

### Admin
- `POST /admin/authenticate`
  - body: `{ telegramId: string, passphrase: string }`
  - response: `{ ok: boolean, data: { authenticated: boolean } }`

### Tools
- `POST /tools/catalog_list`
  - body: `{ query?: string, category?: string, page?: number, limit?: number }`
- `POST /tools/catalog_categories`
  - body: `{}`
- `POST /tools/catalog_get`
  - body: `{ sku_or_id: string }`
- `POST /tools/order_create`
  - body: `{ customer, items, payment_method, note?, idempotency_key? }`
  - `idempotency_key`:
    - optional for backward compatibility
    - if supplied, backend phai replay cung ket qua cho cung key + cung payload
    - neu key trung nhung payload khac, tra loi loi conflict
- `POST /tools/order_get`
  - body: `{ order_code: string }`
- `POST /tools/order_list`
  - body: `{ status?: OrderStatus, from?: string, to?: string }`
- `POST /tools/order_set_status`
  - body: `{ order_code: string, status: OrderStatus, reason?: string }`
- `POST /tools/payment_submit`
  - body: `{ order_code: string, transfer_ref?: string, proof_text?: string }`
- `POST /tools/payment_confirm`
  - body: `{ order_code: string, approved: boolean, note?: string }`
- `POST /tools/faq_answer`
  - body: `{ question: string, product_sku?: string }`

### Admin product/inventory
- `POST /admin/product_add`
  - body (chinh): `{ sku, name, category?, imageUrl?, priceVnd, stockQty, description, faq? }`
  - `imageUrl` neu co phai la URL `http(s)`.
- `POST /admin/product_update`
  - body (chinh): `{ sku, name?, category?, imageUrl?, priceVnd?, stockQty?, description?, isActive?, faq? }`
  - `imageUrl` neu co phai la URL `http(s)`.
- `POST /admin/stock_set`

## OpenClaw Service
Base URL: `http://openclaw:8082`

- `GET /health`
- `GET /admin/kpi/summary?windowMinutes=60`
  - yeu cau `DIALOG_ENGINE_V2_ENABLED=true`
  - response:
    ```json
    {
      "ok": true,
      "data": {
        "windowMinutes": 60,
        "windowStartedAt": "2026-03-04T10:00:00.000Z",
        "generatedAt": "2026-03-04T11:00:00.000Z",
        "channels": [
          {
            "channel": "web",
            "counters": {
              "totalBotEvents": 120,
              "fallbackCount": 8,
              "orderStartCount": 30,
              "orderCreateSuccessCount": 20,
              "actionTotalCount": 72,
              "actionErrorCount": 4
            },
            "rates": {
              "fallbackRate": 6.67,
              "orderWizardCompletionRate": 66.67,
              "actionErrorRate": 5.56
            }
          }
        ],
        "overall": {
          "counters": {
            "totalBotEvents": 350,
            "fallbackCount": 25,
            "orderStartCount": 80,
            "orderCreateSuccessCount": 49,
            "actionTotalCount": 210,
            "actionErrorCount": 11
          },
          "rates": {
            "fallbackRate": 7.14,
            "orderWizardCompletionRate": 61.25,
            "actionErrorRate": 5.24
          }
        }
      }
    }
    ```
- `GET /admin/profile?channel=<telegram|web|messenger>&userId=<id>`
  - yeu cau `DIALOG_ENGINE_V2_ENABLED=true`
  - tra ve profile hop nhat cua user theo mapping identity.
- `POST /chat`
  - body:
    ```json
    {
      "userId": "123",
      "message": "toi muon dat don",
      "actionPayload": "ACTION_ORDER_START",
      "channel": "telegram|web|messenger",
      "correlationId": "optional",
      "clientContext": {
        "sourceMessageId": "optional",
        "locale": "vi-VN"
      },
      "profile": {
        "name": "Nguyen Van A",
        "phone": "0909000001",
        "address": "Ha Noi"
      }
    }
    ```
  - `channel`:
    - `telegram` (default, backend `sales-mcp`)
    - `web` (backend bridge URL `WEB_BRIDGE_BASE_URL`)
    - `messenger` (backend bridge URL `WEB_BRIDGE_BASE_URL`)
  - `message` hoac `actionPayload` bat buoc co it nhat 1 truong.
  - rate limit:
    - neu vuot nguong, service tra `HTTP 429` + `Retry-After` + `retryAfterSeconds`.
    - nguong cau hinh qua env:
      - `OPENCLAW_CHAT_RATE_LIMIT_WINDOW_SEC`
      - `OPENCLAW_CHAT_RATE_LIMIT_MAX`
  - hybrid assist:
    - `DIALOG_HYBRID_ASSIST_ENABLED=true|false`
    - `DIALOG_HYBRID_ASSIST_THRESHOLD=0.2..0.95` (de xuat `0.55`)
  - profile unify:
    - engine tu dong dong bo profile vao MySQL:
      - `chat_user_profiles`
      - `chat_user_identities`
    - mapping uu tien:
      1) identity `(channel,user_id)` da ton tai
      2) neu chua ton tai va co so dien thoai hop le -> lien ket profile theo `phone_normalized`.
  - response:
    ```json
    {
      "ok": true,
      "data": {
        "reply": "Ban muon lam gi tiep theo?",
        "alerts": [],
        "ui": {
          "type": "menu",
          "title": "Tuy chon",
          "items": [],
          "suggestions": [
            { "label": "Xem menu", "payload": "ACTION_VIEW_MENU" },
            { "label": "Ca phe", "payload": "ACTION_CATEGORY:coffee" }
          ]
        },
        "state": {
          "name": "ORDER_COLLECT_PHONE",
          "missingFields": ["phone"]
        }
      }
    }
    ```
  - `ui.suggestions` da chuan hoa theo object `{label,payload}` cho tat ca channels.
  - payload dac biet cho UX review don:
    - `OPEN_WEB_REVIEW:<SKU:QTY,SKU:QTY,...>|n=<base64url(name)>|p=<digits>|a=<base64url(address)>|m=bank_transfer|cod`
    - `n/p/a/m` la optional; adapter channel se tu map thanh query `rn/rp/ra/rm` cho trang review.
    - adapter channel se map payload nay thanh nut mo URL web review (khong gui callback ve bot).
  - action payload uu tien cao hon text intent trong engine v2.
  - engine v2 event log (`chat_dialogue_events`) luu them:
    - `source_message_id`
    - `locale`
  - ho tro handoff:
    - neu nguoi dung nhan tin dang \"gap tu van vien\", bot vao che do handoff.
    - engine v2: che do handoff duoc luu trong MySQL session state.
    - legacy handoff (fallback): giu session theo Redis TTL.
    - nhan \"tiep tuc voi bot\" de thoat handoff va quay lai bot tu dong.

## Telegram Gateway
Base URL: `http://telegram-gateway:8083`

- `GET /health`
- `GET /ready`
- Telegram long polling command handlers theo hop dong trong runbook.
- Co ho tro `/miniapp` + menu button `web_app` neu `TELEGRAM_MINI_APP_URL` duoc cau hinh.

## Telegram Mini App
Base URL: `http://telegram-miniapp:8084`

- `GET /health`
- `GET /ready`
- `GET /api/config`
- `GET /api/products?query=<tu_khoa>`
- `GET /api/products?query=<tu_khoa>&category=<category>`
  - response item: `{ sku, name, category, imageUrl?, priceVnd, stockQty, description, ... }`
- `GET /api/categories`
- `POST /api/orders`
  - body: `{ customerTelegramId, customerName, customerPhone, customerAddress, paymentMethod, note?, items }`
- `GET /api/orders/:orderCode?telegramUserId=<id>`
- `POST /api/pay`
  - body: `{ orderCode, transferRef, proofText?, customerTelegramId }`

## OrderStatus
- `new`
- `awaiting_payment`
- `payment_review`
- `paid`
- `shipping`
- `completed`
- `cancelled`
