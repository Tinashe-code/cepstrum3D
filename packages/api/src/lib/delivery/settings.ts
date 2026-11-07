/**
 * Delivery pricing settings — one platform rate for every vendor.
 *
 * Change them in packages/api/.env (restart the backend afterwards):
 *
 *   DELIVERY_BASE_FEE=2            fixed part of every delivery, USD
 *   DELIVERY_PER_KM=0.5            USD per road km from the vendor to the customer
 *   DELIVERY_MIN_FEE=3             a delivery never costs less than this (unless free)
 *   DELIVERY_ROUND_TO=0.5          prices are rounded up to this step
 *   FREE_DELIVERY_MIN_ORDER=300    whole-cart amount for free delivery (0 = off)
 *   FREE_DELIVERY_ORDER_CITIES=Harare   where that applies, comma separated ("" = anywhere)
 *   GOOGLE_MAPS_API_KEY=...        Geocoding + Routes APIs; without it distances are estimated
 *
 * The free-delivery amount and towns can also be changed live in the admin
 * panel (Delivery page). Those values are saved on the store record and win
 * over .env — see ./overrides.ts.
 */
import { getOverrides } from "./overrides";

const num = (v: string | undefined, fallback: number) => {
  const n = Number(v);
  return v !== undefined && v !== "" && Number.isFinite(n) ? n : fallback;
};

export const parseCities = (v: string | undefined | null) =>
  (v ?? "")
    .split(",")
    .map((c) => c.trim())
    .filter(Boolean);

export const envDeliverySettings = () => ({
  baseFee: num(process.env.DELIVERY_BASE_FEE, 2),
  perKm: num(process.env.DELIVERY_PER_KM, 0.5),
  minFee: num(process.env.DELIVERY_MIN_FEE, 3),
  roundTo: num(process.env.DELIVERY_ROUND_TO, 0.5),
  freeMinOrder: num(process.env.FREE_DELIVERY_MIN_ORDER, 300),
  freeOrderCities: parseCities(process.env.FREE_DELIVERY_ORDER_CITIES ?? "Harare"),
  googleMapsApiKey: process.env.GOOGLE_MAPS_API_KEY || "",
});

/** .env values with any admin-panel changes applied on top. */
export const getDeliverySettings = () => ({ ...envDeliverySettings(), ...getOverrides() });

export type DeliverySettings = ReturnType<typeof getDeliverySettings>;

/** Fulfillment provider id as stored on shipping options. */
export const DISTANCE_DELIVERY_PROVIDER_ID = "distance-delivery_distance-delivery";
