import type { SubscriberArgs, SubscriberConfig } from "@medusajs/framework";
import { linkAllSellersToCategories } from "../lib/catalog/category-sellers";

/**
 * Keep every store on every category's allowlist: a new category gets all
 * stores, a newly created or approved store gets all categories.
 * (See lib/catalog/category-sellers.ts for why.)
 */
export default async function categorySellerAllowlist({ event, container }: SubscriberArgs<{ id: string }>) {
  const id = event.data?.id;
  if (!id) return;
  if (event.name.startsWith("product-category.")) {
    await linkAllSellersToCategories(container, { categoryIds: [id] });
  } else {
    await linkAllSellersToCategories(container, { sellerIds: [id] });
  }
}

export const config: SubscriberConfig = {
  event: ["product-category.created", "seller.created", "seller.approved"],
};
