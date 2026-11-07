"use client"

import { useState } from "react"
import Image from "next/image"
import { useParams, useRouter } from "next/navigation"
import { HttpTypes } from "@medusajs/types"

import { Button, FreeDeliveryBadge, Stars } from "@/components/atoms"
import LocalizedClientLink from "@/components/molecules/LocalizedLink/LocalizedLink"
import { useCartContext, useWishlist } from "@/components/providers"
import { HeartFilledIcon, HeartIcon } from "@/icons"
import { getProductPrice } from "@/lib/helpers/get-product-price"
import { toast } from "@/lib/helpers/toast"
import { cn } from "@/lib/utils"
import { Product } from "@/types/product"

type Variant = HttpTypes.StoreProductVariant & { offer_id?: string | null }

/** Option titles whose values differ between this product's variants (e.g. ["Colour"]). */
const varyingOptions = (variants: Variant[]) => {
  const values: Record<string, Set<string>> = {}
  for (const v of variants) {
    for (const o of v.options ?? []) {
      const title = o.option?.title ?? ""
      ;(values[title] ??= new Set()).add(o.value)
    }
  }
  return Object.entries(values)
    .filter(([, set]) => set.size > 1)
    .map(([title]) => title)
}

/** Rainbow dot used for "More colours" (like Takealot). */
const MultiColourIcon = () => (
  <span
    aria-hidden
    className="inline-block h-4 w-4 shrink-0 rounded-full"
    style={{
      background:
        "conic-gradient(#ef4444, #f97316, #facc15, #22c55e, #3b82f6, #a855f7, #ec4899, #ef4444)",
    }}
  />
)

export const ProductCard = ({
  product,
  className,
  actions = false,
}: {
  product: HttpTypes.StoreProduct | Product
  className?: string
  /**
   * Show quick actions (add to cart / shop all options, favourite).
   * On for listing pages; off on the home page.
   */
  actions?: boolean
}) => {
  if (!product) {
    return null
  }

  const storeProduct = product as HttpTypes.StoreProduct
  const variants = (storeProduct.variants ?? []) as Variant[]
  const axes = varyingOptions(variants)
  const hasOptions = variants.length > 1
  const coloursVary = axes.some((a) => a.toLowerCase().startsWith("colo"))

  const { cheapestPrice, cheapestVariant } = getProductPrice({ product: storeProduct })
  const price = cheapestPrice
  const pricesVary =
    new Set(
      variants
        .map((v) => (v as { calculated_price?: { calculated_amount?: number } }).calculated_price?.calculated_amount)
        .filter((a) => a !== undefined)
    ).size > 1
  const pctOff = Number(price?.percentage_diff ?? 0)
  const onSale =
    !!price && pctOff > 0 && price.calculated_price !== price.original_price

  const productName = String(product.title || "Product")
  const rating = (product as { rating?: { average: number; count: number } }).rating
  const href = `/products/${product.handle}`

  return (
    <div
      className={cn(
        "relative group border rounded-sm flex flex-col p-1 w-full lg:w-[calc(25%-1rem)] min-w-[250px] bg-primary transition-shadow hover:shadow-[0_4px_16px_rgba(0,0,0,0.08)]",
        className
      )}
      data-testid="product-card"
      data-product-handle={product.handle}
    >
      <div
        className="relative w-full bg-primary aspect-square"
        data-testid="product-card-image-container"
      >
        <LocalizedClientLink
          href={href}
          aria-label={`View ${productName}`}
          title={`View ${productName}`}
          data-testid="product-card-link"
        >
          <div className="overflow-hidden rounded-sm w-full h-full flex justify-center align-center">
            <Image
              priority
              fetchPriority="high"
              src={
                product.thumbnail
                  ? decodeURIComponent(product.thumbnail)
                  : "/images/placeholder.svg"
              }
              alt={`${productName} image`}
              width={300}
              height={300}
              sizes="(min-width: 1024px) 25vw, (min-width: 640px) 50vw, 100vw"
              className={cn(
                "object-contain aspect-square w-full object-center h-full transition-transform duration-300 rounded-xs",
                actions ? "group-hover:scale-[1.03]" : "lg:group-hover:-mt-14",
                !product.thumbnail && "opacity-30"
              )}
              data-testid="product-card-image"
            />
          </div>
        </LocalizedClientLink>

        {onSale && (
          <span
            className="absolute left-2 top-2 rounded-xs bg-sale px-2 py-1 text-sm font-bold text-white shadow-sm"
            data-testid="product-card-discount-badge"
          >
            -{pctOff}%
          </span>
        )}

        {actions && <WishlistButton productId={product.id} productName={productName} />}

        {!actions && (
          <LocalizedClientLink
            href={href}
            aria-label={`See more about ${productName}`}
            title={`See more about ${productName}`}
          >
            <Button
              className="absolute rounded-sm h-auto lg:h-[48px] lg:group-hover:block hidden w-full uppercase bottom-1 z-10"
              data-testid="product-card-see-more-button"
            >
              See More
            </Button>
          </LocalizedClientLink>
        )}
      </div>

      <div className="flex flex-col gap-2 p-3 flex-1" data-testid="product-card-info">
        <LocalizedClientLink
          href={href}
          aria-label={`Go to ${productName} page`}
          title={productName}
        >
          <h3
            className="heading-xs normal-case line-clamp-2 min-h-[2.5em] hover:text-accent"
            data-testid="product-card-title"
          >
            {product.title}
          </h3>
        </LocalizedClientLink>

        {rating && rating.count > 0 && (
          <div className="flex items-center gap-1" data-testid="product-card-rating">
            <Stars value={rating.average} size={14} />
            <span className="text-xs text-secondary">({rating.count})</span>
          </div>
        )}

        <div
          className="flex flex-wrap items-baseline gap-x-2 gap-y-1"
          data-testid="product-card-price"
        >
          {price ? (
            <>
              {pricesVary && <span className="text-sm text-secondary">From</span>}
              <p
                className="text-2xl font-bold leading-none text-sale"
                data-testid="product-card-current-price"
              >
                {price.calculated_price}
              </p>
              {onSale && (
                <>
                  <p
                    className="text-sm text-secondary line-through"
                    data-testid="product-card-original-price"
                  >
                    {price.original_price}
                  </p>
                  <span
                    className="rounded-xs bg-sale/10 px-1.5 py-0.5 text-xs font-bold text-sale"
                    data-testid="product-card-percent-off"
                  >
                    {pctOff}% OFF
                  </span>
                </>
              )}
            </>
          ) : (
            <p className="label-md text-secondary">Not available</p>
          )}
        </div>

        {hasOptions && (
          <p className="flex items-center gap-2 text-sm text-secondary" data-testid="product-card-more-options">
            {coloursVary ? (
              <>
                <MultiColourIcon />
                More colours
              </>
            ) : (
              <>More options</>
            )}
          </p>
        )}

        <FreeDeliveryBadge metadata={storeProduct.metadata} />

        {actions && (
          <div className="mt-auto pt-1">
            {hasOptions ? (
              // Choosing colour/size happens on the product page (Takealot-style).
              <LocalizedClientLink
                href={href}
                className="flex w-full items-center justify-center rounded-sm border-2 border-accent px-4 py-2 text-sm font-bold uppercase text-accent transition-colors hover:bg-accent hover:text-white"
                data-testid="product-card-shop-options"
              >
                Shop all options
              </LocalizedClientLink>
            ) : (
              <AddToCartButton
                product={storeProduct}
                variant={(cheapestVariant as Variant | null) ?? variants[0]}
                unitAmount={price?.calculated_price_number ?? null}
                currencyCode={price?.currency_code}
              />
            )}
          </div>
        )}
      </div>
    </div>
  )
}

function AddToCartButton({
  product,
  variant,
  unitAmount,
  currencyCode,
}: {
  product: HttpTypes.StoreProduct
  variant?: Variant
  unitAmount: number | null
  currencyCode?: string
}) {
  const { addToCart, onAddToCart, isAddingItem } = useCartContext()
  const { locale } = useParams<{ locale: string }>()
  const [adding, setAdding] = useState(false)

  // Mercur gives each variant its best (buybox) offer; that's what we add.
  const offerId = variant?.offer_id ?? null
  const available = !!offerId && unitAmount !== null

  const handleClick = async () => {
    if (!available || !variant) return
    setAdding(true)
    onAddToCart(
      {
        thumbnail: product.thumbnail || "",
        product_title: product.title,
        quantity: 1,
        subtotal: unitAmount!,
        total: unitAmount!,
        tax_total: 0,
        variant_id: variant.id,
        product_id: product.id,
        variant,
        metadata: { offer_id: offerId },
      } as never,
      currencyCode || "usd"
    )
    try {
      await addToCart({ offerId: offerId!, quantity: 1, countryCode: locale })
      toast.success({ title: "Added to cart", description: product.title })
    } catch {
      toast.error({
        title: "Couldn't add to cart",
        description: "This item may be out of stock.",
      })
    } finally {
      setAdding(false)
    }
  }

  return (
    <Button
      onClick={handleClick}
      disabled={!available || isAddingItem}
      loading={adding}
      className="w-full uppercase py-2.5 flex justify-center"
      data-testid="product-card-add-to-cart"
    >
      {available ? "Add to cart" : "Not available"}
    </Button>
  )
}

function WishlistButton({
  productId,
  productName,
}: {
  productId: string
  productName: string
}) {
  const { isSaved, toggle, loggedIn } = useWishlist()
  const router = useRouter()
  const { locale } = useParams<{ locale: string }>()
  const saved = isSaved(productId)

  const handleClick = async () => {
    if (!loggedIn) {
      router.push(`/${locale}/login`)
      return
    }
    await toggle(productId)
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      aria-pressed={saved}
      aria-label={saved ? `Remove ${productName} from favourites` : `Add ${productName} to favourites`}
      title={loggedIn ? (saved ? "Remove from favourites" : "Add to favourites") : "Log in to save favourites"}
      className="absolute right-2 top-2 flex h-9 w-9 items-center justify-center rounded-full bg-white/90 shadow-sm transition-transform hover:scale-110"
      data-testid="product-card-wishlist"
    >
      {saved ? (
        <HeartFilledIcon size={20} color="#DC2626" />
      ) : (
        <HeartIcon size={20} color="#18181b" />
      )}
    </button>
  )
}
