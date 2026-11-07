/**
 * Demo discounts: a "Black November" sale from EzoD Tech on a handful of products,
 * so the storefront shows % off badges and struck-through original prices.
 *
 * Sales are Medusa price lists (type "sale") owned by a seller. Each sale price is
 * scoped to one of that seller's offers (rule `offer_id`), so other vendors' prices
 * for the same product are untouched. Vendors can create their own sales in the
 * vendor panel (Price lists).
 *
 * Safe to re-run: skips if the price list already exists.
 *   bunx medusa exec ./src/scripts/setup-demo-discounts.ts
 */
import { ExecArgs, MedusaContainer } from "@medusajs/framework/types";
import { ContainerRegistrationKeys, PriceListStatus, PriceListType } from "@medusajs/framework/utils";
import { createSellerPriceListsWorkflow } from "@mercurjs/core/workflows";

const SALE_TITLE = "Black November";
const SELLER_EMAIL = "ezod@layerline.test";

/** product handle → % off */
const DISCOUNTS: Record<string, number> = {
  "kingroon-pla-basic": 20,
  "kingroon-petg-basic": 15,
  "esun-pla": 25,
  "elegoo-standard-photopolymer-resin": 18,
  "sunlu-filadryer-s2": 20,
  "creality-ender-3-v3-se": 10,
  "3d-printing-tool-kit-25-pcs": 30,
  "pei-spring-steel-build-plate-235-235-mm": 15,
};

export async function setupDemoDiscounts(container: MedusaContainer) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER);
  const query = container.resolve(ContainerRegistrationKeys.QUERY);

  const { data: existing } = await query.graph({
    entity: "price_list",
    fields: ["id"],
    filters: { title: SALE_TITLE },
  });
  if (existing.length) {
    logger.info(`"${SALE_TITLE}" sale already exists, skipping.`);
    return;
  }

  const { data: sellers } = await query.graph({
    entity: "seller",
    fields: ["id"],
    filters: { email: SELLER_EMAIL },
  });
  const sellerId = sellers[0]?.id as string | undefined;
  if (!sellerId) {
    logger.warn(`Seller ${SELLER_EMAIL} not found, skipping demo discounts.`);
    return;
  }

  const { data: offers } = await query.graph({
    entity: "offer",
    fields: ["id", "variant_id", "product.handle", "prices.amount", "prices.currency_code", "prices.price_list_id"],
    filters: { seller_id: sellerId },
  });

  const prices: {
    amount: number;
    currency_code: string;
    variant_id: string;
    rules: Record<string, string>;
  }[] = [];

  for (const offer of offers as {
    id: string;
    variant_id: string;
    product?: { handle?: string };
    prices?: { amount: number; currency_code: string; price_list_id?: string | null }[];
  }[]) {
    const pct = DISCOUNTS[offer.product?.handle ?? ""];
    if (!pct) continue;
    const base = (offer.prices ?? []).find((p) => !p.price_list_id && p.currency_code === "usd");
    if (!base) continue;
    prices.push({
      amount: Math.round(Number(base.amount) * (100 - pct)) / 100,
      currency_code: "usd",
      variant_id: offer.variant_id,
      rules: { offer_id: offer.id },
    });
  }

  if (!prices.length) {
    logger.warn("No matching offers found for demo discounts.");
    return;
  }

  await createSellerPriceListsWorkflow(container).run({
    input: {
      seller_id: sellerId,
      price_lists_data: [
        {
          title: SALE_TITLE,
          description: "Demo sale — EzoD Tech",
          type: PriceListType.SALE,
          status: PriceListStatus.ACTIVE,
          // Sale prices are scoped per offer via `rules.offer_id`.
          prices: prices as never,
        },
      ],
    },
  });
  logger.info(`Created "${SALE_TITLE}" sale with ${prices.length} discounted offer prices.`);
}

export default async function run({ container }: ExecArgs) {
  await setupDemoDiscounts(container);
}
