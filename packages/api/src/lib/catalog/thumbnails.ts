import type { MedusaContainer } from "@medusajs/framework/types";
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils";

/**
 * Every product shown in the shop needs a main image (thumbnail): product cards,
 * the cart and order emails use it. When a vendor adds a product without one and
 * uploads images later, the first image becomes the main image.
 */
export async function ensureThumbnails(container: MedusaContainer, productIds?: string[]) {
  const query = container.resolve(ContainerRegistrationKeys.QUERY);
  const { data } = await query.graph({
    entity: "product",
    fields: ["id", "thumbnail", "images.url", "images.rank"],
    filters: productIds?.length ? { id: productIds } : {},
  });
  const missing = (data as { id: string; thumbnail: string | null; images?: { url: string; rank?: number }[] }[])
    .filter((p) => !p.thumbnail && p.images?.length)
    .map((p) => ({
      id: p.id,
      thumbnail: [...p.images!].sort((a, b) => (a.rank ?? 0) - (b.rank ?? 0))[0].url,
    }));
  const products = container.resolve(Modules.PRODUCT);
  for (const m of missing) await products.updateProducts(m.id, { thumbnail: m.thumbnail });
  return missing.length;
}
