/**
 * Address suggestions for checkout via Google Places API (New), proxied so the
 * key stays on the server (GOOGLE_MAPS_API_KEY; enable "Places API (New)").
 * Restricted to Zimbabwe. Pass the same session token to autocomplete and
 * details so Google bills them as one session.
 */

export type PlaceSuggestion = { place_id: string; main: string; secondary: string };

export type PlaceAddress = {
  address_1: string;
  city: string;
  province: string;
  postal_code: string;
  lat: number | null;
  lng: number | null;
  place_id: string;
  formatted: string;
};

export async function placesAutocomplete(input: string, session: string, key: string): Promise<PlaceSuggestion[]> {
  const res = await fetch("https://places.googleapis.com/v1/places:autocomplete", {
    method: "POST",
    signal: AbortSignal.timeout(8000),
    headers: { "content-type": "application/json", "X-Goog-Api-Key": key },
    body: JSON.stringify({ input, sessionToken: session || undefined, includedRegionCodes: ["zw"] }),
  });
  if (!res.ok) return [];
  const json = (await res.json()) as {
    suggestions?: {
      placePrediction?: {
        placeId: string;
        text?: { text: string };
        structuredFormat?: { mainText?: { text: string }; secondaryText?: { text: string } };
      };
    }[];
  };
  return (json.suggestions ?? [])
    .map((s) => s.placePrediction)
    .filter(Boolean)
    .map((p) => ({
      place_id: p!.placeId,
      main: p!.structuredFormat?.mainText?.text ?? p!.text?.text ?? "",
      secondary: p!.structuredFormat?.secondaryText?.text ?? "",
    }));
}

type Component = { longText: string; shortText: string; types: string[] };

export async function placeDetails(placeId: string, session: string, key: string): Promise<PlaceAddress | null> {
  const url =
    `https://places.googleapis.com/v1/places/${encodeURIComponent(placeId)}` +
    (session ? `?sessionToken=${encodeURIComponent(session)}` : "");
  const res = await fetch(url, {
    signal: AbortSignal.timeout(8000),
    headers: {
      "X-Goog-Api-Key": key,
      "X-Goog-FieldMask": "id,location,addressComponents,formattedAddress,displayName",
    },
  });
  if (!res.ok) return null;
  const p = (await res.json()) as {
    id: string;
    location?: { latitude: number; longitude: number };
    addressComponents?: Component[];
    formattedAddress?: string;
    displayName?: { text: string };
  };
  const comps = p.addressComponents ?? [];
  const get = (...types: string[]) => comps.find((c) => types.some((t) => c.types.includes(t)))?.longText ?? "";

  const street = [get("street_number"), get("route")].filter(Boolean).join(" ");
  const suburb = get("sublocality_level_1", "sublocality", "neighborhood");
  const name = p.displayName?.text ?? "";
  const first = street || name || (p.formattedAddress ?? "").split(",")[0];
  const address_1 = [first, suburb && suburb !== first ? suburb : ""].filter(Boolean).join(", ");

  return {
    address_1,
    city: get("locality", "postal_town", "administrative_area_level_2"),
    province: get("administrative_area_level_1"),
    postal_code: get("postal_code"),
    lat: p.location?.latitude ?? null,
    lng: p.location?.longitude ?? null,
    place_id: p.id,
    formatted: p.formattedAddress ?? "",
  };
}

/**
 * Nearest street address to a map point (Geocoding API, reverse). The returned
 * lat/lng are the customer's own point, not the address's, so delivery is
 * priced to where they actually are.
 */
export async function reverseGeocode(lat: number, lng: number, key: string): Promise<PlaceAddress | null> {
  const url = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${key}`;
  const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
  if (!res.ok) return null;
  const json = (await res.json()) as {
    status: string;
    results?: { place_id: string; formatted_address: string; address_components: { long_name: string; types: string[] }[] }[];
  };
  const r = json.status === "OK" ? json.results?.[0] : undefined;
  if (!r) return null;
  const get = (...types: string[]) => r.address_components.find((c) => types.some((t) => c.types.includes(t)))?.long_name ?? "";
  const street = [get("street_number"), get("route")].filter(Boolean).join(" ");
  const suburb = get("sublocality_level_1", "sublocality", "neighborhood");
  const first = street || r.formatted_address.split(",")[0];
  return {
    address_1: [first, suburb && suburb !== first ? suburb : ""].filter(Boolean).join(", "),
    city: get("locality", "postal_town", "administrative_area_level_2"),
    province: get("administrative_area_level_1"),
    postal_code: get("postal_code"),
    lat,
    lng,
    place_id: r.place_id,
    formatted: r.formatted_address,
  };
}
