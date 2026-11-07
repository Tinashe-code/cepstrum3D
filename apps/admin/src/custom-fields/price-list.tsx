import { defineCustomFieldsConfig } from "@mercurjs/dashboard-sdk"
import { SaleLimitsSection } from "../components/sale-limits-section"

/** Price list page: adds "Sale quantity per variant" (see src/components/sale-limits-section.tsx). */
export default defineCustomFieldsConfig({
  model: "price_list",
  displays: [
    {
      zone: "general",
      fields: [{ id: "sale_limits", component: SaleLimitsSection }],
    },
  ],
})
