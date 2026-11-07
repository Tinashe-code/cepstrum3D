/**
 * Product types from the main categories (Filament, Resin, 3D printer, Spare
 * part, Accessory), so promotion conditions like "Product type = Filament" have
 * values. Only sets a type on products that have none. Safe to re-run.
 *
 * Run on an existing database:  bunx medusa exec ./src/scripts/setup-product-types.ts
 * The main seed calls it automatically. Manage types in the admin: Settings → Product Types.
 */
import { ExecArgs, MedusaContainer } from "@medusajs/framework/types";
import { ContainerRegistrationKeys } from "@medusajs/framework/utils";
import { createProductTypesWorkflow, updateProductsWorkflow } from "@medusajs/medusa/core-flows";

/** Top-level category handle → product type. */
const TYPE_BY_CATEGORY: Record<string, string> = {
  filaments: "Filament",
  resin: "Resin",
  "3d-printers-more": "3D Printer",
  "spare-parts-upgrades": "Spare Part",
  accessories: "Accessory",
};

export async function setupProductTypes(container: MedusaContainer) {
  const query = container.resolve(ContainerRegistrationKeys.QUERY);
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER);

  const { data: existing } = await query.graph({ entity: "product_type", fields: ["id", "value"] });
  const byValue = new Map((existing as { id: string; value: string }[]).map((t) => [t.value, t.id]));
  const missing = [...new Set(Object.values(TYPE_BY_CATEGORY))].filter((v) => !byValue.has(v));
  if (missing.length) {
    const { result } = await createProductTypesWorkflow(container).run({
      input: { product_types: missing.map((value) => ({ value })) },
    });
    for (const t of result) byValue.set(t.value, t.id);
  }

  const { data: products } = await query.graph({
    entity: "product",
    fields: ["id", "type_id", "categories.handle", "categories.parent_category.handle"],
  });
  let n = 0;
  for (const p of products as any[]) {
    if (p.type_id) continue;
    const top = (p.categories ?? []).map((c: any) => c.parent_category?.handle ?? c.handle);
    const type = top.map((h: string) => TYPE_BY_CATEGORY[h]).find(Boolean);
    if (!type) continue;
    await updateProductsWorkflow(container).run({ input: { selector: { id: p.id }, update: { type_id: byValue.get(type)! } } });
    n++;
  }
  logger.info(`setup-product-types: ${byValue.size} types; set on ${n} products.`);
}

export default async function run({ container }: ExecArgs) {
  await setupProductTypes(container);
}
