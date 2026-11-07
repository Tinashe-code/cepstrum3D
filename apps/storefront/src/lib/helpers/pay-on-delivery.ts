/**
 * Pay on delivery helpers (storefront side).
 * The rules themselves live in the backend: packages/api/src/lib/pay-on-delivery.ts
 */

export const POD_PROVIDER_ID = "pp_pay-on-delivery_pay-on-delivery"
export const POD_ATTRIBUTE_HANDLE = "pay-on-delivery"

export const isPayOnDelivery = (providerId?: string | null) =>
  providerId === POD_PROVIDER_ID

type ProductWithAttributes = {
  attributes?: { handle?: string | null; values?: { name?: string | null }[] | null }[] | null
}

/** True when the product's "Pay on delivery" toggle is on. */
export const isProductPayOnDelivery = (product: unknown) =>
  ((product as ProductWithAttributes)?.attributes ?? []).some(
    (a) =>
      a?.handle === POD_ATTRIBUTE_HANDLE &&
      (a.values ?? []).some((v) => String(v?.name).toLowerCase() === "true")
  )

export type PayOnDeliveryEligibility = {
  eligible: boolean
  message: string | null
  ineligible_items: { id: string; title: string; product_id: string | null }[]
}
