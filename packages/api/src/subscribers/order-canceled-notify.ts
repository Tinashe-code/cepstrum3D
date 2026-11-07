import type { SubscriberArgs, SubscriberConfig } from "@medusajs/framework";
import { notifyOrderCanceled } from "../lib/notifications/order-updates";

/** Order cancelled (by the customer, a vendor or the admin) → email the customer and the vendor. */
export default async function orderCanceledNotify({ event, container }: SubscriberArgs<{ id: string }>) {
  if (event.data?.id) await notifyOrderCanceled(container, event.data.id);
}

export const config: SubscriberConfig = { event: "order.canceled" };
