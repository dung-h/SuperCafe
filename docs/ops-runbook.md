# Ops Runbook (Daily)

## 1) Quick health checks

```bash
curl -sS http://127.0.0.1:8081/health
curl -sS http://127.0.0.1:8082/health
curl -sS http://127.0.0.1:8083/health
```

## 2) Omnichannel smoke

```bash
cd /root/SuperCafe
./scripts/omnichannel-smoke.sh
```

## 3) Ops summary (manual)

```bash
curl -sS "http://127.0.0.1:8082/admin/ops/summary?windowMinutes=60"
```

## 4) KPI/alert check (manual)

```bash
cd /root/SuperCafe
./scripts/sre-alert-check.sh
```

Tune thresholds with env when needed:
- `MAX_FALLBACK_RATE` (default `12`)
- `MAX_ACTION_ERROR_RATE` (default `3`)
- `MIN_ORDER_COMPLETION_RATE` (default `55`)
- `MIN_ORDER_START_COUNT_FOR_COMPLETION_ALERT` (default `5`)
- `MAX_WEBHOOK_SEND_FAIL_RATE` (default `3`)
- `MAX_DB_ERROR_RATE` (default `1`)

## 5) Install cron every 10 minutes

```bash
cd /root/SuperCafe
chmod +x scripts/install-sre-cron.sh
./scripts/install-sre-cron.sh install
```

Other commands:

```bash
./scripts/install-sre-cron.sh status
./scripts/install-sre-cron.sh uninstall
```

Cron output log:
- `/var/log/supercafe/sre-alert-check.log`

## 6) Backup + DR (nightly cron)

Manual backup:

```bash
cd /root/SuperCafe
./scripts/backup-supercafe.sh
```

Install nightly backup cron:

```bash
cd /root/SuperCafe
./scripts/install-backup-cron.sh install
```

Backup log:
- `/var/log/supercafe/backup.log`

## 7) Messenger webhook verification sanity check

Expected behavior:
- `GET /?r=messenger/webhook` without verify params => `403`
- `GET` with `hub.mode`, `hub.verify_token`, `hub.challenge` => returns challenge

Current callback URL:
- `https://dungho.io.vn/lowlandcoffee/?r=messenger/webhook`
