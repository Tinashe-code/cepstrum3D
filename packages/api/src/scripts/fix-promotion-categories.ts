/**
 * Make category conditions on existing promotions include sub-categories
 * (e.g. "Filaments" also covers PLA, PETG, …). New and edited promotions get
 * this automatically. Safe to re-run.
 *
 *   bunx medusa exec ./src/scripts/fix-promotion-categories.ts
 */
import { ExecArgs } from "@medusajs/framework/types";
import { ContainerRegistrationKeys } from "@medusajs/framework/utils";
import { expandExistingPromotionCategoryRules } from "../lib/promotions/category-descendants";

export default async function run({ container }: ExecArgs) {
  const n = await expandExistingPromotionCategoryRules(container);
  container.resolve(ContainerRegistrationKeys.LOGGER).info(`fix-promotion-categories: ${n} category rules updated.`);
}
