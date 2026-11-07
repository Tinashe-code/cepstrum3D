import type { CreateNotificationDTO, MedusaContainer } from "@medusajs/framework/types";
import { ContainerRegistrationKeys } from "@medusajs/framework/utils";
import { money, renderEmail, siteName, storefrontUrl, vendorPortalUrl } from "./layout";
import { emailTo, inboxCustomerId, inboxFor, sendNotifications } from "./send";

/**
 * Order emails + in-store messages.
 *
 * Customer (email + Account → Notifications):
 *   received   – once per checkout (order group), listing every vendor's part
 *   packed / shipped / delivered – per vendor order (vendor fulfils it)
 *   canceled   – per vendor order
 * Vendor (email to the store's email address):
 *   new order  – their part of a checkout
 *   canceled   – when an order of theirs is cancelled (by the customer or the platform)
 *
 * Wording lives in the build… functions below.
 */

export type OrderStage = "packed" | "shipped" | "delivered";

type Item = { title: string; quantity?: number; detail?: { quantity?: number }; variant_title?: string | null; unit_price?: number };
type OrderRow = {
  id: string;
  display_id: number;
  email?: string | null;
  customer_id?: string | null;
  currency_code?: string;
  total?: number;
  item_total?: number;
  shipping_total?: number;
  discount_total?: number;
  metadata?: Record<string, unknown> | null;
  seller?: { id?: string; name?: string; email?: string | null } | null;
  order_group?: { id: string; display_id?: number } | null;
  items?: Item[];
  shipping_methods?: { name?: string | null; amount?: number }[];
  shipping_address?: {
    first_name?: string | null;
    last_name?: string | null;
    address_1?: string | null;
    city?: string | null;
    phone?: string | null;
  } | null;
  fulfillments?: { id: string; labels?: { tracking_number?: string; tracking_url?: string }[] }[];
};

const ORDER_FIELDS = [
  "id",
  "display_id",
  "email",
  "customer_id",
  "currency_code",
  "total",
  "item_total",
  "shipping_total",
  "discount_total",
  "metadata",
  "seller.id",
  "seller.name",
  "seller.email",
  "order_group.id",
  "order_group.display_id",
  "items.title",
  "items.quantity",
  "items.detail.quantity",
  "items.variant_title",
  "items.unit_price",
  "shipping_methods.name",
  "shipping_methods.amount",
  "shipping_address.first_name",
  "shipping_address.last_name",
  "shipping_address.address_1",
  "shipping_address.city",
  "shipping_address.phone",
  "fulfillments.id",
  "fulfillments.labels.tracking_number",
  "fulfillments.labels.tracking_url",
];

async function loadOrder(container: MedusaContainer, id: string) {
  const query = container.resolve(ContainerRegistrationKeys.QUERY);
  const { data } = await query.graph({ entity: "order", fields: ORDER_FIELDS, filters: { id } });
  return data[0] as unknown as OrderRow | undefined;
}

const qty = (i: Item) => Number(i.quantity ?? i.detail?.quantity ?? 0);
const itemRows = (o: OrderRow) =>
  (o.items ?? []).map((i) => ({
    label: `${qty(i)} × ${i.title}${i.variant_title ? ` (${i.variant_title})` : ""}`,
    value: money(Number(i.unit_price ?? 0) * qty(i), o.currency_code),
  }));
const isPickup = (o: OrderRow) => (o.shipping_methods ?? []).some((m) => /collect/i.test(m.name ?? ""));
const deliveryLabel = (o: OrderRow) =>
  isPickup(o) ? "Collect from vendor" : (o.shipping_methods ?? []).map((m) => m.name).filter(Boolean).join(", ") || "Delivery";
const customerOrderLink = (o: OrderRow) =>
  o.order_group?.id ? `${storefrontUrl()}/user/orders/${o.order_group.id}` : `${storefrontUrl()}/user/orders`;
const customerName = (o: OrderRow) =>
  [o.shipping_address?.first_name, o.shipping_address?.last_name].filter(Boolean).join(" ") || o.email || "A customer";

// ---------------------------------------------------------------- customer: packed / shipped / delivered

export function buildOrderMessage(order: OrderRow, stage: OrderStage, fulfillmentId?: string) {
  const seller = order.seller?.name || "The vendor";
  const no = `#${order.display_id}`;
  const pickup = isPickup(order);
  const labels = (order.fulfillments ?? []).find((f) => f.id === fulfillmentId)?.labels ?? [];
  const tracking = labels.filter((l) => l.tracking_number);

  const copy = {
    packed: {
      title: pickup ? `Order ${no} is ready for collection` : `Order ${no} is being prepared`,
      body: pickup
        ? `${seller} has packed your order. You can collect it from them.`
        : `${seller} has packed your order and will send it soon.`,
    },
    shipped: {
      title: `Order ${no} is on its way`,
      body: `${seller} has sent your order.${tracking.length ? ` Tracking: ${tracking.map((t) => t.tracking_number).join(", ")}.` : ""}`,
    },
    delivered: {
      title: `Order ${no} has been delivered`,
      body: `${seller} marked your order as delivered. Thanks for shopping with ${siteName()}!`,
    },
  }[stage];

  const link = customerOrderLink(order);
  const email = renderEmail({
    heading: copy.title,
    intro: copy.body,
    rows: itemRows(order),
    extraHtml: tracking
      .filter((t) => t.tracking_url)
      .map((t) => `<p style="margin:12px 0 0"><a href="${t.tracking_url}" style="color:#ea580c">Track parcel ${t.tracking_number}</a></p>`)
      .join(""),
    button: { text: "View your order", url: link },
    footer: `You're receiving this because you placed order ${no} on ${siteName()}.`,
  });
  return { ...copy, link, subject: copy.title, ...email };
}

export async function notifyOrderUpdate(
  container: MedusaContainer,
  { orderId, stage, fulfillmentId }: { orderId: string; stage: OrderStage; fulfillmentId?: string }
) {
  const order = await loadOrder(container, orderId);
  if (!order) return [];
  const msg = buildOrderMessage(order, stage, fulfillmentId);
  const template = `order-${stage}`;
  const resource = { id: order.id, type: "order" };
  const list: CreateNotificationDTO[] = [];
  if (order.email) list.push(emailTo(order.email, template, msg, resource, order.customer_id));
  const inbox = await inboxCustomerId(container, order.email, order.customer_id);
  if (inbox) list.push(inboxFor(inbox, template, { title: msg.title, body: msg.body, link: msg.link, stage, order_display_id: order.display_id }, resource));
  return sendNotifications(container, list, `Order ${order.display_id} ${stage}`);
}

// ---------------------------------------------------------------- customer: order received (whole checkout)

export async function notifyOrderGroupReceived(container: MedusaContainer, groupId: string) {
  const query = container.resolve(ContainerRegistrationKeys.QUERY);
  const { data } = await query.graph({
    entity: "order_group",
    fields: ["id", "display_id", "total", "orders.id"],
    filters: { id: groupId },
  });
  const group = data[0] as unknown as { id: string; display_id: number; total?: number; orders?: { id: string }[] } | undefined;
  if (!group?.orders?.length) return [];
  const orders = (await Promise.all(group.orders.map((o) => loadOrder(container, o.id)))).filter(Boolean) as OrderRow[];
  const first = orders[0];
  if (!first) return [];

  const currency = first.currency_code ?? "usd";
  const no = `#${group.display_id}`;
  const title = `We've received your order ${no}`;
  const vendors = orders.map((o) => o.seller?.name).filter(Boolean);
  const intro =
    orders.length > 1
      ? `Thank you! Your order goes to ${orders.length} vendors (${vendors.join(", ")}). Each one packs and sends their part, and we'll email you at every step.`
      : `Thank you! ${vendors[0] ?? "The vendor"} will prepare your order, and we'll email you when it's packed and on its way.`;

  const rows = orders.flatMap((o) => [
    { label: `${o.seller?.name ?? "Vendor"} — order #${o.display_id} · ${deliveryLabel(o)}`, value: "", strong: true },
    ...itemRows(o),
  ]);
  const delivery = orders.reduce((s, o) => s + Number(o.shipping_total ?? 0), 0);
  const discount = orders.reduce((s, o) => s + Number(o.discount_total ?? 0), 0);
  const total = Number(group.total ?? orders.reduce((s, o) => s + Number(o.total ?? 0), 0));
  const totals = [
    ...(discount ? [{ label: "Discount", value: `−${money(discount, currency)}` }] : []),
    { label: "Delivery", value: delivery ? money(delivery, currency) : "Free" },
    { label: "Total", value: money(total, currency), strong: true },
  ];
  const link = `${storefrontUrl()}/user/orders/${group.id}`;
  const email = renderEmail({
    heading: title,
    intro,
    rows,
    totals,
    button: { text: "View your order", url: link },
    footer: `You're receiving this because you placed order ${no} on ${siteName()}.`,
  });

  const resource = { id: group.id, type: "order_group" };
  const list: CreateNotificationDTO[] = [];
  if (first.email) list.push(emailTo(first.email, "order-received", { subject: title, ...email }, resource, first.customer_id));
  const inbox = await inboxCustomerId(container, first.email, first.customer_id);
  if (inbox) {
    list.push(
      inboxFor(inbox, "order-received", { title, body: intro, link, stage: "received", order_display_id: group.display_id }, resource)
    );
  }
  return sendNotifications(container, list, `Order group ${group.display_id} received`);
}

// ---------------------------------------------------------------- vendor: new order

export async function notifyVendorNewOrder(container: MedusaContainer, orderId: string) {
  const o = await loadOrder(container, orderId);
  if (!o?.seller?.email) return [];
  const no = `#${o.display_id}`;
  const title = `New order ${no} — ${money(o.total, o.currency_code)}`;
  const a = o.shipping_address;
  const email = renderEmail({
    heading: `New order ${no}`,
    intro: `${customerName(o)} ordered from ${o.seller.name}. Please pack it and mark it as fulfilled in the vendor portal.`,
    paragraphs: [
      `Delivery: ${deliveryLabel(o)}${isPickup(o) ? "" : a ? ` to ${[a.address_1, a.city].filter(Boolean).join(", ")}` : ""}.`,
      `Customer: ${customerName(o)}${a?.phone ? ` · ${a.phone}` : ""}${o.email ? ` · ${o.email}` : ""}`,
    ],
    rows: itemRows(o),
    totals: [
      { label: "Delivery", value: Number(o.shipping_total ?? 0) ? money(o.shipping_total, o.currency_code) : "Free" },
      ...(Number(o.discount_total ?? 0) ? [{ label: "Discount", value: `−${money(o.discount_total, o.currency_code)}` }] : []),
      { label: "Order total", value: money(o.total, o.currency_code), strong: true },
    ],
    button: { text: "Open the order", url: `${vendorPortalUrl()}/orders/${o.id}` },
    footer: `${siteName()} — you're receiving this as the store contact for ${o.seller.name}.`,
  });
  return sendNotifications(
    container,
    [emailTo(o.seller.email, "vendor-new-order", { subject: title, ...email }, { id: o.id, type: "order" })],
    `Vendor email for order ${o.display_id}`
  );
}

// ---------------------------------------------------------------- cancelled (customer + vendor)

export async function notifyOrderCanceled(container: MedusaContainer, orderId: string) {
  const o = await loadOrder(container, orderId);
  if (!o) return [];
  const no = `#${o.display_id}`;
  const byCustomer = (o.metadata ?? {}).canceled_by === "customer";
  const resource = { id: o.id, type: "order" };
  const list: CreateNotificationDTO[] = [];

  // customer
  const cTitle = `Order ${no} has been cancelled`;
  const cBody = byCustomer
    ? `As you asked, your order from ${o.seller?.name ?? "the vendor"} has been cancelled.`
    : `Your order from ${o.seller?.name ?? "the vendor"} has been cancelled. If you didn't expect this, reply to this email or contact us.`;
  const cEmail = renderEmail({
    heading: cTitle,
    intro: cBody,
    rows: itemRows(o),
    button: { text: "View your orders", url: `${storefrontUrl()}/user/orders` },
    footer: `You're receiving this because you placed order ${no} on ${siteName()}.`,
  });
  if (o.email) list.push(emailTo(o.email, "order-canceled", { subject: cTitle, ...cEmail }, resource, o.customer_id));
  const inbox = await inboxCustomerId(container, o.email, o.customer_id);
  if (inbox) list.push(inboxFor(inbox, "order-canceled", { title: cTitle, body: cBody, link: customerOrderLink(o), stage: "canceled" }, resource));

  // vendor
  if (o.seller?.email) {
    const vTitle = `Order ${no} was cancelled${byCustomer ? " by the customer" : ""}`;
    const vEmail = renderEmail({
      heading: vTitle,
      intro: byCustomer
        ? `${customerName(o)} cancelled order ${no}. Please don't send it. Reserved stock has been released.`
        : `Order ${no} was cancelled. Please don't send it. Reserved stock has been released.`,
      rows: itemRows(o),
      button: { text: "Open the order", url: `${vendorPortalUrl()}/orders/${o.id}` },
      footer: `${siteName()} — you're receiving this as the store contact for ${o.seller.name}.`,
    });
    list.push(emailTo(o.seller.email, "vendor-order-canceled", { subject: vTitle, ...vEmail }, resource));
  }
  return sendNotifications(container, list, `Order ${o.display_id} cancelled`);
}
