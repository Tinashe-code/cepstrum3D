import { getProductReviews } from '@/lib/data/reviews';

import { ProductReviewsClient } from './ProductReviewsClient';

/** "Ratings & reviews" on the product page. Server part: first page of reviews. */
export const ProductReviews = async ({ productId, productTitle }: { productId: string; productTitle: string }) => {
  const initial = await getProductReviews(productId, { limit: 5 });
  return (
    <ProductReviewsClient
      productId={productId}
      productTitle={productTitle}
      initial={initial}
    />
  );
};
