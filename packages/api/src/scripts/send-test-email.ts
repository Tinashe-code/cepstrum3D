/**
 * Check that emails can be sent. Sends one test email and prints Resend's answer
 * with what to fix.
 *
 *   TEST_EMAIL_TO=you@example.com bunx medusa exec ./src/scripts/send-test-email.ts
 */
import { ExecArgs } from "@medusajs/framework/types";
import { resendConfig, sendWithResend } from "../lib/notifications/resend";
import { renderEmail } from "../lib/notifications/layout";

export default async function run(_: ExecArgs) {
  const { apiKey, from } = resendConfig();
  const to = (process.env.TEST_EMAIL_TO ?? "").trim();
  const line = (s: string) => console.log(s);

  line("");
  line(`RESEND_API_KEY : ${apiKey ? `set (${apiKey.slice(0, 5)}…, ${apiKey.length} chars)` : "MISSING — add it to packages/api/.env"}`);
  line(`EMAIL_FROM     : ${from}`);
  line(`TEST_EMAIL_TO  : ${to || "MISSING — run with TEST_EMAIL_TO=you@example.com"}`);
  if (!apiKey || !to) return;

  const email = renderEmail({
    heading: "Test email",
    intro: "If you can read this, Cepstrum3D can send emails. 🎉",
    footer: "Sent by scripts/send-test-email.ts",
  });
  const result = await sendWithResend({ to, subject: "Cepstrum3D test email", ...email }, apiKey, from);
  if (result.ok) {
    line(`\n✅ Sent. Resend id ${result.id}. Check the inbox (and spam) of ${to}.`);
    line("   You can also see it at resend.com → Emails.");
  } else {
    line(`\n❌ Not sent. Resend answered ${result.status}: ${result.message}`);
    if (result.hint) line(`   → ${result.hint}`);
  }
}
