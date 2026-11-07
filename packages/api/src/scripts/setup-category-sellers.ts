/**
 * Puts every store on every product category's allowlist, so vendors can pick
 * categories in promotion conditions. Safe to re-run. New stores and
 * categories are handled automatically by subscribers/category-seller-allowlist.ts.
 *
 * Run on an existing database:  bunx medusa exec ./src/scripts/setup-category-sellers.ts
 * The main seed calls it automatically.
 */
import { ExecArgs } from "@medusajs/framework/types";
import { ContainerRegistrationKeys } from "@medusajs/framework/utils";
import { linkAllSellersToCategories } from "../lib/catalog/category-sellers";

export default async function run({ container }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER);
  const n = await linkAllSellersToCategories(container);
  logger.info(`setup-category-sellers: all stores linked to ${n} categories.`);
}
