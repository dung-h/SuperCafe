#!/usr/bin/env bash
set -euo pipefail

BACKUP_DIR="${BACKUP_DIR:-/var/backups/supercafe}"
RETENTION_DAYS="${RETENTION_DAYS:-7}"

MYSQL_HOST="${DB_HOST:-127.0.0.1}"
MYSQL_PORT="${DB_PORT:-3306}"
MYSQL_DB="${DB_NAME:-lowland_coffee}"
MYSQL_USER="${DB_USER:-web251}"
MYSQL_PASS="${DB_PASS:-}"

SQLITE_SOURCE="${SQLITE_PATH:-/root/SuperCafe/OpenClaw/infra/sqlite/sales.db}"

TIMESTAMP="$(date -u +"%Y%m%d_%H%M%S")"
TARGET_DIR="${BACKUP_DIR}/${TIMESTAMP}"

mkdir -p "${TARGET_DIR}"
created_any=0

if command -v mysqldump >/dev/null 2>&1; then
  sql_path="${TARGET_DIR}/mysql_${MYSQL_DB}.sql"
  echo "[backup] dumping mysql ${MYSQL_DB} from ${MYSQL_HOST}:${MYSQL_PORT}"
  if [ -n "${MYSQL_PASS}" ]; then
    export MYSQL_PWD="${MYSQL_PASS}"
  fi
  if mysqldump \
    --single-transaction \
    --quick \
    --routines \
    --events \
    -h "${MYSQL_HOST}" \
    -P "${MYSQL_PORT}" \
    -u "${MYSQL_USER}" \
    "${MYSQL_DB}" > "${sql_path}"; then
    gzip -f "${sql_path}"
    created_any=1
  else
    rm -f "${sql_path}"
    echo "[backup] mysql dump failed"
  fi
  unset MYSQL_PWD || true
else
  echo "[backup] mysqldump not found, skip mysql backup"
fi

if [ -f "${SQLITE_SOURCE}" ]; then
  sqlite_target="${TARGET_DIR}/sales.db"
  echo "[backup] copying sqlite ${SQLITE_SOURCE}"
  cp "${SQLITE_SOURCE}" "${sqlite_target}"
  gzip -f "${sqlite_target}"
  created_any=1
else
  echo "[backup] sqlite file not found: ${SQLITE_SOURCE}"
fi

if [ "${created_any}" -eq 0 ]; then
  echo "[backup] no artifacts created"
  rmdir "${TARGET_DIR}" 2>/dev/null || true
  exit 1
fi

if command -v sha256sum >/dev/null 2>&1; then
  (
    cd "${TARGET_DIR}"
    sha256sum * > SHA256SUMS.txt
  )
fi

if [[ "${RETENTION_DAYS}" =~ ^[0-9]+$ ]]; then
  find "${BACKUP_DIR}" -mindepth 1 -maxdepth 1 -type d -mtime +"${RETENTION_DAYS}" -print -exec rm -rf {} +
else
  echo "[backup] RETENTION_DAYS='${RETENTION_DAYS}' is invalid, skip cleanup"
fi

echo "[backup] completed: ${TARGET_DIR}"
