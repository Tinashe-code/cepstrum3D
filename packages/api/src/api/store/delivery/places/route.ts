import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { placeDetails, placesAutocomplete, reverseGeocode } from "../../../../lib/delivery/places";
import { getDeliverySettings } from "../../../../lib/delivery/settings";

/**
 * GET /store/delivery/places?input=12 Sam Nu&session=…   → address suggestions (Zimbabwe)
 * GET /store/delivery/places?place_id=…&session=…        → the chosen address with coordinates
 * GET /store/delivery/places?lat=-17.8&lng=31.05          → nearest address to the customer's location
 * Returns { enabled: false } when GOOGLE_MAPS_API_KEY isn't set, so checkout
 * falls back to a plain address field.
 */
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const key = getDeliverySettings().googleMapsApiKey;
  const q = req.query as { input?: string; place_id?: string; session?: string; lat?: string; lng?: string };

  if (q.lat !== undefined && q.lng !== undefined) {
    const lat = Number(q.lat);
    const lng = Number(q.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return res.status(400).json({ message: "Bad location" });
    // Without Google we still return the point, so delivery can be priced to it.
    const address = key ? await reverseGeocode(lat, lng, key).catch(() => null) : null;
    return res.json({ enabled: !!key, address: address ?? { address_1: "", city: "", province: "", postal_code: "", lat, lng, place_id: "", formatted: "" } });
  }

  if (!key) return res.json({ enabled: false, suggestions: [] });
  const session = String(q.session ?? "").slice(0, 100);

  try {
    if (q.place_id) {
      const address = await placeDetails(String(q.place_id), session, key);
      return res.json({ enabled: true, address });
    }
    const input = String(q.input ?? "").trim().slice(0, 200);
    if (input.length < 3) return res.json({ enabled: true, suggestions: [] });
    return res.json({ enabled: true, suggestions: await placesAutocomplete(input, session, key) });
  } catch {
    return res.json({ enabled: true, suggestions: [], address: null });
  }
}
