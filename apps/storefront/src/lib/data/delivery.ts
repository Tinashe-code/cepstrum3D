'use server';

import { getAuthHeaders } from './cookies';

const BACKEND = process.env.MEDUSA_BACKEND_URL || 'http://localhost:9000';
const KEY = process.env.NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY || '';

export type DeliverySettings = {
  base_fee: number;
  per_km: number;
  min_fee: number;
  free_min_order: number;
  free_order_cities: string[];
  free_order_label: string;
};

export type VendorDeliveryQuote = {
  seller_id: string;
  seller_name: string;
  from_city: string;
  amount?: number;
  free?: boolean;
  free_reason?: string;
  km?: number;
  estimated?: boolean;
  error?: string;
};

export type DeliveryQuote = {
  vendors: VendorDeliveryQuote[];
  total: number;
  goods_total: number;
  free_order: { label: string; min_order: number; cities: string[]; remaining: number | null };
  rate: { base_fee: number; per_km: number; min_fee: number };
};

/** Platform delivery rate and the store-wide free-delivery threshold (cached for 5 minutes). */
export async function getDeliverySettings(): Promise<DeliverySettings | null> {
  try {
    const res = await fetch(`${BACKEND}/store/delivery/settings`, {
      headers: { 'x-publishable-api-key': KEY },
      next: { revalidate: 300 },
    });
    if (!res.ok) return null;
    return ((await res.json()) as { delivery: DeliverySettings }).delivery;
  } catch {
    return null;
  }
}

/** Per-vendor delivery price / distance / free reason for a cart (never cached). */
export async function getDeliveryQuote(cartId: string): Promise<DeliveryQuote | null> {
  try {
    const res = await fetch(`${BACKEND}/store/carts/${cartId}/delivery-quote`, {
      headers: { 'x-publishable-api-key': KEY, ...(await getAuthHeaders()) },
      cache: 'no-store',
    });
    if (!res.ok) return null;
    return ((await res.json()) as { delivery_quote: DeliveryQuote }).delivery_quote;
  } catch {
    return null;
  }
}

export type PlaceSuggestion = { place_id: string; main: string; secondary: string };
export type PlaceAddress = {
  address_1: string;
  city: string;
  province: string;
  postal_code: string;
  lat: number | null;
  lng: number | null;
  place_id: string;
  formatted: string;
};

/** Google address suggestions (Zimbabwe), via the backend. `enabled` is false without a Google key. */
export async function searchPlaces(
  input: string,
  session: string
): Promise<{ enabled: boolean; suggestions: PlaceSuggestion[] }> {
  try {
    const res = await fetch(
      `${BACKEND}/store/delivery/places?input=${encodeURIComponent(input)}&session=${encodeURIComponent(session)}`,
      { headers: { 'x-publishable-api-key': KEY }, cache: 'no-store' }
    );
    const json = (await res.json()) as { enabled?: boolean; suggestions?: PlaceSuggestion[] };
    return { enabled: !!json.enabled, suggestions: json.suggestions ?? [] };
  } catch {
    return { enabled: false, suggestions: [] };
  }
}

/** Full address + coordinates for a chosen suggestion. */
export async function getPlace(placeId: string, session: string): Promise<PlaceAddress | null> {
  try {
    const res = await fetch(
      `${BACKEND}/store/delivery/places?place_id=${encodeURIComponent(placeId)}&session=${encodeURIComponent(session)}`,
      { headers: { 'x-publishable-api-key': KEY }, cache: 'no-store' }
    );
    return ((await res.json()) as { address?: PlaceAddress | null }).address ?? null;
  } catch {
    return null;
  }
}

/**
 * Nearest address to the customer's own location (browser GPS). The point kept
 * is theirs, so delivery is priced to where they are even if the street name
 * Google gives is only close.
 */
export async function locatePlace(lat: number, lng: number): Promise<PlaceAddress | null> {
  try {
    const res = await fetch(`${BACKEND}/store/delivery/places?lat=${lat}&lng=${lng}`, {
      headers: { 'x-publishable-api-key': KEY },
      cache: 'no-store'
    });
    return ((await res.json()) as { address?: PlaceAddress | null }).address ?? null;
  } catch {
    return null;
  }
}

/** Units left at a limited sale price, per offer: { offer_id: remaining }. */
export async function getSaleRemaining(offerIds: string[]): Promise<Record<string, number>> {
  const ids = offerIds.filter(Boolean);
  if (!ids.length) return {};
  try {
    const res = await fetch(`${BACKEND}/store/sale-limits?offer_id=${encodeURIComponent(ids.join(','))}`, {
      headers: { 'x-publishable-api-key': KEY },
      cache: 'no-store'
    });
    const json = (await res.json()) as { sale_limits?: Record<string, { remaining: number }> };
    return Object.fromEntries(Object.entries(json.sale_limits ?? {}).map(([k, v]) => [k, v.remaining]));
  } catch {
    return {};
  }
}
