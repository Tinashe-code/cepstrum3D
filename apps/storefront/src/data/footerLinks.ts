import { siteConfig } from "@/config/site"

/**
 * Footer links. /info/… pages come from data/infoPages.ts (edit the text there).
 * Social links come from siteConfig.social and are hidden while empty.
 */
const social = [
  { label: "WhatsApp", path: siteConfig.supportWhatsApp ? `https://wa.me/${siteConfig.supportWhatsApp}` : "" },
  { label: "Facebook", path: siteConfig.social.facebook },
  { label: "Instagram", path: siteConfig.social.instagram },
  { label: "LinkedIn", path: siteConfig.social.linkedin },
].filter((l) => l.path)

const links = {
  customerServices: [
    { label: "Help & FAQs", path: "/info/help" },
    { label: "Track Order", path: "/user/orders" },
    { label: "Returns", path: "/info/returns" },
    { label: "Delivery in Zimbabwe", path: "/info/delivery" },
    { label: "Payment options", path: "/info/payment" },
  ],
  about: [
    { label: `About ${siteConfig.name}`, path: "/info/about" },
    { label: `Sell on ${siteConfig.name}`, path: process.env.NEXT_PUBLIC_VENDOR_URL || "/info/sell" },
    { label: "Privacy Policy", path: "/info/privacy" },
    { label: "Terms & Conditions", path: "/info/terms" },
  ],
  connect: social,
}

export default links
