import LocalizedClientLink from "@/components/molecules/LocalizedLink/LocalizedLink"
import Image from "next/image"

/**
 * A category tile. Shows the picture set in admin → Categories → Media (or its
 * Icon); without one, the built-in drawing in public/images/categories.
 */
export function CategoryCard({
  category,
  image,
}: {
  category: { name: string; handle: string }
  image?: { image: string | null; icon: string | null } | null
}) {
  const src = image?.image || image?.icon || `/images/categories/${category.handle}.png`
  return (
    <LocalizedClientLink
      href={`/categories/${category.handle}`}
      className="relative flex flex-col items-center border rounded-sm bg-component transition-all hover:rounded-full w-[233px] aspect-square"
    >
      <div className="flex relative aspect-square overflow-hidden w-[200px]">
        <Image
          loading="lazy"
          src={src}
          alt={`category - ${category.name}`}
          width={200}
          height={200}
          sizes="(min-width: 1024px) 200px, 40vw"
          className="object-contain scale-90 rounded-full"
        />
      </div>
      <h3 className="w-full text-center label-lg text-primary">
        {category.name}
      </h3>
    </LocalizedClientLink>
  )
}
