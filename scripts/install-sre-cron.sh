#!/usr/bin/env bash
set -euo pipefail

MODE="${1:-install}"
REPO_DIR="${REPO_DIR:-/root/SuperCafe}"
LOG_DIR="${LOG_DIR:-/var/log/supercafe}"
SCHEDULE="${SCHEDULE:-*/10 * * * *}"
OPENCLAW_URL="${OPENCLAW_URL:-http://127.0.0.1:8082}"
WINDOW_MINUTES="${WINDOW_MINUTES:-5}"

CRON_TAG="# supercafe-sre-alert-check"
CRON_CMD="cd ${REPO_DIR} && OPENCLAW_URL=${OPENCLAW_URL} WINDOW_MINUTES=${WINDOW_MINUTES} /bin/bash scripts/sre-alert-check.sh >> ${LOG_DIR}/sre-alert-check.log 2>&1"
CRON_LINE="${SCHEDULE} ${CRON_CMD} ${CRON_TAG}"

ensure_log_dir() {
  mkdir -p "${LOG_DIR}"
}

current_crontab() {
  crontab -l 2>/dev/null || true
}

install_cron() {
  ensure_log_dir
  local current
  current="$(current_crontab)"
  local filtered
  filtered="$(printf '%s\n' "${current}" | awk -v tag="${CRON_TAG}" 'index($0, tag)==0')"
  {
    printf '%s\n' "${filtered}"
    printf '%s\n' "${CRON_LINE}"
  } | awk 'NF' | crontab -
  echo "[cron] installed: ${CRON_LINE}"
}

uninstall_cron() {
  local current
  current="$(current_crontab)"
  printf '%s\n' "${current}" | awk -v tag="${CRON_TAG}" 'index($0, tag)==0' | crontab -
  echo "[cron] removed entries tagged '${CRON_TAG}'"
}

status_cron() {
  current_crontab | grep -F "${CRON_TAG}" || true
}

case "${MODE}" in
  install)
    install_cron
    status_cron
    ;;
  uninstall)
    uninstall_cron
    ;;
  status)
    status_cron
    ;;
  *)
    echo "Usage: $0 [install|uninstall|status]" >&2
    exit 2
    ;;
esac
