import type { MedusaNextFunction, MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import type { MedusaContainer } from "@medusajs/framework/types";
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils";
import { refreshCartItemsWorkflow } from "@medusajs/medusa/core-flows";

/**
 * Quantity price ranges ("1–3: $10 each, 4 and above: $9 each").
 *
 * A vendor sets ranges on a listing (offer.metadata.quantity_prices):
 *   [{ min_quantity: 1, max_quantity: 3, unit_price: 10 },
 *    { min_quantity: 4, max_quantity: null, unit_price: 9 }]   // null = "and above"
 *
 * When the cart quantity falls in a range, EVERY item on that line is charged the
 * range's price (4 items = 4 × $9). A quantity no range covers pays the normal price.
 * Stock stays on the listing (one item = one unit of stock).
 *
 * The price is set here on the server after every cart change and again at
 * checkout, so customers can't set it themselves.
 */

export type QuantityRange = { min_quantity: number; max_quantity: number | null; unit_price: number };

const MAX_QTY = 100000;
const r2 = (n: number) => Math.round(n * 100) / 100;

/** Cleaned-up ranges from offer metadata, sorted by start; overlapping/invalid ones dropped. */
export function readRanges(metadata: unknown): QuantityRange[] {
  const raw = (metadata as any)?.quantity_prices;
  if (!Array.isArray(raw)) return [];
  const ranges: QuantityRange[] = [];
  for (const t of raw) {
    const min = Number(t?.min_quantity);
    const max = t?.max_quantity === null || t?.max_quantity === undefined || t?.max_quantity === "" ? null : Number(t.max_quantity);
    const price = Number(t?.unit_price);
    if (!Number.isInteger(min) || min < 1 || min > MAX_QTY) continue;
    if (max !== null && (!Number.isInteger(max) || max < min)) continue;
    if (!Number.isFinite(price) || price <= 0) continue;
    ranges.push({ min_quantity: min, max_quantity: max, unit_price: r2(price) });
  }
  ranges.sort((a, b) => a.min_quantity - b.min_quantity);
  // Drop any range that overlaps the one before it.
  return ranges.filter((r, i) => i === 0 || (ranges[i - 1].max_quantity !== null && r.min_quantity > ranges[i - 1].max_quantity!));
}

/** Problems with a vendor's ranges, in plain words (empty = fine). */
export function rangeProblems(raw: unknown[]): string[] {
  const problems: string[] = [];
  const rows = raw.map((t: any) => ({
    min: Number(t?.min_quantity),
    max: t?.max_quantity === null || t?.max_quantity === undefined || t?.max_quantity === "" ? null : Number(t.max_quantity),
    price: Number(t?.unit_price),
  }));
  rows.forEach((r, i) => {
    const n = `Row ${i + 1}`;
    if (!Number.isInteger(r.min) || r.min < 1) problems.push(`${n}: "from" must be a whole number of 1 or more.`);
    if (r.max !== null && (!Number.isInteger(r.max) || r.max < r.min)) problems.push(`${n}: "to" must be empty (= and above) or a whole number not below "from".`);
    if (!Number.isFinite(r.price) || r.price <= 0) problems.push(`${n}: price must be above 0.`);
  });
  const sorted = [...rows].sort((a, b) => a.min - b.min);
  for (let i = 1; i < sorted.length; i++) {
    const prev = sorted[i - 1];
    if (prev.max === null || sorted[i].min <= prev.max) {
      problems.push(`The ranges starting at ${prev.min} and ${sorted[i].min} overlap.`);
    }
  }
  return problems;
}

/** Price per item for `qty`, or null if no range covers it. */
export function rangePrice(qty: number, ranges: QuantityRange[]) {
  const r = ranges.find((x) => qty >= x.min_quantity && (x.max_quantity === null || qty <= x.max_quantity));
  return r ? r.unit_price : null;
}

type CartItem = {
  id: string;
  quantity: number;
  unit_price: number;
  is_custom_price?: boolean;
  metadata?: Record<string, any> | null;
};

/**
 * Re-price every line in the cart whose listing has quantity prices. Returns
 * true if anything changed. The normal price is remembered on the line
 * (metadata.regular_unit_price) so it can be restored when no range applies.
 */
export async function applyQuantityPrices(container: MedusaContainer, cartId: string) {
  const query = container.resolve(ContainerRegistrationKeys.QUERY);
  const { data: carts } = await query.graph({
    entity: "cart",
    fields: ["id", "completed_at", "items.id", "items.quantity", "items.unit_price", "items.is_custom_price", "items.metadata"],
    filters: { id: cartId },
  });
  const cart = carts[0] as { completed_at?: string | null; items?: CartItem[] } | undefined;
  if (!cart || cart.completed_at) return false;

  const items = (cart.items ?? []).filter((i) => i?.metadata?.offer_id);
  if (!items.length) return false;

  const offerIds = [...new Set(items.map((i) => String(i.metadata!.offer_id)))];
  const { data: offers } = await query.graph({ entity: "offer", fields: ["id", "metadata"], filters: { id: offerIds } });
  const rangesByOffer = new Map((offers as { id: string; metadata?: unknown }[]).map((o) => [o.id, readRanges(o.metadata)]));

  const updates: any[] = [];
  for (const item of items) {
    const ranges = rangesByOffer.get(String(item.metadata!.offer_id)) ?? [];
    const remembered = Number(item.metadata?.regular_unit_price);
    const regular = Number.isFinite(remembered) && remembered > 0 ? remembered : Number(item.unit_price);
    const price = ranges.length ? rangePrice(Number(item.quantity), ranges) : null;

    if (price === null) {
      // No range applies (or the vendor removed them): back to the normal price.
      if (item.metadata?.regular_unit_price != null) {
        const { regular_unit_price, quantity_price, ...rest } = item.metadata ?? {};
        updates.push({ id: item.id, unit_price: regular, is_custom_price: false, metadata: rest });
      }
      continue;
    }
    if (item.is_custom_price && Math.abs(Number(item.unit_price) - price) < 0.0001 && item.metadata?.regular_unit_price != null) continue;
    updates.push({
      id: item.id,
      unit_price: price,
      is_custom_price: true,
      metadata: { ...(item.metadata ?? {}), regular_unit_price: regular, quantity_price: price },
    });
  }
  if (!updates.length) return false;

  await container.resolve(Modules.CART).updateLineItems(updates as any);
  // Recalculate delivery, promotions and the payment amount with the new prices.
  await refreshCartItemsWorkflow(container).run({ input: { cart_id: cartId } });
  return true;
}

/** After add-to-cart / quantity change: re-price before the response goes out. */
export function quantityPricesAfterCartChange(req: MedusaRequest, res: MedusaResponse, next: MedusaNextFunction) {
  const cartId = req.params.id;
  const json = res.json.bind(res);
  res.json = ((body: unknown) => {
    if (res.statusCode >= 400 || !cartId) return json(body);
    applyQuantityPrices(req.scope, cartId)
      .catch((e) => req.scope.resolve(ContainerRegistrationKeys.LOGGER).error(`[quantity prices] ${(e as Error).message}`))
      .finally(() => json(body));
    return res;
  }) as typeof res.json;
  next();
}

/** Just before checkout completes: make sure every line has the right price. */
export async function quantityPricesBeforeCheckout(req: MedusaRequest, _res: MedusaResponse, next: MedusaNextFunction) {
  try {
    if (req.params.id) await applyQuantityPrices(req.scope, req.params.id);
  } catch (e) {
    req.scope.resolve(ContainerRegistrationKeys.LOGGER).error(`[quantity prices] checkout: ${(e as Error).message}`);
  }
  next();
}
