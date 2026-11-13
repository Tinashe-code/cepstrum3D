import { Badge, Container, Heading, Text } from "@medusajs/ui"
import { ReceiptPercent } from "@medusajs/icons"
import type { RouteConfig } from "@mercurjs/dashboard-sdk"
import { FEES } from "../../data/vendor-terms"

export const config: RouteConfig = {
  label: "Fees & charges",
  icon: ReceiptPercent,
}

const TBA = "To be announced"
const money = (n: number) => `US$${n.toFixed(n % 1 ? 2 : 0)}`
const day = (iso: string) =>
  new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })

const row = { display: "flex", justifyContent: "space-between", gap: 16 } as const

/** Vendor portal → Fees & charges: what selling on Cepstrum3D costs after the free trial. */
const FeesPage = () => {
  const started = FEES.effectiveFrom ? new Date(FEES.effectiveFrom) <= new Date() : false

  return (
    <Container className="divide-y p-0">
      <div className="px-6 py-4">
        <div className="flex flex-wrap items-center gap-2">
          <Heading>Fees & charges</Heading>
          {started ? (
            <Badge size="2xsmall" color="orange">Charges apply</Badge>
          ) : (
            <Badge size="2xsmall" color="green">Free trial</Badge>
          )}
        </div>
        <Text size="small" className="text-ui-fg-subtle">
          Listing on Cepstrum3D is free. You only pay when you sell.
        </Text>
      </div>

      {/* Trial and notice */}
      <div className="px-6 py-4">
        <Text size="small" weight="plus">Your free trial</Text>
        <Text size="small" className="text-ui-fg-subtle">
          New vendors pay no fees and no commission for their {FEES.trialLength}.
          {FEES.effectiveFrom
            ? ` Charges ${started ? "have applied" : "will apply"} from ${day(FEES.effectiveFrom)}.`
            : " The date charges start has not been set yet."}
        </Text>
        <Text size="small" className="text-ui-fg-subtle">
          Cepstrum3D will email you and show a notice here at least {FEES.noticeDays} days before any charge
          starts, or before any rate changes. Nothing is charged without that notice.
        </Text>
      </div>

      {/* Success fee */}
      <div className="px-6 py-4">
        <Text size="small" weight="plus">1. Success fee</Text>
        <Text size="small" className="text-ui-fg-subtle">
          A percentage of the item price (excluding delivery) on each item that is sold and delivered. The rate
          depends on the product's category.
        </Text>
        <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 6, maxWidth: 420 }}>
          {FEES.successFees.map((f) => (
            <div key={f.category} style={row}>
              <Text size="small">{f.category}</Text>
              <Text size="small" weight="plus">{f.rate == null ? TBA : `${f.rate}%`}</Text>
            </div>
          ))}
        </div>
        {FEES.successFees.some((f) => f.rate != null) && (
          <Text size="xsmall" className="text-ui-fg-muted" style={{ marginTop: 8 }}>
            Example: a US$30 roll of filament at 10% has a success fee of US$3.
          </Text>
        )}
      </div>

      {/* Subscription */}
      <div className="px-6 py-4">
        <Text size="small" weight="plus">2. Monthly subscription</Text>
        <Text size="small" className="text-ui-fg-subtle">
          A fixed monthly fee per vendor account:{" "}
          <b>{FEES.monthlySubscription == null ? TBA : `${money(FEES.monthlySubscription)} per month`}</b>.
          {FEES.subscriptionWaivedBelow != null &&
            ` You don't pay it in any month where your sales are below ${money(FEES.subscriptionWaivedBelow)}.`}
        </Text>
      </div>

      {/* Never charged */}
      <div className="px-6 py-4">
        <Text size="small" weight="plus">You are never charged for</Text>
        <ul style={{ margin: "6px 0 0", paddingLeft: 18, listStyle: "disc" }}>
          {FEES.neverCharged.map((t) => (
            <li key={t}><Text size="small" className="text-ui-fg-subtle">{t}</Text></li>
          ))}
        </ul>
        <Text size="xsmall" className="text-ui-fg-muted" style={{ marginTop: 6 }}>
          You deliver your own orders, so there are no warehouse, storage or fulfilment fees.
        </Text>
      </div>

      {/* Billing */}
      <div className="px-6 py-4">
        <Text size="small" weight="plus">Billing</Text>
        <ul style={{ margin: "6px 0 0", paddingLeft: 18, listStyle: "disc" }}>
          {FEES.billing.map((t) => (
            <li key={t}><Text size="small" className="text-ui-fg-subtle">{t}</Text></li>
          ))}
        </ul>
      </div>

      <div className="px-6 py-4">
        <Text size="xsmall" className="text-ui-fg-muted">Questions about fees? {FEES.contact}</Text>
      </div>
    </Container>
  )
}

export default FeesPage
