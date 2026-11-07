/**
 * Free-delivery rule on a product (admin sets it in Product → Metadata):
 *   free_delivery_cities = "Harare"   free_delivery_min_qty = "4"   free_delivery_unit = "spools"
 * Mirrors packages/api/src/lib/delivery/rules.ts, which decides the actual price.
 */
export type FreeDeliveryRule = { cities: string[]; minQty: number | null; unit: string };

const cities = (v: unknown) =>
  String(v ?? '')
    .split(',')
    .map(c => c.trim())
    .filter(Boolean);

export const getFreeDeliveryRule = (metadata?: Record<string, unknown> | null): FreeDeliveryRule | null => {
  const m = metadata ?? {};
  const c = cities(m.free_delivery_cities);
  const q = Number(m.free_delivery_min_qty);
  const minQty = Number.isFinite(q) && q > 1 ? Math.floor(q) : null;
  if (!c.length && minQty === null && String(m.free_delivery ?? '') !== 'true') return null;
  return { cities: c, minQty, unit: String(m.free_delivery_unit || 'items') };
};

const list = (c: string[]) =>
  c.length <= 1 ? c[0] ?? '' : `${c.slice(0, -1).join(', ')} and ${c[c.length - 1]}`;

/** "Free delivery in Harare from 4 spools" */
export const freeDeliveryLabel = (r: FreeDeliveryRule) =>
  ['Free delivery', r.cities.length ? `in ${list(r.cities)}` : '', r.minQty ? `from ${r.minQty} ${r.unit}` : '']
    .filter(Boolean)
    .join(' ');
