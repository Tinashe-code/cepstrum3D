import { defineCustomFieldsConfig } from "@mercurjs/dashboard-sdk"
import { PromotionRecipientSection } from "../components/promotion-recipient-section"

/** Promotion page: "Only for one customer" (see src/components/promotion-recipient-section.tsx). */
export default defineCustomFieldsConfig({
  model: "promotion",
  displays: [
    {
      zone: "general",
      fields: [{ id: "for_customer", component: PromotionRecipientSection }],
    },
  ],
})
