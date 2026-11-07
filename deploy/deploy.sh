#!/usr/bin/env bash
# Build and (re)start Cepstrum3D on the server. Run as the app user:
#
#   sudo -u cepstrum bash /opt/cepstrum3d/deploy/deploy.sh          # build what's in the folder
#   sudo -u cepstrum bash /opt/cepstrum3d/deploy/deploy.sh --pull   # git pull first
#
# Steps: install packages → build backend + panels → update the database →
# restart backend → build shop → restart shop → refresh Caddy. Takes ~10 min.
set -euo pipefail

APP_DIR="${APP_DIR:-/opt/cepstrum3d}"
ENV_FILE="${ENV_FILE:-/etc/cepstrum3d/production.env}"
DATA_DIR="${DATA_DIR:-/var/lib/cepstrum3d}"
export PATH="$HOME/.bun/bin:$PATH"

say() { printf '\n\033[1;33m==> %s\033[0m\n' "$*"; }
die() { printf '\n\033[1;31mERROR: %s\033[0m\n' "$*"; exit 1; }

[ -r "$ENV_FILE" ] || die "$ENV_FILE missing — copy deploy/production.env.example there and fill it in."
set -a; . "$ENV_FILE"; set +a
# The database lives on this server; setup-server.sh saved its address here.
if [ -z "${DATABASE_URL:-}" ] && [ -r /etc/cepstrum3d/database-url ]; then
  export DATABASE_URL="$(cat /etc/cepstrum3d/database-url)"
fi
grep -v '^\s*#' "$ENV_FILE" | grep -q 'CHANGE-ME' && die "Fill in every CHANGE-ME in $ENV_FILE first."
for v in SHOP_DOMAIN API_DOMAIN DATABASE_URL JWT_SECRET COOKIE_SECRET REVALIDATE_SECRET NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY; do
  [ -n "${!v:-}" ] || die "$v is empty in $ENV_FILE"
done

SHOP_URL="https://$SHOP_DOMAIN"
API_URL="https://$API_DOMAIN"

# Backend settings derived from the two addresses.
export STORE_CORS="$SHOP_URL,https://www.$SHOP_DOMAIN"
export ADMIN_CORS="$API_URL"
export VENDOR_CORS="$API_URL"
export AUTH_CORS="$SHOP_URL,https://www.$SHOP_DOMAIN,$API_URL"
export MERCUR_BACKEND_URL="$API_URL"            # baked into the panels
export MERCUR_VENDOR_URL="$API_URL/seller"
export FILE_BACKEND_URL="$API_URL/static"       # address of uploaded images
export STOREFRONT_URL="$SHOP_URL/${NEXT_PUBLIC_DEFAULT_REGION:-zw}"
export VENDOR_PORTAL_URL="$API_URL/seller"
export STOREFRONT_REVALIDATE_URL="http://127.0.0.1:3000/api/revalidate"
export STOREFRONT_REVALIDATE_SECRET="$REVALIDATE_SECRET"
export NODE_ENV=production

cd "$APP_DIR"
if [ "${1:-}" = "--pull" ]; then say "Getting the latest code"; git pull --ff-only; fi

say "Installing packages"
bun install --frozen-lockfile

say "Building backend + admin + vendor panels"
NODE_OPTIONS=--max-old-space-size=3072 bunx turbo run build --filter=@acme/api --ui=stream

SERVER_DIR="$APP_DIR/packages/api/.medusa/server"
say "Uploaded images: keep them outside the build folder"
# Images uploaded during development (packages/api/static) are copied once.
[ -d "$APP_DIR/packages/api/static" ] && cp -rn "$APP_DIR/packages/api/static/." "$DATA_DIR/static/" 2>/dev/null || true
rm -rf "$SERVER_DIR/static" && ln -s "$DATA_DIR/static" "$SERVER_DIR/static"

# Settings file read by the backend services (systemd) — regenerated each deploy.
{
  grep -v '^\s*#' "$ENV_FILE" | grep -v '^\s*$' | grep -v '^DATABASE_URL=\s*$'
  echo "DATABASE_URL=$DATABASE_URL"
  for v in STORE_CORS ADMIN_CORS VENDOR_CORS AUTH_CORS MERCUR_BACKEND_URL MERCUR_VENDOR_URL FILE_BACKEND_URL STOREFRONT_URL \
           VENDOR_PORTAL_URL STOREFRONT_REVALIDATE_URL STOREFRONT_REVALIDATE_SECRET; do
    printf '%s=%s\n' "$v" "${!v}"
  done
  echo "MEDUSA_BACKEND_URL=http://127.0.0.1:9000"
  echo "NEXT_PUBLIC_BASE_URL=$SHOP_URL"
  echo "NEXT_PUBLIC_VENDOR_URL=$API_URL/seller"
} > "$DATA_DIR/runtime.env"
chmod 600 "$DATA_DIR/runtime.env"

say "Updating the database (migrations)"
(cd "$SERVER_DIR" && "$APP_DIR/packages/api/node_modules/.bin/medusa" db:migrate)

say "Installing services and web server config"
sudo /usr/bin/cp "$APP_DIR"/deploy/systemd/* /etc/systemd/system/
sudo /usr/bin/systemctl daemon-reload
# Nightly database + photo backup (deploy/backup.sh)
sudo /usr/bin/systemctl enable --now cepstrum3d-backup.timer
sed -e "s/{SHOP_DOMAIN}/$SHOP_DOMAIN/g" -e "s/{API_DOMAIN}/$API_DOMAIN/g" -e "s/{ADMIN_EMAIL}/${ADMIN_EMAIL:-}/g" \
  "$APP_DIR/deploy/Caddyfile" | sudo /usr/bin/tee /etc/caddy/Caddyfile >/dev/null
sudo /usr/bin/systemctl reload caddy

say "Restarting the backend"
sudo /usr/bin/systemctl restart cepstrum3d-api
for i in $(seq 1 60); do
  curl -fs http://127.0.0.1:9000/health >/dev/null && break
  [ "$i" = 60 ] && die "Backend didn't start. See: journalctl -u cepstrum3d-api -n 100"
  sleep 3
done

say "Building the shop"
cd "$APP_DIR/apps/storefront"
# Pages are pre-built from the running backend, over the server's own network.
MEDUSA_BACKEND_URL=http://127.0.0.1:9000 NEXT_PUBLIC_BASE_URL="$SHOP_URL" NEXT_PUBLIC_VENDOR_URL="$API_URL/seller" \
  NODE_OPTIONS=--max-old-space-size=3072 npx next build
STANDALONE="$APP_DIR/apps/storefront/.next/standalone/apps/storefront"
cp -r public "$STANDALONE/"
mkdir -p "$STANDALONE/.next" && rm -rf "$STANDALONE/.next/static" && cp -r .next/static "$STANDALONE/.next/"

say "Restarting the shop"
sudo /usr/bin/systemctl restart cepstrum3d-shop
for i in $(seq 1 30); do
  curl -fs -o /dev/null http://127.0.0.1:3000/ && break
  [ "$i" = 30 ] && die "Shop didn't start. See: journalctl -u cepstrum3d-shop -n 100"
  sleep 2
done

cat <<EOF

✅ Live:
   Shop          $SHOP_URL
   Admin panel   $API_URL/dashboard
   Vendor portal $API_URL/seller
EOF
