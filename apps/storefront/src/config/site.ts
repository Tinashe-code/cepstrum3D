/**
 * Storefront branding — the single place to rename the marketplace.
 *
 * Change `name` here and it updates the logo, page titles, SEO tags, footer,
 * hero, "Sell on …" section and cart labels across every page.
 */
export const siteConfig = {
  /** Marketplace name shown everywhere on the storefront. */
  name: "Cepstrum3D",

  /** One-line description used in page titles/SEO and social previews. */
  description:
    "Zimbabwe's 3D printing marketplace — filament, resin, printers and parts from trusted local vendors.",

  /** Short tagline shown above the first hero slide. */
  tagline: "Zimbabwe's 3D printing marketplace",

  /** Company that owns and runs the platform (footer credit). */
  owner: "Cepstrum Technologies",

  /** Commercial partner (footer credit). Set to "" to hide. */
  partner: "EzoD Tech",

  /** Small square brand mark (no text) — used where an image URL is needed. */
  logoMark: "/logo-mark.svg",

  /** Returns policy shown on every product page (Delivery & Returns). */
  returnsPolicy:
    "Unused items in their original packaging can be returned within 7 days of delivery. Contact the vendor from your order page to arrange a return.",

  /** Where customers can reach you (Help & FAQs, policy pages). Leave "" to hide. */
  supportEmail: "",
  /** WhatsApp number in international format without + or spaces, e.g. "263771234567". */
  supportWhatsApp: "",

  /** Footer "Connect" links. Leave "" to hide one. */
  social: {
    facebook: "",
    instagram: "",
    linkedin: "",
  },

  /** In the cart, show "Only N left" when a vendor has fewer than this many in stock. */
  lowStockThreshold: 10,
} as const

export type SiteConfig = typeof siteConfig
