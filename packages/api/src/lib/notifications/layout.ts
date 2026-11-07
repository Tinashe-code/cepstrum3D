/**
 * One look for every Cepstrum3D email (customers and vendors): orange header
 * with the site name, heading, text, optional item table and button.
 *
 *   SITE_NAME           default "Cepstrum3D"
 *   STOREFRONT_URL      shop link incl. country, e.g. https://cepstrum3d.co.zw/zw
 *   VENDOR_PORTAL_URL   vendor portal, e.g. https://api.cepstrum3d.co.zw/seller
 */

export const siteName = () => process.env.SITE_NAME || "Cepstrum3D";
export const storefrontUrl = () => (process.env.STOREFRONT_URL || "http://localhost:3000/zw").replace(/\/$/, "");
export const vendorPortalUrl = () => (process.env.VENDOR_PORTAL_URL || "http://localhost:9000/seller").replace(/\/$/, "");

export const escapeHtml = (s: string) =>
  String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

export const money = (amount: number | null | undefined, currency = "usd") => {
  const n = Number(amount ?? 0);
  const code = currency.toUpperCase();
  return code === "USD" ? `$${n.toFixed(2)}` : `${n.toFixed(2)} ${code}`;
};

export type EmailRow = { label: string; value: string; strong?: boolean };

export function renderEmail({
  heading,
  intro,
  paragraphs = [],
  rows = [],
  totals = [],
  button,
  extraHtml = "",
  footer,
}: {
  heading: string;
  intro: string;
  paragraphs?: string[];
  /** Item lines, e.g. { label: "2 × eSUN PLA+ (Black)", value: "$25.50" } */
  rows?: EmailRow[];
  /** Under the items, e.g. Delivery / Total */
  totals?: EmailRow[];
  button?: { text: string; url: string };
  extraHtml?: string;
  footer?: string;
}) {
  const e = escapeHtml;
  const row = (r: EmailRow) =>
    `<tr><td style="padding:6px 0;font-size:14px;${r.strong ? "font-weight:bold;" : ""}">${e(r.label)}</td>` +
    `<td align="right" style="padding:6px 0;font-size:14px;white-space:nowrap;${r.strong ? "font-weight:bold;" : ""}">${e(r.value)}</td></tr>`;

  const html = `<!doctype html><html><body style="margin:0;background:#f5f5f5;font-family:Arial,Helvetica,sans-serif;color:#18181b">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:24px 12px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:8px;overflow:hidden">
<tr><td style="background:#ea580c;color:#ffffff;padding:16px 24px;font-size:20px;font-weight:bold;letter-spacing:1px">${e(siteName().toUpperCase())}</td></tr>
<tr><td style="padding:24px">
<h1 style="margin:0 0 12px;font-size:20px">${e(heading)}</h1>
<p style="margin:0 0 16px;font-size:15px;line-height:1.5">${e(intro)}</p>
${paragraphs.map((p) => `<p style="margin:0 0 12px;font-size:14px;line-height:1.5">${e(p)}</p>`).join("")}
${rows.length ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:8px 0 4px;border-top:1px solid #eeeeee">${rows.map(row).join("")}</table>` : ""}
${totals.length ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 16px;border-top:1px solid #eeeeee">${totals.map(row).join("")}</table>` : ""}
${extraHtml}
${button ? `<p style="margin:20px 0 0"><a href="${e(button.url)}" style="display:inline-block;background:#ea580c;color:#ffffff;text-decoration:none;padding:12px 20px;border-radius:4px;font-weight:bold">${e(button.text)}</a></p>` : ""}
</td></tr>
${footer ? `<tr><td style="padding:16px 24px;font-size:12px;color:#71717a;border-top:1px solid #eeeeee">${e(footer)}</td></tr>` : ""}
</table></td></tr></table></body></html>`;

  const text = [
    heading,
    "",
    intro,
    ...paragraphs.map((p) => `\n${p}`),
    rows.length ? "" : null,
    ...rows.map((r) => `• ${r.label} — ${r.value}`),
    ...totals.map((r) => `${r.label}: ${r.value}`),
    button ? `\n${button.text}: ${button.url}` : null,
    footer ? `\n--\n${footer}` : null,
  ]
    .filter((l) => l !== null)
    .join("\n");

  return { html, text };
}
