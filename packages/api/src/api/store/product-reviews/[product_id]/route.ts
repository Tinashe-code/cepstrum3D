import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { productReviews, reviewEligibility, submitProductReview } from "../../../../lib/reviews/product-reviews";

const customerId = (req: MedusaRequest) =>
  (req as unknown as { auth_context?: { actor_id?: string; actor_type?: string } }).auth_context?.actor_type === "customer"
    ? (req as any).auth_context.actor_id
    : null;

/**
 * GET /store/product-reviews/:product_id?limit=10&offset=0&sort=newest|highest|lowest
 * → { summary: { average, count, distribution }, reviews: [...], mine? }
 * `mine` (signed-in customers): whether they can review, and their review if any.
 */
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const q = req.query as { limit?: string; offset?: string; sort?: string };
  const data = await productReviews(req.scope, req.params.product_id, {
    limit: Number(q.limit) || 10,
    offset: Number(q.offset) || 0,
    sort: (["newest", "highest", "lowest"].includes(String(q.sort)) ? q.sort : "newest") as never,
  });
  const cid = customerId(req);
  const mine = cid ? await reviewEligibility(req.scope, cid, req.params.product_id) : null;
  res.json({ ...data, mine: mine && { can_review: mine.can_review, reason: mine.reason, review: mine.existing } });
}

/** POST /store/product-reviews/:product_id { rating: 1-5, text? } — create or update the customer's review. */
export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const body = (req.body ?? {}) as { rating?: number; text?: string };
  const result = await submitProductReview(req.scope, customerId(req)!, req.params.product_id, {
    rating: Number(body.rating),
    text: body.text,
  });
  res.status(result.updated ? 200 : 201).json(result);
}
