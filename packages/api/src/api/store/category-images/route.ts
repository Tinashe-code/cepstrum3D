import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { ContainerRegistrationKeys } from "@medusajs/framework/utils";

/**
 * GET /store/category-images: the pictures set in admin → Categories → Media
 * and Icon, by category handle:
 *   { images: { "3d-printers-more": { image: "https://…", icon: null } } }
 *
 * The standard store category route doesn't allow the `media_images` field,
 * so the shop's category tiles read them from here.
 */
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY);
  const { data } = await query.graph({
    entity: "product_category",
    fields: ["handle", "media_images.url", "media_images.type", "media_images.rank"],
    filters: { is_active: true, is_internal: false },
  });

  const images: Record<string, { image: string | null; icon: string | null }> = {};
  for (const c of data as any[]) {
    const media = (c.media_images ?? []).filter(Boolean);
    const gallery = media
      .filter((m: any) => !m.type)
      .sort((a: any, b: any) => (a.rank ?? 0) - (b.rank ?? 0));
    const icon = media.find((m: any) => m.type === "icon");
    if (gallery.length || icon) {
      images[c.handle] = { image: gallery[0]?.url ?? null, icon: icon?.url ?? null };
    }
  }
  res.json({ images });
}
