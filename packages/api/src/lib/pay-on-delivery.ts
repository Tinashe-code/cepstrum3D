/**
 * Pay on delivery (POD) — shared rules.
 *
 * A product is POD-eligible when its global "Pay on delivery" toggle attribute
 * (handle `pay-on-delivery`) is set to true. Operators and vendors set it from the
 * product's attributes in the admin / vendor panels.
 *
 * A cart is POD-eligible only when EVERY line item's product is eligible. One
 * ineligible item makes the whole cart ineligible.
 */
import { MedusaContainer } from "@medusajs/framework/types";
import { ContainerRegistrationKeys } from "@medusajs/framework/utils";

export const POD_ATTRIBUTE_HANDLE = "pay-on-delivery";

/** Payment provider id: pp_<identifier>_<config id> (see medusa-config.ts). */
export const POD_PROVIDER_ID = "pp_pay-on-delivery_pay-on-delivery";

export const isPodProvider = (providerId?: string | null) => providerId === POD_PROVIDER_ID;

type AttributeValue = { name?: string | null; attribute?: { handle?: string | null } | null };

/** True when a product's attribute values include `pay-on-delivery = true`. */
export const isProductPodEligible = (attributeValues?: AttributeValue[] | null) =>
  (attributeValues ?? []).some(
    (v) => v?.attribute?.handle === POD_ATTRIBUTE_HANDLE && String(v?.name).toLowerCase() === "true"
  );

export type PodCartEligibility = {
  cart_id: string;
  eligible: boolean;
  /** Line items whose product is not eligible — show these to the shopper. */
  ineligible_items: { id: string; title: string; product_id: string | null }[];
};

export async function getCartPodEligibility(
  container: MedusaContainer,
  cartId: string
): Promise<PodCartEligibility> {
  const query = container.resolve(ContainerRegistrationKeys.QUERY);

  const { data: carts } = await query.graph({
    entity: "cart",
    fields: ["id", "items.id", "items.title", "items.product_title", "items.product_id"],
    filters: { id: cartId },
  });
  const cart = carts[0];
  if (!cart) {
    throw new Error(`Cart ${cartId} not found`);
  }

  const items = (cart.items ?? []).filter(Boolean) as {
    id: string;
    title?: string | null;
    product_title?: string | null;
    product_id?: string | null;
  }[];

  const productIds = [...new Set(items.map((i) => i.product_id).filter((id): id is string => !!id))];

  const eligibleProducts = new Set<string>();
  if (productIds.length) {
    const { data: products } = await query.graph({
      entity: "product",
      fields: ["id", "product_attribute_values.name", "product_attribute_values.attribute.handle"],
      filters: { id: productIds },
    });
    for (const p of products as { id: string; product_attribute_values?: AttributeValue[] }[]) {
      if (isProductPodEligible(p.product_attribute_values)) {
        eligibleProducts.add(p.id);
      }
    }
  }

  const ineligible_items = items
    .filter((i) => !i.product_id || !eligibleProducts.has(i.product_id))
    .map((i) => ({ id: i.id, title: i.product_title || i.title || "Item", product_id: i.product_id ?? null }));

  return {
    cart_id: cart.id,
    // An empty cart has nothing to deliver, so it isn't eligible either.
    eligible: items.length > 0 && ineligible_items.length === 0,
    ineligible_items,
  };
}

export const podIneligibleMessage = (e: PodCartEligibility) =>
  e.ineligible_items.length
    ? `Pay on delivery isn't available for this cart because these items require payment at checkout: ${e.ineligible_items
        .map((i) => i.title)
        .join(", ")}.`
    : "Pay on delivery isn't available for an empty cart.";
