import type { CreateNotificationDTO, MedusaContainer } from "@medusajs/framework/types";
import { ContainerRegistrationKeys } from "@medusajs/framework/utils";
import { renderEmail, siteName, vendorPortalUrl } from "./layout";
import { emailTo, sendNotifications } from "./send";

/**
 * Weekly stock check: every vendor with stock on Cepstrum3D gets a list of what
 * customers can currently buy from them, oldest stock counts first, and is asked
 * to fix anything that's sold out or wrong. Customers can only order what's in
 * stock, so an up-to-date count is what stops orders for items the vendor
 * no longer has.
 *
 *   STOCK_CHECK_STALE_DAYS   counts not changed for this many days are flagged (default 14)
 */

const staleDays = () => Number(process.env.STOCK_CHECK_STALE_DAYS || 14);

type Row = { seller_id: string; seller_name: string; seller_email: string; title: string; variant: string; stock: number; updated: Date };

export async function sendWeeklyStockChecks(container: MedusaContainer) {
  const k = container.resolve(ContainerRegistrationKeys.PG_CONNECTION);
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER);

  // In-stock listings per open vendor: available = stocked − reserved, per item in a bundle.
  const { rows } = (await k.raw(`
    SELECT s.id AS seller_id, s.name AS seller_name, s.email AS seller_email,
           p.title, v.title AS variant,
           FLOOR(SUM(il.stocked_quantity - il.reserved_quantity) / MAX(oii.required_quantity))::int AS stock,
           MAX(il.updated_at) AS updated
    FROM offer o
    JOIN seller s ON s.id = o.seller_id AND s.deleted_at IS NULL AND s.status = 'open'
    JOIN product p ON p.id = o.product_id AND p.deleted_at IS NULL AND p.status = 'published'
    JOIN product_variant v ON v.id = o.variant_id AND v.deleted_at IS NULL
    JOIN offer_inventory_item oii ON oii.offer_id = o.id AND oii.deleted_at IS NULL
    JOIN inventory_level il ON il.inventory_item_id = oii.inventory_item_id AND il.deleted_at IS NULL
    WHERE o.deleted_at IS NULL AND o.manage_inventory = true
    GROUP BY s.id, s.name, s.email, o.id, p.title, v.title
    HAVING FLOOR(SUM(il.stocked_quantity - il.reserved_quantity) / MAX(oii.required_quantity)) > 0
    ORDER BY s.id, MAX(il.updated_at) ASC
  `)) as { rows: Row[] };

  const bySeller = new Map<string, Row[]>();
  for (const r of rows) bySeller.set(r.seller_id, [...(bySeller.get(r.seller_id) ?? []), r]);

  const now = Date.now();
  const site = siteName();
  const list: CreateNotificationDTO[] = [];
  for (const [sellerId, items] of bySeller) {
    const first = items[0];
    if (!first.seller_email) continue;
    const stale = items.filter((i) => (now - new Date(i.updated).getTime()) / 86_400_000 >= staleDays()).length;
    const shown = items.slice(0, 40);
    const email = renderEmail({
      heading: "Weekly stock check",
      intro: `Customers can order these ${items.length} item${items.length === 1 ? "" : "s"} from ${first.seller_name} right now. Is the stock still right?`,
      paragraphs: [
        "If anything is sold out or the count is wrong, update it in Inventory in the vendor portal now. An order for something you don't have has to be cancelled, which disappoints the customer and can affect your listings.",
        stale
          ? `${stale} item${stale === 1 ? " hasn't" : "s haven't"} had a stock update in ${staleDays()} days or more (marked "check"). Please confirm ${stale === 1 ? "it" : "them"}.`
          : "Thanks for keeping your stock up to date.",
      ],
      rows: shown.map((i) => {
        const days = Math.floor((now - new Date(i.updated).getTime()) / 86_400_000);
        return {
          label: `${i.title}${i.variant && i.variant !== "Default variant" ? ` (${i.variant})` : ""}${days >= staleDays() ? "  · check" : ""}`,
          value: `${i.stock} in stock`,
        };
      }),
      extraHtml: items.length > shown.length ? `<p style="font-size:13px;color:#71717a">…and ${items.length - shown.length} more in the vendor portal.</p>` : "",
      button: { text: "Update stock", url: `${vendorPortalUrl()}/inventory` },
      footer: `${site} sends this every Monday to vendors with items in stock.`,
    });
    list.push(emailTo(first.seller_email, "vendor-stock-check", { subject: `Weekly stock check: ${items.length} item${items.length === 1 ? "" : "s"} on sale`, ...email }, { id: sellerId, type: "seller" }));
  }
  logger.info(`[stock check] ${list.length} vendor email(s)`);
  return sendNotifications(container, list, "weekly stock check");
}
