import type { SubscriberArgs, SubscriberConfig } from "@medusajs/framework";
import { notifySellerSignedUp } from "../lib/notifications/vendor-account";

/** A vendor signed up (or the admin created a store) → welcome email, and an alert to the onboarding team. */
export default async function vendorSignedUpNotify({ event, container }: SubscriberArgs<{ id: string } | { id: string }[]>) {
  const items = Array.isArray(event.data) ? event.data : [event.data];
  for (const d of items) if (d?.id) await notifySellerSignedUp(container, d.id);
}

export const config: SubscriberConfig = { event: "seller.created" };
