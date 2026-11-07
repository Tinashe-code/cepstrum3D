/**
 * Distances for delivery pricing.
 *
 * With GOOGLE_MAPS_API_KEY: addresses without coordinates are geocoded
 * (Geocoding API) and the road distance comes from the Routes API (driving).
 * Without a key, or if Google can't be reached: straight-line distance between
 * known points × 1.3 for roads, marked as an estimate.
 */

export type LatLng = { lat: number; lng: number };

export type AddressLike = {
  address_1?: string | null;
  address_2?: string | null;
  city?: string | null;
  province?: string | null;
  country_code?: string | null;
  metadata?: Record<string, unknown> | null;
};

/** Rough centres of Zimbabwean towns — only used when Google isn't available. */
const TOWN_CENTRES: Record<string, LatLng> = {
  harare: { lat: -17.8292, lng: 31.0522 },
  chitungwiza: { lat: -18.0127, lng: 31.0756 },
  epworth: { lat: -17.89, lng: 31.1475 },
  norton: { lat: -17.8833, lng: 30.7 },
  ruwa: { lat: -17.8897, lng: 31.2447 },
  bulawayo: { lat: -20.1325, lng: 28.6265 },
  mutare: { lat: -18.9707, lng: 32.6709 },
  gweru: { lat: -19.45, lng: 29.8167 },
  kwekwe: { lat: -18.9281, lng: 29.8149 },
  kadoma: { lat: -18.3333, lng: 29.9153 },
  masvingo: { lat: -20.0744, lng: 30.8328 },
  marondera: { lat: -18.1853, lng: 31.5519 },
  bindura: { lat: -17.3019, lng: 31.3306 },
  chinhoyi: { lat: -17.3667, lng: 30.2 },
  kariba: { lat: -16.5167, lng: 28.8 },
  "victoria falls": { lat: -17.9243, lng: 25.8572 },
  hwange: { lat: -18.3646, lng: 26.4988 },
  beitbridge: { lat: -22.2167, lng: 30.0 },
  zvishavane: { lat: -20.3267, lng: 30.0665 },
  chegutu: { lat: -18.1302, lng: 30.1407 },
  rusape: { lat: -18.5278, lng: 32.1284 },
  chipinge: { lat: -20.1883, lng: 32.6236 },
  shurugwi: { lat: -19.67, lng: 30.0 },
  gwanda: { lat: -20.9333, lng: 29.0 },
};

/** Typical trip inside one town when we only know the town (km). */
const SAME_TOWN_ESTIMATE_KM = 10;
const ROAD_FACTOR = 1.3;

export const normaliseCity = (c?: string | null) => (c ?? "").trim().toLowerCase();

const coordsFromMetadata = (a?: AddressLike | null): LatLng | null => {
  const m = (a?.metadata ?? {}) as Record<string, unknown>;
  const lat = Number(m.lat ?? m.latitude);
  const lng = Number(m.lng ?? m.longitude);
  return Number.isFinite(lat) && Number.isFinite(lng) && (lat !== 0 || lng !== 0) ? { lat, lng } : null;
};

const addressText = (a: AddressLike) =>
  [a.address_1, a.address_2, a.city, a.province, a.country_code === "zw" || !a.country_code ? "Zimbabwe" : a.country_code]
    .filter(Boolean)
    .join(", ");

const geocodeCache = new Map<string, LatLng | null>();
const routeCache = new Map<string, number | null>();

async function googleGeocode(text: string, key: string): Promise<LatLng | null> {
  if (geocodeCache.has(text)) return geocodeCache.get(text)!;
  try {
    const url =
      "https://maps.googleapis.com/maps/api/geocode/json?components=country:ZW&address=" +
      encodeURIComponent(text) +
      "&key=" +
      key;
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
    const json = (await res.json()) as { status: string; results?: { geometry: { location: LatLng } }[] };
    const hit = json.status === "OK" ? json.results?.[0]?.geometry.location ?? null : null;
    geocodeCache.set(text, hit);
    return hit;
  } catch {
    return null;
  }
}

async function googleRoadKm(from: LatLng, to: LatLng, key: string): Promise<number | null> {
  const cacheKey = [from.lat, from.lng, to.lat, to.lng].map((n) => n.toFixed(4)).join(",");
  if (routeCache.has(cacheKey)) return routeCache.get(cacheKey)!;
  try {
    const res = await fetch("https://routes.googleapis.com/directions/v2:computeRoutes", {
      method: "POST",
      signal: AbortSignal.timeout(8000),
      headers: {
        "content-type": "application/json",
        "X-Goog-Api-Key": key,
        "X-Goog-FieldMask": "routes.distanceMeters",
      },
      body: JSON.stringify({
        origin: { location: { latLng: { latitude: from.lat, longitude: from.lng } } },
        destination: { location: { latLng: { latitude: to.lat, longitude: to.lng } } },
        travelMode: "DRIVE",
      }),
    });
    const json = (await res.json()) as { routes?: { distanceMeters?: number }[] };
    const meters = json.routes?.[0]?.distanceMeters;
    const km = typeof meters === "number" ? meters / 1000 : null;
    routeCache.set(cacheKey, km);
    return km;
  } catch {
    return null;
  }
}

const haversineKm = (a: LatLng, b: LatLng) => {
  const R = 6371;
  const rad = (d: number) => (d * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
};

type Located = { point: LatLng | null; precise: boolean };

async function locate(a: AddressLike, key: string): Promise<Located> {
  const fromMeta = coordsFromMetadata(a);
  if (fromMeta) return { point: fromMeta, precise: true };
  if (key && (a.address_1 || a.city)) {
    const g = await googleGeocode(addressText(a), key);
    if (g) return { point: g, precise: !!a.address_1 };
  }
  return { point: TOWN_CENTRES[normaliseCity(a.city)] ?? null, precise: false };
}

export type DistanceResult = {
  km: number;
  /** true when the number is an estimate (no Google, or only the town is known). */
  estimated: boolean;
};

/** Road distance from the vendor's address to the customer's, in km. */
export async function deliveryDistanceKm(
  from: AddressLike,
  to: AddressLike,
  key: string
): Promise<DistanceResult | null> {
  const [a, b] = await Promise.all([locate(from, key), locate(to, key)]);

  if (a.point && b.point) {
    if (key && a.precise && b.precise) {
      const road = await googleRoadKm(a.point, b.point, key);
      if (road !== null) return { km: road, estimated: false };
    }
    const road = haversineKm(a.point, b.point) * ROAD_FACTOR;
    // When one side is only known by its town, a trip inside that town is
    // assumed to be a typical in-town distance, not the gap to the town centre.
    const sameTown = normaliseCity(from.city) !== "" && normaliseCity(from.city) === normaliseCity(to.city);
    if ((!a.precise || !b.precise) && sameTown) {
      return { km: Math.max(road, SAME_TOWN_ESTIMATE_KM), estimated: true };
    }
    return { km: Math.max(road, 1), estimated: true };
  }

  if (normaliseCity(from.city) && normaliseCity(from.city) === normaliseCity(to.city)) {
    return { km: SAME_TOWN_ESTIMATE_KM, estimated: true };
  }
  return null;
}
