import type { MedusaNextFunction, MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { ContainerRegistrationKeys, MedusaError } from "@medusajs/framework/utils";
import { refreshCartItemsWorkflow } from "@medusajs/medusa/core-flows";
import { liveSaleLimitsForOffers } from "./sale-limits";

/**
 * POST /store/carts/:id/complete — if another shopper bought the last sale
 * units after this cart was priced, re-price the cart (the line falls back to
 * the normal price) and ask the customer to check it before placing the order.
 */
export async function guardSaleLimits(req: MedusaRequest, _res: MedusaResponse, next: MedusaNextFunction) {
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY);
  const { data } = await query.graph({
    entity: "cart",
    fields: ["id", "items.quantity", "items.unit_price", "items.product_title", "items.variant_title", "items.metadata"],
    filters: { id: req.params.id },
  });
  const items = ((data[0] as { items?: { quantity: number; unit_price: number; product_title?: string; variant_title?: string; metadata?: Record<string, unknown> }[] })?.items ?? [])
    .filter((i) => i.metadata?.offer_id);
  if (!items.length) return next();

  const live = await liveSaleLimitsForOffers(req.scope, items.map((i) => String(i.metadata!.offer_id)));
  const over = items.filter((i) => {
    const sale = live[String(i.metadata!.offer_id)];
    return sale && Math.abs(Number(i.unit_price) - sale.price) < 0.0001 && i.quantity > sale.remaining;
  });
  if (!over.length) return next();

  await refreshCartItemsWorkflow(req.scope).run({ input: { cart_id: req.params.id, force_refresh: true } as never });
  const names = over
    .map((i) => {
      const left = live[String(i.metadata!.offer_id)].remaining;
      return `${i.product_title}${i.variant_title ? ` (${i.variant_title})` : ""}: ${left ? `only ${left} left` : "sold out"} at the sale price`;
    })
    .join("; ");
  return next(
    new MedusaError(
      MedusaError.Types.NOT_ALLOWED,
      `Prices in your cart changed — ${names}. Please check your cart and place the order again.`
    )
  );
}
