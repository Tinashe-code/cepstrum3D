import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { MedusaError } from "@medusajs/framework/utils";
import { listListings } from "../../../lib/listings/status";

/** GET /vendor/listings — this vendor's listings that aren't live: waiting, not approved, suspended. */
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  // Set by Mercur's /vendor/* middleware after checking the member belongs to this seller.
  const sellerId = (req as any).seller_context?.seller_id as string | undefined;
  if (!sellerId) throw new MedusaError(MedusaError.Types.NOT_ALLOWED, "No seller selected");
  const all = await Promise.all(
    ["pending", "rejected", "suspended"].map((status) => listListings(req.scope, { status, sellerId }))
  );
  const seen = new Set<string>();
  const listings = all.flat().filter((l) => (seen.has(l.kind + l.id) ? false : (seen.add(l.kind + l.id), true)));
  res.json({ listings });
}
