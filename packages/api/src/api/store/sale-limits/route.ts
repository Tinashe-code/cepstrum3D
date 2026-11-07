import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { liveSaleLimitsForOffers } from "../../../lib/sales/sale-limits";

/**
 * GET /store/sale-limits?offer_id=a,b — units left at the sale price, for
 * "Only 12 left at this price" on the product page. Offers without a limit
 * are left out.
 */
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const raw = req.query.offer_id;
  const ids = (Array.isArray(raw) ? raw : String(raw ?? "").split(","))
    .map(String)
    .filter(Boolean)
    .slice(0, 200);
  const live = await liveSaleLimitsForOffers(req.scope, ids);
  res.json({
    sale_limits: Object.fromEntries(Object.entries(live).map(([k, v]) => [k, { remaining: v.remaining, price: v.price }])),
  });
}
