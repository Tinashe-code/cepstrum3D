import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { getRecipient, setRecipient } from "../../../../../lib/promotions/recipient";

/** GET /admin/promotions/:id/recipient */
export async function GET(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  res.json(await getRecipient(req.scope, req.params.id));
}

/** POST /admin/promotions/:id/recipient  { email, phone, name, notify, message } */
export async function POST(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  res.json(await setRecipient(req.scope, req.params.id, (req.body ?? {}) as never));
}
