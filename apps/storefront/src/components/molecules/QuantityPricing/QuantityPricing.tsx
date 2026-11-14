"use client"

import { convertToLocale } from "@/lib/helpers/money"
import { QuantityRange, rangeLabel, unitPriceFor } from "@/lib/helpers/quantity-prices"
import { cn } from "@/lib/utils"

/**
 * Product page: the vendor's price-per-quantity table ("1–3: $10 each, 4+: $9 each")
 * and a quantity picker. The row that applies to the chosen quantity is highlighted.
 */
export function QuantityPricing({
  rows,
  regular,
  ranges,
  quantity,
  onQuantity,
  max,
  currency,
}: {
  rows: QuantityRange[]
  regular: number
  ranges: QuantityRange[]
  quantity: number
  onQuantity: (q: number) => void
  /** Most that can still go into the cart (stock minus what's already there). */
  max: number
  currency: string
}) {
  const money = (n: number) => convertToLocale({ amount: n, currency_code: currency })
  const unit = unitPriceFor(quantity, regular, ranges)
  const saving = (regular - unit) * quantity
  const set = (q: number) => onQuantity(Math.min(Math.max(1, q), Math.max(1, max)))

  return (
    <div className="mb-4" data-testid="quantity-pricing">
      <p className="label-md text-primary mb-2 font-bold">Buy more, pay less per item</p>
      <div className="rounded-sm border divide-y">
        {rows.map((r) => {
          const active = quantity >= r.min_quantity && (r.max_quantity === null || quantity <= r.max_quantity)
          return (
            <button
              key={r.min_quantity}
              type="button"
              onClick={() => set(r.min_quantity)}
              disabled={r.min_quantity > max}
              className={cn(
                "flex w-full items-center justify-between px-3 py-2 text-left",
                active && "bg-[#fff7ed]",
                r.min_quantity > max && "opacity-50 cursor-not-allowed"
              )}
              data-testid={`quantity-price-${r.min_quantity}`}
            >
              <span className={cn("label-md text-primary", active && "font-bold")}>
                {rangeLabel(r)} {r.max_quantity === r.min_quantity && r.min_quantity === 1 ? "item" : "items"}
              </span>
              <span className={cn("label-md", active ? "font-bold text-[#ea580c]" : "text-primary")}>
                {money(r.unit_price)} each
              </span>
            </button>
          )
        })}
      </div>
      <div className="mt-3 flex items-center gap-3">
        <span className="label-md text-secondary">Quantity</span>
        <div className="flex items-center rounded-sm border">
          <button type="button" aria-label="Fewer" className="px-3 py-1 label-lg" onClick={() => set(quantity - 1)} disabled={quantity <= 1}>
            −
          </button>
          <input
            aria-label="Quantity"
            className="w-12 text-center label-md outline-none"
            inputMode="numeric"
            value={quantity}
            onChange={(e) => set(Number(e.target.value.replace(/\D/g, "")) || 1)}
          />
          <button type="button" aria-label="More" className="px-3 py-1 label-lg" onClick={() => set(quantity + 1)} disabled={quantity >= max}>
            +
          </button>
        </div>
        <span className="label-md text-primary">
          {money(unit)} each · <b>{money(unit * quantity)}</b>
        </span>
      </div>
      {saving > 0.004 && (
        <p className="mt-1 text-[13px] font-bold text-[#15803d]" data-testid="quantity-pricing-saving">
          You save {money(saving)}
        </p>
      )}
    </div>
  )
}
