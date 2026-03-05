# Industrial Lite v1 - Backlog 4 Tuan Dau

## Scope
- Kenh: Messenger, Web widget, Telegram.
- Muc tieu: nang cap tu pilot production len Industrial Lite v1 (~4/5) theo huong task-oriented dialogue.
- Nguyen tac: action payload uu tien hon text, state persistent MySQL, backward-compatible.

## Week 1 - Knowledge + Intent Baseline
### Deliverables
- Tai lieu KB cho bot (intent matrix, quy tac soan FAQ, runbook cap nhat).
- Seed FAQ cong khai vao `faqs` de bot co nguon tra loi ban dau.
- Cai thien FAQ retrieval theo keyword scoring + ho tro contact settings (gio mo cua/dia chi/sdt/email).
- Mo rong intent trigger cho nhom cau hoi thong tin cua quan.

### KPI
- FAQ hit rate >= 60% tren tap test FAQ co san.
- Fallback rate giam toi thieu 20% so voi baseline truoc week 1.

### DoD
- Co script seed KB chay idempotent.
- Co tai lieu huong dan cap nhat KB.
- Co smoke test cho nhom cau hoi store-info.

## Week 2 - Reliable Ordering (Idempotency)
### Deliverables
- Them idempotency cho `order_create` tai web/messenger bridge.
- OpenClaw policy engine gui `idempotency_key` khi confirm wizard.
- Replay cung key tra lai cung order, khong tao duplicate.

### KPI
- Duplicate order do retry <= 0.5%.
- 100% replay cung idempotency key tra ket qua nhat quan.

### DoD
- Co schema/table idempotency.
- Co hash check payload conflict (same key, different payload => reject).
- Co test ky thuat cho replay/conflict case.

## Week 3 - Protection Layer (Rate Limit + Abuse Control)
### Deliverables
- Rate limit `/chat` OpenClaw theo user/channel.
- Rate limit webhook message ingestion Messenger theo sender.
- Co env config cho threshold/window + logging ro rang khi bi limit.

### KPI
- 429/limited event duoc log day du.
- Khong gay false-positive qua 2% tren traffic test binh thuong.

### DoD
- Co retry-after cho `/chat`.
- Co thong so cau hinh trong env/docs.
- Co smoke test overflow.

## Week 4 - Ops Alerting + Runbook
### Deliverables
- Script alert KPI co notify realtime (Telegram/Webhook) tu cron.
- Co che do `fail_only` va `always`.
- Bo sung runbook xu ly su co threshold breach.

### KPI
- Thoi gian phat hien su co < 5 phut (cron + notify).
- 100% threshold breach tao alert.

### DoD
- Alert script chay non-interactive, return code chinh xac.
- Co env keys ro rang va vi du.
- Co huong dan tiep quan tren GPT.md.

## Tracking Board (initial)
- [x] Week 1: Hoan tat.
- [x] Week 2: Hoan tat (web/messenger bridge + sales-mcp telegram parity).
- [x] Week 3: Hoan tat (OpenClaw + Messenger webhook rate-limit).
- [x] Week 4: Hoan tat (alert script co notify mode + delivery hooks).
