'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';

import { Button, InteractiveStarRating, Stars, Textarea } from '@/components/atoms';
import LocalizedClientLink from '@/components/molecules/LocalizedLink/LocalizedLink';
import {
  getProductReviews,
  submitProductReview,
  type MyReview,
  type ProductReview,
  type ReviewSort,
  type ReviewSummary
} from '@/lib/data/reviews';
import { cn } from '@/lib/utils';

const PAGE = 5;
const RATING_WORDS = ['', 'Poor', 'Fair', 'Good', 'Very good', 'Excellent'];

const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

export const ProductReviewsClient = ({
  productId,
  productTitle,
  initial
}: {
  productId: string;
  productTitle: string;
  initial: { summary: ReviewSummary; reviews: ProductReview[]; mine: MyReview | null };
}) => {
  const router = useRouter();
  const [summary, setSummary] = useState(initial.summary);
  const [reviews, setReviews] = useState(initial.reviews);
  const [mine, setMine] = useState(initial.mine);
  const [sort, setSort] = useState<ReviewSort>('newest');
  const [loadingMore, startMore] = useTransition();

  const [writing, setWriting] = useState(false);
  const [rating, setRating] = useState(initial.mine?.review?.rating ?? 0);
  const [text, setText] = useState(initial.mine?.review?.text ?? '');
  const [error, setError] = useState<string>();
  const [saved, setSaved] = useState<string>();
  const [saving, startSave] = useTransition();

  const reload = (nextSort = sort, count = Math.max(PAGE, reviews.length)) =>
    getProductReviews(productId, { limit: count, sort: nextSort }).then(r => {
      setSummary(r.summary);
      setReviews(r.reviews);
      setMine(r.mine);
    });

  const changeSort = (s: ReviewSort) => {
    setSort(s);
    startMore(() => reload(s, PAGE));
  };

  const loadMore = () =>
    startMore(async () => {
      const r = await getProductReviews(productId, { limit: PAGE, offset: reviews.length, sort });
      setReviews(prev => [...prev, ...r.reviews.filter(n => !prev.some(p => p.id === n.id))]);
    });

  const submit = () =>
    startSave(async () => {
      setError(undefined);
      if (!rating) {
        setError('Choose a star rating.');
        return;
      }
      const r = await submitProductReview(productId, rating, text);
      if (!r.ok) {
        setError(r.message);
        return;
      }
      await reload();
      setWriting(false);
      setSaved(
        r.status === 'pending'
          ? 'Thanks! Your review will appear once it has been checked.'
          : 'Thanks! Your review is now live.'
      );
      router.refresh();
    });

  const total = summary.count;
  const hasMore = reviews.length < total;

  return (
    <section
      id="reviews"
      className="my-8 scroll-mt-24 rounded-sm border p-5"
      data-testid="product-reviews"
    >
      <h2 className="heading-md mb-4 uppercase text-primary">Ratings &amp; reviews</h2>

      <div className="grid gap-6 md:grid-cols-[260px_1fr]">
        {/* Summary */}
        <div data-testid="reviews-summary">
          {total ? (
            <>
              <div className="flex items-end gap-2">
                <span className="text-5xl font-bold leading-none text-primary">{summary.average?.toFixed(1)}</span>
                <span className="label-md mb-1 text-secondary">out of 5</span>
              </div>
              <Stars value={summary.average ?? 0} size={22} className="mt-2" />
              <p className="label-md mt-1 text-secondary">
                {total} review{total === 1 ? '' : 's'}
              </p>
              <ul className="mt-4 space-y-1">
                {[5, 4, 3, 2, 1].map(n => {
                  const c = summary.distribution[String(n) as '5'] ?? 0;
                  return (
                    <li key={n} className="flex items-center gap-2 text-sm">
                      <span className="w-10 text-secondary">{n} ★</span>
                      <span className="h-2 flex-1 overflow-hidden rounded-full bg-gray-200">
                        <span
                          className="block h-full rounded-full bg-amber-500"
                          style={{ width: `${total ? (c / total) * 100 : 0}%` }}
                        />
                      </span>
                      <span className="w-6 text-right text-secondary">{c}</span>
                    </li>
                  );
                })}
              </ul>
            </>
          ) : (
            <p className="label-md text-secondary">No reviews yet.</p>
          )}

          {/* Write a review */}
          <div className="mt-5">
            {saved && <p className="label-md mb-2 text-green-700" data-testid="review-saved">{saved}</p>}
            {!mine ? (
              <p className="label-md text-secondary">
                <LocalizedClientLink href="/login" className="underline">Sign in</LocalizedClientLink> to review a product
                you bought.
              </p>
            ) : mine.can_review ? (
              !writing && (
                <Button
                  variant="tonal"
                  className="w-full uppercase"
                  onClick={() => setWriting(true)}
                  data-testid="review-write-button"
                >
                  {mine.review ? 'Edit your review' : 'Write a review'}
                </Button>
              )
            ) : (
              <p className="label-md text-secondary" data-testid="review-not-eligible">
                {mine.reason === 'not_received'
                  ? 'You can review this product once your order has been delivered.'
                  : 'Only customers who bought this product can review it.'}
              </p>
            )}
            {mine?.review?.status === 'pending' && !writing && (
              <p className="label-sm mt-2 text-secondary">Your review is waiting to be checked.</p>
            )}
            {mine?.review?.status === 'rejected' && !writing && (
              <p className="label-sm mt-2 text-negative">Your review was hidden because it broke our review rules. You can edit it.</p>
            )}
          </div>
        </div>

        {/* Form + list */}
        <div>
          {writing && (
            <div className="mb-6 rounded-sm border bg-component-secondary p-4" data-testid="review-form">
              <p className="label-lg mb-1 text-primary">Your rating of {productTitle}</p>
              <div className="flex items-center gap-2">
                <InteractiveStarRating value={rating} onChange={setRating} data-testid="review-stars" />
                <span className="label-md text-secondary">{RATING_WORDS[rating]}</span>
              </div>
              <Textarea
                className="mt-3 min-h-[110px] w-full"
                placeholder="What did you like or not like? How did it print? (optional)"
                maxLength={1000}
                value={text}
                onChange={e => setText(e.target.value)}
                data-testid="review-text"
              />
              <p className="label-sm mt-1 text-right text-secondary">{text.length}/1000</p>
              {error && <p className="label-md text-negative" data-testid="review-error">{error}</p>}
              <div className="mt-2 flex gap-2">
                <Button onClick={submit} disabled={saving} className="uppercase" data-testid="review-submit">
                  {saving ? 'Saving…' : mine?.review ? 'Update review' : 'Post review'}
                </Button>
                <Button variant="text" onClick={() => setWriting(false)} disabled={saving}>
                  Cancel
                </Button>
              </div>
            </div>
          )}

          {total > 1 && (
            <div className="mb-3 flex items-center justify-end gap-2">
              <label htmlFor="review-sort" className="label-md text-secondary">Sort</label>
              <select
                id="review-sort"
                value={sort}
                onChange={e => changeSort(e.target.value as ReviewSort)}
                className="rounded-sm border bg-primary px-2 py-1 text-sm"
                data-testid="review-sort"
              >
                <option value="newest">Newest</option>
                <option value="highest">Highest rating</option>
                <option value="lowest">Lowest rating</option>
              </select>
            </div>
          )}

          <ul className={cn('divide-y', loadingMore && 'opacity-60')} data-testid="review-list">
            {reviews.map(r => (
              <li key={r.id} className="py-4 first:pt-0" data-testid="review-item">
                <div className="flex flex-wrap items-center gap-2">
                  <Stars value={r.rating} size={16} />
                  <span className="label-md font-semibold text-primary">{RATING_WORDS[r.rating]}</span>
                </div>
                <p className="label-sm mt-1 text-secondary">
                  {r.author} · {formatDate(r.created_at)}
                  {r.verified && <span className="ml-2 text-green-700">✓ Verified purchase</span>}
                </p>
                {r.text && <p className="mt-2 whitespace-pre-line text-md text-primary">{r.text}</p>}
                {r.seller_reply && (
                  <div className="mt-3 rounded-sm border-l-4 border-action bg-component-secondary px-3 py-2">
                    <p className="label-sm font-semibold text-primary">Reply from {r.seller_name ?? 'the seller'}</p>
                    <p className="label-md mt-1 whitespace-pre-line text-secondary">{r.seller_reply}</p>
                  </div>
                )}
              </li>
            ))}
          </ul>

          {hasMore && (
            <Button
              variant="tonal"
              className="mt-2 uppercase"
              onClick={loadMore}
              disabled={loadingMore}
              data-testid="review-load-more"
            >
              {loadingMore ? 'Loading…' : `Show more reviews (${total - reviews.length})`}
            </Button>
          )}
        </div>
      </div>
    </section>
  );
};
