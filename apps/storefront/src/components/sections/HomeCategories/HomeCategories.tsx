import { Carousel } from "@/components/cells"
import { CategoryCard } from "@/components/organisms"
import { getCategoryImages } from "@/lib/data/categories"

// Top-level categories, mirroring 3DJake's main navigation.
// Handles match the seed (packages/api/src/scripts/seed.ts); images live in public/images/categories.
export const categories: { id: number; name: string; handle: string }[] = [
  { id: 1, name: "Filaments", handle: "filaments" },
  { id: 2, name: "3D Printers & More", handle: "3d-printers-more" },
  { id: 3, name: "Resin", handle: "resin" },
  { id: 4, name: "Spare Parts & Upgrades", handle: "spare-parts-upgrades" },
  { id: 5, name: "Accessories", handle: "accessories" },
]

export const HomeCategories = async ({ heading }: { heading: string }) => {
  const images = await getCategoryImages()
  return (
    <section className="bg-primary py-8 w-full">
      <div className="mb-6">
        <h2 className="heading-lg text-primary uppercase">{heading}</h2>
      </div>
      <Carousel
        items={categories?.map((category) => (
          <CategoryCard key={category.id} category={category} image={images[category.handle]} />
        ))}
      />
    </section>
  )
}
