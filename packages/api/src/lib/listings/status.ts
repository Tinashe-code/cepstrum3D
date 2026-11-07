import type { MedusaContainer } from "@medusajs/framework/types";
import { ContainerRegistrationKeys, MedusaError, Modules } from "@medusajs/framework/utils";
import { renderEmail, siteName, storefrontUrl, vendorPortalUrl } from "../notifications/layout";
import { emailTo, sendNotifications } from "../notifications/send";
import { revalidateStorefront } from "../storefront-cache";

/**
 * Listing approval and suspension.
 *
 * Two kinds of listing:
 *  - a PRODUCT a vendor creates. Mercur already keeps it "proposed" (hidden)
 *    until an admin confirms it (admin → Products → the product → Confirm).
 *  - an OFFER: a vendor selling a variant of a product that's already live
 *    (e.g. a second vendor listing eSUN PLA+). Mercur publishes those at once,
 *    so we hold them here:
 *        offer.metadata.listing_status = "pending" | "approved" | "rejected" | "suspended"
 *    Missing = approved (offers made before this existed, or admin-made).
 *
 * Suspending a PRODUCT sets it to draft (hidden everywhere in the shop) and
 * remembers why in product.metadata.suspension; unsuspending publishes it again.
 */

export type ListingStatus = "pending" | "approved" | "rejected" | "suspended";
export const HIDDEN: ListingStatus[] = ["pending", "rejected", "suspended"];

export type ListingNote = { status: ListingStatus; reason?: string | null; at: string; by?: string | null };

const db = (c: MedusaContainer) => c.resolve(ContainerRegistrationKeys.PG_CONNECTION);

/** Offer ids customers must not see or buy. Cheap: one indexed scan of a small table. */
export async function hiddenOfferIds(container: MedusaContainer, offerIds?: string[]): Promise<string[]> {
  const q = db(container)("offer")
    .select("id")
    .whereNull("deleted_at")
    .whereRaw("metadata->>'listing_status' = any(?)", [HIDDEN]);
  if (offerIds?.length) q.whereIn("id", offerIds);
  return ((await q) as { id: string }[]).map((r) => r.id);
}

type OfferRow = {
  id: string;
  sku: string;
  seller_id: string;
  product_id: string;
  variant_id: string;
  metadata: Record<string, unknown> | null;
  created_by: string | null;
  created_at: string;
};

async function offers(container: MedusaContainer, ids: string[]) {
  return (await db(container)("offer").select("*").whereIn("id", ids).whereNull("deleted_at")) as OfferRow[];
}

async function sellers(container: MedusaContainer, ids: string[]) {
  if (!ids.length) return new Map<string, { id: string; name: string; email: string | null }>();
  const rows = (await db(container)("seller").select("id", "name", "email").whereIn("id", ids)) as {
    id: string;
    name: string;
    email: string | null;
  }[];
  return new Map(rows.map((r) => [r.id, r]));
}

async function products(container: MedusaContainer, ids: string[]) {
  if (!ids.length) return new Map<string, { id: string; title: string; handle: string; status: string; metadata: any }>();
  const rows = (await db(container)("product")
    .select("id", "title", "handle", "status", "metadata", "thumbnail")
    .whereIn("id", ids)) as { id: string; title: string; handle: string; status: string; metadata: any; thumbnail: string | null }[];
  return new Map(rows.map((r) => [r.id, r]));
}

/** Sellers involved in a product: whoever submitted it, and everyone with an offer on it. */
export async function productSellerIds(container: MedusaContainer, productId: string) {
  const k = db(container);
  const creators = (await k("product_change")
    .select("created_by")
    .where({ product_id: productId })
    .whereLike("created_by", "sel_%")) as { created_by: string }[];
  const withOffers = (await k("offer").distinct("seller_id").where({ product_id: productId }).whereNull("deleted_at")) as {
    seller_id: string;
  }[];
  return [...new Set([...creators.map((r) => r.created_by), ...withOffers.map((r) => r.seller_id)])];
}

// ---------------------------------------------------------------- emails

const STATUS_WORDS: Record<string, { subject: (t: string) => string; intro: (t: string) => string }> = {
  approved: {
    subject: (t) => `Approved: ${t} is now live`,
    intro: (t) => `Your listing for ${t} has been approved and customers can now buy it.`,
  },
  rejected: {
    subject: (t) => `Not approved: ${t}`,
    intro: (t) => `Your listing for ${t} wasn't approved.`,
  },
  suspended: {
    subject: (t) => `Suspended: ${t}`,
    intro: (t) => `Your listing for ${t} has been suspended and is hidden from the shop.`,
  },
  reinstated: {
    subject: (t) => `Back online: ${t}`,
    intro: (t) => `Your listing for ${t} is visible in the shop again.`,
  },
  changes_requested: {
    subject: (t) => `Changes needed: ${t}`,
    intro: (t) => `Before ${t} can go live, the ${siteName()} team asks for some changes.`,
  },
};

export async function emailSellers(
  container: MedusaContainer,
  sellerIds: string[],
  kind: keyof typeof STATUS_WORDS,
  title: string,
  reason?: string | null,
  resource?: { id: string; type: string }
) {
  const map = await sellers(container, sellerIds);
  const w = STATUS_WORDS[kind];
  const list = [...map.values()]
    .filter((s) => s.email)
    .map((s) => {
      const content = renderEmail({
        heading: w.subject(title),
        intro: w.intro(title),
        paragraphs: [
          ...(reason ? [`Reason: ${reason}`] : []),
          ...(kind === "suspended" || kind === "rejected" || kind === "changes_requested"
            ? [`If you have questions, reply to this email. You can update the listing in your vendor portal.`]
            : []),
        ],
        button: { text: "Open the vendor portal", url: `${vendorPortalUrl()}/products` },
        footer: `${siteName()} — ${s.name}`,
      });
      return emailTo(s.email!, `listing-${kind}`, { subject: w.subject(title), ...content }, resource);
    });
  await sendNotifications(container, list, `Listing ${kind}: ${title}`);
}

/** Tell the marketplace team something is waiting (ADMIN_NOTIFICATIONS_EMAIL, comma-separated). */
export async function emailAdmins(container: MedusaContainer, subject: string, intro: string, path: string) {
  const to = (process.env.ADMIN_NOTIFICATIONS_EMAIL ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  if (!to.length) return;
  const base = (process.env.MERCUR_BACKEND_URL || "http://localhost:9000").replace(/\/$/, "");
  const content = renderEmail({
    heading: subject,
    intro,
    button: { text: "Review it", url: `${base}/dashboard${path}` },
    footer: `${siteName()} admin`,
  });
  await sendNotifications(
    container,
    to.map((t) => emailTo(t, "admin-review-needed", { subject, ...content })),
    subject
  );
}

// ---------------------------------------------------------------- offers

/** New vendor listings on a product that's already live wait for approval. */
export async function holdNewOffers(container: MedusaContainer, offerIds: string[]) {
  const rows = await offers(container, offerIds);
  const prods = await products(container, [...new Set(rows.map((o) => o.product_id))]);
  const hold = rows.filter(
    (o) =>
      o.metadata?.listing_status === undefined &&
      prods.get(o.product_id)?.status === "published" &&
      // Only vendor-made offers (created by a seller member, not an admin)
      String(o.created_by ?? "").startsWith("mem_")
  );
  if (!hold.length) return [];
  const k = db(container);
  for (const o of hold) {
    const note: ListingNote = { status: "pending", at: new Date().toISOString() };
    await k("offer")
      .where({ id: o.id })
      .update({ metadata: { ...(o.metadata ?? {}), listing_status: "pending", listing_note: note } });
  }
  const names = [...new Set(hold.map((o) => prods.get(o.product_id)?.title).filter(Boolean))];
  await emailAdmins(
    container,
    `${hold.length} new listing${hold.length > 1 ? "s" : ""} waiting for approval`,
    `A vendor wants to sell: ${names.join(", ")}.`,
    "/listings"
  );
  return hold.map((o) => o.id);
}

export async function setOfferStatus(
  container: MedusaContainer,
  offerIds: string[],
  status: ListingStatus,
  opts: { reason?: string | null; by?: string | null; notify?: boolean } = {}
) {
  const rows = await offers(container, offerIds);
  if (!rows.length) throw new MedusaError(MedusaError.Types.NOT_FOUND, "Listing not found");
  if ((status === "rejected" || status === "suspended") && !opts.reason?.trim()) {
    throw new MedusaError(MedusaError.Types.INVALID_DATA, "Give the vendor a reason.");
  }
  const k = db(container);
  const note: ListingNote = { status, reason: opts.reason?.trim() || null, at: new Date().toISOString(), by: opts.by ?? null };
  for (const o of rows) {
    const history = Array.isArray(o.metadata?.listing_history) ? (o.metadata!.listing_history as ListingNote[]) : [];
    await k("offer")
      .where({ id: o.id })
      .update({
        metadata: { ...(o.metadata ?? {}), listing_status: status, listing_note: note, listing_history: [...history, note].slice(-20) },
      });
  }

  if (opts.notify !== false) {
    const prods = await products(container, [...new Set(rows.map((o) => o.product_id))]);
    const bySeller = new Map<string, string[]>();
    for (const o of rows) bySeller.set(o.seller_id, [...(bySeller.get(o.seller_id) ?? []), prods.get(o.product_id)?.title ?? o.sku]);
    const wasSuspended = rows.some((o) => o.metadata?.listing_status === "suspended");
    const kind = status === "approved" ? (wasSuspended ? "reinstated" : "approved") : status;
    for (const [sellerId, titles] of bySeller) {
      await emailSellers(container, [sellerId], kind as never, [...new Set(titles)].join(", "), note.reason, {
        id: rows[0].id,
        type: "offer",
      });
    }
  }
  await revalidateShop(rows.map((o) => o.product_id));
  return rows.map((o) => o.id);
}

// ---------------------------------------------------------------- products

export async function suspendProduct(container: MedusaContainer, productId: string, reason: string, by?: string | null) {
  if (!reason?.trim()) throw new MedusaError(MedusaError.Types.INVALID_DATA, "Give the vendor a reason.");
  const productModule = container.resolve(Modules.PRODUCT);
  const p = await productModule.retrieveProduct(productId);
  if ((p.metadata as any)?.suspension?.reason) throw new MedusaError(MedusaError.Types.NOT_ALLOWED, "This product is already suspended.");
  const suspension = { reason: reason.trim(), at: new Date().toISOString(), by: by ?? null, previous_status: p.status };
  await productModule.updateProducts(productId, { status: "draft", metadata: { ...(p.metadata ?? {}), suspension } } as never);
  await emailSellers(container, await productSellerIds(container, productId), "suspended", p.title, reason, {
    id: productId,
    type: "product",
  });
  await revalidateShop([productId]);
  return suspension;
}

export async function unsuspendProduct(container: MedusaContainer, productId: string) {
  const productModule = container.resolve(Modules.PRODUCT);
  const p = await productModule.retrieveProduct(productId);
  const s = (p.metadata as any)?.suspension;
  if (!s?.reason) throw new MedusaError(MedusaError.Types.NOT_ALLOWED, "This product isn't suspended.");
  const { suspension: _s, ...rest } = (p.metadata ?? {}) as Record<string, unknown>;
  const history = Array.isArray(rest.suspension_history) ? (rest.suspension_history as unknown[]) : [];
  await productModule.updateProducts(productId, {
    status: s.previous_status === "published" || !s.previous_status ? "published" : s.previous_status,
    // Medusa merges metadata; an empty string removes the key.
    metadata: { ...rest, suspension: "", suspension_history: [...history, { ...s, lifted_at: new Date().toISOString() }].slice(-20) },
  } as never);
  await emailSellers(container, await productSellerIds(container, productId), "reinstated", p.title, null, {
    id: productId,
    type: "product",
  });
  await revalidateShop([productId]);
}

// ---------------------------------------------------------------- lists for the panels

export type ListingRow = {
  kind: "offer" | "product";
  id: string;
  product_id: string;
  product_title: string;
  product_handle: string;
  product_status: string;
  thumbnail: string | null;
  sku?: string;
  variant_title?: string | null;
  seller_id?: string;
  seller_name?: string;
  status: ListingStatus | "proposed";
  reason?: string | null;
  since?: string | null;
};

/**
 * status: "pending" (offers waiting + new products waiting), "suspended",
 * "rejected", or "all" (with q = product title search).
 */
export async function listListings(
  container: MedusaContainer,
  opts: { status?: string; q?: string; sellerId?: string; limit?: number }
): Promise<ListingRow[]> {
  const k = db(container);
  const limit = Math.min(opts.limit ?? 100, 200);
  const status = opts.status ?? "pending";

  const oq = k("offer as o")
    .join("product as p", "p.id", "o.product_id")
    .leftJoin("product_variant as v", "v.id", "o.variant_id")
    .leftJoin("seller as s", "s.id", "o.seller_id")
    .whereNull("o.deleted_at")
    .whereNull("p.deleted_at")
    .select(
      "o.id",
      "o.sku",
      "o.metadata",
      "o.created_at",
      "o.seller_id",
      "s.name as seller_name",
      "v.title as variant_title",
      "p.id as product_id",
      "p.title as product_title",
      "p.handle as product_handle",
      "p.status as product_status",
      "p.thumbnail"
    )
    .orderBy("o.created_at", "desc")
    .limit(limit);
  if (opts.sellerId) oq.where("o.seller_id", opts.sellerId);
  if (status === "all") {
    if (opts.q) oq.whereILike("p.title", `%${opts.q}%`);
  } else {
    oq.whereRaw("o.metadata->>'listing_status' = ?", [status]);
  }

  const pq = k("product as p")
    .whereNull("p.deleted_at")
    .select("p.id", "p.title", "p.handle", "p.status", "p.thumbnail", "p.metadata", "p.updated_at", "p.created_at")
    .orderBy("p.updated_at", "desc")
    .limit(limit);
  if (status === "pending") pq.where("p.status", "proposed");
  else if (status === "suspended") pq.whereRaw("p.metadata->'suspension' is not null and p.metadata->>'suspension' <> ''");
  else if (status === "rejected") pq.where("p.status", "rejected");
  else if (opts.q) pq.whereILike("p.title", `%${opts.q}%`);
  if (opts.sellerId) {
    pq.where((b) =>
      b
        .whereIn("p.id", k("product_change").select("product_id").where("created_by", opts.sellerId!))
        .orWhereIn("p.id", k("offer").select("product_id").where("seller_id", opts.sellerId!).whereNull("deleted_at"))
    );
  }

  const [offerRows, productRows] = await Promise.all([oq, pq]);
  // Who submitted each product (first seller-made change)
  const submitters = new Map<string, string>();
  if ((productRows as any[]).length) {
    const subs = (await k("product_change as c")
      .join("seller as s", "s.id", "c.created_by")
      .whereIn("c.product_id", (productRows as any[]).map((p) => p.id))
      .orderBy("c.created_at", "asc")
      .select("c.product_id", "s.name")) as { product_id: string; name: string }[];
    for (const r of subs) if (!submitters.has(r.product_id)) submitters.set(r.product_id, r.name);
  }
  const rows: ListingRow[] = [];
  for (const p of productRows as any[]) {
    const s = p.metadata?.suspension?.reason ? p.metadata.suspension : null;
    rows.push({
      kind: "product",
      id: p.id,
      product_id: p.id,
      product_title: p.title,
      product_handle: p.handle,
      product_status: p.status,
      thumbnail: p.thumbnail,
      seller_name: submitters.get(p.id),
      status: s ? "suspended" : p.status === "proposed" ? "proposed" : p.status === "rejected" ? "rejected" : "approved",
      reason: s?.reason ?? null,
      since: s?.at ?? p.updated_at ?? p.created_at,
    });
  }
  for (const o of offerRows as any[]) {
    rows.push({
      kind: "offer",
      id: o.id,
      product_id: o.product_id,
      product_title: o.product_title,
      product_handle: o.product_handle,
      product_status: o.product_status,
      thumbnail: o.thumbnail,
      sku: o.sku,
      variant_title: o.variant_title,
      seller_id: o.seller_id,
      seller_name: o.seller_name,
      status: (o.metadata?.listing_status as ListingStatus) ?? "approved",
      reason: o.metadata?.listing_note?.reason ?? null,
      since: o.metadata?.listing_note?.at ?? o.created_at,
    });
  }
  return rows;
}

// ---------------------------------------------------------------- shop cache

async function revalidateShop(productIds: string[]) {
  try {
    await revalidateStorefront(["products", "offers", ...productIds.map((id) => `product-offers-${id}`)]);
  } catch {
    // cache refresh is best-effort; pages refresh on their own within minutes
  }
}

export { storefrontUrl };
