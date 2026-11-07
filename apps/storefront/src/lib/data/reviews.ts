'use server';

import { revalidateTag } from 'next/cache';

import { getAuthHeaders } from './cookies';

/**
 * Product ratings & reviews (backend: packages/api/src/lib/reviews).
 * Public lists are cached for 5 minutes under the 'reviews' tag, refreshed
 * straight away when a customer posts or edits a review.
 */

const BACKEND = process.env.MEDUSA_BACKEND_URL || 'http://localhost:9000';
const KEY = process.env.NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY || '';

export type ReviewSummary = {
  average: number | null;
  count: number;
  distribution: Record<'1' | '2' | '3' | '4' | '5', number>;
};

export type ProductReview = {
  id: string;
  rating: number;
  text: string | null;
  author: string;
  verified: boolean;
  seller_reply: string | null;
  seller_name: string | null;
  created_at: string;
};

export type MyReview = {
  can_review: boolean;
  reason: 'not_purchased' | 'not_received' | null;
  review: { id: string; rating: number; text: string | null; status: string } | null;
};

export type ReviewSort = 'newest' | 'highest' | 'lowest';

export async function getProductReviews(
  productId: string,
  opts: { limit?: number; offset?: number; sort?: ReviewSort } = {}
): Promise<{ summary: ReviewSummary; reviews: ProductReview[]; mine: MyReview | null }> {
  const auth = await getAuthHeaders();
  const signedIn = 'authorization' in auth;
  const params = new URLSearchParams({
    limit: String(opts.limit ?? 5),
    offset: String(opts.offset ?? 0),
    sort: opts.sort ?? 'newest'
  });
  try {
    const res = await fetch(`${BACKEND}/store/product-reviews/${productId}?${params}`, {
      headers: { 'x-publishable-api-key': KEY, ...auth },
      // A signed-in customer gets their own state, so skip the shared cache.
      ...(signedIn ? { cache: 'no-store' as const } : { next: { revalidate: 300, tags: ['reviews'] } })
    });
    if (!res.ok) throw new Error();
    return await res.json();
  } catch {
    return {
      summary: { average: null, count: 0, distribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 } },
      reviews: [],
      mine: null
    };
  }
}

export async function submitProductReview(
  productId: string,
  rating: number,
  text: string
): Promise<{ ok: boolean; message?: string; status?: string }> {
  const res = await fetch(`${BACKEND}/store/product-reviews/${productId}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-publishable-api-key': KEY, ...(await getAuthHeaders()) },
    body: JSON.stringify({ rating, text }),
    cache: 'no-store'
  }).catch(() => null);
  if (!res) return { ok: false, message: "We couldn't reach the store. Please try again." };
  const body = (await res.json().catch(() => ({}))) as { message?: string; status?: string };
  if (!res.ok) return { ok: false, message: body.message || 'Could not save your review.' };
  revalidateTag('reviews');
  return { ok: true, status: body.status };
}

/** { productId: { average, count } } for product cards. */
export async function getReviewSummaries(productIds: string[]): Promise<Record<string, { average: number; count: number }>> {
  const ids = [...new Set(productIds)].filter(Boolean);
  if (!ids.length) return {};
  try {
    const res = await fetch(`${BACKEND}/store/product-reviews?product_id=${ids.sort().join(',')}`, {
      headers: { 'x-publishable-api-key': KEY },
      next: { revalidate: 300, tags: ['reviews'] }
    });
    if (!res.ok) return {};
    return ((await res.json()) as { summaries: Record<string, { average: number; count: number }> }).summaries;
  } catch {
    return {};
  }
}

/** Adds `rating: { average, count }` to each product (cards show stars when count > 0). */
export async function withRatings<T extends { id: string }>(products: T[]): Promise<(T & { rating?: { average: number; count: number } })[]> {
  const s = await getReviewSummaries(products.map((p) => p.id));
  return products.map((p) => (s[p.id] ? { ...p, rating: s[p.id] } : p));
}
