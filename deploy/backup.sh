#!/usr/bin/env bash
# Nightly backup of the Cepstrum3D database and product photos.
# Runs automatically at 02:30 (systemd timer cepstrum3d-backup.timer). By hand:
#   sudo -u cepstrum bash /opt/cepstrum3d/deploy/backup.sh
#
# Keeps BACKUP_KEEP_DAYS (default 14) days of database copies on the server and,
# when R2_* is set in production.env, copies them to Cloudflare R2 (kept
# R2_KEEP_DAYS, default 30) together with every product photo.
set -euo pipefail

ENV_FILE="${ENV_FILE:-/etc/cepstrum3d/production.env}"
DATA_DIR="${DATA_DIR:-/var/lib/cepstrum3d}"
BACKUP_DIR="$DATA_DIR/backups"
log() { echo "[backup] $*"; }

[ -r "$ENV_FILE" ] && { set -a; . "$ENV_FILE"; set +a; }
if [ -z "${DATABASE_URL:-}" ] && [ -r /etc/cepstrum3d/database-url ]; then DATABASE_URL="$(cat /etc/cepstrum3d/database-url)"; fi
[ -n "${DATABASE_URL:-}" ] || { log "DATABASE_URL not set"; exit 1; }

PG_BIN=/usr/lib/postgresql/17/bin
[ -x "$PG_BIN/pg_dump" ] || PG_BIN="$(dirname "$(command -v pg_dump)")"

mkdir -p "$BACKUP_DIR"
STAMP="$(date -u +%Y%m%d-%H%M)"
FILE="$BACKUP_DIR/cepstrum3d-$STAMP.dump"
trap 'rm -f "$FILE.part"' EXIT

log "dumping database → $FILE"
"$PG_BIN/pg_dump" --format=custom --no-owner --no-acl --file="$FILE.part" "$DATABASE_URL"
mv "$FILE.part" "$FILE"
# Quick check the file can be read back
"$PG_BIN/pg_restore" --list "$FILE" >/dev/null
log "ok, $(du -h "$FILE" | cut -f1)"

find "$BACKUP_DIR" -name 'cepstrum3d-*.dump' -mtime +"${BACKUP_KEEP_DAYS:-14}" -delete

if [ -n "${R2_BUCKET:-}" ] && [ -n "${R2_ACCOUNT_ID:-}" ] && [ -n "${R2_ACCESS_KEY_ID:-}" ] && [ -n "${R2_SECRET_ACCESS_KEY:-}" ]; then
  # rclone reads its settings from these variables — no config file needed.
  export RCLONE_CONFIG_R2_TYPE=s3 RCLONE_CONFIG_R2_PROVIDER=Cloudflare RCLONE_CONFIG_R2_REGION=auto \
         RCLONE_CONFIG_R2_ENDPOINT="https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com" \
         RCLONE_CONFIG_R2_ACCESS_KEY_ID="$R2_ACCESS_KEY_ID" RCLONE_CONFIG_R2_SECRET_ACCESS_KEY="$R2_SECRET_ACCESS_KEY" \
         RCLONE_CONFIG_R2_NO_CHECK_BUCKET=true
  log "copying to R2 bucket $R2_BUCKET"
  rclone copy "$FILE" "r2:$R2_BUCKET/database/" --s3-no-check-bucket
  rclone sync "$DATA_DIR/static/" "r2:$R2_BUCKET/static/" --s3-no-check-bucket
  rclone delete "r2:$R2_BUCKET/database/" --min-age "${R2_KEEP_DAYS:-30}d" --s3-no-check-bucket || true
  log "R2 done"
else
  log "R2 not set up — backups are on this server only (set R2_* in $ENV_FILE)"
fi
