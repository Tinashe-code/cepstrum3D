"use client"

import { useEffect, useRef, useState } from "react"
import Image from "next/image"

import { imageNamedFor, productImage, variantImage } from "@/lib/helpers/product-image"
import { HttpTypes } from "@medusajs/types"

import { Chip } from "@/components/atoms"
import useUpdateSearchParams from "@/hooks/useUpdateSearchParams"
import { getOfferStock, getVariantOffers, StoreOffer } from "@/lib/helpers/buybox"
import { cn } from "@/lib/utils"

const isColour = (title: string) => /^colou?r$/i.test(title)

type Variant = HttpTypes.StoreProductVariant & { thumbnail?: string | null }

/**
 * Product options, Takealot-style:
 * - options with a single value (Brand, Material, …) are shown as plain specs;
 * - Colour gets a dropdown plus a grid of picture tiles (with "Out of stock");
 * - any other choice (e.g. Diameter) uses chips.
 * The selection lives in the URL (?colour=Red), which the price, add-to-cart and gallery read.
 */
export const ProductVariants = ({
  product,
  selectedVariant,
  offers = [],
}: {
  product: HttpTypes.StoreProduct
  selectedVariant: Record<string, string>
  offers?: StoreOffer[]
}) => {
  const updateSearchParams = useUpdateSearchParams()
  const options = product.options ?? []
  const variants = (product.variants ?? []) as Variant[]

  const fixed = options.filter((o) => (o.values ?? []).length <= 1)
  const choices = options.filter((o) => (o.values ?? []).length > 1)

  const setOptionValue = (title: string, value: string) => {
    if (value) updateSearchParams(title.toLowerCase(), value)
  }

  /** The variant you'd get by picking `value` for `title`, keeping the other selections. */
  const variantFor = (title: string, value: string) => {
    const wanted = { ...selectedVariant, [title.toLowerCase()]: value }
    return (
      variants.find((v) =>
        (v.options ?? []).every((o) => {
          const t = (o.option?.title ?? "").toLowerCase()
          return !wanted[t] || wanted[t] === o.value
        })
      ) ??
      variants.find((v) => (v.options ?? []).some((o) => o.option?.title === title && o.value === value))
    )
  }

  const inStock = (variant?: Variant) =>
    !!variant && getVariantOffers(offers, variant.id).some((o) => getOfferStock(o) > 0)

  return (
    <div className="my-4 space-y-4" data-testid="product-variants">
      {fixed.length > 0 && (
        <dl className="flex flex-wrap gap-x-5 gap-y-1 text-sm" data-testid="product-specs">
          {fixed.map((o) => (
            <div key={o.id} className="flex gap-1">
              <dt className="text-secondary">{o.title}:</dt>
              <dd className="text-primary font-medium">{o.values?.[0]?.value}</dd>
            </div>
          ))}
        </dl>
      )}

      {choices.map(({ id, title, values }) => {
        const key = title.toLowerCase()
        const selected = selectedVariant[key]

        if (isColour(title)) {
          return (
            <ColourPicker
              key={id}
              title={title}
              selected={selected}
              values={(values ?? []).map((v) => {
                const variant = variantFor(title, v.value)
                return {
                  value: v.value,
                  image:
                    variantImage(variant as never) ||
                    imageNamedFor(product.images, v.value) ||
                    productImage(product as never) ||
                    "/images/placeholder.svg",
                  available: inStock(variant),
                }
              })}
              onSelect={(value) => setOptionValue(title, value)}
            />
          )
        }

        return (
          <div key={id} data-testid={`product-variant-${key}`}>
            <span className="label-md text-secondary">{title}: </span>
            <span className="label-md text-primary" data-testid={`product-variant-selected-${key}`}>
              {selected}
            </span>
            <div className="flex flex-wrap gap-2 mt-2" data-testid={`product-variant-options-${key}`}>
              {(values ?? []).map(({ id, value }) => (
                <Chip
                  key={id}
                  selected={selected === value}
                  value={value}
                  onSelect={() => setOptionValue(title, value || "")}
                  data-testid={`product-variant-chip-${key}-${value?.toLowerCase().replace(/\s+/g, "-")}`}
                />
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}

type ColourValue = { value: string; image: string; available: boolean }

function ColourPicker({
  title,
  selected,
  values,
  onSelect,
}: {
  title: string
  selected?: string
  values: ColourValue[]
  onSelect: (value: string) => void
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const current = values.find((v) => v.value === selected) ?? values[0]

  useEffect(() => {
    if (!open) return
    const close = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener("mousedown", close)
    return () => document.removeEventListener("mousedown", close)
  }, [open])

  const pick = (value: string) => {
    onSelect(value)
    setOpen(false)
  }

  return (
    <div data-testid="product-colour-picker">
      <div className="mb-2 flex items-baseline gap-1">
        <span className="label-md text-secondary">{title}:</span>
        <span className="label-md text-primary" data-testid="product-variant-selected-colour">
          {current?.value}
        </span>
        <span className="ml-auto text-xs text-secondary">{values.length} colours</span>
      </div>

      {/* Dropdown — handy when there are many colours */}
      <div className="relative mb-3" ref={ref}>
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-haspopup="listbox"
          aria-expanded={open}
          className="flex w-full items-center gap-3 rounded-sm border bg-primary px-3 py-2 text-left hover:border-accent"
          data-testid="product-colour-dropdown"
        >
          {current && (
            <Image src={current.image} alt="" width={28} height={28} className="h-7 w-7 rounded-xs object-contain" />
          )}
          <span className="flex-1 text-md">{current?.value}</span>
          <span aria-hidden className={cn("transition-transform", open && "rotate-180")}>▾</span>
        </button>
        {open && (
          <ul
            role="listbox"
            className="absolute z-20 mt-1 max-h-72 w-full overflow-auto rounded-sm border bg-primary shadow-lg"
          >
            {values.map((v) => (
              <li key={v.value}>
                <button
                  type="button"
                  role="option"
                  aria-selected={v.value === current?.value}
                  onClick={() => pick(v.value)}
                  className={cn(
                    "flex w-full items-center gap-3 px-3 py-2 text-left hover:bg-accent-soft",
                    v.value === current?.value && "bg-accent-soft"
                  )}
                >
                  <Image src={v.image} alt="" width={28} height={28} className="h-7 w-7 rounded-xs object-contain" />
                  <span className="flex-1">{v.value}</span>
                  {!v.available && <span className="text-xs text-secondary">Out of stock</span>}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Picture tiles */}
      <div
        role="radiogroup"
        aria-label={title}
        className="grid grid-cols-3 gap-2 sm:grid-cols-4 xl:grid-cols-5"
        data-testid="product-colour-tiles"
      >
        {values.map((v) => {
          const isSelected = v.value === current?.value
          return (
            <button
              key={v.value}
              type="button"
              role="radio"
              aria-checked={isSelected}
              onClick={() => pick(v.value)}
              className={cn(
                "group flex flex-col items-center rounded-sm border bg-primary p-1.5 text-center transition-colors hover:border-accent",
                isSelected && "border-2 border-accent"
              )}
              data-testid={`product-colour-tile-${v.value.toLowerCase().replace(/\s+/g, "-")}`}
            >
              <span className="relative block aspect-square w-full">
                <Image
                  src={v.image}
                  alt={v.value}
                  fill
                  sizes="96px"
                  className={cn("object-contain", !v.available && "opacity-50")}
                />
                {!v.available && (
                  <span className="absolute inset-x-0 bottom-1 bg-white/85 text-[11px] font-medium text-primary">
                    Out of stock
                  </span>
                )}
              </span>
              <span className="mt-1 text-xs leading-tight text-primary">{v.value}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
