import type { MedusaContainer } from "@medusajs/framework/types";
import type { MedusaNextFunction, MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { ContainerRegistrationKeys } from "@medusajs/framework/utils";

/**
 * "Product Category = Filaments" in a promotion only matches products placed
 * directly in Filaments. Ours sit in sub-categories (PLA, PETG, …), so such a
 * promotion never applied. When a promotion rule names a category, this adds
 * all its sub-categories (operator "in"), so choosing a parent covers
 * everything under it.
 *
 * - Middleware on admin/vendor promotion create/update and rule batches.
 * - expandExistingPromotionCategoryRules() fixes promotions saved before
 *   (scripts/fix-promotion-categories.ts).
 */

const isCategoryAttr = (a?: unknown) => typeof a === "string" && /(^|\.)categories\.id$/.test(a);

type Rule = { attribute?: string; operator?: string; values?: unknown };

async function descendantsMap(container: MedusaContainer) {
  const query = container.resolve(ContainerRegistrationKeys.QUERY);
  const { data } = await query.graph({ entity: "product_category", fields: ["id", "parent_category_id"] });
  const children = new Map<string, string[]>();
  for (const c of data as { id: string; parent_category_id?: string | null }[]) {
    if (!c.parent_category_id) continue;
    children.set(c.parent_category_id, [...(children.get(c.parent_category_id) ?? []), c.id]);
  }
  return (ids: string[]) => {
    const out = new Set<string>();
    const walk = (id: string) => {
      if (out.has(id)) return;
      out.add(id);
      for (const c of children.get(id) ?? []) walk(c);
    };
    ids.forEach(walk);
    return [...out];
  };
}

/** Returns true when any rule changed. */
function expandRules(rules: unknown, expand: (ids: string[]) => string[]) {
  if (!Array.isArray(rules)) return false;
  let changed = false;
  for (const r of rules as Rule[]) {
    if (!r || !isCategoryAttr(r.attribute)) continue;
    if (r.operator && !["eq", "in"].includes(r.operator)) continue;
    const values = (Array.isArray(r.values) ? r.values : [r.values]).filter(Boolean).map(String);
    const all = expand(values);
    if (all.length !== values.length || r.operator !== "in") {
      r.values = all;
      r.operator = "in";
      changed = true;
    }
  }
  return changed;
}

export async function expandCategoryRulesInBody(req: MedusaRequest, _res: MedusaResponse, next: MedusaNextFunction) {
  const body = (req.body ?? {}) as Record<string, any>;
  const lists = [
    body.rules,
    body.application_method?.target_rules,
    body.application_method?.buy_rules,
    body.create,
    body.update,
  ].filter(Array.isArray);
  if (!lists.some((l) => (l as Rule[]).some((r) => isCategoryAttr(r?.attribute)))) return next();

  try {
    const expand = await descendantsMap(req.scope);
    for (const l of lists) expandRules(l, expand);
  } catch {
    // never block saving a promotion over this
  }
  return next();
}

/** Fix category rules on promotions saved before this change. */
export async function expandExistingPromotionCategoryRules(container: MedusaContainer) {
  const query = container.resolve(ContainerRegistrationKeys.QUERY);
  const expand = await descendantsMap(container);
  const { data } = await query.graph({
    entity: "promotion_rule",
    fields: ["id", "attribute", "operator", "values.value"],
  });
  const { Modules } = await import("@medusajs/framework/utils");
  const promotions = container.resolve(Modules.PROMOTION);
  let n = 0;
  for (const r of data as { id: string; attribute: string; operator: string; values?: { value: string }[] }[]) {
    if (!isCategoryAttr(r.attribute) || !["eq", "in"].includes(r.operator)) continue;
    const values = (r.values ?? []).map((v) => v.value);
    const all = expand(values);
    if (all.length === values.length && r.operator === "in") continue;
    await promotions.updatePromotionRules([{ id: r.id, operator: "in", values: all } as never]);
    n++;
  }
  return n;
}
