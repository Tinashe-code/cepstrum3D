import type { SubscriberArgs, SubscriberConfig } from "@medusajs/framework";
import { ContainerRegistrationKeys } from "@medusajs/framework/utils";
import { recordSaleQuantities } from "../lib/sales/sale-limits";

/** Count units sold at a limited sale price; ends that variant's sale when its quantity runs out. */
export default async function saleLimitCount({ event, container }: SubscriberArgs<{ id: string }>) {
  if (!event.data?.id) return;
  try {
    await recordSaleQuantities(container, event.data.id);
  } catch (e) {
    container.resolve(ContainerRegistrationKeys.LOGGER).error(`sale-limit count failed for ${event.data.id}: ${(e as Error).message}`);
  }
}

export const config: SubscriberConfig = { event: "order.placed" };
