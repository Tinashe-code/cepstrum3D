import type { MedusaContainer } from "@medusajs/framework/types";
import { ContainerRegistrationKeys } from "@medusajs/framework/utils";
import { renderEmail, siteName, vendorPortalUrl } from "./layout";
import { emailTo, sendNotifications } from "./send";

/**
 * Emails about a vendor's account:
 *   • sign-up received  (seller.created)  → the vendor, plus an alert to the onboarding team
 *   • store approved    (seller.approved) → the vendor
 *
 * Sent to the store's email and to every member login (they're often different).
 *
 *   VENDOR_SUPPORT_CONTACT      shown to vendors, default "Ezod Tech: admin@ezodtech.com · +263 78 617 9303"
 *   VENDOR_SIGNUP_ALERT_EMAIL   who is told about new sign-ups (comma list), default admin@ezodtech.com; "off" to disable
 *   MERCUR_BACKEND_URL          used for the admin panel link
 */

const supportContact = () =>
  process.env.VENDOR_SUPPORT_CONTACT || "Ezod Tech: admin@ezodtech.com · +263 78 617 9303";

const signupAlertTo = () => {
  const v = process.env.VENDOR_SIGNUP_ALERT_EMAIL ?? "admin@ezodtech.com";
  return v.toLowerCase() === "off" ? [] : v.split(",").map((s) => s.trim()).filter(Boolean);
};

const adminUrl = () => `${(process.env.MERCUR_BACKEND_URL || "http://localhost:9000").replace(/\/$/, "")}/dashboard`;

type Seller = {
  id: string;
  name: string;
  email?: string | null;
  phone?: string | null;
  status?: string | null;
  members?: { email?: string | null; first_name?: string | null }[] | null;
};

async function loadSeller(container: MedusaContainer, id: string): Promise<Seller | undefined> {
  const query = container.resolve(ContainerRegistrationKeys.QUERY);
  const { data } = await query.graph({
    entity: "seller",
    fields: ["id", "name", "email", "phone", "status", "members.email", "members.first_name"],
    filters: { id },
  });
  return data[0] as Seller | undefined;
}

/** Store email + member logins, without duplicates. */
const recipients = (s: Seller) => {
  const seen = new Set<string>();
  return [s.email, ...(s.members ?? []).map((m) => m?.email)]
    .filter((e): e is string => !!e && e.includes("@"))
    .filter((e) => {
      const k = e.trim().toLowerCase();
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    });
};

const firstName = (s: Seller) => s.members?.find((m) => m?.first_name)?.first_name?.trim() || null;

export async function notifySellerSignedUp(container: MedusaContainer, sellerId: string) {
  const s = await loadSeller(container, sellerId);
  if (!s) return [];
  const name = firstName(s);
  const site = siteName();

  const vendorEmail = renderEmail({
    heading: name ? `Thanks for signing up, ${name}` : "Thanks for signing up",
    intro: `We've received your vendor account for ${s.name} on ${site}.`,
    paragraphs: [
      "Our team reviews every new store before it goes live. This usually takes up to one business day, and we'll email you as soon as your store is approved.",
      "Once approved, you can add your products from the vendor portal. Each listing is checked before customers see it, so have clear photos, prices and stock levels ready.",
      `Need help getting set up? ${supportContact()}`,
    ],
    button: { text: "Open the vendor portal", url: vendorPortalUrl() },
    footer: `You're receiving this because a vendor account was created for ${s.name} on ${site}.`,
  });
  const list = recipients(s).map((to) =>
    emailTo(to, "vendor-signup-received", { subject: `Welcome to ${site}: your store is being reviewed`, ...vendorEmail }, { id: s.id, type: "seller" })
  );

  // Tell the onboarding team there's a store waiting for approval.
  const alert = renderEmail({
    heading: "New vendor sign-up",
    intro: `${s.name} has signed up and is waiting for approval.`,
    rows: [
      { label: "Store", value: s.name },
      { label: "Email", value: recipients(s).join(", ") || "-" },
      { label: "Phone", value: s.phone || "-" },
    ],
    button: { text: "Review in the admin panel", url: `${adminUrl()}/stores` },
  });
  for (const to of signupAlertTo()) {
    list.push(emailTo(to, "admin-vendor-signup", { subject: `New vendor sign-up: ${s.name}`, ...alert }, { id: s.id, type: "seller" }));
  }

  return sendNotifications(container, list, `seller ${s.id} sign-up`);
}

export async function notifySellerApproved(container: MedusaContainer, sellerId: string) {
  const s = await loadSeller(container, sellerId);
  if (!s) return [];
  const site = siteName();
  const portal = vendorPortalUrl();

  const email = renderEmail({
    heading: `Your store is approved`,
    intro: `Good news: ${s.name} is now approved on ${site}. You can start listing your products.`,
    paragraphs: [
      "1. Log in to the vendor portal and add your products, with photos, prices and stock levels.",
      "2. Each new listing is checked by our team before it goes live, usually within a day.",
      "3. When a customer orders, you'll get an email. Pack and deliver the order, and update its status in the portal.",
      "Before you start, read Listing rules and Fees & charges in the portal menu.",
      `Questions? ${supportContact()}`,
    ],
    button: { text: "Go to your vendor portal", url: portal },
    footer: `${site} · vendor portal: ${portal}`,
  });
  const list = recipients(s).map((to) =>
    emailTo(to, "vendor-store-approved", { subject: `Your ${site} store is approved`, ...email }, { id: s.id, type: "seller" })
  );
  return sendNotifications(container, list, `seller ${s.id} approved`);
}
