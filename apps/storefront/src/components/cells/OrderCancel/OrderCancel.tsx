"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"

import { Button } from "@/components/atoms"
import { Modal } from "@/components/molecules"
import { cancelOrder } from "@/lib/data/orders"

/**
 * Cancel this vendor's order. Allowed until the vendor packs it; the customer
 * and the vendor both get an email (and the customer an in-store message).
 */
export const OrderCancel = ({ order }: { order: any }) => {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [error, setError] = useState<string>()
  const [pending, start] = useTransition()

  const confirm = () =>
    start(async () => {
      setError(undefined)
      const r = await cancelOrder(order.id)
      if (!r.ok) {
        setError(r.message)
        return
      }
      setOpen(false)
      router.refresh()
    })

  return (
    <>
      <div className="md:flex justify-between items-center">
        <div className="mb-4 md:mb-0">
          <h2 className="text-primary label-lg uppercase">Cancel order</h2>
          <p className="text-secondary label-md max-w-sm">
            You can cancel until {order.seller?.name || "the seller"} starts packing it.
          </p>
        </div>
        <Button
          variant="tonal"
          className="uppercase"
          onClick={() => setOpen(true)}
          data-testid="order-cancel-button"
        >
          Cancel order
        </Button>
      </div>
      {open && (
        <Modal heading="Cancel this order?" onClose={() => setOpen(false)}>
          <div className="px-4 space-y-4">
            <p className="label-md text-secondary">
              All {order.items?.length ?? ""} item(s) from {order.seller?.name || "this seller"} will be
              cancelled. Orders from other sellers in the same checkout are not affected. If you paid
              already, the refund is handled by the seller.
            </p>
            {error && (
              <p className="label-md text-negative" data-testid="order-cancel-error">
                {error}
              </p>
            )}
            <div className="flex gap-2">
              <Button variant="tonal" className="w-full uppercase" onClick={() => setOpen(false)} disabled={pending}>
                Keep order
              </Button>
              <Button className="w-full uppercase" onClick={confirm} disabled={pending} data-testid="order-cancel-confirm">
                {pending ? "Cancelling…" : "Yes, cancel"}
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </>
  )
}
