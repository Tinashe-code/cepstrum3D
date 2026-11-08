import type { ExecArgs } from "@medusajs/framework/types";
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils";

/**
 * Set a new password for any login: admin, vendor (store member) or customer.
 *
 *   LOGIN_EMAIL=admin@layerline.test NEW_PASSWORD='Long-Random-Pass-123' \
 *     bunx medusa exec ./src/scripts/set-password.ts
 *
 * LOGIN_EMAIL can be several addresses separated by commas; with
 * NEW_PASSWORD=random each gets its own random password (printed once) —
 * handy for locking demo accounts.
 */
export default async function setPassword({ container }: ExecArgs) {
  const log = container.resolve(ContainerRegistrationKeys.LOGGER);
  const auth = container.resolve(Modules.AUTH);
  const emails = (process.env.LOGIN_EMAIL ?? "").split(",").map((e) => e.trim().toLowerCase()).filter(Boolean);
  const wanted = process.env.NEW_PASSWORD ?? "";
  if (!emails.length || !wanted) {
    log.error("Set LOGIN_EMAIL and NEW_PASSWORD (or NEW_PASSWORD=random)");
    return;
  }
  if (wanted !== "random" && wanted.length < 10) {
    log.error("Use at least 10 characters.");
    return;
  }
  const { randomBytes } = await import("node:crypto");
  for (const email of emails) {
    const [identity] = await auth.listProviderIdentities({ entity_id: email, provider: "emailpass" });
    if (!identity) {
      log.warn(`${email}: no login with this email`);
      continue;
    }
    const password = wanted === "random" ? randomBytes(18).toString("base64url") : wanted;
    await auth.updateProvider("emailpass", { entity_id: email, password });
    log.info(`${email}: password changed${wanted === "random" ? ` → ${password}` : ""}`);
  }
}
