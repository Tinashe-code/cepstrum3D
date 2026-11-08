'use client';

import { HttpTypes } from '@medusajs/types';
import { useSearchParams } from 'next/navigation';

import { GalleryCarousel } from '@/components/organisms';
import { imageNamedFor, variantImage as imageOfVariant } from '@/lib/helpers/product-image';

/**
 * Product images. When a colour is chosen (?colour=Red), that colour's picture
 * (the variant's thumbnail or first linked image) is shown first.
 */
export const ProductGallery = ({
  images,
  variants = [],
}: {
  images: HttpTypes.StoreProduct['images'];
  variants?: (HttpTypes.StoreProductVariant & { thumbnail?: string | null })[];
}) => {
  const searchParams = useSearchParams();
  const colour = searchParams.get('colour') ?? searchParams.get('color');

  if (!images || images.length === 0) return null;

  const chosen = colour
    ? variants.find(v =>
        (v.options ?? []).some(
          o => /^colou?r$/i.test(o.option?.title ?? '') && o.value === colour
        )
      )
    : null;
  const variantImage = chosen
    ? imageOfVariant(chosen as never) || imageNamedFor(images, colour)
    : null;

  const ordered = variantImage
    ? [
        ...images.filter(img => img.url === variantImage),
        ...images.filter(img => img.url !== variantImage)
      ]
    : images;

  return (
    <div data-testid="product-gallery">
      {/* key resets the carousel to the first slide when the colour changes */}
      <GalleryCarousel key={variantImage ?? 'default'} images={ordered} />
    </div>
  );
};
