/**
 * Gives each colour variant its own picture (variant thumbnail), so the storefront
 * can show a picture per colour in the colour picker and switch the gallery.
 *
 * Matches a product image to a variant's Colour value by file name
 * (e.g. ".../filament-red.png" for "Red"). Variants that already have a thumbnail
 * are left alone, so vendors' own uploads are never overwritten. Safe to re-run.
 *
 *   bunx medusa exec ./src/scripts/setup-variant-images.ts
 */
import { ExecArgs, MedusaContainer } from "@medusajs/framework/types";
import { ContainerRegistrationKeys } from "@medusajs/framework/utils";
import { updateProductVariantsWorkflow } from "@medusajs/medusa/core-flows";

const COLOUR_OPTION_TITLES = ["colour", "color"];

export async function setupVariantImages(container: MedusaContainer) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER);
  const query = container.resolve(ContainerRegistrationKeys.QUERY);

  const { data: products } = await query.graph({
    entity: "product",
    fields: [
      "id",
      "images.url",
      "variants.id",
      "variants.thumbnail",
      "variants.options.value",
      "variants.options.option.title",
    ],
  });

  const updates: { id: string; thumbnail: string }[] = [];
  for (const p of products as {
    images?: { url: string }[];
    variants?: { id: string; thumbnail?: string | null; options?: { value: string; option?: { title?: string } }[] }[];
  }[]) {
    for (const v of p.variants ?? []) {
      if (v.thumbnail) continue;
      const colour = v.options?.find((o) =>
        COLOUR_OPTION_TITLES.includes((o.option?.title ?? "").toLowerCase())
      )?.value;
      if (!colour) continue;
      const slug = colour.toLowerCase().replace(/[^a-z0-9]+/g, "-");
      const image = (p.images ?? []).find((img) =>
        new RegExp(`[-_/]${slug}\\.(png|jpe?g|webp)$`, "i").test(img.url)
      );
      if (image) updates.push({ id: v.id, thumbnail: image.url });
    }
  }

  for (const u of updates) {
    await updateProductVariantsWorkflow(container).run({
      input: { selector: { id: u.id }, update: { thumbnail: u.thumbnail } },
    });
  }
  logger.info(`Variant pictures set on ${updates.length} colour variants.`);
}

export default async function run({ container }: ExecArgs) {
  await setupVariantImages(container);
}
