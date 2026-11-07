import type { MedusaContainer } from "@medusajs/framework/types";
import type { MedusaNextFunction, MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { ContainerRegistrationKeys, MedusaError, Modules } from "@medusajs/framework/utils";
import { money, renderEmail, siteName, storefrontUrl } from "../notifications/layout";
import { emailTo, inboxCustomerId, inboxFor, sendNotifications } from "../notifications/send";

/**
 * Promo codes for one customer — "a thank-you code just for Tinashe".
 *
 *   promotion.metadata.for_customer = { email?: "x@y.com", phone?: "0771234567", name?: "Tinashe" }
 *
 * The code then only works when the cart belongs to that customer: the cart's
 * email, the signed-in account's email or phone, or the delivery phone must
 * match. Checked when the code is applied and again when the order is placed.
 * Admins and vendors set it on the promotion page; the customer can be sent the
 * code by email (always from Cepstrum3D's address) + an in-store message.
 */

export type Recipient = { email?: string; phone?: string; name?: string };

export const normaliseEmail = (e?: string | null) => (e ?? "").trim().toLowerCase();

/** Digits only, Zimbabwe numbers as 263…: "077 123 4567", "+263 77 123 4567" → "263771234567". */
export const normalisePhone = (p?: string | null) => {
  let d = (p ?? "").replace(/\D/g, "");
  if (d.startsWith("00")) d = d.slice(2);
  if (d.startsWith("0") && d.length === 10) d = `263${d.slice(1)}`;
  return d;
};

export const recipientOf = (metadata?: Record<string, unknown> | null): Recipient | null => {
  const r = (metadata ?? {}).for_customer as Recipient | undefined;
  return r && (r.email || r.phone) ? r : null;
};

type CartIdentity = { emails: string[]; phones: string[] };

async function cartIdentity(container: MedusaContainer, cartId: string, extraEmail?: string | null): Promise<CartIdentity> {
  const query = container.resolve(ContainerRegistrationKeys.QUERY);
  const { data } = await query.graph({
    entity: "cart",
    fields: ["email", "customer.email", "customer.phone", "shipping_address.phone", "billing_address.phone"],
    filters: { id: cartId },
  });
  const c = (data[0] ?? {}) as any;
  return {
    emails: [extraEmail, c.email, c.customer?.email].map(normaliseEmail).filter(Boolean),
    phones: [c.customer?.phone, c.shipping_address?.phone, c.billing_address?.phone].map(normalisePhone).filter(Boolean),
  };
}

export const identityMatches = (r: Recipient, id: CartIdentity) =>
  (!!r.email && id.emails.includes(normaliseEmail(r.email))) || (!!r.phone && id.phones.includes(normalisePhone(r.phone)));

async function restrictedPromotions(container: MedusaContainer, codes: string[]) {
  if (!codes.length) return [];
  const query = container.resolve(ContainerRegistrationKeys.QUERY);
  const { data } = await query.graph({ entity: "promotion", fields: ["id", "code", "metadata"], filters: { code: codes } });
  return (data as { id: string; code: string; metadata?: Record<string, unknown> }[])
    .map((p) => ({ ...p, recipient: recipientOf(p.metadata) }))
    .filter((p) => p.recipient);
}

/**
 * POST /store/carts/:id (promo_codes) and POST /store/carts/:id/promotions —
 * refuse a customer-only code for anyone else.
 */
export async function guardRecipientCodes(req: MedusaRequest, _res: MedusaResponse, next: MedusaNextFunction) {
  const body = (req.body ?? {}) as { promo_codes?: unknown; email?: string };
  if (!Array.isArray(body.promo_codes) || !body.promo_codes.length || req.method !== "POST") return next();
  const cartId = req.params.id;
  if (!cartId) return next();

  const restricted = await restrictedPromotions(req.scope, body.promo_codes.map(String));
  if (!restricted.length) return next();

  const id = await cartIdentity(req.scope, cartId, body.email);
  for (const p of restricted) {
    if (identityMatches(p.recipient!, id)) continue;
    const message = !id.emails.length && !id.phones.length
      ? `The code ${p.code} is for one customer only. Sign in, or enter your email and phone at checkout, then apply it again.`
      : `The code ${p.code} isn't valid for this account. It was given to a specific customer.`;
    return next(new MedusaError(MedusaError.Types.NOT_ALLOWED, message));
  }
  return next();
}

/** POST /store/carts/:id/complete — remove a customer-only code the cart no longer qualifies for. */
export async function guardRecipientCodesAtCheckout(req: MedusaRequest, _res: MedusaResponse, next: MedusaNextFunction) {
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY);
  const { data } = await query.graph({ entity: "cart", fields: ["promotions.code"], filters: { id: req.params.id } });
  const codes = (((data[0] as any)?.promotions ?? []) as { code?: string }[]).map((p) => p.code).filter(Boolean) as string[];
  const restricted = await restrictedPromotions(req.scope, codes);
  if (!restricted.length) return next();

  const id = await cartIdentity(req.scope, req.params.id);
  const bad = restricted.filter((p) => !identityMatches(p.recipient!, id));
  if (!bad.length) return next();

  const { updateCartPromotionsWorkflow } = await import("@medusajs/medusa/core-flows");
  await updateCartPromotionsWorkflow(req.scope).run({
    input: { cart_id: req.params.id, promo_codes: bad.map((p) => p.code), action: "remove" } as never,
  });
  return next(
    new MedusaError(
      MedusaError.Types.NOT_ALLOWED,
      `The code ${bad.map((p) => p.code).join(", ")} is for a different customer, so it was removed. Please check your total and place the order again.`
    )
  );
}

// ---------------------------------------------------------------- panels

type PromotionRow = {
  id: string;
  code: string;
  status: string;
  metadata?: Record<string, unknown> | null;
  application_method?: { type?: string; value?: number; currency_code?: string | null; target_type?: string } | null;
  campaign?: { ends_at?: string | null } | null;
};

async function loadPromotion(container: MedusaContainer, id: string) {
  const query = container.resolve(ContainerRegistrationKeys.QUERY);
  const { data } = await query.graph({
    entity: "promotion",
    fields: [
      "id",
      "code",
      "status",
      "metadata",
      "application_method.type",
      "application_method.value",
      "application_method.currency_code",
      "application_method.target_type",
      "campaign.ends_at",
    ],
    filters: { id },
  });
  const p = data[0] as unknown as PromotionRow | undefined;
  if (!p) throw new MedusaError(MedusaError.Types.NOT_FOUND, "Promotion not found");
  return p;
}

export async function promotionSellerName(container: MedusaContainer, promotionId: string) {
  const query = container.resolve(ContainerRegistrationKeys.QUERY);
  const { data } = await query.graph({ entity: "promotion_seller", fields: ["seller_id"], filters: { promotion_id: promotionId } });
  const sellerId = (data[0] as { seller_id?: string } | undefined)?.seller_id;
  if (!sellerId) return null;
  const { data: s } = await query.graph({ entity: "seller", fields: ["name"], filters: { id: sellerId } });
  return (s[0] as { name?: string } | undefined)?.name ?? null;
}

export async function assertSellerOwnsPromotion(container: MedusaContainer, sellerId: string, promotionId: string) {
  const query = container.resolve(ContainerRegistrationKeys.QUERY);
  const { data } = await query.graph({
    entity: "promotion_seller",
    fields: ["promotion_id"],
    filters: { seller_id: sellerId, promotion_id: promotionId },
  });
  if (!data.length) throw new MedusaError(MedusaError.Types.NOT_FOUND, "Promotion not found");
}

export async function getRecipient(container: MedusaContainer, promotionId: string) {
  const p = await loadPromotion(container, promotionId);
  return {
    promotion: { id: p.id, code: p.code, status: p.status },
    recipient: recipientOf(p.metadata),
    sent_at: ((p.metadata ?? {}).for_customer_sent_at as string | undefined) ?? null,
  };
}

const describeValue = (p: PromotionRow) => {
  const am = p.application_method ?? {};
  const v = Number(am.value ?? 0);
  const amount = am.type === "percentage" ? `${v}% off` : `${money(v, am.currency_code ?? "usd")} off`;
  return am.target_type === "shipping_methods" ? `${amount} delivery` : amount;
};

/**
 * Save who the code is for; optionally email it to them now (and put it in their
 * in-store messages if they have an account). Clearing both email and phone
 * makes it a normal code again.
 */
export async function setRecipient(
  container: MedusaContainer,
  promotionId: string,
  input: { email?: string | null; phone?: string | null; name?: string | null; notify?: boolean; message?: string | null }
) {
  const p = await loadPromotion(container, promotionId);
  const email = normaliseEmail(input.email);
  const phone = (input.phone ?? "").trim();
  const name = (input.name ?? "").trim();
  if (email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    throw new MedusaError(MedusaError.Types.INVALID_DATA, "That email address doesn't look right.");
  }
  if (phone && normalisePhone(phone).length < 9) {
    throw new MedusaError(MedusaError.Types.INVALID_DATA, "That phone number doesn't look right.");
  }
  if (input.notify && !email) {
    throw new MedusaError(MedusaError.Types.INVALID_DATA, "Add the customer's email to send them the code.");
  }

  const metadata = { ...(p.metadata ?? {}) } as Record<string, unknown>;
  if (email || phone) metadata.for_customer = { email: email || undefined, phone: phone || undefined, name: name || undefined };
  else {
    delete metadata.for_customer;
    delete metadata.for_customer_sent_at;
  }

  if (input.notify && email) {
    const from = (await promotionSellerName(container, p.id)) ?? siteName();
    const ends = p.campaign?.ends_at ? new Date(p.campaign.ends_at).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" }) : null;
    const title = `${name ? `${name}, here's` : "Here's"} a code just for you: ${describeValue(p)}`;
    const intro = `${from === siteName() ? `Thank you for shopping with ${siteName()}.` : `${from} is saying thank you.`} Use this code at checkout on ${siteName()}.`;
    const extraHtml = `<p style="margin:16px 0;text-align:center"><span style="display:inline-block;border:2px dashed #ea580c;padding:10px 18px;font-size:22px;font-weight:bold;letter-spacing:2px;color:#ea580c">${p.code}</span></p>`;
    const paragraphs = [
      ...(input.message ? [String(input.message)] : []),
      `It only works for you — sign in with this email${phone ? " or use your phone number" : ""} when you check out.${ends ? ` Valid until ${ends}.` : ""}`,
    ];
    const content = renderEmail({
      heading: title,
      intro,
      paragraphs,
      extraHtml,
      button: { text: `Shop on ${siteName()}`, url: storefrontUrl() },
      footer: `${siteName()}${from !== siteName() ? ` on behalf of ${from}` : ""}.`,
    });
    const list = [emailTo(email, "promo-code-for-customer", { subject: title, ...content }, { id: p.id, type: "promotion" })];
    const inbox = await inboxCustomerId(container, email, null);
    if (inbox) {
      list.push(
        inboxFor(inbox, "promo-code-for-customer", { title, body: `${intro} Code: ${p.code}`, link: storefrontUrl(), stage: "promo", code: p.code }, { id: p.id, type: "promotion" })
      );
    }
    await sendNotifications(container, list, `Promo ${p.code} for ${email}`);
    metadata.for_customer_sent_at = new Date().toISOString();
  }

  await container.resolve(Modules.PROMOTION).updatePromotions([{ id: p.id, metadata } as never]);
  return getRecipient(container, promotionId);
}
