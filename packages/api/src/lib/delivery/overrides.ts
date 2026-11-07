import type { MedusaContainer } from "@medusajs/framework/types";
import type { MedusaNextFunction, MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { MedusaError, Modules } from "@medusajs/framework/utils";

/**
 * Delivery settings the admin can change without redeploying:
 *   free-delivery order amount and the towns it applies to.
 * Saved in store.metadata.delivery_settings; kept in memory and re-read at most
 * every 30 seconds, so pricing code can stay synchronous.
 */

export type DeliveryOverrides = Partial<{
  freeMinOrder: number;
  freeOrderCities: string[];
  baseFee: number;
  perKm: number;
  minFee: number;
}>;

const KEY = "delivery_settings";
const TTL_MS = 30_000;
let cache: DeliveryOverrides = {};
let loadedAt = 0;

export const getOverrides = () => cache;

const clean = (raw: unknown): DeliveryOverrides => {
  const r = (raw ?? {}) as Record<string, unknown>;
  const out: DeliveryOverrides = {};
  for (const k of ["freeMinOrder", "baseFee", "perKm", "minFee"] as const) {
    const n = Number(r[k]);
    if (r[k] !== undefined && r[k] !== null && r[k] !== "" && Number.isFinite(n) && n >= 0) out[k] = n;
  }
  if (Array.isArray(r.freeOrderCities)) {
    out.freeOrderCities = r.freeOrderCities.map((c) => String(c).trim()).filter(Boolean);
  }
  return out;
};

async function store(container: MedusaContainer) {
  const [s] = await container.resolve(Modules.STORE).listStores({}, { take: 1 });
  return s;
}

export async function refreshOverrides(container: MedusaContainer, force = false) {
  if (!force && Date.now() - loadedAt < TTL_MS) return cache;
  try {
    const s = await store(container);
    cache = clean((s?.metadata ?? {})[KEY]);
    loadedAt = Date.now();
  } catch {
    // keep the last good values
  }
  return cache;
}

export async function saveOverrides(container: MedusaContainer, input: unknown) {
  const s = await store(container);
  if (!s) throw new MedusaError(MedusaError.Types.NOT_FOUND, "Store not found");
  const r = (input ?? {}) as Record<string, unknown>;
  for (const k of ["freeMinOrder", "baseFee", "perKm", "minFee"]) {
    if (r[k] !== undefined && r[k] !== null && r[k] !== "" && !(Number(r[k]) >= 0)) {
      throw new MedusaError(MedusaError.Types.INVALID_DATA, `${k} must be a number of 0 or more`);
    }
  }
  const next = clean(input);
  await container.resolve(Modules.STORE).updateStores(s.id, { metadata: { ...(s.metadata ?? {}), [KEY]: next } });
  cache = next;
  loadedAt = Date.now();
  return next;
}

/** Middleware on store routes: keep the in-memory copy fresh. */
export async function refreshDeliveryOverrides(req: MedusaRequest, _res: MedusaResponse, next: MedusaNextFunction) {
  await refreshOverrides(req.scope);
  next();
}
