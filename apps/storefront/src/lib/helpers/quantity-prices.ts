/**
 * Quantity price ranges set by vendors ("1–3: $10 each, 4 and above: $9 each"),
 * stored on the offer as metadata.quantity_prices. Same rules as the backend
 * (lib/sales/quantity-prices.ts), which is what actually charges the customer;
 * this copy is for display only.
 */

export type QuantityRange = { min_quantity: number; max_quantity: number | null; unit_price: number }

export function readQuantityRanges(metadata: unknown): QuantityRange[] {
  const raw = (metadata as { quantity_prices?: unknown } | null | undefined)?.quantity_prices
  if (!Array.isArray(raw)) return []
  return raw
    .map((t) => ({
      min_quantity: Number(t?.min_quantity),
      max_quantity: t?.max_quantity == null ? null : Number(t.max_quantity),
      unit_price: Number(t?.unit_price),
    }))
    .filter((r) => Number.isInteger(r.min_quantity) && r.min_quantity >= 1 && r.unit_price > 0)
    .sort((a, b) => a.min_quantity - b.min_quantity)
}

/** Price per item for `qty`: the matching range, else the normal price. */
export function unitPriceFor(qty: number, regular: number, ranges: QuantityRange[]) {
  const r = ranges.find((x) => qty >= x.min_quantity && (x.max_quantity === null || qty <= x.max_quantity))
  return r ? r.unit_price : regular
}

/** Rows to show, starting at 1 (quantities before the first range pay the normal price). */
export function priceTable(regular: number, ranges: QuantityRange[]) {
  if (!ranges.length) return []
  const rows = [...ranges]
  if (rows[0].min_quantity > 1) rows.unshift({ min_quantity: 1, max_quantity: rows[0].min_quantity - 1, unit_price: regular })
  return rows
}

export const rangeLabel = (r: QuantityRange) =>
  r.max_quantity === null
    ? `${r.min_quantity}+`
    : r.max_quantity === r.min_quantity
    ? `${r.min_quantity}`
    : `${r.min_quantity}–${r.max_quantity}`
