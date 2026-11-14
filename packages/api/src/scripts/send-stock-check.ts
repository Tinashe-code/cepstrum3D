import type { ExecArgs } from "@medusajs/framework/types";
import { sendWeeklyStockChecks } from "../lib/notifications/stock-check";

/** Send the weekly stock check emails now: medusa exec ./src/scripts/send-stock-check.js */
export default async function ({ container }: ExecArgs) {
  await sendWeeklyStockChecks(container);
}
