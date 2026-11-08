import type { ExecArgs } from "@medusajs/framework/types";
import { ContainerRegistrationKeys } from "@medusajs/framework/utils";
import { ensureThumbnails } from "../lib/catalog/thumbnails";

/** One-off: give every existing product without a main image its first image. */
export default async function fixMissingThumbnails({ container }: ExecArgs) {
  const n = await ensureThumbnails(container);
  container.resolve(ContainerRegistrationKeys.LOGGER).info(`${n} product(s) given a main image`);
}
