import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { orderThresholdLabel } from "../../../lib/delivery/rules";
import { envDeliverySettings, getDeliverySettings } from "../../../lib/delivery/settings";
import { refreshOverrides, saveOverrides } from "../../../lib/delivery/overrides";
import { revalidateStorefront } from "../../../lib/storefront-cache";

const view = (overrides: Record<string, unknown>) => {
  const s = getDeliverySettings();
  const { googleMapsApiKey: _k, ...env } = envDeliverySettings();
  const { googleMapsApiKey: _k2, ...current } = s;
  return { current, defaults: env, overrides, label: orderThresholdLabel(s) };
};

/** GET /admin/delivery-settings — current values (admin changes over .env). */
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  res.json(view(await refreshOverrides(req.scope, true)));
}

/** POST /admin/delivery-settings { freeMinOrder, freeOrderCities[] } — takes effect within seconds. */
export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const saved = await saveOverrides(req.scope, req.body);
  await revalidateStorefront(["delivery-settings"]);
  res.json(view(saved));
}
