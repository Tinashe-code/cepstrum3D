import { normaliseCity } from "./geo";
import { DeliverySettings, parseCities } from "./settings";

/**
 * Free-delivery rule on a product, set by the admin in the product's Metadata:
 *
 *   free_delivery_cities   = Harare              (comma separated; empty = any city)
 *   free_delivery_min_qty  = 4                   (optional; minimum units of this product)
 *   free_delivery_unit     = spools              (optional; word used in labels, default "items")
 *
 * At least one of cities / min qty must be set for the rule to exist.
 */
export type FreeDeliveryRule = {
  cities: string[];
  minQty: number | null;
  unit: string;
};

export const readFreeDeliveryRule = (metadata?: Record<string, unknown> | null): FreeDeliveryRule | null => {
  const m = metadata ?? {};
  const cities = parseCities(m.free_delivery_cities as string | undefined);
  const qty = Number(m.free_delivery_min_qty);
  const minQty = Number.isFinite(qty) && qty > 1 ? Math.floor(qty) : null;
  const enabled = cities.length > 0 || minQty !== null || String(m.free_delivery ?? "") === "true";
  if (!enabled) return null;
  return { cities, minQty, unit: String(m.free_delivery_unit || "items") };
};

const list = (cities: string[]) =>
  cities.length <= 1 ? cities[0] ?? "" : `${cities.slice(0, -1).join(", ")} and ${cities[cities.length - 1]}`;

/** "Free delivery in Harare from 4 spools" */
export const ruleLabel = (r: FreeDeliveryRule) =>
  ["Free delivery", r.cities.length ? `in ${list(r.cities)}` : "", r.minQty ? `from ${r.minQty} ${r.unit}` : ""]
    .filter(Boolean)
    .join(" ");

const money = (n: number) => `$${Number.isInteger(n) ? n : n.toFixed(2)}`;

/** "Free delivery on orders from $300 in Harare" */
export const orderThresholdLabel = (s: DeliverySettings) =>
  s.freeMinOrder > 0
    ? `Free delivery on orders from ${money(s.freeMinOrder)}${s.freeOrderCities.length ? ` in ${list(s.freeOrderCities)}` : ""}`
    : "";

export const cityMatches = (cities: string[], customerCity?: string | null) =>
  !cities.length || cities.map(normaliseCity).includes(normaliseCity(customerCity));

export type LegItem = {
  product_id: string;
  title: string;
  quantity: number;
  rule: FreeDeliveryRule | null;
};

/**
 * A vendor's delivery is free by product rule only when every product in that
 * vendor's part of the cart qualifies (one trip carries all of them).
 */
export const legQualifiesByProductRules = (items: LegItem[], customerCity?: string | null) => {
  if (!items.length) return false;
  const qtyByProduct = new Map<string, number>();
  for (const i of items) qtyByProduct.set(i.product_id, (qtyByProduct.get(i.product_id) ?? 0) + i.quantity);
  return items.every(
    (i) =>
      i.rule !== null &&
      cityMatches(i.rule.cities, customerCity) &&
      (i.rule.minQty === null || (qtyByProduct.get(i.product_id) ?? 0) >= i.rule.minQty)
  );
};
