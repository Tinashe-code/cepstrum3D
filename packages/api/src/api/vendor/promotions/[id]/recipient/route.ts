import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { assertSellerOwnsPromotion, getRecipient, setRecipient } from "../../../../../lib/promotions/recipient";

const sellerOf = (req: AuthenticatedMedusaRequest) =>
  (req as unknown as { seller_context?: { seller_id?: string } }).seller_context?.seller_id ??
  String(req.headers["x-seller-id"] ?? "");

/** GET /vendor/promotions/:id/recipient — who this code is reserved for. */
export async function GET(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  await assertSellerOwnsPromotion(req.scope, sellerOf(req), req.params.id);
  res.json(await getRecipient(req.scope, req.params.id));
}

/** POST /vendor/promotions/:id/recipient  { email, phone, name, notify, message } */
export async function POST(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  await assertSellerOwnsPromotion(req.scope, sellerOf(req), req.params.id);
  res.json(await setRecipient(req.scope, req.params.id, (req.body ?? {}) as never));
}
