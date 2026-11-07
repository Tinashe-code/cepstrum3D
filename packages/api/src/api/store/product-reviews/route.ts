import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { reviewSummaries } from "../../../lib/reviews/product-reviews";

/** GET /store/product-reviews?product_id=prod_1,prod_2 → { summaries: { prod_1: { average, count } } } (product cards) */
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const raw = (req.query as { product_id?: string | string[] }).product_id;
  const ids = (Array.isArray(raw) ? raw : String(raw ?? "").split(","))
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 100);
  res.json({ summaries: await reviewSummaries(req.scope, ids) });
}
