import { useEffect, useMemo, useState } from "react"
import { Badge, Button, Container, Heading, Input, Text, toast } from "@medusajs/ui"
import { getAuthHeaders } from "@mercurjs/admin"

declare const __BACKEND_URL__: string

type Row = {
  offer_id: string
  product: string
  variant: string
  sku: string
  sale_price: number
  regular_price: number | null
  currency_code: string
  limit: number | null
  sold: number
  remaining: number | null
}

const pctOff = (r: Row) =>
  r.regular_price ? Math.round((1 - r.sale_price / r.regular_price) * 100) : null

const api = (id: string) => `${__BACKEND_URL__}/admin/price-lists/${id}/sale-limits`

/**
 * Price list → "Sale quantity per variant": how many units of each variant may
 * sell at this price list's price. When a variant's quantity is used up it goes
 * back to its normal price. Empty = no limit.
 * Backend: packages/api/src/lib/sales/sale-limits.ts
 */
export const SaleLimitsSection = ({ data }: { data?: unknown }) => {
  const priceListId = (data as { id?: string } | undefined)?.id
  const [rows, setRows] = useState<Row[]>([])
  const [draft, setDraft] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [filter, setFilter] = useState("")
  const [percent, setPercent] = useState("")
  const [applying, setApplying] = useState(false)

  const load = async () => {
    if (!priceListId) return
    setLoading(true)
    try {
      const res = await fetch(api(priceListId), { headers: getAuthHeaders() })
      const json = await res.json()
      setRows(json.rows ?? [])
      setDraft(Object.fromEntries((json.rows ?? []).map((r: Row) => [r.offer_id, r.limit === null ? "" : String(r.limit)])))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [priceListId])

  const changed = useMemo(
    () => rows.filter((r) => (r.limit === null ? "" : String(r.limit)) !== (draft[r.offer_id] ?? "")),
    [rows, draft]
  )

  const save = async () => {
    if (!priceListId || !changed.length) return
    setSaving(true)
    try {
      const limits = Object.fromEntries(
        changed.map((r) => {
          const v = (draft[r.offer_id] ?? "").trim()
          return [r.offer_id, v === "" ? null : Math.max(0, Math.floor(Number(v)))]
        })
      )
      const res = await fetch(api(priceListId), {
        method: "POST",
        headers: { ...getAuthHeaders(), "content-type": "application/json" },
        body: JSON.stringify({ limits }),
      })
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).message ?? "Save failed")
      const json = await res.json()
      setRows(json.rows ?? [])
      setDraft(Object.fromEntries((json.rows ?? []).map((r: Row) => [r.offer_id, r.limit === null ? "" : String(r.limit)])))
      toast.success("Sale quantities saved")
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setSaving(false)
    }
  }

  const applyPercent = async (offerIds: string[]) => {
    const value = Number(percent)
    if (!priceListId || !(value > 0 && value < 100)) {
      toast.error("Enter a percentage between 1 and 99")
      return
    }
    setApplying(true)
    try {
      const res = await fetch(`${api(priceListId).replace(/sale-limits$/, "percent-off")}`, {
        method: "POST",
        headers: { ...getAuthHeaders(), "content-type": "application/json" },
        body: JSON.stringify({ percent: value, offer_ids: offerIds }),
      })
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).message ?? "Could not apply")
      setRows(((await res.json()).rows ?? []) as Row[])
      toast.success(`${value}% off applied to ${offerIds.length} variant${offerIds.length === 1 ? "" : "s"}`)
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setApplying(false)
    }
  }

  const shown = rows.filter((r) =>
    `${r.product} ${r.variant} ${r.sku}`.toLowerCase().includes(filter.trim().toLowerCase())
  )

  return (
    <Container className="divide-y p-0" data-testid="sale-limits-section">
      <div className="flex items-start justify-between gap-4 px-6 py-4">
        <div>
          <Heading level="h2">Sale quantity per variant</Heading>
          <Text size="small" className="text-ui-fg-subtle mt-1">
            How many units of each variant can sell at this price. When they're sold, that variant goes back to its
            normal price. Leave empty for no limit. Use "% off" to set the sale prices from the normal prices —
            search first to apply it to one product or colour only.
          </Text>
        </div>
        <Button size="small" onClick={save} isLoading={saving} disabled={!changed.length} data-testid="sale-limits-save">
          Save{changed.length ? ` (${changed.length})` : ""}
        </Button>
      </div>
      <div className="flex flex-wrap items-center gap-2 px-6 py-3">
        <div className="min-w-[220px] flex-1">
          <Input
            size="small"
            placeholder="Search product, colour or SKU"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            data-testid="sale-limits-search"
          />
        </div>
        <div className="flex items-center gap-2">
          <Input
            size="small"
            type="number"
            min={1}
            max={99}
            placeholder="% off"
            className="w-24"
            value={percent}
            onChange={(e) => setPercent(e.target.value.replace(/[^\d.]/g, ""))}
            data-testid="sale-percent-input"
          />
          <Button
            size="small"
            variant="secondary"
            isLoading={applying}
            disabled={!shown.length || !percent}
            onClick={() => applyPercent(shown.map((r) => r.offer_id))}
            data-testid="sale-percent-apply"
          >
            Set {percent ? `${percent}% off` : "% off"} for {filter ? `${shown.length} listed` : "all"}
          </Button>
        </div>
      </div>
      {loading ? (
        <Text size="small" className="text-ui-fg-subtle px-6 py-4">Loading…</Text>
      ) : !rows.length ? (
        <Text size="small" className="text-ui-fg-subtle px-6 py-4">Add products to this price list first.</Text>
      ) : (
        <div className="max-h-[480px] overflow-auto">
          <table className="w-full text-left">
            <thead className="bg-ui-bg-subtle txt-compact-small-plus text-ui-fg-subtle sticky top-0">
              <tr>
                <th className="px-6 py-2">Product</th>
                <th className="px-3 py-2">Variant</th>
                <th className="px-3 py-2 text-right">Normal</th>
                <th className="px-3 py-2 text-right">Sale price</th>
                <th className="px-3 py-2 text-right">Sold</th>
                <th className="px-3 py-2">Sale quantity</th>
                <th className="px-6 py-2">Left</th>
              </tr>
            </thead>
            <tbody className="txt-compact-small divide-y">
              {shown.map((r) => (
                <tr key={r.offer_id} data-testid="sale-limit-row">
                  <td className="px-6 py-2">{r.product}</td>
                  <td className="px-3 py-2">{r.variant}</td>
                  <td className="px-3 py-2 text-right text-ui-fg-subtle">
                    {r.regular_price === null ? "—" : r.regular_price.toFixed(2)}
                  </td>
                  <td className="px-3 py-2 text-right">
                    {r.sale_price.toFixed(2)} {r.currency_code.toUpperCase()}
                    {pctOff(r) !== null && pctOff(r)! > 0 && (
                      <span className="text-ui-fg-subtle block text-[11px]">-{pctOff(r)}%</span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-right">{r.sold}</td>
                  <td className="px-3 py-2">
                    <Input
                      size="small"
                      type="number"
                      min={0}
                      step={1}
                      placeholder="No limit"
                      className="w-28"
                      value={draft[r.offer_id] ?? ""}
                      onChange={(e) => setDraft((d) => ({ ...d, [r.offer_id]: e.target.value.replace(/[^\d]/g, "") }))}
                      data-testid="sale-limit-input"
                    />
                  </td>
                  <td className="px-6 py-2">
                    {r.remaining === null ? (
                      <Text size="small" className="text-ui-fg-muted">—</Text>
                    ) : r.remaining === 0 ? (
                      <Badge size="2xsmall" color="red">Sold out — normal price</Badge>
                    ) : (
                      <Badge size="2xsmall" color={r.remaining < 10 ? "orange" : "green"}>{r.remaining} left</Badge>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Container>
  )
}
