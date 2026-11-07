'use server';

/**
 * Favourites (wishlist).
 *
 * Stored on the signed-in customer as `metadata.wishlist` — a list of product ids —
 * through the standard Store API (`POST /store/customers/me`). No backend module needed.
 * Guests have no favourites; the heart button sends them to the login page.
 */
import { HttpTypes } from '@medusajs/types';
import { revalidateTag } from 'next/cache';

import { sdk } from '../client';
import { getAuthHeaders, getCacheTag } from './cookies';

const MAX_ITEMS = 200;

const readIds = (customer?: HttpTypes.StoreCustomer | null) => {
  const raw = (customer?.metadata as { wishlist?: unknown } | null | undefined)?.wishlist;
  return Array.isArray(raw) ? raw.filter((id): id is string => typeof id === 'string') : [];
};

const fetchMe = async () => {
  const authHeaders = await getAuthHeaders();
  if (!authHeaders || !Object.keys(authHeaders).length) return null;
  return (sdk.store.customers.me
    .query({ fields: 'id,metadata', fetchOptions: { headers: { ...authHeaders }, cache: 'no-store' } } as never) as unknown as Promise<{
    customer: HttpTypes.StoreCustomer;
  }>)
    .then(({ customer }) => customer ?? null)
    .catch(() => null);
};

export async function getWishlist(): Promise<{ loggedIn: boolean; productIds: string[] }> {
  const customer = await fetchMe();
  return { loggedIn: Boolean(customer), productIds: readIds(customer) };
}

/** Adds or removes a product. Returns the updated list. */
export async function toggleWishlistItem(
  productId: string
): Promise<{ loggedIn: boolean; productIds: string[]; saved: boolean }> {
  const customer = await fetchMe();
  if (!customer) return { loggedIn: false, productIds: [], saved: false };

  const current = readIds(customer);
  const saved = !current.includes(productId);
  const productIds = saved
    ? [productId, ...current].slice(0, MAX_ITEMS)
    : current.filter(id => id !== productId);

  await sdk.store.customers.me.mutate({
    metadata: { ...(customer.metadata ?? {}), wishlist: productIds },
    fetchOptions: { headers: { ...(await getAuthHeaders()) } }
  } as never);

  revalidateTag(await getCacheTag('customers'));
  return { loggedIn: true, productIds, saved };
}
