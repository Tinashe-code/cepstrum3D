import type { SubscriberArgs, SubscriberConfig } from "@medusajs/framework";
import { holdNewOffers } from "../lib/listings/status";

/** A vendor listing an already-live product waits for admin approval. */
export default async function offerCreatedListing({ event, container }: SubscriberArgs<unknown>) {
  const d = event.data as any;
  const ids: string[] = (Array.isArray(d) ? d : Array.isArray(d?.ids) ? d.ids : [d])
    .map((x: any) => (typeof x === "string" ? x : x?.id))
    .filter(Boolean);
  if (ids.length) await holdNewOffers(container, ids);
}

export const config: SubscriberConfig = { event: "offer.created" };
