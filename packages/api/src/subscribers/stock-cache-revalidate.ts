import type { SubscriberArgs, SubscriberConfig } from "@medusajs/framework";
import { InventoryEvents } from "@medusajs/framework/utils";
import { revalidateStorefront } from "../lib/storefront-cache";

/**
 * The shop caches each offer's stock. Changing stock in Inventory (or an order
 * reserving it) changes an inventory level, not the offer, so the shop kept
 * showing the old count, e.g. "Out of stock" after stock was added.
 * Refresh the shop's offers whenever stock changes.
 */
export default async function stockCacheRevalidate(_: SubscriberArgs<unknown>) {
  await revalidateStorefront(["offers", "products"]);
}

export const config: SubscriberConfig = {
  event: [
    InventoryEvents.INVENTORY_LEVEL_CREATED,
    InventoryEvents.INVENTORY_LEVEL_UPDATED,
    InventoryEvents.INVENTORY_LEVEL_DELETED,
    InventoryEvents.RESERVATION_ITEM_CREATED,
    InventoryEvents.RESERVATION_ITEM_UPDATED,
    InventoryEvents.RESERVATION_ITEM_DELETED,
  ],
  context: { subscriberId: "stock-cache-revalidate" },
};
