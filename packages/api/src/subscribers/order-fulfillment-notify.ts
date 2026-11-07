import type { SubscriberArgs, SubscriberConfig } from "@medusajs/framework";
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils";
import { notifyOrderUpdate, OrderStage } from "../lib/notifications/order-updates";

type EventData = { order_id?: string; fulfillment_id?: string; id?: string; no_notification?: boolean };

const STAGE: Record<string, OrderStage> = {
  "order.fulfillment_created": "packed",
  "shipment.created": "shipped",
  "delivery.created": "delivered",
};

/**
 * Email + in-store message to the customer when an order is packed, shipped or
 * delivered. Respects "Notify customer": skipped when the event says
 * no_notification, or when the vendor turned it off on the fulfilment
 * (saved as fulfillment.metadata.no_notification by
 * workflows/hooks/fulfillment-notify-flag.ts).
 */
export default async function orderFulfillmentNotify({ event, container }: SubscriberArgs<EventData>) {
  const stage = STAGE[event.name];
  const data = event.data ?? {};
  if (!stage || data.no_notification === true) return;

  const fulfillmentId = data.fulfillment_id ?? data.id;
  if (!fulfillmentId) return;

  const fulfillmentModule = container.resolve(Modules.FULFILLMENT);
  const fulfillment = await fulfillmentModule.retrieveFulfillment(fulfillmentId).catch(() => null);
  if ((fulfillment?.metadata as Record<string, unknown> | null)?.no_notification === true) return;

  let orderId = data.order_id;
  if (!orderId) {
    const query = container.resolve(ContainerRegistrationKeys.QUERY);
    const { data: links } = await query.graph({
      entity: "order_fulfillment",
      fields: ["order_id"],
      filters: { fulfillment_id: fulfillmentId },
    });
    orderId = (links[0] as { order_id?: string } | undefined)?.order_id;
  }
  if (!orderId) return;

  await notifyOrderUpdate(container, { orderId, stage, fulfillmentId });
}

export const config: SubscriberConfig = {
  event: Object.keys(STAGE),
};
