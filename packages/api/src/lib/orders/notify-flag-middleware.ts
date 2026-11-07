import type { MedusaNextFunction, MedusaRequest, MedusaResponse } from "@medusajs/framework/http";

/**
 * POST /vendor/orders/:id/fulfillments — carry the vendor's "Notify customer"
 * choice (`no_notification`) past Mercur's body validation, which would drop
 * it, by moving it into `additional_data` (which the route passes on).
 */
export function vendorFulfillmentNotifyFlag(req: MedusaRequest, _res: MedusaResponse, next: MedusaNextFunction) {
  if (!/^\/vendor\/orders\/[^/]+\/fulfillments\/?$/.test(req.path)) return next();
  const body = (req.body ?? {}) as Record<string, unknown>;
  if (typeof body.no_notification === "boolean") {
    body.additional_data = { ...((body.additional_data as Record<string, unknown>) ?? {}), no_notification: body.no_notification };
    delete body.no_notification;
  }
  return next();
}
