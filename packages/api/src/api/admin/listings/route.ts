import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { listListings } from "../../../lib/listings/status";

/**
 * GET /admin/listings?status=pending|suspended|rejected|all&q=title
 * pending = new products and new vendor listings waiting for approval.
 */
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const q = req.query as { status?: string; q?: string };
  const listings = await listListings(req.scope, { status: q.status ?? "pending", q: q.q?.trim() || undefined });
  res.json({ listings });
}
