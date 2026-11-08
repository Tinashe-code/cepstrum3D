import type { MedusaNextFunction, MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { ContainerRegistrationKeys } from "@medusajs/framework/utils";

/**
 * One review request per product, however many edits the vendor makes.
 *
 * Mercur refuses a product edit while an earlier one is waiting for approval
 * ("There is already an active update request for this product"). That makes
 * vendors wait for the admin after every image. Instead, on vendor edit routes:
 *
 *   1. the waiting request is set aside for a moment (status "merging"),
 *   2. Mercur creates its new request as usual,
 *   3. the new request's changes are folded into the waiting one, and the new,
 *      now-empty request is removed,
 *
 * so the admin still sees ONE request per product containing everything, and
 * approves or rejects it in one go. Later edits to the same thing replace earlier
 * ones; image/category/tag lists keep both edits' additions and removals.
 */

const MERGING = "merging";
const ARRAY_FIELDS = new Set(["images", "categories", "tags", "sales_channels"]);

type Action = {
  id: string;
  action: string;
  details: Record<string, any>;
  reference: string | null;
  reference_id: string | null;
};

const db = (req: MedusaRequest) => req.scope.resolve(ContainerRegistrationKeys.PG_CONNECTION);
const log = (req: MedusaRequest) => req.scope.resolve(ContainerRegistrationKeys.LOGGER);

/** Which earlier action a new one replaces. null = always add. */
const keyOf = (a: Action) => {
  switch (a.action) {
    case "UPDATE":
      return `UPDATE:${a.details?.field}`;
    case "STATUS_CHANGE":
      return "STATUS_CHANGE";
    case "VARIANT_UPDATE":
      return `VARIANT_UPDATE:${a.details?.variant_id}`;
    default:
      return a.reference && a.reference_id ? `${a.action}:${a.reference}:${a.reference_id}` : null;
  }
};

const itemKey = (v: any) => (v && typeof v === "object" ? (v.id ?? v.url ?? JSON.stringify(v)) : String(v));

/** (earlier pending list) + what this edit added − what this edit removed, both relative to the live product. */
function mergeList(earlier: any[], next: any[], live: any[]) {
  const liveKeys = new Set((live ?? []).map(itemKey));
  const nextKeys = new Set((next ?? []).map(itemKey));
  const removed = new Set([...liveKeys].filter((k) => !nextKeys.has(k)));
  const out = (earlier ?? []).filter((v) => !removed.has(itemKey(v)));
  const have = new Set(out.map(itemKey));
  for (const v of next ?? []) if (!liveKeys.has(itemKey(v)) && !have.has(itemKey(v))) out.push(v);
  return out;
}

function mergeDetails(earlier: Action, next: Action): Record<string, any> {
  if (next.action === "UPDATE" && ARRAY_FIELDS.has(next.details?.field)) {
    return {
      ...earlier.details,
      value: mergeList(earlier.details?.value, next.details?.value, next.details?.previous_value),
    };
  }
  if (next.action === "UPDATE" || next.action === "STATUS_CHANGE") {
    // keep the original "before" value so the admin sees live → final
    return { ...next.details, previous_value: earlier.details?.previous_value, previous_status: earlier.details?.previous_status ?? next.details?.previous_status };
  }
  if (next.action === "VARIANT_UPDATE") {
    const fields = { ...(earlier.details?.fields ?? {}), ...(next.details?.fields ?? {}) };
    // Variant images are sent as { add: [...ids], remove: [...ids] }: combine both edits.
    const a = earlier.details?.fields?.images;
    const b = next.details?.fields?.images;
    if (a && b && typeof a === "object" && typeof b === "object" && !Array.isArray(a) && !Array.isArray(b)) {
      const add = new Set<string>([...(a.add ?? []), ...(b.add ?? [])]);
      const remove = new Set<string>([...(a.remove ?? []), ...(b.remove ?? [])]);
      for (const id of b.add ?? []) remove.delete(id);
      for (const id of b.remove ?? []) add.delete(id);
      fields.images = { add: [...add], remove: [...remove] };
    }
    return {
      ...earlier.details,
      fields,
      previous_fields: { ...(next.details?.previous_fields ?? {}), ...(earlier.details?.previous_fields ?? {}) },
    };
  }
  return next.details;
}

async function fold(req: MedusaRequest, productId: string, heldId: string) {
  const k = db(req);
  await k.transaction(async (trx) => {
    const fresh = (await trx("product_change")
      .where({ product_id: productId, status: "pending" })
      .whereNull("deleted_at")
      .whereNot("id", heldId)
      .orderBy("created_at", "desc")) as { id: string }[];

    for (const c of fresh) {
      const earlier = (await trx("product_change_action").where({ product_change_id: heldId }).whereNull("deleted_at")) as Action[];
      const byKey = new Map(earlier.map((a) => [keyOf(a), a] as const).filter(([key]) => key));
      const incoming = (await trx("product_change_action")
        .where({ product_change_id: c.id })
        .whereNull("deleted_at")
        .orderBy("ordering", "asc")) as Action[];

      for (const a of incoming) {
        const key = keyOf(a);
        const prev = key ? byKey.get(key) : undefined;
        if (prev) {
          await trx("product_change_action")
            .where({ id: prev.id })
            .update({ details: JSON.stringify(mergeDetails(prev, a)), updated_at: trx.fn.now() });
          await trx("product_change_action").where({ id: a.id }).del();
        } else {
          await trx("product_change_action").where({ id: a.id }).update({ product_change_id: heldId, updated_at: trx.fn.now() });
        }
      }
      await trx("product_change").where({ id: c.id }).del();
    }
    await trx("product_change").where({ id: heldId }).update({ status: "pending", updated_at: trx.fn.now() });
  });
}

/**
 * Vendor product edit routes. Product id comes from the URL; product creation
 * (POST /vendor/products) has none and isn't affected.
 */
export async function mergeIntoPendingProductChange(req: MedusaRequest, res: MedusaResponse, next: MedusaNextFunction) {
  const productId = req.params.id;
  if (!productId || !["POST", "DELETE"].includes(req.method)) return next();
  const k = db(req);

  // Self-heal: a request set aside by a crashed edit goes back to waiting.
  await k("product_change")
    .where({ status: MERGING })
    .where("updated_at", "<", k.raw("now() - interval '2 minutes'"))
    .update({ status: "pending" })
    .catch(() => undefined);

  const held = (await k("product_change")
    .where({ product_id: productId, status: "pending" })
    .whereNull("deleted_at")
    .orderBy("created_at", "asc")
    .first("id")) as { id: string } | undefined;
  if (!held) return next();

  await k("product_change").where({ id: held.id }).update({ status: MERGING, updated_at: k.fn.now() });

  let done = false;
  const finish = async () => {
    if (done) return;
    done = true;
    try {
      await fold(req, productId, held.id);
    } catch (e) {
      log(req).error(`Merging product edits for ${productId} failed: ${(e as Error).message}`);
      await k("product_change").where({ id: held.id }).update({ status: "pending" }).catch(() => undefined);
    }
  };

  // Fold before the response goes out, so the vendor's next edit sees one request.
  const json = res.json.bind(res);
  res.json = ((body: unknown) => {
    void finish().finally(() => json(body));
    return res;
  }) as typeof res.json;
  res.on("close", () => void finish());
  next();
}
