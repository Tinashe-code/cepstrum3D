'use client';

import { createContext, PropsWithChildren, useCallback, useContext, useEffect, useState } from 'react';

import { getWishlist, toggleWishlistItem } from '@/lib/data/wishlist';

type WishlistContextValue = {
  loggedIn: boolean;
  ready: boolean;
  isSaved: (productId: string) => boolean;
  toggle: (productId: string) => Promise<{ loggedIn: boolean }>;
};

const WishlistContext = createContext<WishlistContextValue | null>(null);

/** Loads the signed-in customer's favourites once and shares them with every product card. */
export function WishlistProvider({ children }: PropsWithChildren) {
  const [ids, setIds] = useState<string[]>([]);
  const [loggedIn, setLoggedIn] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    getWishlist()
      .then(({ loggedIn, productIds }) => {
        setLoggedIn(loggedIn);
        setIds(productIds);
      })
      .finally(() => setReady(true));
  }, []);

  const isSaved = useCallback((productId: string) => ids.includes(productId), [ids]);

  const toggle = useCallback(
    async (productId: string) => {
      if (!loggedIn) return { loggedIn: false };
      // Optimistic update; rolled back if the request fails.
      const previous = ids;
      setIds(prev => (prev.includes(productId) ? prev.filter(id => id !== productId) : [productId, ...prev]));
      try {
        const res = await toggleWishlistItem(productId);
        setLoggedIn(res.loggedIn);
        if (res.loggedIn) setIds(res.productIds);
        return { loggedIn: res.loggedIn };
      } catch {
        setIds(previous);
        return { loggedIn: true };
      }
    },
    [ids, loggedIn]
  );

  return (
    <WishlistContext.Provider value={{ loggedIn, ready, isSaved, toggle }}>{children}</WishlistContext.Provider>
  );
}

export function useWishlist() {
  const ctx = useContext(WishlistContext);
  if (!ctx) throw new Error('useWishlist must be used within a WishlistProvider');
  return ctx;
}
