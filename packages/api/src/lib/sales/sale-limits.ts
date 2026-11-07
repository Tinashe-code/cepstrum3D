import type { MedusaContainer } from "@medusajs/framework/types";
import { ContainerRegistrationKeys, MedusaError, Modules } from "@medusajs/framework/utils";
import { revalidateStorefront } from "../storefront-cache";

/**
 * Sale quantity per variant — "the sale price on Black ends after 20 are sold,
 * on Blue after 34".
 *
 * Works on sale price lists (vendor Price Lists, type "Sale"). Each price in a
 * vendor's list is for one offer (that vendor's listing of a variant), so the
 * limit is set per offer:
 *
 *   price_list.metadata.sale_limits = { [offer_id]: { limit: 20, sold: 3 } }
 *
 * The price's max_quantity is kept at limit − sold. Medusa only applies a price
 * when the cart line's quantity is ≤ max_quantity, so a line asking for more
 * than what's left pays the normal price, and once it's sold out
 * (max_quantity 0) the variant is back to its normal price. Raising the limit
 * starts the sale again. Sales are counted when an order is placed.
 */

export type SaleLimit = { limit: number; sold: number };
export type SaleLimits = Record<string, SaleLimit>;

type PriceRow = {
  id: string;
  amount: number;
  currency_code: string;
  price_set_id: string;
  max_quantity?: number | null;
  price_rules?: { attribute: string; value: string }[];
};
type PriceListRow = {
  id: string;
  title: string;
  type: string;
  status: string;
  starts_at?: string | null;
  ends_at?: string | null;
  metadata?: Record<string, unknown> | null;
  prices?: PriceRow[];
};

const offerOf = (p: PriceRow) => p.price_rules?.find((r) => r.attribute === "offer_id")?.value ?? null;
export const remainingOf = (l?: SaleLimit) => (l ? Math.max(0, l.limit - l.sold) : null);
const limitsOf = (pl: PriceListRow): SaleLimits => ((pl.metadata ?? {}).sale_limits as SaleLimits) ?? {};

const isLive = (pl: PriceListRow, now = Date.now()) =>
  pl.status === "active" &&
  (!pl.starts_at || new Date(pl.starts_at).getTime() <= now) &&
  (!pl.ends_at || new Date(pl.ends_at).getTime() > now);

const PRICE_LIST_FIELDS = [
  "id",
  "title",
  "type",
  "status",
  "starts_at",
  "ends_at",
  "metadata",
  "prices.id",
  "prices.amount",
  "prices.currency_code",
  "prices.price_set_id",
  "prices.max_quantity",
  "prices.price_rules.attribute",
  "prices.price_rules.value",
];

async function loadPriceList(container: MedusaContainer, id: string) {
  const query = container.resolve(ContainerRegistrationKeys.QUERY);
  const { data } = await query.graph({ entity: "price_list", fields: PRICE_LIST_FIELDS, filters: { id } });
  const pl = data[0] as unknown as PriceListRow | undefined;
  if (!pl) throw new MedusaError(MedusaError.Types.NOT_FOUND, "Price list not found");
  return pl;
}

/** Price lists owned by a seller (Mercur link). */
export async function assertSellerOwnsPriceList(container: MedusaContainer, sellerId: string, priceListId: string) {
  const query = container.resolve(ContainerRegistrationKeys.QUERY);
  const { data } = await query.graph({
    entity: "price_list_seller",
    fields: ["price_list_id"],
    filters: { seller_id: sellerId, price_list_id: priceListId },
  });
  if (!data.length) throw new MedusaError(MedusaError.Types.NOT_FOUND, "Price list not found");
}

/** Rows for the "Sale quantity per variant" section. */
export async function getSaleLimitRows(container: MedusaContainer, priceListId: string) {
  const query = container.resolve(ContainerRegistrationKeys.QUERY);
  const pl = await loadPriceList(container, priceListId);
  const limits = limitsOf(pl);
  const prices = (pl.prices ?? []).filter((p) => offerOf(p));
  const offerIds = [...new Set(prices.map((p) => offerOf(p)!))];

  const { data: offers } = offerIds.length
    ? await query.graph({
        entity: "offer",
        fields: [
          "id",
          "sku",
          "product_variant.title",
          "product_variant.product.title",
          "prices.amount",
          "prices.currency_code",
          "prices.price_list_id",
        ],
        filters: { id: offerIds },
      })
    : { data: [] as unknown[] };
  type OfferRow = {
    id: string;
    sku?: string;
    product_variant?: { title?: string; product?: { title?: string } };
    prices?: { amount: number; currency_code: string; price_list_id?: string | null }[];
  };
  const byId = new Map((offers as OfferRow[]).map((o) => [o.id, o]));
  /** The offer's normal price: its price that isn't on any price list. */
  const regular = (o: OfferRow | undefined, currency: string) =>
    o?.prices?.find((x) => !x.price_list_id && x.currency_code === currency)?.amount ?? null;

  return {
    price_list: { id: pl.id, title: pl.title, type: pl.type, live: isLive(pl) },
    rows: prices.map((p) => {
      const offerId = offerOf(p)!;
      const o = byId.get(offerId);
      const l = limits[offerId];
      return {
        offer_id: offerId,
        price_id: p.id,
        product: o?.product_variant?.product?.title ?? "",
        variant: o?.product_variant?.title ?? "",
        sku: o?.sku ?? "",
        sale_price: Number(p.amount),
        regular_price: regular(o, p.currency_code) === null ? null : Number(regular(o, p.currency_code)),
        currency_code: p.currency_code,
        limit: l?.limit ?? null,
        sold: l?.sold ?? 0,
        remaining: remainingOf(l),
      };
    }),
  };
}

/** Keep each limited price's max_quantity = what's left; unlimited prices have none. */
async function syncMaxQuantities(container: MedusaContainer, pl: PriceListRow, limits: SaleLimits, offerIds?: string[]) {
  const pricing = container.resolve(Modules.PRICING);
  const updates = (pl.prices ?? [])
    .filter((p) => {
      const offer = offerOf(p);
      return offer && (!offerIds || offerIds.includes(offer));
    })
    .map((p) => {
      const remaining = remainingOf(limits[offerOf(p)!]);
      return { id: p.id, price_set_id: p.price_set_id, max_quantity: remaining, currency_code: p.currency_code, amount: p.amount };
    })
    .filter((u, i, all) => all.indexOf(u) === i);
  if (updates.length) {
    await pricing.updatePriceListPrices([{ price_list_id: pl.id, prices: updates as never }]);
  }
}

/**
 * Set limits: { [offer_id]: number | null } (null or "" removes the limit).
 * Units already sold are kept, so lowering the limit below "sold" ends the sale.
 */
export async function setSaleLimits(
  container: MedusaContainer,
  priceListId: string,
  input: Record<string, number | null>
) {
  const pl = await loadPriceList(container, priceListId);
  const known = new Set((pl.prices ?? []).map(offerOf).filter(Boolean) as string[]);
  const limits = { ...limitsOf(pl) };
  const changed: string[] = [];

  for (const [offerId, raw] of Object.entries(input)) {
    if (!known.has(offerId)) continue;
    const value = raw === null || (raw as unknown) === "" ? null : Math.floor(Number(raw));
    if (value === null || !Number.isFinite(value) || value < 0) {
      delete limits[offerId];
    } else {
      limits[offerId] = { limit: value, sold: limits[offerId]?.sold ?? 0 };
    }
    changed.push(offerId);
  }

  const pricing = container.resolve(Modules.PRICING);
  await pricing.updatePriceLists([{ id: pl.id, metadata: { ...(pl.metadata ?? {}), sale_limits: limits } }]);
  await syncMaxQuantities(container, pl, limits, changed);
  await revalidateStorefront();
  return getSaleLimitRows(container, priceListId);
}

/** Live, limited sale prices for offers: { offer_id: { price_list_id, price, remaining } }. */
export async function liveSaleLimitsForOffers(container: MedusaContainer, offerIds: string[]) {
  const query = container.resolve(ContainerRegistrationKeys.QUERY);
  if (!offerIds.length) return {};
  const { data } = await query.graph({
    entity: "price_list",
    fields: PRICE_LIST_FIELDS,
    filters: { type: "sale", status: "active" },
  });
  const result: Record<string, { price_list_id: string; price: number; remaining: number; limit: number }> = {};
  for (const pl of data as unknown as PriceListRow[]) {
    if (!isLive(pl)) continue;
    const limits = limitsOf(pl);
    for (const p of pl.prices ?? []) {
      const offer = offerOf(p);
      if (!offer || !offerIds.includes(offer) || !limits[offer]) continue;
      result[offer] = {
        price_list_id: pl.id,
        price: Number(p.amount),
        remaining: remainingOf(limits[offer])!,
        limit: limits[offer].limit,
      };
    }
  }
  return result;
}

/** After an order is placed: count units bought at a limited sale price. */
export async function recordSaleQuantities(container: MedusaContainer, orderId: string) {
  const query = container.resolve(ContainerRegistrationKeys.QUERY);
  const { data } = await query.graph({
    entity: "order",
    // On orders the quantity lives on the item's detail record.
    fields: ["id", "items.quantity", "items.detail.quantity", "items.unit_price", "items.metadata"],
    filters: { id: orderId },
  });
  type Row = { quantity?: number; detail?: { quantity?: number }; unit_price: number; metadata?: Record<string, unknown> };
  const items = ((data[0] as { items?: Row[] })?.items ?? [])
    .filter((i) => i.metadata?.offer_id)
    .map((i) => ({ ...i, quantity: Number(i.quantity ?? i.detail?.quantity ?? 0) }))
    .filter((i) => i.quantity > 0);
  if (!items.length) return;

  const live = await liveSaleLimitsForOffers(
    container,
    items.map((i) => String(i.metadata!.offer_id))
  );

  const byList = new Map<string, Record<string, number>>();
  for (const item of items) {
    const offer = String(item.metadata!.offer_id);
    const sale = live[offer];
    // Only units that were actually charged the sale price count.
    if (!sale || Math.abs(Number(item.unit_price) - sale.price) > 0.0001) continue;
    const add = byList.get(sale.price_list_id) ?? {};
    add[offer] = (add[offer] ?? 0) + Number(item.quantity);
    byList.set(sale.price_list_id, add);
  }

  const pricing = container.resolve(Modules.PRICING);
  for (const [priceListId, sold] of byList) {
    const pl = await loadPriceList(container, priceListId);
    const limits = { ...limitsOf(pl) };
    for (const [offer, qty] of Object.entries(sold)) {
      if (limits[offer]) limits[offer] = { ...limits[offer], sold: limits[offer].sold + qty };
    }
    await pricing.updatePriceLists([{ id: pl.id, metadata: { ...(pl.metadata ?? {}), sale_limits: limits } }]);
    await syncMaxQuantities(container, pl, limits, Object.keys(sold));
    // A variant that just sold out goes back to its normal price in the shop.
    if (Object.keys(sold).some((o) => remainingOf(limits[o]) === 0)) await revalidateStorefront();
  }
}

/**
 * Set this price list's prices to X% off each variant's normal price
 * (all variants, or just `offerIds`). Rounded to cents.
 */
export async function applyPercentOff(
  container: MedusaContainer,
  priceListId: string,
  percent: number,
  offerIds?: string[]
) {
  if (!Number.isFinite(percent) || percent <= 0 || percent >= 100) {
    throw new MedusaError(MedusaError.Types.INVALID_DATA, "Percent off must be between 0 and 100.");
  }
  const pl = await loadPriceList(container, priceListId);
  const { rows } = await getSaleLimitRows(container, priceListId);
  const wanted = offerIds?.length ? new Set(offerIds) : null;
  const priceById = new Map((pl.prices ?? []).map((p) => [p.id, p]));

  const updates = rows
    .filter((r) => r.regular_price !== null && (!wanted || wanted.has(r.offer_id)))
    .map((r) => {
      const p = priceById.get(r.price_id)!;
      return {
        id: p.id,
        price_set_id: p.price_set_id,
        currency_code: p.currency_code,
        amount: Math.round(r.regular_price! * (100 - percent)) / 100,
      };
    });
  if (updates.length) {
    const pricing = container.resolve(Modules.PRICING);
    await pricing.updatePriceListPrices([{ price_list_id: pl.id, prices: updates as never }]);
    await revalidateStorefront();
  }
  return getSaleLimitRows(container, priceListId);
}
