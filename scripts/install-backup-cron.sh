#!/usr/bin/env bash
set -euo pipefail

ACTION="${1:-status}"
SCHEDULE="${BACKUP_CRON_SCHEDULE:-0 2 * * *}"
REPO_DIR="$(cd "$(dirname "$0")/.." && pwd)"
LOG_DIR="${BACKUP_LOG_DIR:-/var/log/supercafe}"
CRON_TAG="# supercafe-nightly-backup"
CRON_CMD="cd ${REPO_DIR} && /bin/bash scripts/backup-supercafe.sh >> ${LOG_DIR}/backup.log 2>&1"
CRON_LINE="${SCHEDULE} ${CRON_CMD} ${CRON_TAG}"

mkdir -p "${LOG_DIR}"

current_crontab() {
  crontab -l 2>/dev/null || true
}

install_cron() {
  local current filtered
  current="$(current_crontab)"
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

case "${ACTION}" in
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
    echo "Usage: $0 {install|uninstall|status}" >&2
    exit 1
    ;;
esac
