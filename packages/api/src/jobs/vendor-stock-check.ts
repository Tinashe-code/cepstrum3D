import type { MedusaContainer } from "@medusajs/framework/types";
import { sendWeeklyStockChecks } from "../lib/notifications/stock-check";

/** Every Monday 08:00 Harare time (06:00 UTC): ask each vendor to confirm their stock. */
export default async function vendorStockCheck(container: MedusaContainer) {
  await sendWeeklyStockChecks(container);
}

export const config = { name: "vendor-weekly-stock-check", schedule: "0 6 * * 1" };
