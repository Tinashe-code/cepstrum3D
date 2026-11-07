import { useEffect, useState } from "react"
import { Badge, Container, Heading, Text } from "@medusajs/ui"
import { ShieldCheck } from "@medusajs/icons"
import type { RouteConfig } from "@mercurjs/dashboard-sdk"
import { getAuthHeaders } from "@mercurjs/vendor"

declare const __BACKEND_URL__: string

export const config: RouteConfig = {
  label: "Listing status",
  icon: ShieldCheck,
}

type Row = {
  kind: "offer" | "product"
  id: string
  product_id: string
  product_title: string
  thumbnail: string | null
  sku?: string
  variant_title?: string | null
  status: "pending" | "rejected" | "suspended" | "proposed" | "approved"
  reason?: string | null
  since?: string | null
}

const LABEL: Record<Row["status"], { color: "orange" | "red" | "grey" | "green"; text: string; help: string }> = {
  proposed: { color: "orange", text: "Waiting for approval", help: "The Cepstrum3D team is reviewing this new product." },
  pending: { color: "orange", text: "Waiting for approval", help: "Customers will see it once it's approved." },
  rejected: { color: "grey", text: "Not approved", help: "Fix what the reason says, then contact the Cepstrum3D team." },
  suspended: { color: "red", text: "Suspended", help: "Hidden from the shop. Contact the Cepstrum3D team to have it reinstated." },
  approved: { color: "green", text: "Live", help: "" },
}

/** Vendor portal → Listing status: listings that aren't live yet, or were taken down, and why. */
const ListingStatusPage = () => {
  const [rows, setRows] = useState<Row[] | null>(null)

  useEffect(() => {
    fetch(`${__BACKEND_URL__}/vendor/listings`, { headers: getAuthHeaders() })
      .then((r) => r.json())
      .then((j) => setRows(j.listings ?? []))
      .catch(() => setRows([]))
  }, [])

  return (
    <Container className="divide-y p-0">
      <div className="px-6 py-4">
        <Heading>Listing status</Heading>
        <Text size="small" className="text-ui-fg-subtle">
          New products and new listings are checked by the Cepstrum3D team before customers can see them. You get an
          email when a decision is made.
        </Text>
      </div>
      {rows === null ? (
        <Text size="small" className="px-6 py-8 text-ui-fg-subtle">Loading…</Text>
      ) : !rows.length ? (
        <Text size="small" className="px-6 py-8 text-ui-fg-subtle">All your listings are live. ✅</Text>
      ) : (
        rows.map((r) => (
          <div key={r.kind + r.id} className="flex items-start gap-3 px-6 py-3" data-testid="vendor-listing-row">
            {r.thumbnail ? (
              <img src={r.thumbnail} alt="" className="h-10 w-10 rounded object-cover" />
            ) : (
              <div className="h-10 w-10 rounded bg-ui-bg-component" />
            )}
            <div className="flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <Text size="small" weight="plus">{r.product_title}</Text>
                <Badge size="2xsmall" color={LABEL[r.status].color}>{LABEL[r.status].text}</Badge>
              </div>
              <Text size="xsmall" className="text-ui-fg-subtle">
                {r.kind === "product" ? "Product" : [r.variant_title, r.sku].filter(Boolean).join(" · ")}
                {r.since ? ` · since ${new Date(r.since).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}` : ""}
              </Text>
              {r.reason && <Text size="xsmall" className="text-ui-fg-error">Reason: {r.reason}</Text>}
              <Text size="xsmall" className="text-ui-fg-muted">{LABEL[r.status].help}</Text>
            </div>
          </div>
        ))
      )}
    </Container>
  )
}

export default ListingStatusPage
