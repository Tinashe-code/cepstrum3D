import { Container, Heading, Text } from "@medusajs/ui"
import { DocumentText } from "@medusajs/icons"
import type { RouteConfig } from "@mercurjs/dashboard-sdk"
import { FEES, LISTING_RULES } from "../../data/vendor-terms"

export const config: RouteConfig = {
  label: "Listing rules",
  icon: DocumentText,
}

/** Vendor portal → Listing rules: what may be listed and how listings must look. */
const ListingRulesPage = () => (
  <Container className="divide-y p-0">
    <div className="px-6 py-4">
      <Heading>Listing rules</Heading>
      <Text size="small" className="text-ui-fg-subtle">
        These rules keep Cepstrum3D trustworthy for customers and fair for every vendor. Listings are checked
        against them before they go live.
      </Text>
    </div>

    {LISTING_RULES.map((s, i) => (
      <div key={s.title} className="px-6 py-4">
        <Text size="small" weight="plus">{i + 1}. {s.title}</Text>
        <ul style={{ margin: "6px 0 0", paddingLeft: 18, listStyle: "disc", display: "flex", flexDirection: "column", gap: 4 }}>
          {s.rules.map((r) => (
            <li key={r}><Text size="small" className="text-ui-fg-subtle">{r}</Text></li>
          ))}
        </ul>
      </div>
    ))}

    <div className="px-6 py-4">
      <Text size="xsmall" className="text-ui-fg-muted">Not sure whether something is allowed? {FEES.contact}</Text>
    </div>
  </Container>
)

export default ListingRulesPage
