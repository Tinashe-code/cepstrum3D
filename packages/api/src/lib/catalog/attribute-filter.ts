import type { MedusaNextFunction, MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { ContainerRegistrationKeys } from "@medusajs/framework/utils";

/**
 * Shop filters such as Material = PLA (GET /store/products?attributes[material]=PLA).
 *
 * Mercur only matches the value on a product's VARIANTS (their options), and
 * only exactly. A product whose material was set as a product attribute (not
 * on its variants), or with "PLA " / "pla", was left out of the results.
 *
 * This runs after Mercur's version and replaces it: a product matches when
 * EITHER its variants OR its product attributes carry the value (ignoring
 * capitals and spaces). Several values of one filter = any of them; several
 * filters = all of them.
 */
export async function matchAttributeFilters(req: MedusaRequest, _res: MedusaResponse, next: MedusaNextFunction) {
  try {
    const raw = (req.query as any)?.attributes;
    if (!raw || typeof raw !== "object") return next();

    const groups = Object.entries(raw as Record<string, unknown>)
      .map(([handle, v]) => [
        handle,
        (Array.isArray(v) ? v : String(v ?? "").split(","))
          .map((s) => String(s).trim().toLowerCase())
          .filter(Boolean),
      ] as [string, string[]])
      .filter(([, values]) => values.length > 0);
    if (!groups.length) return next();

    const k = req.scope.resolve(ContainerRegistrationKeys.PG_CONNECTION);
    let ids: Set<string> | null = null;

    for (const [handle, values] of groups) {
      const marks = values.map(() => "?").join(",");
      const { rows } = await k.raw(
        `
        WITH attr AS (
          SELECT id, name, product_option_id FROM product_attribute
          WHERE deleted_at IS NULL AND (handle = ? OR lower(name) = lower(?))
        )
        -- value on the product's variants
        SELECT DISTINCT v.product_id AS id
        FROM product_variant v
        JOIN product_variant_option pvo ON pvo.variant_id = v.id
        JOIN product_option_value pov ON pov.id = pvo.option_value_id AND pov.deleted_at IS NULL
        JOIN product_option po ON po.id = pov.option_id AND po.deleted_at IS NULL
        WHERE v.deleted_at IS NULL
          AND lower(trim(pov.value)) IN (${marks})
          AND (po.id IN (SELECT product_option_id FROM attr WHERE product_option_id IS NOT NULL)
               OR lower(trim(po.title)) IN (SELECT lower(trim(name)) FROM attr))
        UNION
        -- value as a product attribute
        SELECT DISTINCT l.product_id AS id
        FROM product_attribute_value_link l
        JOIN product_attribute_value pav ON pav.id = l.product_attribute_value_id AND pav.deleted_at IS NULL
        WHERE l.deleted_at IS NULL
          AND pav.attribute_id IN (SELECT id FROM attr)
          AND lower(trim(pav.name)) IN (${marks})
        `,
        [handle, handle.replace(/-/g, " "), ...values, ...values]
      );
      const found = new Set<string>((rows as { id: string }[]).map((r) => r.id));
      ids = ids === null ? found : new Set([...ids].filter((id) => found.has(id)));
    }

    const filters = ((req as any).filterableFields ??= {});
    // Drop Mercur's variant-option clauses; the id list below replaces them.
    if (Array.isArray(filters.$and)) {
      filters.$and = filters.$and.filter((c: any) => !c?.variants?.options?.value);
      if (!filters.$and.length) delete filters.$and;
    }
    delete filters.attributes;

    let list = [...(ids ?? [])];
    if (filters.id) {
      const prior = new Set<string>(Array.isArray(filters.id) ? filters.id : [filters.id]);
      list = list.filter((id) => prior.has(id));
    }
    filters.id = list.length ? list : ["__no_match__"];
  } catch (e) {
    req.scope.resolve(ContainerRegistrationKeys.LOGGER).warn(`[attribute filter] ${(e as Error).message}`);
  }
  next();
}
