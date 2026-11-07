# Putting Cepstrum3D online

One small server in **Johannesburg** (the closest cloud region to Zimbabwe) runs everything: the shop, the backend, the admin panel, the vendor portal, the **PostgreSQL database** and Redis. Caddy sets up HTTPS by itself. Every night the database and product photos are backed up, on the server and to Cloudflare R2.

```
customer ──► https://cepstrum3d.cepstrumtechnologies.com      ─┐
admin    ──► https://api.cepstrum3d.cepstrumtechnologies.com/dashboard   ├─► Caddy ─► shop (port 3000)
vendor   ──► https://api.cepstrum3d.cepstrumtechnologies.com/seller      │         └► backend (port 9000) ─► PostgreSQL + Redis
```

## 1. The web addresses

Once you own `cepstrumtechnologies.com`, you can create any number of **subdomains** for free. Each is a name in front of the domain that you point at your server.

| Address | What it is |
|---|---|
| `cepstrumtechnologies.com` | Company website (later) |
| `cepstrum3d.cepstrumtechnologies.com` | **The shop** |
| `api.cepstrum3d.cepstrumtechnologies.com` | Backend, admin panel, vendor portal |

`www.shop.cepstrum3d.cepstrumtechnologies.com` would also work, but it is long to type and to say. The setup also answers on `www.` in front of the shop address and forwards it, so both `cepstrum3d.cepstrumtechnologies.com` and `www.cepstrum3d.cepstrumtechnologies.com` open the shop. To use a different name (for example `shop.cepstrumtechnologies.com`), change `SHOP_DOMAIN` and `API_DOMAIN` in the settings file. Nothing else changes.

**DNS records.** At your domain registrar (or Cloudflare, free), add these once the server has an IP address:

| Type | Name | Value |
|---|---|---|
| A | `cepstrum3d` | your server's public IP |
| A | `www.cepstrum3d` | your server's public IP |
| A | `api.cepstrum3d` | your server's public IP |

If you use Cloudflare, set these records to **DNS only** (grey cloud). Caddy makes the certificates itself, and Cloudflare's free proxy doesn't cover two-level names like `api.cepstrum3d`.

## 2. The server

**Free option: Oracle Cloud Always Free.**
1. Sign up at cloud.oracle.com. The **home region** you pick can't be changed, and free servers only exist there. Your account uses **South Africa Central (Johannesburg)**, which is the best choice for Zimbabwe.
2. Compute → Instances → Create:
   - **Image:** Ubuntu 24.04
   - **Shape:** Ampere A1 Flex, 2 OCPU, 12 GB RAM (the current free limit)
   - **SSH key:** add yours
3. Networking → your VCN → Security List → add **Ingress rules** for TCP ports **80** and **443** from `0.0.0.0/0`.
4. Note the server's **public IP** and create the DNS records above.

**If Oracle refuses your card or has no free capacity,** any Ubuntu VPS with 4 GB RAM works the same way.

Then, on the server:

```bash
ssh ubuntu@YOUR_SERVER_IP
git clone https://github.com/YOU/cepstrum3d.git /tmp/c3d      # or upload the code with scp
bash /tmp/c3d/deploy/setup-server.sh
```

## 3. The database

The database runs **on the server**, next to the backend, so each database call takes under a millisecond. (A database in another country makes every cart action wait on dozens of slow round trips.) `setup-server.sh` installs PostgreSQL 17, creates the database and a random password, and saves its address in `/etc/cepstrum3d/database-url`. You never need to type it.

**Moving your data from Neon** (products, vendors, customers, promos, reviews). Do this once, after step 4 and before step 5. In Neon → your project → **Connect**, copy the connection string, then on the server:

```bash
sudo -u cepstrum bash /opt/cepstrum3d/deploy/import-database.sh 'postgresql://…neon.tech/neondb?sslmode=require'
```

It prints how many products, vendors and orders it copied. Keep the Neon project for a week as a spare copy, then delete it. You can keep using Neon (or a local PostgreSQL) for development on your laptop; it is no longer connected to the live shop.

**Starting fresh instead:** skip the import. `deploy.sh` creates the empty tables, and you create the admin login with step 5.4.

### Backups

`backup.sh` runs every night at 02:30 (Harare time):
- It saves a full copy of the database in `/var/lib/cepstrum3d/backups/`, keeping the last 14 days.
- With R2 set up, it also copies each backup **off the server** to Cloudflare R2 (kept 30 days), together with all product photos. R2 is free up to 10 GB.

**Set up R2** (about 5 minutes, strongly recommended): Cloudflare dashboard → **R2** → create a bucket `cepstrum3d-backups` → **Manage API tokens** → create a token with *Object Read & Write* on that bucket. Then put the account ID and the two keys in `R2_*` in `production.env`.

```bash
sudo -u cepstrum bash /opt/cepstrum3d/deploy/backup.sh               # run a backup now
systemctl list-timers cepstrum3d-backup.timer                        # when the next one runs
sudo -u cepstrum bash /opt/cepstrum3d/deploy/restore-database.sh     # list backups (server + R2)
sudo -u cepstrum bash /opt/cepstrum3d/deploy/restore-database.sh latest   # put the newest one back
```

**If the server is ever lost:** create a new one, then run steps 2, 4 and 5. After that:
1. Run `restore-database.sh r2:cepstrum3d-<date>.dump`.
2. Copy the photos back with `rclone copy r2:cepstrum3d-backups/static /var/lib/cepstrum3d/static`. It uses the same R2 settings.

## 4. Put the code on the server and fill in the settings

```bash
sudo -u cepstrum git clone https://github.com/YOU/cepstrum3d.git /opt/cepstrum3d
sudo cp /opt/cepstrum3d/deploy/production.env.example /etc/cepstrum3d/production.env
sudo nano /etc/cepstrum3d/production.env
sudo chown root:cepstrum /etc/cepstrum3d/production.env && sudo chmod 640 /etc/cepstrum3d/production.env
```

Fill in every `CHANGE-ME`. Make the secrets with `openssl rand -hex 32`. Leave `DATABASE_URL` empty, because the server already knows it.

For a **private GitHub repo**, create a read-only **deploy key**:
1. On the server, run `sudo -u cepstrum ssh-keygen -t ed25519`.
2. Add `/home/cepstrum/.ssh/id_ed25519.pub` in GitHub → repo → Settings → Deploy keys.
3. Clone with the `git@github.com:…` address.

## 5. Go live

```bash
sudo -u cepstrum bash /opt/cepstrum3d/deploy/deploy.sh
```

The first run takes about 10–15 minutes. It ends by printing the three addresses. HTTPS certificates are created on the first visit, which may take a few seconds.

**After the first deploy:**

1. **Fix image addresses.** Product images uploaded on your computer are saved as `http://localhost:9000/...`. Point them at the server:
   ```bash
   cd /opt/cepstrum3d/packages/api/.medusa/server
   sudo -u cepstrum bash -c 'set -a; . /var/lib/cepstrum3d/runtime.env; \
     OLD_URL=http://localhost:9000 NEW_URL=https://api.cepstrum3d.cepstrumtechnologies.com \
     /opt/cepstrum3d/packages/api/node_modules/.bin/medusa exec ./src/scripts/rewrite-file-urls.js'
   ```
   The image files themselves are copied from `packages/api/static` if that folder is in the repo. Otherwise, copy your computer's `packages/api/static` folder to `/var/lib/cepstrum3d/static/` on the server.
2. **Check emails.** Run `send-test-email.js` the same way, with `TEST_EMAIL_TO=you@…` in front.
3. **Admin panel** (`https://api.…/dashboard`):
   - Regions → Zimbabwe → remove the **test card provider** and keep **Pay on delivery**.
   - Delete the demo vendors, products and orders.
   - Check Delivery → free-delivery amount.
4. **Create a new admin login,** if the database is new:
   ```bash
   cd /opt/cepstrum3d/packages/api/.medusa/server && sudo -u cepstrum bash -c 'set -a; . /var/lib/cepstrum3d/runtime.env; /opt/cepstrum3d/packages/api/node_modules/.bin/medusa user -e you@cepstrumtechnologies.com -p "A-strong-password"'
   ```

## Updating the site later

Push your changes to GitHub, then on the server:

```bash
sudo -u cepstrum bash /opt/cepstrum3d/deploy/deploy.sh --pull
```

The shop is offline for about a minute while the backend restarts.

## When something is wrong

| Problem | Look here |
|---|---|
| Shop shows an error | `journalctl -u cepstrum3d-shop -n 100` |
| Admin, vendor portal or checkout errors; emails not sent | `journalctl -u cepstrum3d-api -n 200` (look for `[email failed]`) |
| HTTPS / "site can't be reached" | `journalctl -u caddy -n 50`. Check that the DNS records point at the server and ports 80/443 are open (step 2.3) |
| Restart everything | `sudo systemctl restart cepstrum3d-api cepstrum3d-shop` |

## What it costs

| Piece | Cost |
|---|---|
| Server (Oracle Always Free) | $0 |
| Database (PostgreSQL on the server) | $0 |
| Backups (Cloudflare R2, up to 10 GB) | $0 |
| Redis (on the server) | $0 |
| Emails (Resend free, 3,000/month) | $0 |
| Google Maps | Google's monthly free usage covers a small shop. Set a budget alert. |
| Domain | ~$10–15 per year |

**When traffic grows:** a bigger server, or a managed database with more frequent backups, and Cloudflare R2 for serving product images.
