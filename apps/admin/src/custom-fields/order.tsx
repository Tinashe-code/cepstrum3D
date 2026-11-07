import { defineCustomFieldsConfig } from "@mercurjs/dashboard-sdk"

/**
 * Orders list: "Fulfillment" filter. Order fulfillment status isn't stored in
 * the database, so the backend turns this filter into an id filter
 * (packages/api/src/lib/orders/fulfillment-filter.ts).
 */
export default defineCustomFieldsConfig({
  model: "order",
  list: {
    filters: [
      {
        key: "fulfillment_status",
        label: "Fulfillment",
        type: "select",
        multiple: true,
        options: [
          { label: "Not fulfilled", value: "not_fulfilled" },
          { label: "Partially fulfilled", value: "partially_fulfilled" },
          { label: "Fulfilled (packed)", value: "fulfilled" },
          { label: "Partially shipped", value: "partially_shipped" },
          { label: "Shipped", value: "shipped" },
          { label: "Partially delivered", value: "partially_delivered" },
          { label: "Delivered", value: "delivered" },
          { label: "Canceled", value: "canceled" },
        ],
      },
    ],
  },
})
