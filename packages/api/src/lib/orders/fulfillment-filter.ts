import type { MedusaNextFunction, MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { ContainerRegistrationKeys, MathBN, isDefined } from "@medusajs/framework/utils";

/**
 * "Fulfillment" filter for the admin and vendor order lists.
 *
 * An order's fulfillment status is not a database column — Mercur works it out
 * from the order's fulfillments when listing (aggregate-status.ts). So the
 * routes can't filter on it directly (admin rejects the field, vendor errors).
 * These middlewares run before the routes' own validation: they read
 * `fulfillment_status` (one value or comma list), find the matching orders or
 * order groups, and pass them on as an `id` filter, which both routes support
 * and which Mercur's seller scoping intersects with.
 */

export const FULFILLMENT_STATUSES = [
  "not_fulfilled",
  "partially_fulfilled",
  "fulfilled",
  "partially_shipped",
  "shipped",
  "partially_delivered",
  "delivered",
  "canceled",
] as const;

type Fulfillment = {
  packed_at?: unknown;
  shipped_at?: unknown;
  delivered_at?: unknown;
  canceled_at?: unknown;
};
type OrderRow = {
  id: string;
  fulfillments?: Fulfillment[] | null;
  items?: { raw_quantity?: unknown; detail?: { raw_fulfilled_quantity?: unknown } | null }[] | null;
};

/** Same rules as Mercur's getLastFulfillmentStatus, so the filter matches the status column. */
export function fulfillmentStatusOf(order: OrderRow): string {
  const counts: Record<string, number> = { canceled: 0, delivered: 0, shipped: 0, fulfilled: 0 };
  const fulfillments = order.fulfillments ?? [];
  for (const f of fulfillments) {
    if (f.canceled_at) counts.canceled++;
    else if (f.delivered_at) counts.delivered++;
    else if (f.shipped_at) counts.shipped++;
    else if (f.packed_at) counts.fulfilled++;
  }
  const active = fulfillments.length - counts.canceled;
  const hasUnfulfilledItems = (order.items ?? []).some(
    (i) =>
      isDefined(i?.detail?.raw_fulfilled_quantity) &&
      MathBN.lt(i!.detail!.raw_fulfilled_quantity as never, i!.raw_quantity as never)
  );
  const pick = (key: "delivered" | "shipped" | "fulfilled") =>
    counts[key] === active && !hasUnfulfilledItems ? key : `partially_${key}`;

  if (counts.delivered > 0) return pick("delivered");
  if (counts.shipped > 0) return pick("shipped");
  if (counts.fulfilled > 0) return pick("fulfilled");
  if (counts.canceled > 0 && counts.canceled === fulfillments.length) return "canceled";
  return "not_fulfilled";
}

const ORDER_FIELDS = [
  "id",
  "items.raw_quantity",
  "items.detail.raw_fulfilled_quantity",
  "fulfillments.packed_at",
  "fulfillments.shipped_at",
  "fulfillments.delivered_at",
  "fulfillments.canceled_at",
];

/** Matches no rows (an empty id list would mean "no filter"). */
const NO_MATCH = "__no_match__";

const readStatuses = (req: MedusaRequest): string[] | null => {
  const raw = (req.query as Record<string, unknown>).fulfillment_status;
  if (raw === undefined || raw === null || raw === "") return null;
  const values = (Array.isArray(raw) ? raw : String(raw).split(","))
    .map((v) => String(v).trim())
    .filter((v) => (FULFILLMENT_STATUSES as readonly string[]).includes(v));
  return values;
};

const withExistingIds = (req: MedusaRequest, ids: string[]) => {
  const q = req.query as Record<string, unknown>;
  const existing = q.id === undefined ? null : new Set((Array.isArray(q.id) ? q.id : String(q.id).split(",")).map(String));
  const result = existing ? ids.filter((id) => existing.has(id)) : ids;
  q.id = result.length ? result : [NO_MATCH];
};

/** GET /vendor/orders?fulfillment_status=shipped,delivered */
export async function vendorOrdersFulfillmentFilter(req: MedusaRequest, _res: MedusaResponse, next: MedusaNextFunction) {
  if (req.path.replace(/\/$/, "") !== "/vendor/orders") return next();
  const statuses = readStatuses(req);
  if (!statuses) return next();
  delete (req.query as Record<string, unknown>).fulfillment_status;

  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY);
  const sellerId = String(req.headers["x-seller-id"] ?? "");
  const { data: links } = await query.graph({
    entity: "order_seller",
    fields: ["order_id"],
    filters: sellerId ? { seller_id: sellerId } : {},
  });
  const orderIds = (links as { order_id: string }[]).map((l) => l.order_id);
  const { data: orders } = orderIds.length
    ? await query.graph({ entity: "order", fields: ORDER_FIELDS, filters: { id: orderIds } })
    : { data: [] as unknown[] };

  withExistingIds(
    req,
    (orders as OrderRow[]).filter((o) => statuses.includes(fulfillmentStatusOf(o))).map((o) => o.id)
  );
  return next();
}

/** GET /admin/order-groups?fulfillment_status=not_fulfilled — groups with at least one matching order. */
export async function adminOrderGroupsFulfillmentFilter(req: MedusaRequest, _res: MedusaResponse, next: MedusaNextFunction) {
  if (req.path.replace(/\/$/, "") !== "/admin/order-groups") return next();
  const statuses = readStatuses(req);
  if (!statuses) return next();
  delete (req.query as Record<string, unknown>).fulfillment_status;

  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY);
  const { data: groups } = await query.graph({
    entity: "order_group",
    fields: ["id", ...ORDER_FIELDS.map((f) => `orders.${f}`)],
  });

  withExistingIds(
    req,
    (groups as { id: string; orders?: OrderRow[] }[])
      .filter((g) => (g.orders ?? []).some((o) => statuses.includes(fulfillmentStatusOf(o))))
      .map((g) => g.id)
  );
  return next();
}
