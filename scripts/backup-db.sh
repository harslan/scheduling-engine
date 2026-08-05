#!/usr/bin/env bash
# Logical backup of the pilot database.
#   DATABASE_URL=postgres://... ./scripts/backup-db.sh [output-dir]
# Requires pg_dump >= server major (Supabase runs PG 17; `brew install libpq`).
set -euo pipefail

: "${DATABASE_URL:?set DATABASE_URL (session pooler, port 5432)}"
OUT_DIR="${1:-$HOME/sbs-pilot-backups}"
mkdir -p "$OUT_DIR"

PG_DUMP="$(command -v pg_dump)"
if [ -x /usr/local/opt/libpq/bin/pg_dump ]; then PG_DUMP=/usr/local/opt/libpq/bin/pg_dump; fi
if [ -x /opt/homebrew/opt/libpq/bin/pg_dump ]; then PG_DUMP=/opt/homebrew/opt/libpq/bin/pg_dump; fi

STAMP="$(date +%Y%m%d-%H%M)"
FILE="$OUT_DIR/sbs-pilot-$STAMP.sql"
"$PG_DUMP" "$DATABASE_URL" --no-owner --no-privileges --schema=public -f "$FILE"
echo "backup written: $FILE ($(du -h "$FILE" | cut -f1))"
