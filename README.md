# Cepstrum3D Marketplace

Multi-vendor marketplace for the 3D printing industry in Zimbabwe — a 3DJake-style shop with Takealot-style vendors.

- **Platform owner:** Cepstrum Technologies
- **Commercial partner & anchor vendor:** EzoD Tech
- **Name:** "Cepstrum3D" — set in one place, `apps/storefront/src/config/site.ts` (see [Renaming](#renaming)).

Built on [Mercur](https://github.com/mercurjs/mercur) 2.x (open-source marketplace layer) on top of [Medusa](https://medusajs.com) v2.

## What's in the box

| App | Path | Local URL |
|---|---|---|
| Backend API (Medusa + Mercur) | `packages/api` | http://localhost:9000 |
| Operator admin panel (Cepstrum) | `apps/admin` → served at | http://localhost:9000/dashboard |
| Vendor panel (EzoD Tech + other sellers) | `apps/vendor` → served at | http://localhost:9000/seller |
| Customer storefront (Next.js) | `apps/storefront` | http://localhost:3000/zw |

### Marketplace model

- **Master products + offers.** A product (e.g. *Kingroon PETG Basic, 1.75 mm / 1000 g*) exists once. Each vendor lists an **offer** against its variants with its own price, stock and shipping. Customers see the best offer and can "Compare other offers".
- **Split orders.** A cart with items from several vendors checks out once and becomes an **order group** with one order per vendor.
- **Vendor onboarding.** Vendors register at `/seller/register`; the operator approves them in the admin panel.

### Catalogue structure (mirrors 3DJake)

Seeded by `packages/api/src/scripts/seed.ts`:

- **Categories:** 3D Printers & More · Filaments · Resin · Spare Parts & Upgrades · Accessories, each with material/part sub-categories (PLA, PETG, ABS & ASA, TPU, Composites, Nozzles, Build Plates, …).
- **Brand pages:** each brand is a product collection → `/collections/kingroon`, `/collections/elegoo`, …
- **Filters (global product attributes):** Colour, Diameter, Net weight, Material, Brand, Compatibility system, Printer technology. The storefront builds its filter sidebar from these automatically.
- **Demo data:** 28 products, 3 vendors (EzoD Tech + 2 fictional demo vendors), USD prices, Zimbabwe region with *Collect from vendor / Local delivery / Nationwide courier* shipping.

> **Attribute rule.** Mercur's Store API filters through variant options, so every filterable attribute is a *variant axis*. Descriptor attributes (Brand, Material, Compatibility, Technology) hold **one value per product** so they don't multiply variants; only Colour, Diameter and Net weight create variants. Keep this rule when vendors add products.

Product images are simple generated placeholders (`packages/api/static/catalog`, script in `packages/api/scripts/make-placeholder-images.py`). Replace with real photos — **don't** copy manufacturer or 3DJake images without permission.

### Pay on delivery

Products can be marked **eligible for pay on delivery**. A shopper can then place the order without paying at checkout and pays the vendor (cash or EcoCash) when it arrives.

- **The rule:** a cart can use pay on delivery only if **every** product in it is eligible. One ineligible item makes the whole cart ineligible, and checkout says which item is blocking it.
- **Setting the flag:** each product has a **"Pay on delivery"** on/off attribute. Operators set it in the admin panel and vendors in the vendor panel (product → attributes). By default the seed turns it on for filament, resin, parts and accessories, and off for printers.
- **Enforced on the server, not just the UI:**
  - the backend refuses to start a pay-on-delivery payment for an ineligible cart;
  - it refuses to place the order if an ineligible item was added after pay on delivery was chosen.
- **After the order:** the payment stays *authorized, not captured*. Once the money is collected, the vendor or operator marks it as paid by **capturing** the payment on the order page.
- **Storefront:**
  - product pages show a "Pay on delivery available" badge;
  - the checkout payment step shows the option greyed out with the reason when the cart doesn't qualify;
  - the place-order button reads "Place order — pay on delivery".

Code:
- `packages/api/src/lib/pay-on-delivery.ts` — eligibility rules (one place)
- `packages/api/src/modules/pay-on-delivery/` — payment provider (`pp_pay-on-delivery_pay-on-delivery`), registered in `medusa-config.ts`
- `packages/api/src/api/middlewares.ts` — the two server-side guards
- `packages/api/src/api/store/carts/[id]/pay-on-delivery/route.ts` — `GET` eligibility endpoint used by checkout
- `packages/api/src/scripts/setup-pay-on-delivery.ts` — creates the attribute, enables the provider on regions, sets default flags. The seed runs it. For a database seeded before this feature, run: `cd packages/api && bunx medusa exec ./src/scripts/setup-pay-on-delivery.ts`

### Storefront features

- **Home hero carousel** — rotating offers (auto-advances every 6 s, pauses on hover, arrows, dots, swipe). Edit slides, pictures and links in `apps/storefront/src/data/heroSlides.ts`; images go in `apps/storefront/public/images/hero/`.
- **Product cards on listing pages** (categories, brands, search, seller pages, favourites — not the home page): a **favourite (heart)** button, and either **Add to cart** (single-option products) or "More colours" + **Shop all options** (products with several colours/sizes), like Takealot. Guests who tap the heart are sent to log in.
- **Product page colour picker**: a dropdown plus picture tiles for each colour, with "Out of stock" when no vendor has stock; the gallery switches to the chosen colour. Each colour's picture is the variant's thumbnail (vendors set it per variant; `packages/api/src/scripts/setup-variant-images.ts` fills it from image file names for the demo data). Options with a single value (Brand, Material…) show as a compact spec line.
- **Favourites** are saved on the customer account (`metadata.wishlist`) and listed at **My account → Favourites** (`/user/wishlist`).
- **Discounts**: a sale is a seller **price list** (type *sale*) whose prices are scoped to that seller's offers. Cards and product pages show the red sale price, the struck-through original and the % off. The seed adds a demo "Black November" sale from EzoD Tech; on an existing database run `bunx medusa exec ./src/scripts/setup-demo-discounts.ts` in `packages/api`.
- **Colours**: orange brand accent (`--brand-900` etc. in `apps/storefront/src/app/colors.css`), `text-sale`/`bg-sale` red for prices and discounts, and an announcement bar in the header.
- Postal code is optional at checkout and in saved addresses (Zimbabwe doesn't use them).

## Run locally

Requirements: Node 22+, [Bun](https://bun.sh), PostgreSQL 13+, Redis.

```bash
bun install

# Backend env
cp packages/api/.env.template packages/api/.env
# set DATABASE_URL=postgres://postgres:postgres@localhost:5432/layerline

createdb layerline
cd packages/api
bunx medusa db:migrate
bun run seed                                   # prints the storefront publishable key
bunx medusa user -e admin@layerline.test -p supersecret
cd ../..

# Storefront env
cp apps/storefront/.env.template apps/storefront/.env
# paste the publishable key into NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY

bun run dev     # from the repo root: starts everything together
#  - backend API          http://localhost:9000
#  - admin panel (Vite)   :7000 → served at http://localhost:9000/dashboard
#  - vendor panel (Vite)  :7001 → served at http://localhost:9000/seller
#  - storefront           http://localhost:3000/zw
```

In development the backend only *proxies* `/dashboard` and `/seller` to the two Vite dev servers, so if you start `packages/api` on its own you'll see "Dashboard not built". Either use `bun run dev` from the root, or also run `bun run dev` in `apps/admin` and `apps/vendor`.

If your database is far away (e.g. Neon in the US from Zimbabwe), Node's default connection timeout is too short. Set this first:

```bash
export NODE_OPTIONS="--no-network-family-autoselection --dns-result-order=ipv4first"
```

### Demo logins (development only — change before sharing any deployment)

| Who | Where | Email | Password |
|---|---|---|---|
| Operator (Cepstrum) | `/dashboard` | admin@layerline.test | supersecret |
| EzoD Tech | `/seller` | ezod@layerline.test | supersecret |
| Demo vendor | `/seller` | bulawayo@layerline.test | supersecret |
| Demo vendor | `/seller` | mutare@layerline.test | supersecret |

### Smoke tests

Run with the backend up:

```bash
PK=<publishable key> scripts/smoke-checkout.sh          # two-vendor checkout → one order group, two orders
PK=<publishable key> scripts/smoke-pay-on-delivery.sh   # pay-on-delivery rules (7 checks)
```

The pay-on-delivery test checks three cases:
- a cart of only eligible items can use pay on delivery and places the order;
- a cart with one printer in it is refused;
- choosing pay on delivery and then adding a printer blocks the order.

## What changed from the Mercur template

- `packages/api/src/scripts/seed.ts` — new 3D printing seed (the original footwear demo is kept as `seed-mercur-demo.ts.txt` for reference).
- `packages/api/static/catalog/` — placeholder product images.
- Storefront: new logo, hero and copy; home page categories and "Shop by brand" now come from the 3D printing catalogue; new "Sell on Layerline" section; human-readable filter names; footer credits Cepstrum Technologies and EzoD Tech; default region `zw`.
- `STORE_CORS` includes `http://localhost:3000`.
- Pay on delivery (see above).

## Not done yet — next steps

1. **Paynow payments (EcoCash, OneMoney, InnBucks, Zimswitch, Visa/Mastercard).** For paying at checkout there is only Medusa's built-in test provider (`pp_system_default`), which takes no money; remove it from the region before going live. Pay on delivery is already in place. Build a Medusa payment-provider module around the `paynow` npm SDK, then switch the Zimbabwe region to it. Stripe Connect payouts don't work in Zimbabwe, so vendor payouts are a ledger + scheduled EcoCash/bank transfers.
2. **Storefront checkout UI** still shows the template's Stripe card form; replace it with a Paynow redirect / EcoCash push step once (1) exists.
3. **Production infrastructure.** Configure Redis-backed event bus, cache, locking and workflow engine modules in `medusa-config.ts` (dev uses in-memory fakes), move file storage to Cloudflare R2/S3 instead of the local `static` folder, and set real `JWT_SECRET` / `COOKIE_SECRET`.
4. **Search.** Add Meilisearch (self-hosted) or Algolia for typo-tolerant search and facet counts.
5. **Content pages.** Footer links (help, returns, delivery, payment, terms, privacy) are placeholders.
6. **Price filter and 3DJake extras** — price-per-kg on cards, delivery estimates, "Spare parts finder" by printer model.
7. **Telemetry.** Set `MEDUSA_DISABLE_TELEMETRY=true` and `NEXT_TELEMETRY_DISABLED=1` if you don't want usage pings.

## Putting it online

See **[deploy/DEPLOY.md](deploy/DEPLOY.md)**. In short: one server (Oracle Cloud Always Free in Johannesburg, or a small VPS) runs the shop, backend, panels, PostgreSQL and Redis behind Caddy (automatic HTTPS), with nightly backups to Cloudflare R2. `deploy/setup-server.sh` prepares the server once, `deploy/deploy.sh` builds and restarts everything.

## Delivery pricing

- **Options per vendor:** "Collect from vendor" (free) and "Delivery", priced by road distance from the vendor to the customer.
- **Several vendors:** each vendor delivers separately, so a cart from several vendors pays the sum of each vendor's distance.
- **Rate:** one platform rate in `packages/api/.env`: `DELIVERY_BASE_FEE`, `DELIVERY_PER_KM`, `DELIVERY_MIN_FEE`, `DELIVERY_ROUND_TO`.
- **Free delivery, store-wide:** a cart whose goods reach the free-delivery amount (default $300) gets free delivery in the listed towns (default Harare) from every vendor. **Change it in the admin panel → Delivery** — it's saved in the database and the shop updates within seconds, no redeploy. `FREE_DELIVERY_MIN_ORDER` / `FREE_DELIVERY_ORDER_CITIES` in `.env` are only the defaults ("Use defaults" on that page returns to them).
- **Free delivery, per product:** set by the admin in Product → Metadata:
  - `free_delivery_cities`: e.g. `Harare` (comma-separated)
  - `free_delivery_min_qty`: e.g. `4`
  - `free_delivery_unit`: e.g. `spools`

  A vendor's delivery is free when every product from that vendor meets its rule. The rule also shows on product cards and the product page, e.g. "Free delivery in Harare from 4 spools".
- **Google Maps:** set `GOOGLE_MAPS_API_KEY` with the Geocoding API, Routes API and Places API (New) enabled. Checkout then suggests addresses and saves their map point, and distances are real road distances. Without the key, distances are estimated from town centres.
- **Existing database:** run `bunx medusa exec ./src/scripts/setup-distance-delivery.ts` once. It is safe to re-run.

## Emails and in-store messages

All emails come from Cepstrum3D's address (`EMAIL_FROM`), including ones about a vendor's order or a vendor's promo code.

| When | Who gets it |
|---|---|
| Checkout | Customer: "We've received your order" (all vendors' items, delivery, total). Each vendor: "New order #N — $total" with the customer's name, phone and address. |
| Customer cancels (storefront → order → *Cancel order*, only before packing) | Customer and vendor |
| Vendor packs / ships / delivers | Customer (packing respects **Notify customer**) |
| Admin or vendor sends a customer-only code | That customer |

Customers also see these under Account → Notifications.

**Emails not arriving?** Run this from `packages/api` — it prints exactly what Resend says and how to fix it:

```bash
TEST_EMAIL_TO=you@example.com bunx medusa exec ./src/scripts/send-test-email.ts
```

Common causes: the backend wasn't restarted after editing `.env`; `EMAIL_FROM` uses `onboarding@resend.dev` (it only delivers to your own Resend sign-up email); the domain in `EMAIL_FROM` isn't verified in Resend → Domains. Every email also logs `[email sent]` or `[email failed] … → fix` in the backend output.

Code: `src/lib/notifications/*`, `src/subscribers/order-*-notify.ts`, `src/modules/email-notification`, `src/api/store/orders/[id]/cancel`.

## Customer-only promo codes

On a promotion's page (admin or vendor portal), **Only for one customer**: enter the customer's email and/or phone, optionally a first name and a note, tick *Email the code to the customer now*, then **Save and send**.
- The code then works only when the cart's email, the signed-in account's email/phone, or the delivery phone matches. It's checked when applied and again at checkout.
- **Let anyone use it** removes the restriction.
- Matching is by email or phone, so anyone who knows both the code and that email/phone could still use it.
- Code: `src/lib/promotions/recipient.ts`, `apps/*/src/components/promotion-recipient-section.tsx`.

## Listing approval and suspension

Nothing a vendor lists reaches customers until an admin approves it.

| What the vendor does | What happens |
|---|---|
| Creates a new product | Saved as *proposed* (hidden). Admin → **Listings → Waiting for approval → Review product** → Confirm / Request changes / Reject (Mercur's product request flow). |
| Starts selling a product that's already live (a new offer) | Hidden as *waiting*. Admin → **Listings** → Approve / Reject (with a reason). |
| Edits a live product | Becomes a change request the admin confirms on the product page. |

**Suspend** anything that breaks the rules from **Listings** (use *Find a listing* to search): a single vendor's offer, or the whole product for every vendor. It disappears from the shop, carts and checkout at once; **Unsuspend** brings it back. Every decision emails the vendor with the reason, and vendors see the state of their listings under **Listing status** in the vendor portal. Set `ADMIN_NOTIFICATIONS_EMAIL` to be emailed when something is waiting.

Code: `src/lib/listings/*`, `src/subscribers/offer-created-listing.ts`, `apps/admin/src/routes/listings`, `apps/vendor/src/routes/listing-status`.

## Ratings and reviews

Customers rate (1–5 stars) and review products on the product page, under **Ratings & reviews**. Only customers whose order with that product was shipped or delivered can review it, once per product (they can edit it). Stars show on the product page and product cards.

- Reviews go live straight away; hide one in admin → **Reviews** (set it to *Rejected*). With `REVIEWS_AUTO_PUBLISH=false` each review waits for approval there instead.
- The vendor who sold it gets an email and can reply in vendor portal → **Reviews**; the reply shows under the review.
- Code: `src/lib/reviews/product-reviews.ts`, `src/api/store/product-reviews`, storefront `components/sections/ProductReviews`.

## Addresses

Address fields (account → Addresses, and checkout) suggest Google places in Zimbabwe. If the customer can't find their address they can:
- pick the closest place (a shop, school or landmark) and add house details to the text — the point stays saved;
- or press **Use my location**, which keeps their phone's GPS point and fills the nearest street.

The map point is saved on the address (`metadata.lat/lng`) and used for delivery distance. The Google key needs **Places API (New)**, **Geocoding API** and **Routes API** enabled, with billing on.

## Panel filters

- **Orders → Fulfillment** (admin and vendor): `apps/*/src/custom-fields/order.tsx`, applied by `packages/api/src/lib/orders/fulfillment-filter.ts`.
- **Manage inventory → Title / Reservations / Stock level**: `apps/*/src/custom-fields/inventory-item.tsx`, applied by `packages/api/src/lib/inventory/inventory-filters.ts`.
- Mercur's inventory list only sends a fixed set of query parameters, and its vendor fulfilment form never sent "Notify customer". Small patches fix both: `patches/@mercurjs%2Fadmin@2.3.7.patch` and `patches/@mercurjs%2Fvendor@2.3.7.patch`. `bun install` applies them. If Mercur is upgraded, re-check them.

## Discounts and sale quantities

**Where discounts live**
- **Sale prices** (shown struck through on product cards): **Price Lists** in the vendor portal or admin. The demo sale is *Black November*.
- **Promotions** (codes or automatic, applied in the cart): **Promotions**.

**Price list page → "Sale quantity per variant"** (both panels):
- **% off:** sets the sale prices from each variant's normal price. Search first to apply it to one product or colour only.
- **Sale quantity:** how many units of each variant may sell at the sale price, e.g. Black 20, Blue 34. When they're sold, that variant goes back to its normal price. Raising the number starts the sale again.
- **How it works:** a cart line asking for more than what's left pays the normal price, and checkout re-checks in case someone else bought the last units. The product page shows "Only N left at this price".
- **Code:** `packages/api/src/lib/sales/sale-limits.ts`, `apps/*/src/components/sale-limits-section.tsx`.

**Promotion category conditions include sub-categories.** "Product category = Filaments" also matches PLA, PETG and others under it (products sit in the lowest category). New and edited promotions get this automatically. For promotions made before this fix, run once:

```bash
bunx medusa exec ./src/scripts/fix-promotion-categories.ts
```

**Promotion conditions:** every store is allowlisted on every category (`src/lib/catalog/category-sellers.ts`, kept up to date by a subscriber), and product types come from the main categories (`src/scripts/setup-product-types.ts`). For an existing database, run:

```bash
bunx medusa exec ./src/scripts/setup-category-sellers.ts
bunx medusa exec ./src/scripts/setup-product-types.ts
```

**Shop cache:** after a price change the backend tells the shop to refresh, so it shows immediately. For this to work, `STOREFRONT_REVALIDATE_URL` must end in `/api/revalidate`, and `STOREFRONT_REVALIDATE_SECRET` must equal the storefront's `REVALIDATE_SECRET`.

## Renaming

The storefront name lives in **`apps/storefront/src/config/site.ts`** (`siteConfig.name`, plus description, tagline, owner and partner). Changing it updates the header logo, page titles and SEO tags, footer, hero, "Sell on …" section, footer links and cart labels on every page. The logo is the layer mark plus the name as live text, so no image needs redrawing.

Outside the storefront:
- Admin store name: `MARKETPLACE_NAME` in `packages/api/src/scripts/seed.ts` (or Settings → Store in the admin panel).
- Demo login emails still end in `@layerline.test`; they're only test accounts. The folder name `layerline-marketplace` doesn't matter either.

## Docs

Mercur's documentation ships with the project: `node_modules/@mercurjs/docs/llms.txt`. Online at https://docs.mercurjs.com.
