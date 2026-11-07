import { HttpTypes } from "@medusajs/types"
import { Container } from "@medusajs/ui"
import { mapKeys } from "lodash"
import React, { useEffect, useMemo, useRef, useState } from "react"
import { Input } from "@/components/atoms"
import AddressSelect from "@/components/cells/AddressSelect/AddressSelect"
import CountrySelect from "@/components/cells/CountrySelect/CountrySelect"
import { AddressAutocomplete, keepsPoint } from "@/components/cells/AddressAutocomplete/AddressAutocomplete"
import type { PlaceAddress } from "@/lib/data/delivery"
import { usePathname } from "next/navigation"

const ShippingAddress = ({
  customer,
  cart,
  checked,
  onChange,
}: {
  customer: HttpTypes.StoreCustomer | null
  cart: HttpTypes.StoreCart | null
  checked: boolean
  onChange: () => void
}) => {
  const pathname = usePathname()

  const locale = pathname.split("/")[1]
  const [formData, setFormData] = useState<Record<string, any>>({
    "shipping_address.first_name": cart?.shipping_address?.first_name || "",
    "shipping_address.last_name": cart?.shipping_address?.last_name || "",
    "shipping_address.address_1": cart?.shipping_address?.address_1 || "",
    "shipping_address.company": cart?.shipping_address?.company || "",
    "shipping_address.postal_code": cart?.shipping_address?.postal_code || "",
    "shipping_address.city": cart?.shipping_address?.city || "",
    "shipping_address.country_code":
      cart?.shipping_address?.country_code || locale,
    "shipping_address.province": cart?.shipping_address?.province || "",
    "shipping_address.phone": cart?.shipping_address?.phone || "",
    "shipping_address.lat": String((cart?.shipping_address as any)?.metadata?.lat ?? ""),
    "shipping_address.lng": String((cart?.shipping_address as any)?.metadata?.lng ?? ""),
    "shipping_address.place_id": String((cart?.shipping_address as any)?.metadata?.place_id ?? ""),
    email: cart?.email || "",
  })

  const addressesInRegion = useMemo(
    () =>
      customer?.addresses.filter(
        (a) => a.country_code && a.country_code === locale
      ),
    [customer?.addresses]
  )

  // Create a stable reference that only changes when address data actually changes
  const addressSnapshot = useMemo(
    () =>
      JSON.stringify({
        shipping_address: cart?.shipping_address,
        email: cart?.email || customer?.email,
      }),
    [
      cart?.shipping_address?.first_name,
      cart?.shipping_address?.last_name,
      cart?.shipping_address?.address_1,
      cart?.shipping_address?.company,
      cart?.shipping_address?.postal_code,
      cart?.shipping_address?.city,
      cart?.shipping_address?.country_code,
      cart?.shipping_address?.province,
      cart?.shipping_address?.phone,
      cart?.email,
      customer?.email,
    ]
  )

  const setFormAddress = (
    address?: HttpTypes.StoreCartAddress,
    email?: string
  ) => {
    address &&
      setFormData((prevState: Record<string, any>) => ({
        ...prevState,
        "shipping_address.first_name": address?.first_name || "",
        "shipping_address.last_name": address?.last_name || "",
        "shipping_address.address_1": address?.address_1 || "",
        "shipping_address.company": address?.company || "",
        "shipping_address.postal_code": address?.postal_code || "",
        "shipping_address.city": address?.city || "",
        "shipping_address.country_code": address?.country_code || locale,
        "shipping_address.province": address?.province || "",
        "shipping_address.phone": address?.phone || "",
        "shipping_address.lat": String((address as any)?.metadata?.lat ?? ""),
        "shipping_address.lng": String((address as any)?.metadata?.lng ?? ""),
        "shipping_address.place_id": String((address as any)?.metadata?.place_id ?? ""),
      }))

    email &&
      setFormData((prevState: Record<string, any>) => ({
        ...prevState,
        email: email,
      }))
  }

  useEffect(() => {
    if (cart?.shipping_address) {
      setFormAddress(cart.shipping_address, cart.email)
    }

    if (cart && !cart.email && customer?.email) {
      setFormAddress(undefined, customer.email)
    }
  }, [addressSnapshot])

  // Typing in address or city means the saved map point no longer matches.
  const LOCATION_FIELDS = ["shipping_address.address_1", "shipping_address.city"]
  const clearPoint = { "shipping_address.lat": "", "shipping_address.lng": "", "shipping_address.place_id": "" }

  const handleChange = (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLInputElement | HTMLSelectElement
    >
  ) => {
    setFormData({
      ...formData,
      ...(LOCATION_FIELDS.includes(e.target.name) ? clearPoint : {}),
      [e.target.name]: e.target.value,
    })
  }

  // Text of the place the map point belongs to; null = the customer's own location.
  const picked = useRef<string | null | undefined>(undefined)

  const handlePlace = (p: PlaceAddress, source: "place" | "gps") => {
    picked.current = source === 'gps' ? null : p.address_1 || p.formatted
    setFormData((prev: Record<string, any>) => ({
      ...prev,
      "shipping_address.address_1": p.address_1 || prev["shipping_address.address_1"],
      "shipping_address.city": p.city || prev["shipping_address.city"],
      "shipping_address.province": p.province || prev["shipping_address.province"],
      "shipping_address.postal_code": p.postal_code || prev["shipping_address.postal_code"],
      "shipping_address.lat": p.lat ?? "",
      "shipping_address.lng": p.lng ?? "",
      "shipping_address.place_id": p.place_id,
    }))
  }

  return (
    <>
      {customer && (addressesInRegion?.length || 0) > 0 && (
        <Container className="mb-6 flex flex-col gap-y-4 p-0">
          <p className="text-small-regular">
            {`Hi ${customer.first_name}, do you want to use one of your saved addresses?`}
          </p>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-x-4">
            <AddressSelect
              addresses={addressesInRegion || []}
              addressInput={
                mapKeys(formData, (_, key) =>
                  key.replace("shipping_address.", "")
                ) as HttpTypes.StoreCartAddress
              }
              onSelect={setFormAddress}
            />
          </div>
        </Container>
      )}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Input
          label="First name"
          name="shipping_address.first_name"
          autoComplete="given-name"
          value={formData["shipping_address.first_name"]}
          onChange={handleChange}
          required
          data-testid="shipping-first-name-input"
        />
        <Input
          label="Last name"
          name="shipping_address.last_name"
          autoComplete="family-name"
          value={formData["shipping_address.last_name"]}
          onChange={handleChange}
          required
          data-testid="shipping-last-name-input"
        />
        <AddressAutocomplete
          label="Address"
          name="shipping_address.address_1"
          value={formData["shipping_address.address_1"]}
          onType={(value) =>
            setFormData((prev: Record<string, any>) => ({
              ...prev,
              // Adding house details to the nearest place keeps its map point.
              ...(keepsPoint(value, picked.current ?? prev["shipping_address.address_1"]) &&
              prev["shipping_address.lat"] !== ""
                ? {}
                : clearPoint),
              "shipping_address.address_1": value,
            }))
          }
          onPick={handlePlace}
          hasPoint={!!formData["shipping_address.lat"]}
          required
          data-testid="shipping-address-input"
        />
        {/* Map point of the chosen Google address — used to price delivery by distance. */}
        <input type="hidden" name="shipping_address.lat" value={formData["shipping_address.lat"]} />
        <input type="hidden" name="shipping_address.lng" value={formData["shipping_address.lng"]} />
        <input type="hidden" name="shipping_address.place_id" value={formData["shipping_address.place_id"]} />
        <Input
          label="Company"
          name="shipping_address.company"
          value={formData["shipping_address.company"]}
          onChange={handleChange}
          autoComplete="organization"
          data-testid="shipping-company-input"
        />
        <Input
          label="Postal code (optional)"
          name="shipping_address.postal_code"
          autoComplete="postal-code"
          value={formData["shipping_address.postal_code"]}
          onChange={handleChange}
          data-testid="shipping-postal-code-input"
        />
        <Input
          label="City"
          name="shipping_address.city"
          autoComplete="address-level2"
          value={formData["shipping_address.city"]}
          onChange={handleChange}
          required
          data-testid="shipping-city-input"
        />
        <CountrySelect
          name="shipping_address.country_code"
          autoComplete="country"
          region={cart?.region}
          value={formData["shipping_address.country_code"]}
          onChange={handleChange}
          required
          data-testid="shipping-country-select"
        />
        <Input
          label="State / Province"
          name="shipping_address.province"
          autoComplete="address-level1"
          value={formData["shipping_address.province"]}
          onChange={handleChange}
          data-testid="shipping-province-input"
        />
      </div>
      <div className="grid grid-cols-2 gap-4 my-4">
        <Input
          label="Email"
          name="email"
          type="email"
          title="Enter a valid email address."
          autoComplete="email"
          value={formData.email}
          onChange={handleChange}
          required
          data-testid="shipping-email-input"
        />
        <Input
          label="Phone"
          name="shipping_address.phone"
          autoComplete="tel"
          value={formData["shipping_address.phone"]}
          onChange={handleChange}
          data-testid="shipping-phone-input"
        />
      </div>
    </>
  )
}

export default ShippingAddress
