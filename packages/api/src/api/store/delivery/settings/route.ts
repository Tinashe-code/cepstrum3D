import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { orderThresholdLabel } from "../../../../lib/delivery/rules";
import { getDeliverySettings } from "../../../../lib/delivery/settings";

/**
 * GET /store/delivery/settings — the platform delivery rate and the
 * store-wide free-delivery threshold, for messages on the storefront.
 */
export async function GET(_req: MedusaRequest, res: MedusaResponse) {
  const s = getDeliverySettings();
  res.json({
    delivery: {
      base_fee: s.baseFee,
      per_km: s.perKm,
      min_fee: s.minFee,
      free_min_order: s.freeMinOrder,
      free_order_cities: s.freeOrderCities,
      free_order_label: orderThresholdLabel(s),
    },
  });
}
