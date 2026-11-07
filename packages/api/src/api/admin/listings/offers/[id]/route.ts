import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { MedusaError } from "@medusajs/framework/utils";
import { setOfferStatus } from "../../../../../lib/listings/status";

const ACTIONS = { approve: "approved", reject: "rejected", suspend: "suspended", unsuspend: "approved" } as const;

/** POST /admin/listings/offers/:id { action: approve|reject|suspend|unsuspend, reason? } */
export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const { action, reason } = (req.body ?? {}) as { action?: keyof typeof ACTIONS; reason?: string };
  const status = action && ACTIONS[action];
  if (!status) throw new MedusaError(MedusaError.Types.INVALID_DATA, "action must be approve, reject, suspend or unsuspend");
  await setOfferStatus(req.scope, [req.params.id], status, { reason, by: (req as any).auth_context?.actor_id });
  res.json({ id: req.params.id, status });
}
