#!/usr/bin/env bash
set -euo pipefail
BACKUP_FILE="${1:-}"
DB_PATH="${2:-infra/sqlite/sales.db}"

if [[ -z "$BACKUP_FILE" ]]; then
  echo "Usage: ./infra/scripts/restore-sqlite.sh <backup-file> [db-path]" >&2
  exit 1
fi

if [[ ! -f "$BACKUP_FILE" ]]; then
  echo "Backup file not found: $BACKUP_FILE" >&2
  exit 1
fi

cp "$BACKUP_FILE" "$DB_PATH"
echo "Database restored from: $BACKUP_FILE"
