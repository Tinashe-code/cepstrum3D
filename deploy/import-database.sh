#!/usr/bin/env bash
# One-time move of your data from Neon (or any PostgreSQL) into this server's
# database. Run BEFORE the first deploy.sh, or stop the shop first.
#
#   sudo -u cepstrum bash /opt/cepstrum3d/deploy/import-database.sh 'postgresql://user:pass@ep-xxx.neon.tech/neondb?sslmode=require'
#
# Products, vendors, customers, orders, promotions, reviews — everything. The
# local database must be empty or only hold data you're happy to overwrite.
set -euo pipefail

SRC="${1:-}"
[ -n "$SRC" ] || { echo "Usage: import-database.sh 'NEON_CONNECTION_STRING'"; exit 1; }
DEST="${DATABASE_URL:-$(cat /etc/cepstrum3d/database-url)}"
PG_BIN=/usr/lib/postgresql/17/bin
[ -x "$PG_BIN/pg_dump" ] || PG_BIN="$(dirname "$(command -v pg_dump)")"
TMP="$(mktemp -d)"; trap 'rm -rf "$TMP"' EXIT

echo "==> Copying from the old database (can take a few minutes)"
"$PG_BIN/pg_dump" --format=custom --no-owner --no-acl --file="$TMP/import.dump" "$SRC"
echo "==> Loading into this server's database"
"$PG_BIN/pg_restore" --clean --if-exists --no-owner --no-acl --single-transaction --dbname="$DEST" "$TMP/import.dump"
echo "==> Checking"
psql "$DEST" -tAc "select 'products: ' || count(*) from product where deleted_at is null union all select 'vendors: ' || count(*) from seller union all select 'orders: ' || count(*) from \"order\""
echo "✅ Done. Keep the old Neon project for a week, then delete it if everything looks right."
