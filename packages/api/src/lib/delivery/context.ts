import type { MedusaContainer } from "@medusajs/framework/types";
import { ContainerRegistrationKeys } from "@medusajs/framework/utils";
import { LegItem, readFreeDeliveryRule } from "./rules";

/**
 * Everything the delivery price needs that the fulfillment provider can't look
 * up itself: which cart items each vendor (stock location) delivers, each
 * product's free-delivery rule, and the value of the goods in the whole cart.
 * Passed to the provider through the `setCalculatedShippingPricingContext` hook.
 */
export type DeliveryContext = {
  goods_total: number;
  legs: Record<string, { seller_id: string; items: LegItem[] }>;
};

export const DELIVERY_CONTEXT_KEY = "cepstrum_delivery";

type CartRow = {
  items?: {
    quantity: number;
    unit_price: number;
    product_id: string;
    product_title?: string;
    product?: { metadata?: Record<string, unknown> | null } | null;
    offer?: { seller_id?: string } | null;
  }[];
};

export async function buildDeliveryContext(container: MedusaContainer, cartId: string): Promise<DeliveryContext> {
  const query = container.resolve(ContainerRegistrationKeys.QUERY);

  const { data } = await query.graph({
    entity: "cart",
    fields: [
      "items.quantity",
      "items.unit_price",
      "items.product_id",
      "items.product_title",
      "items.product.metadata",
      "items.offer.seller_id",
    ],
    filters: { id: cartId },
  });
  const items = (data[0] as CartRow | undefined)?.items ?? [];

  const goods_total = items.reduce((sum, i) => sum + Number(i.unit_price) * Number(i.quantity), 0);

  const sellerIds = [...new Set(items.map((i) => i.offer?.seller_id).filter(Boolean))] as string[];
  const legs: DeliveryContext["legs"] = {};
  if (!sellerIds.length) return { goods_total, legs };

  const { data: links } = await query.graph({
    entity: "stock_location_seller",
    fields: ["seller_id", "stock_location_id"],
    filters: { seller_id: sellerIds },
  });

  for (const link of links as { seller_id: string; stock_location_id: string }[]) {
    legs[link.stock_location_id] = {
      seller_id: link.seller_id,
      items: items
        .filter((i) => i.offer?.seller_id === link.seller_id)
        .map((i) => ({
          product_id: i.product_id,
          title: i.product_title ?? "",
          quantity: Number(i.quantity),
          rule: readFreeDeliveryRule(i.product?.metadata),
        })),
    };
  }

  return { goods_total, legs };
}
