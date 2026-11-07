import type { CreateNotificationDTO, MedusaContainer } from "@medusajs/framework/types";
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils";

/**
 * Helpers for sending Cepstrum3D notifications. Emails always go out from
 * Cepstrum3D's own address (EMAIL_FROM), whoever they are about — a vendor's
 * promotion, a vendor's order, etc.
 */

export type EmailContent = { subject: string; html: string; text: string };

/** Send; never throws (a failed email must not break checkout or fulfilment). */
export async function sendNotifications(container: MedusaContainer, list: CreateNotificationDTO[], what: string) {
  if (!list.length) return [];
  try {
    await container.resolve(Modules.NOTIFICATION).createNotifications(list);
  } catch (e) {
    container.resolve(ContainerRegistrationKeys.LOGGER).error(`${what}: notification failed — ${(e as Error).message}`);
  }
  return list;
}

export const emailTo = (
  to: string,
  template: string,
  content: EmailContent,
  resource?: { id: string; type: string },
  receiverId?: string | null
): CreateNotificationDTO => ({
  to,
  channel: "email",
  template,
  receiver_id: receiverId ?? undefined,
  resource_id: resource?.id,
  resource_type: resource?.type,
  data: content,
});

export const inboxFor = (
  customerId: string,
  template: string,
  message: { title: string; body: string; link?: string | null; stage?: string } & Record<string, unknown>,
  resource?: { id: string; type: string }
): CreateNotificationDTO => ({
  to: customerId,
  channel: "inbox",
  template,
  receiver_id: customerId,
  resource_id: resource?.id,
  resource_type: resource?.type,
  data: message,
});

/**
 * The account that should see in-store messages. Orders placed as a guest
 * belong to a separate guest record, so prefer the registered account with the
 * same email.
 */
export async function inboxCustomerId(container: MedusaContainer, email?: string | null, customerId?: string | null) {
  if (email) {
    const query = container.resolve(ContainerRegistrationKeys.QUERY);
    const { data } = await query.graph({ entity: "customer", fields: ["id", "has_account"], filters: { email } });
    const registered = (data as { id: string; has_account: boolean }[]).find((c) => c.has_account);
    if (registered) return registered.id;
  }
  return customerId ?? null;
}
