#!/usr/bin/env bash
# One-time server setup for Cepstrum3D on a fresh Ubuntu 22.04/24.04 server
# (Oracle Cloud Always Free ARM, or any VPS). Run as a sudo user:
#
#   curl -fsSL https://raw.githubusercontent.com/<you>/<repo>/main/deploy/setup-server.sh | bash
#   — or, after cloning —
#   bash deploy/setup-server.sh
#
# Installs Node 22, Bun, PostgreSQL 17, Redis, Caddy and rclone (backups), adds
# swap, opens ports 80/443, and creates the "cepstrum" user that runs the shop.
# Safe to re-run.
set -euo pipefail

BUN_VERSION="1.4.4"   # keep in step with "packageManager" in package.json
APP_USER="cepstrum"
APP_DIR="/opt/cepstrum3d"

say() { printf '\n\033[1;33m==> %s\033[0m\n' "$*"; }

say "System packages"
sudo apt-get update -y
sudo apt-get install -y curl git unzip ca-certificates gnupg debian-keyring debian-archive-keyring apt-transport-https redis-server iptables-persistent

say "Node.js 22"
if ! node -v 2>/dev/null | grep -q '^v22'; then
  curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
  sudo apt-get install -y nodejs
fi

say "Caddy (web server with automatic HTTPS)"
if ! command -v caddy >/dev/null; then
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | sudo gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | sudo tee /etc/apt/sources.list.d/caddy-stable.list >/dev/null
  sudo apt-get update -y && sudo apt-get install -y caddy
fi

say "Redis: local only, no disk persistence needed for events"
sudo sed -i 's/^#\?\s*bind .*/bind 127.0.0.1 ::1/' /etc/redis/redis.conf
sudo sed -i 's/^#\?\s*maxmemory .*/maxmemory 256mb/' /etc/redis/redis.conf
grep -q '^maxmemory ' /etc/redis/redis.conf || echo 'maxmemory 256mb' | sudo tee -a /etc/redis/redis.conf >/dev/null
sudo systemctl enable --now redis-server
sudo systemctl restart redis-server

say "PostgreSQL 17 (the shop's database, on this server, local connections only)"
if ! command -v /usr/lib/postgresql/17/bin/postgres >/dev/null 2>&1; then
  sudo install -d /usr/share/postgresql-common/pgdg
  sudo curl -fsSL -o /usr/share/postgresql-common/pgdg/apt.postgresql.org.asc https://www.postgresql.org/media/keys/ACCC4CF8.asc
  echo "deb [signed-by=/usr/share/postgresql-common/pgdg/apt.postgresql.org.asc] https://apt.postgresql.org/pub/repos/apt $(. /etc/os-release && echo "$VERSION_CODENAME")-pgdg main" \
    | sudo tee /etc/apt/sources.list.d/pgdg.list >/dev/null
  sudo apt-get update -y && sudo apt-get install -y postgresql-17
fi
sudo systemctl enable --now postgresql
# Modest tuning for a 12 GB server that also runs the shop
PGCONF=/etc/postgresql/17/main/conf.d/cepstrum3d.conf
sudo tee "$PGCONF" >/dev/null <<'CONF'
listen_addresses = 'localhost'
shared_buffers = 1GB
effective_cache_size = 4GB
work_mem = 16MB
maintenance_work_mem = 256MB
max_connections = 100
CONF
sudo systemctl restart postgresql
# Database + user with a random password, saved once (re-runs keep it)
sudo mkdir -p /etc/cepstrum3d
if [ ! -f /etc/cepstrum3d/database-url ]; then
  DB_PASS=$(openssl rand -hex 24)
  sudo -u postgres psql -v ON_ERROR_STOP=1 -q <<SQL
DO \$\$ BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'cepstrum') THEN CREATE ROLE cepstrum LOGIN PASSWORD '$DB_PASS';
  ELSE ALTER ROLE cepstrum PASSWORD '$DB_PASS'; END IF;
END \$\$;
SQL
  sudo -u postgres psql -tAc "SELECT 1 FROM pg_database WHERE datname='cepstrum3d'" | grep -q 1 || sudo -u postgres createdb -O cepstrum cepstrum3d
  echo "postgresql://cepstrum:$DB_PASS@127.0.0.1:5432/cepstrum3d" | sudo tee /etc/cepstrum3d/database-url >/dev/null
  sudo chmod 640 /etc/cepstrum3d/database-url
fi

say "rclone (copies nightly backups to Cloudflare R2)"
command -v rclone >/dev/null || sudo apt-get install -y rclone

say "Swap (building the shop needs memory)"
if ! swapon --show | grep -q /swapfile; then
  sudo fallocate -l 4G /swapfile || sudo dd if=/dev/zero of=/swapfile bs=1M count=4096
  sudo chmod 600 /swapfile && sudo mkswap /swapfile && sudo swapon /swapfile
  echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab >/dev/null
fi

say "Firewall: open 80 and 443 (Oracle images block them by default)"
for port in 80 443; do
  sudo iptables -C INPUT -p tcp --dport "$port" -j ACCEPT 2>/dev/null || \
    sudo iptables -I INPUT 5 -m state --state NEW -p tcp --dport "$port" -j ACCEPT
done
sudo netfilter-persistent save || true

say "App user, folders and Bun"
id "$APP_USER" >/dev/null 2>&1 || sudo useradd --system --create-home --shell /bin/bash "$APP_USER"
sudo mkdir -p "$APP_DIR" /etc/cepstrum3d /var/lib/cepstrum3d/static /var/lib/cepstrum3d/backups
sudo chown -R "$APP_USER:$APP_USER" "$APP_DIR" /var/lib/cepstrum3d
sudo chmod 750 /etc/cepstrum3d
sudo chown root:"$APP_USER" /etc/cepstrum3d /etc/cepstrum3d/database-url
sudo -u "$APP_USER" -H bash -c "command -v ~/.bun/bin/bun >/dev/null || curl -fsSL https://bun.sh/install | bash -s 'bun-v${BUN_VERSION}'"

say "Allow the app user to restart its own services (used by deploy.sh)"
echo "$APP_USER ALL=(root) NOPASSWD: /usr/bin/systemctl restart cepstrum3d-api, /usr/bin/systemctl restart cepstrum3d-shop, /usr/bin/systemctl reload caddy, /usr/bin/systemctl daemon-reload, /usr/bin/systemctl stop cepstrum3d-api, /usr/bin/systemctl stop cepstrum3d-shop, /usr/bin/systemctl start cepstrum3d-shop, /usr/bin/systemctl enable --now cepstrum3d-backup.timer, /usr/bin/cp /opt/cepstrum3d/deploy/systemd/* /etc/systemd/system/, /usr/bin/tee /etc/caddy/Caddyfile" \
  | sudo tee /etc/sudoers.d/cepstrum3d >/dev/null
sudo chmod 440 /etc/sudoers.d/cepstrum3d

cat <<EOF

Done. Next:
  1. sudo -u $APP_USER git clone <your repo URL> $APP_DIR      (or copy the code there)
  2. sudo cp $APP_DIR/deploy/production.env.example /etc/cepstrum3d/production.env
     sudo nano /etc/cepstrum3d/production.env                 (fill in every CHANGE-ME)
     The database address is already filled in from /etc/cepstrum3d/database-url —
     leave DATABASE_URL as it is.
     sudo chown root:$APP_USER /etc/cepstrum3d/production.env && sudo chmod 640 /etc/cepstrum3d/production.env
  3. (Moving from Neon) sudo -u $APP_USER bash $APP_DIR/deploy/import-database.sh 'NEON_CONNECTION_STRING'
  4. sudo -u $APP_USER bash $APP_DIR/deploy/deploy.sh
EOF
