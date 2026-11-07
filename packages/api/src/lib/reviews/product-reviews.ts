import type { MedusaContainer } from "@medusajs/framework/types";
import { ContainerRegistrationKeys, MedusaError } from "@medusajs/framework/utils";
import { MercurModules } from "@mercurjs/types";
import { createReviewWorkflow, updateReviewWorkflow } from "@mercurjs/core/workflows";
import { renderEmail, siteName, storefrontUrl, vendorPortalUrl } from "../notifications/layout";
import { emailTo, sendNotifications } from "../notifications/send";

/**
 * Product ratings & reviews on top of Mercur's review module.
 *
 *  - Only customers who received the product can review it (their order was
 *    shipped or delivered, not cancelled), once per product; they can edit it.
 *  - Reviews go live straight away (REVIEWS_AUTO_PUBLISH=false to approve each
 *    one first). Admins hide a review in admin → Reviews (set it to Rejected).
 *  - Each review is also linked to the vendor who sold it, so it shows in the
 *    vendor's Reviews page where they can reply; the reply shows in the shop.
 */

const db = (c: MedusaContainer) => c.resolve(ContainerRegistrationKeys.PG_CONNECTION);
const autoPublish = () => process.env.REVIEWS_AUTO_PUBLISH !== "false";

export type PublicReview = {
  id: string;
  rating: number;
  text: string | null;
  author: string;
  verified: boolean;
  seller_reply: string | null;
  seller_name: string | null;
  created_at: string;
};

export type ReviewSummary = { average: number | null; count: number; distribution: Record<1 | 2 | 3 | 4 | 5, number> };

const authorName = (first?: string | null, last?: string | null) => {
  const f = (first ?? "").trim();
  const l = (last ?? "").trim();
  if (!f && !l) return "Customer";
  return [f || l, f && l ? `${l[0].toUpperCase()}.` : ""].filter(Boolean).join(" ");
};

/** Average + count for many products at once (product cards). */
export async function reviewSummaries(container: MedusaContainer, productIds: string[]) {
  const out: Record<string, { average: number; count: number }> = {};
  if (!productIds.length) return out;
  const rows = (await db(container)("product_product_review_review as l")
    .join("review as r", "r.id", "l.review_id")
    .whereIn("l.product_id", productIds)
    .whereNull("l.deleted_at")
    .whereNull("r.deleted_at")
    .where("r.status", "published")
    .groupBy("l.product_id")
    .select("l.product_id")
    .avg({ average: "r.rating" })
    .count({ count: "*" })) as { product_id: string; average: string; count: string }[];
  for (const r of rows) out[r.product_id] = { average: Math.round(Number(r.average) * 10) / 10, count: Number(r.count) };
  return out;
}

export async function productReviews(
  container: MedusaContainer,
  productId: string,
  opts: { limit?: number; offset?: number; sort?: "newest" | "highest" | "lowest" } = {}
) {
  const k = db(container);
  const base = () =>
    k("product_product_review_review as l")
      .join("review as r", "r.id", "l.review_id")
      .where("l.product_id", productId)
      .whereNull("l.deleted_at")
      .whereNull("r.deleted_at")
      .where("r.status", "published");

  const dist = (await base().groupBy("r.rating").select("r.rating").count({ n: "*" })) as { rating: number; n: string }[];
  const distribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 } as ReviewSummary["distribution"];
  let total = 0;
  let sum = 0;
  for (const d of dist) {
    const r = Math.min(5, Math.max(1, Math.round(Number(d.rating)))) as 1 | 2 | 3 | 4 | 5;
    distribution[r] += Number(d.n);
    total += Number(d.n);
    sum += Number(d.rating) * Number(d.n);
  }

  const order =
    opts.sort === "highest" ? [["r.rating", "desc"], ["r.created_at", "desc"]] :
    opts.sort === "lowest" ? [["r.rating", "asc"], ["r.created_at", "desc"]] : [["r.created_at", "desc"]];
  const q = base()
    .leftJoin("customer_customer_review_review as cl", function () {
      this.on("cl.review_id", "r.id").andOnNull("cl.deleted_at");
    })
    .leftJoin("customer as c", "c.id", "cl.customer_id")
    .leftJoin("seller_seller_review_review as sl", function () {
      this.on("sl.review_id", "r.id").andOnNull("sl.deleted_at");
    })
    .leftJoin("seller as s", "s.id", "sl.seller_id")
    .select("r.id", "r.rating", "r.customer_note", "r.seller_note", "r.created_at", "c.first_name", "c.last_name", "s.name as seller_name")
    .limit(Math.min(opts.limit ?? 10, 50))
    .offset(opts.offset ?? 0);
  for (const [col, dir] of order) q.orderBy(col, dir as "asc" | "desc");
  const rows = (await q) as any[];

  const reviews: PublicReview[] = rows.map((r) => ({
    id: r.id,
    rating: Number(r.rating),
    text: r.customer_note,
    author: authorName(r.first_name, r.last_name),
    verified: true,
    seller_reply: r.seller_note,
    seller_name: r.seller_note ? r.seller_name : null,
    created_at: r.created_at,
  }));
  const summary: ReviewSummary = { average: total ? Math.round((sum / total) * 10) / 10 : null, count: total, distribution };
  return { summary, reviews };
}

/** Can this customer review this product? Returns the order to attach it to, or why not. */
export async function reviewEligibility(container: MedusaContainer, customerId: string, productId: string) {
  const k = db(container);
  const existing = (await k("product_product_review_review as l")
    .join("customer_customer_review_review as cl", "cl.review_id", "l.review_id")
    .join("review as r", "r.id", "l.review_id")
    .where({ "l.product_id": productId, "cl.customer_id": customerId })
    .whereNull("l.deleted_at")
    .whereNull("cl.deleted_at")
    .whereNull("r.deleted_at")
    .select("r.id", "r.rating", "r.customer_note", "r.status")
    .first()) as { id: string; rating: number; customer_note: string | null; status: string } | undefined;

  const orders = (await k("order as o")
    .join("order_item as oi", "oi.order_id", "o.id")
    .join("order_line_item as li", "li.id", "oi.item_id")
    .leftJoin("order_order_seller_seller as os", "os.order_id", "o.id")
    .where({ "o.customer_id": customerId, "li.product_id": productId })
    .whereNull("o.deleted_at")
    .whereNot("o.status", "canceled")
    .select("o.id", "os.seller_id")
    .select(
      k.raw(
        `exists (select 1 from order_fulfillment ofl join fulfillment f on f.id = ofl.fulfillment_id
                 where ofl.order_id = o.id and ofl.deleted_at is null and f.canceled_at is null
                   and (f.shipped_at is not null or f.delivered_at is not null)) as received`
      )
    )
    .orderBy("o.created_at", "desc")) as { id: string; seller_id: string | null; received: boolean }[];

  const received = orders.find((o) => o.received);
  return {
    existing: existing ? { id: existing.id, rating: Number(existing.rating), text: existing.customer_note, status: existing.status } : null,
    order_id: received?.id ?? null,
    seller_id: received?.seller_id ?? null,
    can_review: !!existing || !!received,
    reason: existing || received ? null : orders.length ? "not_received" : "not_purchased",
  };
}

export async function submitProductReview(
  container: MedusaContainer,
  customerId: string,
  productId: string,
  input: { rating: number; text?: string | null }
) {
  const rating = Math.round(Number(input.rating));
  if (!(rating >= 1 && rating <= 5)) throw new MedusaError(MedusaError.Types.INVALID_DATA, "Choose 1 to 5 stars.");
  const text = (input.text ?? "").trim().slice(0, 1000) || null;

  const e = await reviewEligibility(container, customerId, productId);
  const status = autoPublish() ? "published" : "pending";

  if (e.existing) {
    await updateReviewWorkflow(container).run({ input: { id: e.existing.id, rating, customer_note: text, status } as never });
    return { id: e.existing.id, status, updated: true };
  }
  if (!e.order_id) {
    throw new MedusaError(
      MedusaError.Types.NOT_ALLOWED,
      e.reason === "not_received"
        ? "You can review this product once your order has been delivered."
        : "Only customers who bought this product can review it."
    );
  }

  const { result } = await createReviewWorkflow(container).run({
    input: { order_id: e.order_id, reference: "product", reference_id: productId, rating, customer_note: text, customer_id: customerId } as never,
  });
  const reviewId = (result as { id: string }).id;
  const link = container.resolve(ContainerRegistrationKeys.LINK);
  if (e.seller_id) {
    // Also on the vendor's Reviews page, so they can reply.
    await link.create({ [MercurModules.SELLER]: { seller_id: e.seller_id }, [MercurModules.REVIEW]: { review_id: reviewId } } as never).catch(() => undefined);
  }
  if (status === "published") {
    await (container.resolve(MercurModules.REVIEW) as { updateReviews: (d: unknown) => Promise<unknown> }).updateReviews({ id: reviewId, status });
  }
  void notifySeller(container, e.seller_id, productId, rating, text).catch(() => undefined);
  return { id: reviewId, status, updated: false };
}

async function notifySeller(container: MedusaContainer, sellerId: string | null, productId: string, rating: number, text: string | null) {
  if (!sellerId) return;
  const k = db(container);
  const seller = (await k("seller").where({ id: sellerId }).first("name", "email")) as { name: string; email: string | null } | undefined;
  const product = (await k("product").where({ id: productId }).first("title", "handle")) as { title: string; handle: string } | undefined;
  if (!seller?.email || !product) return;
  const stars = "★".repeat(rating) + "☆".repeat(5 - rating);
  const subject = `New ${rating}★ review: ${product.title}`;
  const content = renderEmail({
    heading: subject,
    intro: `A customer reviewed ${product.title}: ${stars}`,
    paragraphs: [...(text ? [`“${text}”`] : []), "You can reply in your vendor portal → Reviews. Your reply is shown under the review in the shop."],
    button: { text: "Reply to the review", url: `${vendorPortalUrl()}/reviews` },
    footer: `${siteName()} — ${seller.name}. See it: ${storefrontUrl()}/products/${product.handle}`,
  });
  await sendNotifications(container, [emailTo(seller.email, "review-received", { subject, ...content })], subject);
}
