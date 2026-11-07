/**
 * Fills `variants[].offer_id` when the winning price is a sale (price list) price.
 *
 * Mercur sets each variant's `offer_id` (the best offer, used for "add to cart") by
 * matching the winning price id against the offer's own prices. A sale price lives on a
 * price list, so it never matches and `offer_id` comes back null — which would make
 * discounted products impossible to add to cart from a product card.
 *
 * Our sale prices carry an `offer_id` price rule (see setup-demo-discounts.ts and vendor
 * price lists), so we read that rule from the winning price and fill the gap.
 */
import type { MedusaNextFunction, MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { Modules } from "@medusajs/framework/utils";

type Variant = {
  offer_id?: string | null;
  calculated_price?: { calculated_price?: { id?: string | null; price_list_id?: string | null } | null } | null;
};
type Product = { variants?: Variant[] | null };

async function fill(req: MedusaRequest, body: unknown) {
  const products: Product[] = Array.isArray((body as { products?: Product[] })?.products)
    ? (body as { products: Product[] }).products
    : (body as { product?: Product })?.product
      ? [(body as { product: Product }).product]
      : [];

  const missing = new Map<string, Variant[]>();
  for (const p of products) {
    for (const v of p.variants ?? []) {
      const price = v.calculated_price?.calculated_price;
      if (!v.offer_id && price?.id && price.price_list_id) {
        const list = missing.get(price.id) ?? [];
        list.push(v);
        missing.set(price.id, list);
      }
    }
  }
  if (!missing.size) return;

  const pricing = req.scope.resolve(Modules.PRICING);
  const prices = await pricing.listPrices(
    { id: [...missing.keys()] },
    { relations: ["price_rules"] }
  );
  for (const price of prices) {
    const offerId = (price.price_rules ?? []).find((r) => r.attribute === "offer_id")?.value;
    if (!offerId) continue;
    for (const v of missing.get(price.id) ?? []) {
      v.offer_id = String(offerId);
    }
  }
}

export function fillSaleOfferIds(req: MedusaRequest, res: MedusaResponse, next: MedusaNextFunction) {
  const json = res.json.bind(res);
  res.json = ((body: unknown) => {
    fill(req, body)
      .catch(() => undefined) // never break product reads over this
      .finally(() => json(body));
    return res;
  }) as typeof res.json;
  next();
}
