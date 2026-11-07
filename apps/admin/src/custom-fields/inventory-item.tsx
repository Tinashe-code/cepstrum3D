import { defineCustomFieldsConfig } from "@mercurjs/dashboard-sdk"

/**
 * Manage inventory: extra filters. The backend applies them
 * (packages/api/src/lib/inventory/inventory-filters.ts); the patched inventory
 * list sends them (patches/@mercurjs%2F*.patch).
 */
export default defineCustomFieldsConfig({
  model: "inventory_item",
  list: {
    filters: [
      { key: "title", label: "Title", type: "string" },
      {
        key: "reservations",
        label: "Reservations",
        type: "select",
        options: [
          { label: "Has reservations", value: "has" },
          { label: "No reservations", value: "none" },
        ],
      },
      {
        key: "stock_status",
        label: "Stock level",
        type: "select",
        multiple: true,
        options: [
          { label: "In stock", value: "in_stock" },
          { label: "Low stock (under 10)", value: "low_stock" },
          { label: "Out of stock", value: "out_of_stock" },
        ],
      },
    ],
  },
})
