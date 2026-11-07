import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { ContainerRegistrationKeys, MedusaError, Modules } from "@medusajs/framework/utils";
import { cancelOrderWorkflow } from "@medusajs/medusa/core-flows";
import { fulfillmentStatusOf } from "../../../../../lib/orders/fulfillment-filter";

/**
 * POST /store/orders/:id/cancel — the signed-in customer cancels one vendor
 * order, allowed until the vendor packs it. The vendor and the customer get an
 * email (subscribers/order-canceled-notify.ts).
 */
export async function POST(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY);
  const customerId = req.auth_context.actor_id;

  const [{ data: orders }, { data: customers }] = await Promise.all([
    query.graph({
      entity: "order",
      fields: [
        "id",
        "status",
        "email",
        "customer_id",
        "metadata",
        "items.raw_quantity",
        "items.detail.raw_fulfilled_quantity",
        "fulfillments.packed_at",
        "fulfillments.shipped_at",
        "fulfillments.delivered_at",
        "fulfillments.canceled_at",
      ],
      filters: { id: req.params.id },
    }),
    query.graph({ entity: "customer", fields: ["id", "email"], filters: { id: customerId } }),
  ]);
  const order = orders[0] as any;
  const me = customers[0] as { email?: string } | undefined;
  const owns =
    order &&
    (order.customer_id === customerId ||
      (me?.email && order.email && me.email.toLowerCase() === String(order.email).toLowerCase()));
  if (!owns) throw new MedusaError(MedusaError.Types.NOT_FOUND, "Order not found");
  if (order.status === "canceled") throw new MedusaError(MedusaError.Types.NOT_ALLOWED, "This order is already cancelled.");
  if (fulfillmentStatusOf(order) !== "not_fulfilled") {
    throw new MedusaError(
      MedusaError.Types.NOT_ALLOWED,
      "The vendor has already packed this order, so it can't be cancelled here. Please contact the vendor."
    );
  }

  // Remembered so the emails can say "cancelled by the customer".
  await req.scope.resolve(Modules.ORDER).updateOrders([{ id: order.id, metadata: { ...(order.metadata ?? {}), canceled_by: "customer" } }]);
  await cancelOrderWorkflow(req.scope).run({ input: { order_id: order.id, canceled_by: customerId } });
  res.json({ id: order.id, status: "canceled" });
}
