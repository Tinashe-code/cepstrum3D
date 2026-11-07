import { StepResponse } from "@medusajs/framework/workflows-sdk";
import { Modules } from "@medusajs/framework/utils";
import { createOrderFulfillmentWorkflow } from "@mercurjs/core/workflows";

/**
 * The vendor's "Notify customer" switch on Create fulfilment.
 *
 * Mercur's vendor route doesn't accept `no_notification`, so a middleware moves
 * it into `additional_data` (lib/orders/notify-flag-middleware.ts). Here it's
 * saved on the fulfilment so the notification subscriber can honour it.
 */
createOrderFulfillmentWorkflow.hooks.fulfillmentCreated(async ({ fulfillment, additional_data }, { container }) => {
  const noNotification = (additional_data as Record<string, unknown> | undefined)?.no_notification;
  if (noNotification !== true || !fulfillment?.id) return new StepResponse(undefined);

  const fulfillments = container.resolve(Modules.FULFILLMENT);
  await fulfillments.updateFulfillment(fulfillment.id, {
    metadata: { ...(fulfillment.metadata ?? {}), no_notification: true },
  });
  return new StepResponse(undefined);
});
