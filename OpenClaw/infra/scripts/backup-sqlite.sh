#!/usr/bin/env bash
set -euo pipefail
DB_PATH="${1:-infra/sqlite/sales.db}"
BACKUP_DIR="${2:-infra/sqlite/backups}"

if [[ ! -f "$DB_PATH" ]]; then
  echo "Database not found: $DB_PATH" >&2
  exit 1
fi

mkdir -p "$BACKUP_DIR"
STAMP="$(date +%Y%m%d-%H%M%S)"
TARGET="$BACKUP_DIR/sales-$STAMP.db"
cp "$DB_PATH" "$TARGET"
echo "Backup created: $TARGET"
