import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { ContainerRegistrationKeys, MedusaError } from "@medusajs/framework/utils";
import { rangeProblems, readRanges } from "../../../../lib/sales/quantity-prices";
import { revalidateStorefront } from "../../../../lib/storefront-cache";

/**
 * POST /vendor/quantity-prices/:offer_id
 *   { quantity_prices: [{ min_quantity: 1, max_quantity: 3, unit_price: 10 }, { min_quantity: 4, max_quantity: null, unit_price: 9 }] }
 * Saves (or, with an empty list, removes) the quantity prices on one of this vendor's listings.
 */
export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const sellerId = (req as any).seller_context?.seller_id as string | undefined;
  if (!sellerId) throw new MedusaError(MedusaError.Types.NOT_ALLOWED, "No seller selected");
  const raw = (req.body as { quantity_prices?: unknown } | undefined)?.quantity_prices;
  if (!Array.isArray(raw)) throw new MedusaError(MedusaError.Types.INVALID_DATA, "quantity_prices must be a list");
  const problems = rangeProblems(raw);
  if (problems.length) throw new MedusaError(MedusaError.Types.INVALID_DATA, problems.join(" "));
  const ranges = readRanges({ quantity_prices: raw });

  const k = req.scope.resolve(ContainerRegistrationKeys.PG_CONNECTION);
  const offer = await k("offer").where({ id: req.params.offer_id, seller_id: sellerId }).whereNull("deleted_at").first("id", "metadata");
  if (!offer) throw new MedusaError(MedusaError.Types.NOT_FOUND, "Listing not found");

  const metadata = { ...(offer.metadata ?? {}) };
  if (ranges.length) metadata.quantity_prices = ranges;
  else delete metadata.quantity_prices;
  await k("offer").where({ id: offer.id }).update({ metadata: JSON.stringify(metadata), updated_at: k.fn.now() });

  await revalidateStorefront(["offers", "products"]).catch(() => undefined);
  res.json({ id: offer.id, quantity_prices: ranges });
}
