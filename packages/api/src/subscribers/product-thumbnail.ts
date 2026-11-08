import type { SubscriberArgs, SubscriberConfig } from "@medusajs/framework";
import { ensureThumbnails } from "../lib/catalog/thumbnails";

/** A product with images but no main image gets its first image as the main image. */
export default async function productThumbnail({ event, container }: SubscriberArgs<{ id: string } | { id: string }[]>) {
  const ids = (Array.isArray(event.data) ? event.data : [event.data]).map((d) => d?.id).filter(Boolean) as string[];
  if (ids.length) await ensureThumbnails(container, ids);
}

export const config: SubscriberConfig = { event: ["product.created", "product.updated"] };
