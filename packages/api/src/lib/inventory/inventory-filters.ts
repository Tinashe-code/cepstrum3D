import type { MedusaNextFunction, MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { ContainerRegistrationKeys } from "@medusajs/framework/utils";

/**
 * Extra "Manage inventory" filters for the admin and vendor panels:
 *
 *   title=pla              product name, variant title or SKU contains (case-insensitive)
 *   reservations=has|none  has reserved units / has none
 *   stock_status=in_stock|low_stock|out_of_stock
 *                          available = stocked − reserved, summed over locations;
 *                          low = 1…LOW_STOCK_THRESHOLD−1 (default 10)
 *
 * The inventory routes don't support these, so this middleware (run before
 * their validation) finds the matching items and passes them on as `id`,
 * intersected with any `id` already asked for; Mercur's seller scoping still
 * applies afterwards.
 */

const KEYS = ["title", "reservations", "stock_status"] as const;
const NO_MATCH = "__no_match__";
const lowStock = () => Number(process.env.LOW_STOCK_THRESHOLD || 10);

type Item = {
  id: string;
  title?: string | null;
  sku?: string | null;
  offers?: { product_variant?: { product?: { title?: string | null } | null } | null }[] | null;
  location_levels?: { stocked_quantity?: number | null; reserved_quantity?: number | null }[] | null;
};

const list = (v: unknown) =>
  (Array.isArray(v) ? v : String(v ?? "").split(","))
    .map((s) => String(s).trim())
    .filter(Boolean);

export async function inventoryExtraFilters(req: MedusaRequest, _res: MedusaResponse, next: MedusaNextFunction) {
  if (!/^\/(admin|vendor)\/inventory-items\/?$/.test(req.path)) return next();

  const q = req.query as Record<string, unknown>;
  const title = String(q.title ?? "").trim().toLowerCase();
  const reservations = list(q.reservations);
  const stock = list(q.stock_status);
  for (const k of KEYS) delete q[k];
  if (!title && !reservations.length && !stock.length) return next();

  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY);
  const { data } = await query.graph({
    entity: "inventory_item",
    fields: [
      "id",
      "title",
      "sku",
      "offers.product_variant.product.title",
      "location_levels.stocked_quantity",
      "location_levels.reserved_quantity",
    ],
  });

  const threshold = lowStock();
  const ids = (data as Item[])
    .filter((item) => {
      const levels = item.location_levels ?? [];
      const stocked = levels.reduce((s, l) => s + Number(l.stocked_quantity ?? 0), 0);
      const reserved = levels.reduce((s, l) => s + Number(l.reserved_quantity ?? 0), 0);
      const available = stocked - reserved;

      if (title) {
        const haystack = [item.title, item.sku, ...(item.offers ?? []).map((o) => o.product_variant?.product?.title)]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        if (!haystack.includes(title)) return false;
      }
      if (reservations.length) {
        const state = reserved > 0 ? "has" : "none";
        if (!reservations.includes(state)) return false;
      }
      if (stock.length) {
        const state = available <= 0 ? "out_of_stock" : available < threshold ? "low_stock" : "in_stock";
        if (!stock.includes(state)) return false;
      }
      return true;
    })
    .map((i) => i.id);

  const existing = q.id === undefined ? null : new Set(list(q.id));
  const result = existing ? ids.filter((id) => existing.has(id)) : ids;
  q.id = result.length ? result : [NO_MATCH];
  return next();
}
