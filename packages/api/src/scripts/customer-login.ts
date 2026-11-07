import type { ExecArgs } from "@medusajs/framework/types";
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils";

/**
 * Check why a customer can't sign in, and optionally set their password.
 *
 *   CUSTOMER_EMAIL=customer@ezodtech.com bunx medusa exec ./src/scripts/customer-login.ts
 *   CUSTOMER_EMAIL=customer@ezodtech.com NEW_PASSWORD='Customer123!' bunx medusa exec ./src/scripts/customer-login.ts
 *
 * Fixes the three usual causes of "401" on sign-in:
 *  - wrong password                 → sets NEW_PASSWORD
 *  - customer has no login (made at checkout as a guest, or in the admin) → creates the login
 *  - login exists but isn't tied to the customer → ties it
 */
export default async function customerLogin({ container }: ExecArgs) {
  const log = container.resolve(ContainerRegistrationKeys.LOGGER);
  const email = (process.env.CUSTOMER_EMAIL ?? "").trim().toLowerCase();
  const password = process.env.NEW_PASSWORD ?? "";
  if (!email) {
    log.error("Set CUSTOMER_EMAIL=…");
    return;
  }

  const auth = container.resolve(Modules.AUTH);
  const customers = container.resolve(Modules.CUSTOMER);

  const found = await customers.listCustomers({ email });
  const registered = found.find((c) => c.has_account);
  log.info(
    `Customer records for ${email}: ${found.length
      ? found.map((c) => `${c.id} (${c.has_account ? "account" : "guest"})`).join(", ")
      : "none"}`
  );

  const [identity] = await auth.listProviderIdentities({ entity_id: email, provider: "emailpass" });
  const authIdentity = identity
    ? await auth.retrieveAuthIdentity(identity.auth_identity_id!)
    : null;
  const linked = (authIdentity?.app_metadata as Record<string, unknown> | undefined)?.customer_id as string | undefined;
  log.info(`Login (email + password): ${identity ? "exists" : "MISSING"}${identity ? `, tied to customer: ${linked ?? "NONE"}` : ""}`);

  if (!password) {
    if (!identity) log.info("→ This email has no password login. Re-run with NEW_PASSWORD='…' to create one.");
    else if (!linked) log.info("→ The login isn't tied to a customer. Re-run with NEW_PASSWORD='…' to fix.");
    else log.info("→ Everything is set up, so the password is wrong. Re-run with NEW_PASSWORD='…' to reset it.");
    return;
  }

  let authId = identity?.auth_identity_id;
  if (identity) {
    await auth.updateProvider("emailpass", { entity_id: email, password });
    log.info("Password updated.");
  } else {
    const r = await auth.register("emailpass", { body: { email, password } } as never);
    if (!r.success || !r.authIdentity) {
      log.error(`Could not create the login: ${r.error}`);
      return;
    }
    authId = r.authIdentity.id;
    log.info("Login created.");
  }

  let customerId = registered?.id ?? linked;
  if (!customerId) {
    const guest = found[0];
    if (guest) {
      await customers.updateCustomers(guest.id, { has_account: true } as never);
      customerId = guest.id;
      log.info(`Turned guest record ${guest.id} into an account.`);
    } else {
      const c = await customers.createCustomers({ email, has_account: true });
      customerId = c.id;
      log.info(`Created customer ${c.id}.`);
    }
  }

  if (linked !== customerId) {
    await auth.updateAuthIdentities({
      id: authId!,
      app_metadata: { ...(authIdentity?.app_metadata ?? {}), customer_id: customerId },
    });
    log.info(`Login tied to customer ${customerId}.`);
  }
  log.info(`✅ ${email} can now sign in.`);
}
