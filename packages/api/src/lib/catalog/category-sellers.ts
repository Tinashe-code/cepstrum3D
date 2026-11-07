import type { MedusaContainer } from "@medusajs/framework/types";
import { ContainerRegistrationKeys } from "@medusajs/framework/utils";
import { linkSellersToProductCategoryWorkflow } from "@mercurjs/core/workflows";

/**
 * Mercur keeps a per-category store allowlist (`category_seller`). Vendor
 * screens that offer categories — e.g. a promotion's "Product Category"
 * condition — only list categories the store is on. Cepstrum3D is one
 * marketplace where every vendor may sell in every category, so every
 * approved store is put on every category. Idempotent.
 */
export async function linkAllSellersToCategories(
  container: MedusaContainer,
  { sellerIds, categoryIds }: { sellerIds?: string[]; categoryIds?: string[] } = {}
) {
  const query = container.resolve(ContainerRegistrationKeys.QUERY);

  const sellers =
    sellerIds ??
    ((await query.graph({ entity: "seller", fields: ["id"] })).data as { id: string }[]).map((s) => s.id);
  const categories =
    categoryIds ??
    ((await query.graph({ entity: "product_category", fields: ["id"] })).data as { id: string }[]).map((c) => c.id);

  if (!sellers.length || !categories.length) return 0;

  for (const id of categories) {
    await linkSellersToProductCategoryWorkflow(container).run({ input: { id, add: sellers } });
  }
  return categories.length;
}
