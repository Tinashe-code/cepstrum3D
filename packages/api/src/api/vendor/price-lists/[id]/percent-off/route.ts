import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { applyPercentOff, assertSellerOwnsPriceList } from "../../../../../lib/sales/sale-limits";

/** POST /vendor/price-lists/:id/percent-off  { percent: 20, offer_ids?: [...] } */
export async function POST(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  const sellerId =
    (req as unknown as { seller_context?: { seller_id?: string } }).seller_context?.seller_id ??
    String(req.headers["x-seller-id"] ?? "");
  await assertSellerOwnsPriceList(req.scope, sellerId, req.params.id);
  const { percent, offer_ids } = (req.body ?? {}) as { percent?: number; offer_ids?: string[] };
  res.json(await applyPercentOff(req.scope, req.params.id, Number(percent), offer_ids));
}
