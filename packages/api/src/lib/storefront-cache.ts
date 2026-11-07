import type { MedusaNextFunction, MedusaRequest, MedusaResponse } from "@medusajs/framework/http";

/**
 * Ask the storefront to drop cached catalogue data (products, offers, prices).
 * Uses the same webhook as subscribers/storefront-cache-revalidate.ts:
 *   STOREFRONT_REVALIDATE_URL    = http://localhost:3000/api/revalidate
 *   STOREFRONT_REVALIDATE_SECRET = same value as REVALIDATE_SECRET in apps/storefront/.env
 */
export async function revalidateStorefront(tags: string[] = ["products", "offers"]) {
  const url = process.env.STOREFRONT_REVALIDATE_URL;
  const secret = process.env.STOREFRONT_REVALIDATE_SECRET;
  if (!url || !secret) return;
  try {
    await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-revalidate-secret": secret },
      body: JSON.stringify({ tags }),
    });
  } catch (e) {
    console.error("[storefront-cache] revalidation failed:", (e as Error).message);
  }
}

/**
 * After a price list is created, edited or deleted from a panel, refresh the
 * shop's cached prices so the new/ended discount shows straight away.
 */
export function revalidateAfterPriceListChange(req: MedusaRequest, res: MedusaResponse, next: MedusaNextFunction) {
  if (/\/price-lists/.test(req.path)) {
    res.on("finish", () => {
      if (res.statusCode < 400) void revalidateStorefront();
    });
  }
  next();
}
