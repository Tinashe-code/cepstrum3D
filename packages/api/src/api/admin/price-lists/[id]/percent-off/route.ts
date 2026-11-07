import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { applyPercentOff } from "../../../../../lib/sales/sale-limits";

/** POST /admin/price-lists/:id/percent-off  { percent: 20, offer_ids?: [...] } */
export async function POST(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  const { percent, offer_ids } = (req.body ?? {}) as { percent?: number; offer_ids?: string[] };
  res.json(await applyPercentOff(req.scope, req.params.id, Number(percent), offer_ids));
}
