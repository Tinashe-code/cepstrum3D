/**
 * Switches vendors to distance-priced delivery and sets demo free-delivery rules.
 * Safe to re-run.
 *
 *   1. Links every vendor stock location to the "distance-delivery" provider.
 *   2. Gives each vendor a "Delivery" option priced by distance (price type
 *      "calculated") and removes the old flat "Local delivery" / "Nationwide
 *      courier" demo options. "Collect from vendor" stays.
 *   3. Puts map coordinates on vendor addresses we know (KNOWN_VENDOR_COORDS);
 *      other vendors are located by Google from their address, or by town.
 *   4. Sets free-delivery rules on demo products that have none yet
 *      (DEMO_RULES — edit them per product in the admin: Product → Metadata).
 *
 * Run on an existing database:  bunx medusa exec ./src/scripts/setup-distance-delivery.ts
 * The main seed calls it automatically.
 */
import { ExecArgs, MedusaContainer } from "@medusajs/framework/types";
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils";
import { deleteShippingOptionsWorkflow, updateProductsWorkflow } from "@medusajs/medusa/core-flows";
import { createSellerShippingOptionsWorkflow } from "@mercurjs/core/workflows";
import { DISTANCE_DELIVERY_PROVIDER_ID } from "../lib/delivery/settings";

/** Shipping option type codes of the old flat-rate demo options to remove. */
const OLD_FLAT_CODES = ["local", "courier"];

/** Map pins for vendor addresses (address_1 → coordinates). Replace with the exact gate. */
const KNOWN_VENDOR_COORDS: Record<string, { lat: number; lng: number }> = {
  "116 Nelson Mandela Avenue": { lat: -17.8297, lng: 31.0458 },
};

/** Demo free-delivery rules by top-level category handle. */
const DEMO_RULES: Record<string, Record<string, string>> = {
  filaments: { free_delivery_cities: "Harare", free_delivery_min_qty: "4", free_delivery_unit: "spools" },
  resin: { free_delivery_cities: "Harare", free_delivery_min_qty: "3", free_delivery_unit: "bottles" },
  "3d-printers-more": { free_delivery_cities: "Harare" },
};

export async function setupDistanceDelivery(container: MedusaContainer) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER);
  const query = container.resolve(ContainerRegistrationKeys.QUERY);
  const link = container.resolve(ContainerRegistrationKeys.LINK);
  const stockLocations = container.resolve(Modules.STOCK_LOCATION);

  const { data: sellerLocations } = await query.graph({
    entity: "stock_location_seller",
    fields: [
      "seller_id",
      "stock_location.id",
      "stock_location.name",
      "stock_location.address.*",
      "stock_location.fulfillment_providers.id",
      "stock_location.fulfillment_sets.service_zones.id",
      "stock_location.fulfillment_sets.service_zones.shipping_options.id",
      "stock_location.fulfillment_sets.service_zones.shipping_options.provider_id",
      "stock_location.fulfillment_sets.service_zones.shipping_options.shipping_profile_id",
      "stock_location.fulfillment_sets.service_zones.shipping_options.type.code",
    ],
  });

  for (const row of sellerLocations as any[]) {
    const loc = row.stock_location;
    if (!loc) continue;

    // 1. Provider link
    if (!(loc.fulfillment_providers ?? []).some((p: { id: string }) => p.id === DISTANCE_DELIVERY_PROVIDER_ID)) {
      await link.create({
        [Modules.STOCK_LOCATION]: { stock_location_id: loc.id },
        [Modules.FULFILLMENT]: { fulfillment_provider_id: DISTANCE_DELIVERY_PROVIDER_ID },
      });
    }

    // 3. Coordinates
    const known = KNOWN_VENDOR_COORDS[loc.address?.address_1 ?? ""];
    if (known && loc.address && !loc.address.metadata?.lat) {
      await stockLocations.updateStockLocations(loc.id, {
        address: {
          address_1: loc.address.address_1,
          city: loc.address.city,
          country_code: loc.address.country_code,
          metadata: { ...(loc.address.metadata ?? {}), ...known },
        },
      });
    }

    // 2. Options per service zone
    for (const set of loc.fulfillment_sets ?? []) {
      for (const zone of set.service_zones ?? []) {
        const options = zone.shipping_options ?? [];
        const old = options.filter((o: any) => OLD_FLAT_CODES.includes(o.type?.code));
        if (old.length) {
          await deleteShippingOptionsWorkflow(container).run({ input: { ids: old.map((o: any) => o.id) } });
        }
        if (options.some((o: any) => o.provider_id === DISTANCE_DELIVERY_PROVIDER_ID)) continue;

        const profileId = options[0]?.shipping_profile_id;
        if (!profileId) {
          logger.warn(`setup-distance-delivery: no shipping profile found for ${loc.name}; skipped.`);
          continue;
        }
        await createSellerShippingOptionsWorkflow(container).run({
          input: {
            seller_id: row.seller_id,
            shipping_options: [
              {
                name: "Delivery",
                price_type: "calculated",
                provider_id: DISTANCE_DELIVERY_PROVIDER_ID,
                service_zone_id: zone.id,
                shipping_profile_id: profileId,
                data: {},
                type: {
                  label: "Delivery",
                  description: "Priced by distance from the vendor to you.",
                  code: "distance",
                },
                rules: [
                  { attribute: "enabled_in_store", value: "true", operator: "eq" },
                  { attribute: "is_return", value: "false", operator: "eq" },
                ],
              } as never,
            ],
          },
        });
        logger.info(`setup-distance-delivery: "Delivery" option added for ${loc.name}.`);
      }
    }
  }

  // 4. Demo free-delivery rules
  const { data: products } = await query.graph({
    entity: "product",
    fields: ["id", "metadata", "categories.handle", "categories.parent_category.handle"],
  });
  let ruled = 0;
  for (const p of products as any[]) {
    const meta = (p.metadata ?? {}) as Record<string, unknown>;
    if ("free_delivery_cities" in meta || "free_delivery_min_qty" in meta) continue;
    const top = (p.categories ?? []).map((c: any) => c.parent_category?.handle ?? c.handle);
    const rule = top.map((h: string) => DEMO_RULES[h]).find(Boolean);
    if (!rule) continue;
    await updateProductsWorkflow(container).run({
      input: { selector: { id: p.id }, update: { metadata: { ...meta, ...rule } } },
    });
    ruled++;
  }
  logger.info(`setup-distance-delivery: free-delivery rules set on ${ruled} products.`);
}

export default async function run({ container }: ExecArgs) {
  await setupDistanceDelivery(container);
}
