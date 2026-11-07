# Putting Cepstrum3D online

One small server runs everything: the shop, the backend, the admin panel, the vendor portal and Redis. The database stays on Neon. Caddy sets up HTTPS by itself.

```
customer ──► https://cepstrum3d.cepstrumtechnologies.com      ─┐
admin    ──► https://api.cepstrum3d.cepstrumtechnologies.com/dashboard   ├─► Caddy ─► shop (port 3000)
vendor   ──► https://api.cepstrum3d.cepstrumtechnologies.com/seller      │         └► backend (port 9000) ─► Neon + Redis
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
1. Sign up at cloud.oracle.com. The **home region** you pick can't be changed, and free servers only exist there. Pick **Germany Central (Frankfurt)** so the server sits next to the database (step 3).
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

## 3. The database (Neon)

Keep the database in the **same region as the server**. Each cart action makes many database calls, so distance makes the shop slow. In Neon → your project → Settings, check the region:

- **Already AWS Frankfurt (eu-central-1):** keep using it.
- **Somewhere else:** create a new Neon project in **AWS Europe Central (Frankfurt)** and copy your data across. Run this from any machine with PostgreSQL tools:

```bash
pg_dump "OLD_CONNECTION_STRING" --no-owner --no-acl -Fc -f cepstrum3d.dump
pg_restore --no-owner --no-acl -d "NEW_CONNECTION_STRING" cepstrum3d.dump
```

Reset the Neon password before going live (Neon → Roles → Reset password).

## 4. Put the code on the server and fill in the settings

```bash
sudo -u cepstrum git clone https://github.com/YOU/cepstrum3d.git /opt/cepstrum3d
sudo cp /opt/cepstrum3d/deploy/production.env.example /etc/cepstrum3d/production.env
sudo nano /etc/cepstrum3d/production.env
sudo chown root:cepstrum /etc/cepstrum3d/production.env && sudo chmod 640 /etc/cepstrum3d/production.env
```

Fill in every `CHANGE-ME`. Make the secrets with `openssl rand -hex 32`.

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
| Database (Neon free) | $0 |
| Redis (on the server) | $0 |
| Emails (Resend free, 3,000/month) | $0 |
| Google Maps | Google's monthly free usage covers a small shop. Set a budget alert. |
| Domain | ~$10–15 per year |

**When traffic grows:** a bigger server, Neon's paid plan (more storage, longer backups), and Cloudflare R2 for product images.
