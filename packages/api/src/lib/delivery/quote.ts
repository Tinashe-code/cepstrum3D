import { AddressLike, deliveryDistanceKm } from "./geo";
import { cityMatches, legQualifiesByProductRules, LegItem, orderThresholdLabel, ruleLabel } from "./rules";
import { DeliverySettings } from "./settings";

export type DeliveryQuote = {
  amount: number;
  free: boolean;
  /** Why it is free, e.g. "Free delivery on orders from $300 in Harare". */
  free_reason?: string;
  km?: number;
  estimated?: boolean;
};

export class DeliveryQuoteError extends Error {}

const roundUp = (amount: number, step: number) => (step > 0 ? Math.ceil(amount / step - 1e-9) * step : amount);

/**
 * Price of one vendor's delivery to the customer.
 * 1. Whole cart ≥ FREE_DELIVERY_MIN_ORDER (in the listed cities) → free.
 * 2. Every product from this vendor meets its free-delivery rule → free.
 * 3. Otherwise base fee + per-km × road distance (min fee, rounded up).
 */
export async function quoteDelivery({
  from,
  to,
  items,
  goodsTotal,
  settings,
}: {
  from: AddressLike;
  to?: AddressLike | null;
  items: LegItem[];
  goodsTotal: number;
  settings: DeliverySettings;
}): Promise<DeliveryQuote> {
  if (!to || (!to.city && !to.address_1 && !(to.metadata as Record<string, unknown> | undefined)?.lat)) {
    throw new DeliveryQuoteError("Enter your delivery address to see the delivery price.");
  }

  if (settings.freeMinOrder > 0 && goodsTotal >= settings.freeMinOrder && cityMatches(settings.freeOrderCities, to.city)) {
    return { amount: 0, free: true, free_reason: orderThresholdLabel(settings) };
  }

  if (legQualifiesByProductRules(items, to.city)) {
    const rules = items.map((i) => i.rule!).filter(Boolean);
    const labels = [...new Set(rules.map(ruleLabel))];
    return { amount: 0, free: true, free_reason: labels.length === 1 ? labels[0] : "Free delivery on these items" };
  }

  const distance = await deliveryDistanceKm(from, to, settings.googleMapsApiKey);
  if (!distance) {
    throw new DeliveryQuoteError("We couldn't work out the distance to this address. Check the town or city.");
  }

  const raw = settings.baseFee + settings.perKm * distance.km;
  const amount = roundUp(Math.max(raw, settings.minFee), settings.roundTo);
  return {
    amount: Math.round(amount * 100) / 100,
    free: false,
    km: Math.round(distance.km * 10) / 10,
    estimated: distance.estimated,
  };
}
