import { redirect } from "next/navigation"

import { UserNavigation } from "@/components/molecules"
import ProductListingProductsView from "@/components/molecules/ProductListingProductsView/ProductListingProductsView"
import LocalizedClientLink from "@/components/molecules/LocalizedLink/LocalizedLink"
import { retrieveCustomer } from "@/lib/data/customer"
import { listProducts } from "@/lib/data/products"
import { getWishlist } from "@/lib/data/wishlist"

export default async function FavouritesPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  const user = await retrieveCustomer()
  if (!user) {
    redirect(`/${locale}/login`)
  }

  const { productIds } = await getWishlist()
  const products = productIds.length
    ? (
        await listProducts({
          countryCode: locale,
          queryParams: { id: productIds, limit: productIds.length } as never,
        })
      ).response.products
    : []

  // Keep the order the customer saved them in (newest first).
  const ordered = productIds
    .map((id) => products.find((p) => p.id === id))
    .filter((p): p is NonNullable<typeof p> => Boolean(p))

  return (
    <main className="container" data-testid="wishlist-page">
      <div className="grid grid-cols-1 md:grid-cols-4 mt-6 gap-5 md:gap-8">
        <UserNavigation />
        <div className="md:col-span-3">
          <h1 className="heading-md uppercase mb-6">Favourites</h1>
          {ordered.length ? (
            <ProductListingProductsView products={ordered} />
          ) : (
            <div className="border rounded-sm p-8 text-center">
              <p className="label-lg mb-2">No favourites yet</p>
              <p className="text-md text-secondary mb-4">
                Tap the heart on any product to save it here.
              </p>
              <LocalizedClientLink href="/categories" className="label-md text-accent underline">
                Browse products
              </LocalizedClientLink>
            </div>
          )}
        </div>
      </div>
    </main>
  )
}
