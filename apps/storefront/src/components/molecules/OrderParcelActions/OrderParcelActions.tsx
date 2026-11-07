import { OrderCancel } from "@/components/cells/OrderCancel/OrderCancel"
import { OrderReturn } from "@/components/cells/OrderReturn/OrderReturn"
import { OrderTrack } from "@/components/cells/OrderTrack/OrderTrack"

export const OrderParcelActions = ({ order }: { order: any }) => {
  if (order.status === "canceled")
    return <p className="label-md text-secondary" data-testid="order-canceled-note">This order was cancelled.</p>

  if (order.fulfillment_status === "delivered")
    return <OrderReturn order={order} />

  if (order.fulfillment_status === "shipped")
    return <OrderTrack order={order} />

  // Not packed yet → the customer can still cancel.
  if (order.fulfillment_status === "not_fulfilled")
    return <OrderCancel order={order} />

  return null
}
