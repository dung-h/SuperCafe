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
  - body: `{ customer, items, payment_method, note? }`
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
- `POST /chat`
  - body:
    ```json
    {
      "userId": "123",
      "message": "toi muon dat 2 goi CF-ARABICA-250",
      "channel": "telegram|web|messenger",
      "correlationId": "optional",
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
    - `messenger` (stub phase, chua bat webhook thuc)
  - response: `{ ok: true, data: { reply: string, alerts?: string[] } }`

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
