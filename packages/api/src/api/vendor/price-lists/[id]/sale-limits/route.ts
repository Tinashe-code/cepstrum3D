import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { assertSellerOwnsPriceList, getSaleLimitRows, setSaleLimits } from "../../../../../lib/sales/sale-limits";

const sellerOf = (req: AuthenticatedMedusaRequest) =>
  (req as unknown as { seller_context?: { seller_id?: string } }).seller_context?.seller_id ??
  String(req.headers["x-seller-id"] ?? "");

/** GET /vendor/price-lists/:id/sale-limits — each variant's sale quantity, sold and remaining. */
export async function GET(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  await assertSellerOwnsPriceList(req.scope, sellerOf(req), req.params.id);
  res.json(await getSaleLimitRows(req.scope, req.params.id));
}

/** POST /vendor/price-lists/:id/sale-limits  { limits: { [offer_id]: number | null } } */
export async function POST(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  await assertSellerOwnsPriceList(req.scope, sellerOf(req), req.params.id);
  const limits = ((req.body ?? {}) as { limits?: Record<string, number | null> }).limits ?? {};
  res.json(await setSaleLimits(req.scope, req.params.id, limits));
}
