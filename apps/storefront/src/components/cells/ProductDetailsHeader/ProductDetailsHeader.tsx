"use client"

import { useEffect, useState } from "react"
import { getSaleRemaining } from "@/lib/data/delivery"
import { Button, FreeDeliveryBadge, Stars } from "@/components/atoms"
import { HttpTypes } from "@medusajs/types"
import { ProductVariants } from "@/components/molecules"
import useGetAllSearchParams from "@/hooks/useGetAllSearchParams"
import { getProductPrice } from "@/lib/helpers/get-product-price"
import { convertToLocale } from "@/lib/helpers/money"
import {
  getBuyboxWinner,
  getOfferAmount,
  getOfferStock,
  getVariantOffers,
  StoreOffer,
} from "@/lib/helpers/buybox"
import { Chat } from "@/components/organisms/Chat/Chat"
import { CompareOffersModal } from "@/components/organisms/CompareOffersModal/CompareOffersModal"
import { SellerDTO } from "@mercurjs/types"
import { toast } from "@/lib/helpers/toast"
import { useCartContext } from "@/components/providers"
import { isProductPayOnDelivery } from "@/lib/helpers/pay-on-delivery"
import { QuantityPricing } from "@/components/molecules/QuantityPricing/QuantityPricing"
import { priceTable, readQuantityRanges, unitPriceFor } from "@/lib/helpers/quantity-prices"

const optionsAsKeymap = (
  variantOptions: HttpTypes.StoreProductVariant["options"]
) => {
  return variantOptions?.reduce(
    (
      acc: Record<string, string>,
      varopt: HttpTypes.StoreProductOptionValue
    ) => {
      acc[varopt.option?.title.toLowerCase() || ""] = varopt.value

      return acc
    },
    {}
  )
}

export const ProductDetailsHeader = ({
  product,
  locale,
  user,
  offers = [],
  seller,
}: {
  product: HttpTypes.StoreProduct
  locale: string
  user: HttpTypes.StoreCustomer | null
  offers?: StoreOffer[]
  seller?: SellerDTO
}) => {
  const { addToCart, onAddToCart, cart, isAddingItem } = useCartContext()
  const { allSearchParams } = useGetAllSearchParams()
  const [isCompareOpen, setIsCompareOpen] = useState(false)

  const { cheapestVariant, cheapestPrice } = getProductPrice({
    product,
  })

  const hasAnyPrice = cheapestPrice !== null && cheapestVariant !== null

  const selectedVariant = hasAnyPrice
    ? {
        ...optionsAsKeymap(cheapestVariant.options ?? null),
        ...allSearchParams,
      }
    : allSearchParams

  const variantId =
    product.variants?.find(({ options }: { options: any }) =>
      options?.every((option: any) =>
        selectedVariant[option.option?.title.toLowerCase() || ""]?.includes(
          option.value
        )
      )
    )?.id || ""

  const { variantPrice } = getProductPrice({
    product,
    variantId,
  })

  // Buybox: the winning offer for the selected variant sets the price shown and
  // the offer that add-to-cart uses. Products are sold through offers, not the
  // variant's base price.
  const variantOffers = getVariantOffers(offers, variantId)
  const winnerOffer = getBuyboxWinner(variantOffers)
  const otherOffersCount = Math.max(variantOffers.length - 1, 0)

  const offerAmount = winnerOffer ? getOfferAmount(winnerOffer) : null
  const offerCurrency =
    winnerOffer?.calculated_price?.currency_code ||
    variantPrice?.currency_code ||
    "eur"
  const offerStock = winnerOffer ? getOfferStock(winnerOffer) : 0
  const hasOffer = !!winnerOffer && offerAmount !== null

  // Sale prices (price lists) keep the regular price as original_amount.
  const offerOriginal =
    (winnerOffer?.calculated_price as { original_amount?: number } | undefined)
      ?.original_amount ?? null
  const offerOnSale =
    hasOffer && offerOriginal !== null && offerOriginal > (offerAmount as number)
  const offerPctOff = offerOnSale
    ? Math.round((1 - (offerAmount as number) / (offerOriginal as number)) * 100)
    : 0

  // "Only N left at this price" when the vendor capped this variant's sale quantity.
  const [saleLeft, setSaleLeft] = useState<number | null>(null)
  useEffect(() => {
    let cancelled = false
    setSaleLeft(null)
    if (!offerOnSale || !winnerOffer?.id) return
    getSaleRemaining([winnerOffer.id]).then((r) => {
      if (!cancelled) setSaleLeft(r[winnerOffer.id] ?? null)
    })
    return () => {
      cancelled = true
    }
  }, [offerOnSale, winnerOffer?.id])

  const displayPrice = hasOffer
    ? convertToLocale({ amount: offerAmount as number, currency_code: offerCurrency })
    : variantPrice?.calculated_price

  const quantityInCart =
    cart?.items?.find((item) => item.metadata?.offer_id === winnerOffer?.id)
      ?.quantity ?? 0
  // Quantity price ranges ("4+: $9 each"): the customer picks how many; the
  // price per item depends on the total quantity of this item in the cart.
  const ranges = readQuantityRanges(winnerOffer?.metadata)
  const table = hasOffer ? priceTable(offerAmount as number, ranges) : []
  const [pickQty, setPickQty] = useState(1)
  useEffect(() => setPickQty(1), [winnerOffer?.id])
  const addQty = table.length ? pickQty : 1
  const lineQty = quantityInCart + addQty
  const addTotal = hasOffer
    ? unitPriceFor(lineQty, offerAmount as number, ranges) * lineQty -
      unitPriceFor(quantityInCart, offerAmount as number, ranges) * quantityInCart
    : 0

  const isStockMaxLimitReached = quantityInCart + addQty > offerStock

  const isAddToCartDisabled =
    !hasOffer || !offerStock || isStockMaxLimitReached

  const handleAddToCart = async () => {
    if (!winnerOffer || isAddToCartDisabled) return

    const total = addTotal
    const subtotal =
      addQty === 1 && !ranges.length
        ? winnerOffer.calculated_price?.calculated_amount_without_tax ?? total
        : total

    const storeCartLineItem = {
      thumbnail: product.thumbnail || "",
      product_title: product.title,
      quantity: addQty,
      subtotal,
      total,
      tax_total: total - subtotal,
      variant_id: variantId,
      product_id: product.id,
      variant: product.variants?.find(({ id }) => id === variantId),
      metadata: { offer_id: winnerOffer.id },
    }

    onAddToCart(storeCartLineItem, offerCurrency)

    try {
      await addToCart({
        offerId: winnerOffer.id,
        quantity: addQty,
        countryCode: locale,
      })
    } catch (error) {
      toast.error({
        title: "Error adding to cart",
        description: "This offer does not have the required inventory",
      })
    }
  }

  const rating = (product as { rating?: { average: number; count: number } }).rating

  return (
    <div className="border rounded-sm p-5" data-testid="product-details-header">
      <div className="flex justify-between">
        <div>
          <h1 className="heading-lg text-primary" data-testid="product-title">{product.title}</h1>
          {rating && rating.count > 0 && (
            <a href="#reviews" className="mt-1 inline-flex items-center gap-2 hover:underline" data-testid="product-rating">
              <Stars value={rating.average} size={18} />
              <span className="label-md text-secondary">
                {rating.average.toFixed(1)} ({rating.count} review{rating.count === 1 ? "" : "s"})
              </span>
            </a>
          )}
          <div className="mt-2 flex flex-col gap-1" data-testid="product-price-container">
            {hasOffer ? (
              <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                <span className="heading-lg font-bold text-sale" data-testid="product-price-current">
                  {displayPrice}
                </span>
                {offerOnSale && (
                  <>
                    <span className="text-lg text-secondary line-through" data-testid="product-price-original">
                      {convertToLocale({ amount: offerOriginal as number, currency_code: offerCurrency })}
                    </span>
                    <span className="rounded-xs bg-sale px-2 py-1 text-sm font-bold text-white" data-testid="product-price-percent-off">
                      -{offerPctOff}%
                    </span>
                  </>
                )}
              </div>
            ) : hasAnyPrice && variantPrice ? (
              <span className="heading-lg font-bold text-sale" data-testid="product-price-current">
                {variantPrice.calculated_price}
              </span>
            ) : (
              <span className="label-md text-secondary pt-2 pb-4" data-testid="product-price-unavailable">
                Not available in your region
              </span>
            )}
          </div>
          {saleLeft !== null && saleLeft > 0 && (
            <p className="mt-1 text-[14px] font-bold text-sale" data-testid="product-sale-remaining">
              Only {saleLeft} left at this price
            </p>
          )}
          <FreeDeliveryBadge metadata={product.metadata} className="mt-2 text-[14px]" />
          {isProductPayOnDelivery(product) && (
            <p
              className="mt-2 inline-flex items-center gap-2 rounded-sm border px-3 py-1 label-sm text-primary"
              data-testid="product-pay-on-delivery-badge"
            >
              <span aria-hidden className="inline-block h-2 w-2 rounded-full bg-[#F97316]" />
              Pay on delivery available
            </p>
          )}
        </div>
      </div>
      {hasAnyPrice && (
        <ProductVariants product={product} selectedVariant={selectedVariant} offers={offers} />
      )}
      {table.length > 0 && (
        <QuantityPricing
          rows={table}
          regular={offerAmount as number}
          ranges={ranges}
          quantity={pickQty}
          onQuantity={setPickQty}
          max={Math.max(offerStock - quantityInCart, 1)}
          currency={offerCurrency}
        />
      )}
      <Button
        onClick={handleAddToCart}
        disabled={isAddToCartDisabled}
        loading={isAddingItem}
        className="w-full uppercase mb-4 py-3 flex justify-center"
        size="large"
        data-testid="product-add-to-cart-button"
      >
        {!hasOffer
          ? "NOT AVAILABLE"
          : !offerStock
          ? "OUT OF STOCK"
          : addQty > 1
          ? `ADD ${addQty} TO CART · ${convertToLocale({ amount: addTotal, currency_code: offerCurrency })}`
          : "ADD TO CART"}
      </Button>
      {otherOffersCount > 0 && (
        <Button
          variant="tonal"
          onClick={() => setIsCompareOpen(true)}
          className="w-full uppercase mb-4"
          data-testid="compare-offers-button"
        >
          {`Compare other ${otherOffersCount} offers`}
        </Button>
      )}
      {isCompareOpen && (
        <CompareOffersModal
          offers={variantOffers}
          locale={locale}
          variantLabel={
            product.variants?.find(({ id }) => id === variantId)?.title ||
            undefined
          }
          onClose={() => setIsCompareOpen(false)}
        />
      )}
      {user && seller && (
        <Chat
          user={user}
          seller={seller}
          buttonClassNames="w-full uppercase"
          product={product}
        />
      )}
    </div>
  )
}
