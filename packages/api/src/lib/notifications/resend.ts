/**
 * Send one email through Resend's HTTP API. Shared by the email notification
 * provider and scripts/send-test-email.ts.
 *
 *   RESEND_API_KEY  re_…  (resend.com → API Keys)
 *   EMAIL_FROM      "Cepstrum3D <orders@your-verified-domain>"
 */

export type ResendResult = { ok: true; id: string } | { ok: false; status: number; message: string; hint?: string };

export const resendConfig = () => ({
  apiKey: (process.env.RESEND_API_KEY ?? "").trim().replace(/^["']|["']$/g, ""),
  from: (process.env.EMAIL_FROM ?? "").trim().replace(/^["']|["']$/g, "") || "Cepstrum3D <onboarding@resend.dev>",
});

/** Plain-language reason for the usual Resend errors. */
export function resendHint(status: number, message: string) {
  const m = message.toLowerCase();
  if (status === 401 || m.includes("api key is invalid")) return "RESEND_API_KEY is wrong or was revoked — copy it again from resend.com → API Keys.";
  if (m.includes("only send testing emails")) {
    return "With the test sender (onboarding@resend.dev) Resend only delivers to the email you signed up with. Verify your domain in resend.com → Domains, then set EMAIL_FROM to an address on it.";
  }
  if (m.includes("domain is not verified") || m.includes("not verified")) {
    return "The domain in EMAIL_FROM isn't verified yet. Add the DNS records shown in resend.com → Domains and wait for 'Verified'.";
  }
  if (m.includes("from") && m.includes("invalid")) return 'EMAIL_FROM must look like: Cepstrum3D <orders@yourdomain.co.zw>';
  if (status === 429) return "Too many emails at once (free plan: 2 per second, 100 per day).";
  return undefined;
}

export async function sendWithResend(
  email: { to: string; subject: string; html?: string; text?: string; from?: string },
  apiKey: string,
  defaultFrom: string
): Promise<ResendResult> {
  try {
    // RESEND_API_URL only for testing against a stand-in server; normally unset.
    const base = (process.env.RESEND_API_URL || "https://api.resend.com").replace(/\/$/, "");
    const res = await fetch(`${base}/emails`, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: email.from || defaultFrom,
        to: [email.to],
        subject: email.subject,
        html: email.html,
        text: email.text,
      }),
      signal: AbortSignal.timeout(15000),
    });
    const body = (await res.json().catch(() => ({}))) as { id?: string; message?: string };
    if (res.ok && body.id) return { ok: true, id: body.id };
    const message = body.message ?? res.statusText;
    return { ok: false, status: res.status, message, hint: resendHint(res.status, message) };
  } catch (e) {
    return { ok: false, status: 0, message: (e as Error).message, hint: "Couldn't reach api.resend.com — check the server's internet connection." };
  }
}
