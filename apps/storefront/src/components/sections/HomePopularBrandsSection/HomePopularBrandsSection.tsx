import LocalizedClientLink from "@/components/molecules/LocalizedLink/LocalizedLink"
import { listCollections } from "@/lib/data/collections"

/**
 * "Shop by brand" — every brand is a product collection (seeded in
 * packages/api/src/scripts/seed.ts), so each one gets its own landing page at
 * /collections/<handle>, like 3djake.com/kingroon.
 *
 * Brands are shown as text wordmarks; add official logo files here only once
 * the brand owner has given permission.
 */
export async function HomePopularBrandsSection() {
  const { collections } = await listCollections().catch(() => ({
    collections: [],
    count: 0,
  }))

  if (!collections.length) {
    return null
  }

  return (
    <section className="bg-ink px-4 py-8 md:px-6 lg:px-8 w-full">
      <div className="mb-6 flex items-center justify-between">
        <h2 className="heading-lg text-white uppercase">Shop by brand</h2>
      </div>
      <ul className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
        {collections.map((brand) => (
          <li key={brand.id}>
            <LocalizedClientLink
              href={`/collections/${brand.handle}`}
              className="flex h-24 items-center justify-center rounded-sm border border-white/20 text-white heading-sm uppercase tracking-wide transition-colors hover:border-accent hover:bg-accent hover:text-white"
            >
              {brand.title}
            </LocalizedClientLink>
          </li>
        ))}
      </ul>
    </section>
  )
}
