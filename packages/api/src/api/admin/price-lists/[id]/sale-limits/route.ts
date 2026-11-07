import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { getSaleLimitRows, setSaleLimits } from "../../../../../lib/sales/sale-limits";

/** GET /admin/price-lists/:id/sale-limits */
export async function GET(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  res.json(await getSaleLimitRows(req.scope, req.params.id));
}

/** POST /admin/price-lists/:id/sale-limits  { limits: { [offer_id]: number | null } } */
export async function POST(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  const limits = ((req.body ?? {}) as { limits?: Record<string, number | null> }).limits ?? {};
  res.json(await setSaleLimits(req.scope, req.params.id, limits));
}
