import type { SubscriberArgs, SubscriberConfig } from "@medusajs/framework";
import { notifySellerApproved } from "../lib/notifications/vendor-account";

/** The admin approved a vendor's store → tell the vendor they can start listing. */
export default async function vendorApprovedNotify({ event, container }: SubscriberArgs<{ id: string } | { id: string }[]>) {
  const items = Array.isArray(event.data) ? event.data : [event.data];
  for (const d of items) if (d?.id) await notifySellerApproved(container, d.id);
}

export const config: SubscriberConfig = { event: "seller.approved" };
