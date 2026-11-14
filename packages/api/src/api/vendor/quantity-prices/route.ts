import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { ContainerRegistrationKeys, MedusaError } from "@medusajs/framework/utils";
import { readRanges } from "../../../lib/sales/quantity-prices";

/** GET /vendor/quantity-prices: this vendor's listings, their normal price, stock and quantity price ranges. */
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const sellerId = (req as any).seller_context?.seller_id as string | undefined;
  if (!sellerId) throw new MedusaError(MedusaError.Types.NOT_ALLOWED, "No seller selected");
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY);
  const { data } = await query.graph({
    entity: "offer",
    fields: [
      "id", "sku", "metadata",
      "product.title", "product_variant.title",
      "prices.amount", "prices.currency_code", "prices.min_quantity",
      "inventory_item_link.required_quantity",
      "inventory_item_link.inventory_item.location_levels.stocked_quantity",
      "inventory_item_link.inventory_item.location_levels.reserved_quantity",
    ],
    filters: { seller_id: sellerId },
    pagination: { take: 1000, order: { created_at: "DESC" } },
  });
  const listings = (data as any[]).map((o) => {
    const price = (o.prices ?? []).find((p: any) => !p?.min_quantity || Number(p.min_quantity) <= 1);
    const link = (o.inventory_item_link ?? [])[0];
    const levels = link?.inventory_item?.location_levels ?? [];
    const available = levels.reduce((s: number, l: any) => s + Number(l?.stocked_quantity ?? 0) - Number(l?.reserved_quantity ?? 0), 0);
    return {
      id: o.id,
      sku: o.sku,
      product_title: o.product?.title ?? "",
      variant_title: o.product_variant?.title ?? "",
      price: price ? Number(price.amount) : null,
      currency_code: price?.currency_code ?? "usd",
      stock: Math.floor(available / Number(link?.required_quantity ?? 1)),
      quantity_prices: readRanges(o.metadata),
    };
  });
  res.json({ listings });
}
