import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { ContainerRegistrationKeys } from "@medusajs/framework/utils";
import { buildDeliveryContext } from "../../../../../lib/delivery/context";
import { DeliveryQuoteError, quoteDelivery } from "../../../../../lib/delivery/quote";
import { orderThresholdLabel } from "../../../../../lib/delivery/rules";
import { getDeliverySettings } from "../../../../../lib/delivery/settings";

/**
 * GET /store/carts/:id/delivery-quote
 *
 * Per-vendor delivery breakdown for checkout: distance, price, or why it's
 * free — the same numbers the "Delivery" shipping option charges. Also how
 * much more the cart needs for store-wide free delivery.
 */
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY);
  const settings = getDeliverySettings();
  const cartId = req.params.id;

  const { data } = await query.graph({
    entity: "cart",
    fields: ["id", "shipping_address.*"],
    filters: { id: cartId },
  });
  const cart = data[0] as { shipping_address?: Record<string, unknown> | null } | undefined;
  if (!cart) {
    return res.status(404).json({ message: "Cart not found" });
  }

  const ctx = await buildDeliveryContext(req.scope, cartId);
  const locationIds = Object.keys(ctx.legs);
  const { data: locations } = locationIds.length
    ? await query.graph({
        entity: "stock_location",
        fields: ["id", "address.*"],
        filters: { id: locationIds },
      })
    : { data: [] as unknown[] };
  const { data: sellers } = locationIds.length
    ? await query.graph({
        entity: "seller",
        fields: ["id", "name"],
        filters: { id: [...new Set(Object.values(ctx.legs).map((l) => l.seller_id))] },
      })
    : { data: [] as unknown[] };

  const vendors = await Promise.all(
    (locations as { id: string; address?: Record<string, unknown> }[])
      .filter((loc) => ctx.legs[loc.id]?.items.length)
      .map(async (loc) => {
        const leg = ctx.legs[loc.id];
        const seller = (sellers as { id: string; name: string }[]).find((s) => s.id === leg.seller_id);
        const base = { seller_id: leg.seller_id, seller_name: seller?.name ?? "", from_city: loc.address?.city ?? "" };
        try {
          const quote = await quoteDelivery({
            from: (loc.address ?? {}) as never,
            to: cart.shipping_address as never,
            items: leg.items,
            goodsTotal: ctx.goods_total,
            settings,
          });
          return { ...base, ...quote };
        } catch (e) {
          if (e instanceof DeliveryQuoteError) return { ...base, error: e.message };
          throw e;
        }
      })
  );

  const remaining = settings.freeMinOrder > 0 ? Math.round(Math.max(0, settings.freeMinOrder - ctx.goods_total) * 100) / 100 : null;

  res.json({
    delivery_quote: {
      vendors,
      total: vendors.reduce((sum, v) => sum + (("amount" in v && v.amount) || 0), 0),
      goods_total: Math.round(ctx.goods_total * 100) / 100,
      free_order: {
        label: orderThresholdLabel(settings),
        min_order: settings.freeMinOrder,
        cities: settings.freeOrderCities,
        remaining,
      },
      rate: { base_fee: settings.baseFee, per_km: settings.perKm, min_fee: settings.minFee },
    },
  });
}
