import { useEffect, useMemo, useState } from "react"
import { Badge, Button, Container, Heading, Input, Text } from "@medusajs/ui"
import { Tag } from "@medusajs/icons"
import type { RouteConfig } from "@mercurjs/dashboard-sdk"
import { getAuthHeaders } from "@mercurjs/vendor"
declare const __BACKEND_URL__: string

export const config: RouteConfig = {
  label: "Quantity prices",
  icon: Tag,
}

type Range = { min_quantity: number; max_quantity: number | null; unit_price: number }
type Listing = {
  id: string
  sku: string
  product_title: string
  variant_title: string
  price: number | null
  currency_code: string
  stock: number
  quantity_prices: Range[]
}
type Row = { from: string; to: string; price: string }

const money = (n: number, c = "usd") => (c.toLowerCase() === "usd" ? `$${n.toFixed(2)}` : `${n.toFixed(2)} ${c.toUpperCase()}`)
const label = (r: Range) =>
  r.max_quantity === null ? `${r.min_quantity}+` : r.max_quantity === r.min_quantity ? `${r.min_quantity}` : `${r.min_quantity}–${r.max_quantity}`
const api = (path: string, init?: RequestInit) =>
  fetch(`${__BACKEND_URL__}${path}`, {
    ...init,
    headers: { "content-type": "application/json", ...getAuthHeaders(), ...(init?.headers ?? {}) },
  }).then(async (r) => {
    const body = await r.json().catch(() => ({}))
    if (!r.ok) throw new Error(body?.message || `Request failed (${r.status})`)
    return body
  })

/** Editor for one listing's quantity price ranges. */
function RangeEditor({ listing, onSaved }: { listing: Listing; onSaved: (ranges: Range[]) => void }) {
  const [rows, setRows] = useState<Row[]>(
    listing.quantity_prices.length
      ? listing.quantity_prices.map((r) => ({ from: String(r.min_quantity), to: r.max_quantity == null ? "" : String(r.max_quantity), price: String(r.unit_price) }))
      : [{ from: "1", to: "", price: listing.price != null ? String(listing.price) : "" }]
  )
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)

  const save = async (ranges: Range[]) => {
    setSaving(true)
    setMsg(null)
    try {
      const r = await api(`/vendor/quantity-prices/${listing.id}`, { method: "POST", body: JSON.stringify({ quantity_prices: ranges }) })
      onSaved(r.quantity_prices)
      setMsg({ ok: true, text: ranges.length ? "Saved. Customers see these prices now." : "Quantity prices removed." })
    } catch (e) {
      setMsg({ ok: false, text: (e as Error).message })
    } finally {
      setSaving(false)
    }
  }

  const ranges: Range[] = rows
    .filter((r) => r.from.trim() && r.price.trim())
    .map((r) => ({ min_quantity: Number(r.from), max_quantity: r.to.trim() ? Number(r.to) : null, unit_price: Number(r.price) }))
  const set = (i: number, patch: Partial<Row>) => setRows(rows.map((x, j) => (j === i ? { ...x, ...patch } : x)))
  // Next row starts after the previous one ends.
  const nextFrom = () => {
    const last = rows[rows.length - 1]
    return last?.to.trim() ? String(Number(last.to) + 1) : ""
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 12 }}>
      <Text size="xsmall" className="text-ui-fg-subtle">
        Normal price: {listing.price == null ? "-" : money(listing.price, listing.currency_code)} each. Set a price per item for each
        quantity range. Leave "to" empty for "and above". Quantities outside every range pay the normal price.
      </Text>
      {rows.map((r, i) => (
        <div key={i} className="flex flex-wrap items-center gap-2">
          <Text size="small">From</Text>
          <div style={{ width: 80 }}>
            <Input size="small" type="number" min={1} value={r.from} onChange={(e) => set(i, { from: e.target.value })} />
          </div>
          <Text size="small">to</Text>
          <div style={{ width: 80 }}>
            <Input size="small" type="number" min={1} placeholder="and up" value={r.to} onChange={(e) => set(i, { to: e.target.value })} />
          </div>
          <Text size="small">items:</Text>
          <div style={{ width: 110 }}>
            <Input size="small" type="number" min={0} step="0.01" placeholder="Price each" value={r.price} onChange={(e) => set(i, { price: e.target.value })} />
          </div>
          <Text size="small">each</Text>
          <Button size="small" variant="transparent" onClick={() => setRows(rows.filter((_, j) => j !== i))}>Remove</Button>
        </div>
      ))}
      <div className="flex flex-wrap items-center gap-2">
        <Button size="small" variant="secondary" onClick={() => setRows([...rows, { from: nextFrom(), to: "", price: "" }])}>Add range</Button>
        <Button size="small" isLoading={saving} onClick={() => save(ranges)}>Save prices</Button>
        {listing.quantity_prices.length > 0 && (
          <Button size="small" variant="danger" disabled={saving} onClick={() => { setRows([{ from: "1", to: "", price: "" }]); save([]) }}>
            Remove all
          </Button>
        )}
      </div>
      {msg && <Text size="small" className={msg.ok ? "text-ui-fg-subtle" : "text-ui-fg-error"}>{msg.text}</Text>}
    </div>
  )
}

/**
 * Vendor portal → Quantity prices: "1–3: $10 each, 4 and above: $9 each" on any listing.
 * Stock is still counted per item, so keep each listing's stock up to date.
 */
const QuantityPricesPage = () => {
  const [listings, setListings] = useState<Listing[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState("")
  const [open, setOpen] = useState<string | null>(null)

  useEffect(() => {
    api("/vendor/quantity-prices").then((r) => setListings(r.listings)).catch((e) => setError(e.message))
  }, [])

  const shown = useMemo(() => {
    const q = search.trim().toLowerCase()
    return (listings ?? []).filter((l) => !q || `${l.product_title} ${l.variant_title} ${l.sku}`.toLowerCase().includes(q))
  }, [listings, search])

  return (
    <Container className="divide-y p-0">
      <div className="px-6 py-4">
        <Heading>Quantity prices</Heading>
        <Text size="small" className="text-ui-fg-subtle">
          Charge less per item when customers buy more, for example 1–3 items at $10 each and 4 or more at $9 each. Customers
          see the price table on the product page and the cart charges the right price for their quantity. Stock is still
          counted per item: keep your stock levels up to date.
        </Text>
      </div>
      <div className="px-6 py-4">
        <div style={{ maxWidth: 360 }}>
          <Input size="small" type="search" placeholder="Search your listings" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
      </div>
      {error && <div className="px-6 py-4"><Text size="small" className="text-ui-fg-error">{error}</Text></div>}
      {!listings && !error && <div className="px-6 py-4"><Text size="small" className="text-ui-fg-subtle">Loading…</Text></div>}
      {listings && !shown.length && <div className="px-6 py-4"><Text size="small" className="text-ui-fg-subtle">No listings found.</Text></div>}
      {shown.map((l) => (
        <div key={l.id} className="px-6 py-4">
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex-1" style={{ minWidth: 220 }}>
              <Text size="small" weight="plus">{l.product_title}</Text>
              <Text size="xsmall" className="text-ui-fg-subtle">
                {l.variant_title} · {l.price == null ? "no price" : money(l.price, l.currency_code)} · {l.stock} in stock
              </Text>
            </div>
            {l.quantity_prices.length ? (
              <div className="flex flex-wrap gap-2">
                {l.quantity_prices.map((r) => (
                  <Badge key={r.min_quantity} size="2xsmall" color="green">{label(r)}: {money(r.unit_price, l.currency_code)}</Badge>
                ))}
              </div>
            ) : (
              <Text size="xsmall" className="text-ui-fg-muted">Normal price only</Text>
            )}
            <Button size="small" variant="secondary" onClick={() => setOpen(open === l.id ? null : l.id)}>
              {open === l.id ? "Close" : l.quantity_prices.length ? "Edit prices" : "Add quantity prices"}
            </Button>
          </div>
          {open === l.id && (
            <RangeEditor
              listing={l}
              onSaved={(ranges) => setListings((all) => (all ?? []).map((x) => (x.id === l.id ? { ...x, quantity_prices: ranges } : x)))}
            />
          )}
        </div>
      ))}
    </Container>
  )
}

export default QuantityPricesPage
