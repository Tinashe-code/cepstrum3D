import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { MedusaError } from "@medusajs/framework/utils";
import { suspendProduct, unsuspendProduct } from "../../../../../lib/listings/status";

/**
 * POST /admin/listings/products/:id { action: suspend|unsuspend, reason? }
 * Suspend hides the product (and every vendor's offer on it) from the shop.
 * New products are approved with Mercur's own Confirm / Reject buttons.
 */
export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const { action, reason } = (req.body ?? {}) as { action?: string; reason?: string };
  if (action === "suspend") {
    const suspension = await suspendProduct(req.scope, req.params.id, reason ?? "", (req as any).auth_context?.actor_id);
    return res.json({ id: req.params.id, suspension });
  }
  if (action === "unsuspend") {
    await unsuspendProduct(req.scope, req.params.id);
    return res.json({ id: req.params.id, suspension: null });
  }
  throw new MedusaError(MedusaError.Types.INVALID_DATA, "action must be suspend or unsuspend");
}
