import type { SubscriberArgs, SubscriberConfig } from "@medusajs/framework";
import { notifyOrderGroupReceived, notifyVendorNewOrder } from "../lib/notifications/order-updates";

/**
 * Checkout done:
 *  - order_group.created → one "We've received your order" email + in-store
 *    message to the customer (covers every vendor in the checkout);
 *  - order.placed (one per vendor) → "New order" email to that vendor.
 */
export default async function orderPlacedNotify({ event, container }: SubscriberArgs<{ id: string }>) {
  const id = event.data?.id;
  if (!id) return;
  if (event.name === "order_group.created") await notifyOrderGroupReceived(container, id);
  else await notifyVendorNewOrder(container, id);
}

export const config: SubscriberConfig = { event: ["order_group.created", "order.placed"] };
