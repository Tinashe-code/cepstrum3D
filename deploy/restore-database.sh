#!/usr/bin/env bash
# Put a backup back into the shop's database. REPLACES everything in it.
#
#   sudo -u cepstrum bash /opt/cepstrum3d/deploy/restore-database.sh                # list backups
#   sudo -u cepstrum bash /opt/cepstrum3d/deploy/restore-database.sh latest         # newest on this server
#   sudo -u cepstrum bash /opt/cepstrum3d/deploy/restore-database.sh cepstrum3d-20261108-0030.dump
#   sudo -u cepstrum bash /opt/cepstrum3d/deploy/restore-database.sh r2:cepstrum3d-20261108-0030.dump  # from R2
#
# The shop is stopped while restoring and started again afterwards.
set -euo pipefail

ENV_FILE="${ENV_FILE:-/etc/cepstrum3d/production.env}"
DATA_DIR="${DATA_DIR:-/var/lib/cepstrum3d}"
BACKUP_DIR="$DATA_DIR/backups"
[ -r "$ENV_FILE" ] && { set -a; . "$ENV_FILE"; set +a; }
if [ -z "${DATABASE_URL:-}" ] && [ -r /etc/cepstrum3d/database-url ]; then DATABASE_URL="$(cat /etc/cepstrum3d/database-url)"; fi
PG_BIN=/usr/lib/postgresql/17/bin
[ -x "$PG_BIN/pg_restore" ] || PG_BIN="$(dirname "$(command -v pg_restore)")"
SYSTEMCTL="${SYSTEMCTL:-sudo /usr/bin/systemctl}"

r2_env() {
  export RCLONE_CONFIG_R2_TYPE=s3 RCLONE_CONFIG_R2_PROVIDER=Cloudflare RCLONE_CONFIG_R2_REGION=auto \
         RCLONE_CONFIG_R2_ENDPOINT="https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com" \
         RCLONE_CONFIG_R2_ACCESS_KEY_ID="$R2_ACCESS_KEY_ID" RCLONE_CONFIG_R2_SECRET_ACCESS_KEY="$R2_SECRET_ACCESS_KEY"
}

if [ -z "${1:-}" ]; then
  echo "Backups on this server:"; ls -1t "$BACKUP_DIR"/cepstrum3d-*.dump 2>/dev/null | xargs -r -n1 basename || true
  if [ -n "${R2_BUCKET:-}" ]; then r2_env; echo; echo "Backups in R2:"; rclone lsf "r2:$R2_BUCKET/database/" | sort -r | head -30; fi
  exit 0
fi

case "$1" in
  latest) FILE="$(ls -1t "$BACKUP_DIR"/cepstrum3d-*.dump | head -1)" ;;
  r2:*) r2_env; FILE="$BACKUP_DIR/${1#r2:}"; rclone copyto "r2:$R2_BUCKET/database/${1#r2:}" "$FILE" ;;
  /*) FILE="$1" ;;
  *) FILE="$BACKUP_DIR/$1" ;;
esac
[ -r "$FILE" ] || { echo "Backup not found: $FILE"; exit 1; }

echo "This REPLACES the live database with $(basename "$FILE")."
if [ "${YES:-}" != "1" ]; then read -r -p "Type RESTORE to continue: " ok; [ "$ok" = "RESTORE" ] || { echo "Stopped."; exit 1; }; fi

$SYSTEMCTL stop cepstrum3d-shop || true
$SYSTEMCTL stop cepstrum3d-api || true
"$PG_BIN/pg_restore" --clean --if-exists --no-owner --no-acl --single-transaction --dbname="$DATABASE_URL" "$FILE"
$SYSTEMCTL restart cepstrum3d-api
$SYSTEMCTL start cepstrum3d-shop || true
echo "✅ Restored $(basename "$FILE")"
