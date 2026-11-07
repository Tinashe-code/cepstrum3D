import { ProductDetails, ProductGallery } from "@/components/organisms"
import { listProducts, listSimilarProducts } from "@/lib/data/products"
import { listOffers } from "@/lib/data/offers"
import { StoreOffer } from "@/lib/helpers/buybox"
import { HomeProductSection } from "../HomeProductSection/HomeProductSection"
import { ProductReviews } from "../ProductReviews/ProductReviews"
import NotFound from "@/app/not-found"

export const ProductDetailsPage = async ({
  handle,
  locale,
}: {
  handle: string
  locale: string
}) => {
  const prod = await listProducts({
    countryCode: locale,
    queryParams: { handle: [handle], limit: 1 },
  }).then(({ response }) => response.products[0])

  if (!prod) return null

  if (prod.seller?.store_status === "SUSPENDED") {
    return NotFound()
  }

  const [{ offers }, similar] = await Promise.all([
    listOffers({ productId: prod.id, countryCode: locale }),
    listSimilarProducts({ productId: prod.id, countryCode: locale }),
  ])

  return (
    <>
      <div className="flex flex-col md:flex-row lg:gap-12" data-testid="product-details-page">
        <div className="md:w-1/2 md:px-2" data-testid="product-gallery-container">
          <ProductGallery images={prod?.images || []} variants={prod?.variants || []} />
        </div>
        <div className="md:w-1/2 md:px-2" data-testid="product-details-container">
          <ProductDetails
            product={prod}
            locale={locale}
            offers={offers as StoreOffer[]}
          />
        </div>
      </div>
      <ProductReviews productId={prod.id} productTitle={prod.title} />
      <div className="my-8">
        <HomeProductSection
          heading="Similar items"
          products={similar as never}
          locale={locale}
        />
      </div>
    </>
  )
}
