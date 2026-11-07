import { useCallback, useEffect, useState } from "react"
import { Badge, Button, Container, Heading, Input, Text, toast } from "@medusajs/ui"
import { ShieldCheck } from "@medusajs/icons"
import type { RouteConfig } from "@mercurjs/dashboard-sdk"
import { getAuthHeaders } from "@mercurjs/admin"

declare const __BACKEND_URL__: string

export const config: RouteConfig = {
  label: "Listings",
  icon: ShieldCheck,
}

type Row = {
  kind: "offer" | "product"
  id: string
  product_id: string
  product_title: string
  product_status: string
  thumbnail: string | null
  sku?: string
  variant_title?: string | null
  seller_name?: string
  status: "pending" | "approved" | "rejected" | "suspended" | "proposed"
  reason?: string | null
  since?: string | null
}

const TABS = [
  { id: "pending", label: "Waiting for approval" },
  { id: "suspended", label: "Suspended" },
  { id: "rejected", label: "Not approved" },
  { id: "all", label: "Find a listing" },
] as const

const STATUS_BADGE: Record<Row["status"], { color: "orange" | "green" | "red" | "grey"; text: string }> = {
  proposed: { color: "orange", text: "New product" },
  pending: { color: "orange", text: "Waiting" },
  approved: { color: "green", text: "Live" },
  rejected: { color: "grey", text: "Not approved" },
  suspended: { color: "red", text: "Suspended" },
}

const api = (path: string) => `${__BACKEND_URL__}${path}`

/**
 * Admin → Listings: approve vendors' listings and suspend ones that break the
 * rules. Backend: packages/api/src/lib/listings/status.ts
 *  - New products: open them and use Confirm / Reject / Request changes.
 *  - Vendor listings of a live product: Approve / Reject here.
 *  - Anything live: Suspend with a reason (the vendor is emailed).
 */
const ListingsPage = () => {
  const [tab, setTab] = useState<(typeof TABS)[number]["id"]>("pending")
  const [q, setQ] = useState("")
  const [rows, setRows] = useState<Row[]>([])
  const [loading, setLoading] = useState(false)
  const [asking, setAsking] = useState<{ row: Row; action: "reject" | "suspend" } | null>(null)
  const [reason, setReason] = useState("")
  const [busy, setBusy] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (tab === "all" && q.trim().length < 2) {
      setRows([])
      return
    }
    setLoading(true)
    try {
      const params = new URLSearchParams({ status: tab, ...(tab === "all" ? { q: q.trim() } : {}) })
      const res = await fetch(api(`/admin/listings?${params}`), { headers: getAuthHeaders() })
      const json = await res.json()
      if (!res.ok) throw new Error(json.message)
      setRows(json.listings)
    } catch (e) {
      toast.error((e as Error).message || "Could not load listings")
    } finally {
      setLoading(false)
    }
  }, [tab, q])

  useEffect(() => {
    const t = setTimeout(load, tab === "all" ? 350 : 0)
    return () => clearTimeout(t)
  }, [load, tab])

  const act = async (row: Row, action: string, why?: string) => {
    setBusy(row.kind + row.id)
    try {
      const path = row.kind === "offer" ? `/admin/listings/offers/${row.id}` : `/admin/listings/products/${row.id}`
      const res = await fetch(api(path), {
        method: "POST",
        headers: { ...getAuthHeaders(), "content-type": "application/json" },
        body: JSON.stringify({ action, reason: why }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.message)
      toast.success(
        { approve: "Approved — it's live", reject: "Not approved — vendor told why", suspend: "Suspended — vendor told why", unsuspend: "Back online" }[
          action
        ] ?? "Done"
      )
      setAsking(null)
      setReason("")
      await load()
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setBusy(null)
    }
  }

  const actions = (row: Row) => {
    const b = busy === row.kind + row.id
    if (row.kind === "product" && row.status === "proposed")
      return (
        <Button size="small" variant="secondary" asChild>
          <a href={`/dashboard/products/${row.product_id}`}>Review product</a>
        </Button>
      )
    if (row.status === "pending")
      return (
        <>
          <Button size="small" onClick={() => act(row, "approve")} isLoading={b}>
            Approve
          </Button>
          <Button size="small" variant="secondary" onClick={() => setAsking({ row, action: "reject" })}>
            Reject
          </Button>
        </>
      )
    if (row.status === "suspended")
      return (
        <Button size="small" variant="secondary" onClick={() => act(row, "unsuspend")} isLoading={b}>
          Unsuspend
        </Button>
      )
    if (row.status === "rejected" && row.kind === "offer")
      return (
        <Button size="small" variant="secondary" onClick={() => act(row, "approve")} isLoading={b}>
          Approve after all
        </Button>
      )
    if (row.status === "approved")
      return (
        <Button size="small" variant="danger" onClick={() => setAsking({ row, action: "suspend" })}>
          Suspend
        </Button>
      )
    return null
  }

  return (
    <Container className="divide-y p-0">
      <div className="px-6 py-4">
        <Heading>Listings</Heading>
        <Text size="small" className="text-ui-fg-subtle">
          Every vendor listing needs your approval before customers can see it. Suspend anything that breaks the rules — the
          vendor gets an email with your reason.
        </Text>
      </div>

      <div className="flex flex-wrap items-center gap-2 px-6 py-3">
        {TABS.map((t) => (
          <Button key={t.id} size="small" variant={tab === t.id ? "primary" : "transparent"} onClick={() => setTab(t.id)}>
            {t.label}
          </Button>
        ))}
        {tab === "all" && (
          <Input
            size="small"
            className="ml-auto w-64"
            placeholder="Product name…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            autoFocus
          />
        )}
      </div>

      {asking && (
        <div className="flex flex-wrap items-center gap-2 bg-ui-bg-subtle px-6 py-3">
          <Text size="small" weight="plus">
            {asking.action === "suspend" ? "Suspend" : "Reject"} “{asking.row.product_title}”
            {asking.row.seller_name ? ` from ${asking.row.seller_name}` : asking.row.kind === "product" ? " for every vendor" : ""}:
          </Text>
          <Input
            size="small"
            className="min-w-[280px] flex-1"
            placeholder="Reason the vendor will see, e.g. Photos aren't of the real product"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            autoFocus
          />
          <Button
            size="small"
            variant="danger"
            disabled={!reason.trim()}
            isLoading={busy === asking.row.kind + asking.row.id}
            onClick={() => act(asking.row, asking.action, reason)}
          >
            {asking.action === "suspend" ? "Suspend" : "Reject"}
          </Button>
          <Button size="small" variant="transparent" onClick={() => setAsking(null)}>
            Cancel
          </Button>
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full text-left">
          <thead>
            <tr className="txt-compact-small-plus text-ui-fg-subtle">
              <th className="px-6 py-2 font-normal">Listing</th>
              <th className="px-3 py-2 font-normal">Vendor</th>
              <th className="px-3 py-2 font-normal">Status</th>
              <th className="px-3 py-2 font-normal">Since</th>
              <th className="px-6 py-2" />
            </tr>
          </thead>
          <tbody className="divide-y">
            {rows.map((r) => (
              <tr key={r.kind + r.id} className="align-top" data-testid="listing-row">
                <td className="px-6 py-3">
                  <div className="flex items-start gap-3">
                    {r.thumbnail ? (
                      <img src={r.thumbnail} alt="" className="h-10 w-10 rounded object-cover" />
                    ) : (
                      <div className="h-10 w-10 rounded bg-ui-bg-component" />
                    )}
                    <div>
                      <a className="txt-compact-small-plus hover:underline" href={`/dashboard/products/${r.product_id}`}>
                        {r.product_title}
                      </a>
                      <Text size="xsmall" className="text-ui-fg-subtle">
                        {r.kind === "product" ? "Whole product (all vendors)" : [r.variant_title, r.sku].filter(Boolean).join(" · ")}
                      </Text>
                      {r.reason && (
                        <Text size="xsmall" className="text-ui-fg-error">
                          Reason: {r.reason}
                        </Text>
                      )}
                    </div>
                  </div>
                </td>
                <td className="px-3 py-3 txt-compact-small">{r.seller_name ?? "—"}</td>
                <td className="px-3 py-3">
                  <Badge size="2xsmall" color={STATUS_BADGE[r.status].color}>
                    {STATUS_BADGE[r.status].text}
                  </Badge>
                </td>
                <td className="px-3 py-3 txt-compact-small text-ui-fg-subtle">
                  {r.since ? new Date(r.since).toLocaleDateString("en-GB", { day: "numeric", month: "short" }) : "—"}
                </td>
                <td className="px-6 py-3">
                  <div className="flex justify-end gap-2">{actions(r)}</div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!rows.length && (
          <Text size="small" className="px-6 py-8 text-center text-ui-fg-subtle">
            {loading
              ? "Loading…"
              : tab === "all"
                ? "Type a product name to find its listings."
                : tab === "pending"
                  ? "Nothing waiting. 🎉"
                  : "None."}
          </Text>
        )}
      </div>
    </Container>
  )
}

export default ListingsPage
