import { siteConfig } from "@/config/site"
/**
 * Home page hero carousel slides. Edit this file to change offers, pictures and links.
 *
 * - image: put files in public/images/hero/ (about 1400×1050, landscape 4:3 works best)
 * - theme: background of the text panel — "light" (warm orange tint), "sale" (red → orange),
 *          "fresh" (mint), "dark" (near-black)
 * - badge: optional big callout shown on the panel, e.g. "UP TO 30% OFF"
 */
export type HeroSlide = {
  id: string
  image: string
  imageAlt: string
  eyebrow?: string
  heading: string
  paragraph: string
  badge?: string
  theme: "light" | "sale" | "fresh" | "dark"
  primary: { label: string; path: string }
  secondary?: { label: string; path: string }
}

export const heroSlides: HeroSlide[] = [
  {
    id: "welcome",
    image: "/images/hero/hero-welcome.jpg",
    imageAlt: "3D printer nozzle building a part layer by layer",
    eyebrow: siteConfig.tagline,
    heading: "Everything for 3D printing, from vendors across Zimbabwe",
    paragraph:
      "Filament, resin, printers and spare parts — compare offers from trusted local sellers and pay with EcoCash, OneMoney or card.",
    theme: "light",
    primary: { label: "Shop now", path: "/categories" },
    secondary: { label: `Sell on ${siteConfig.name}`, path: "VENDOR_URL" },
  },
  {
    id: "black-november",
    image: "/images/hero/hero-sale.jpg",
    imageAlt: "Colourful filament spools",
    eyebrow: "Black November",
    heading: "Filament & tools deals",
    paragraph: "PLA, PETG, resin, dryers and tool kits marked down by our vendors. While stocks last.",
    badge: "Up to 30% off",
    theme: "sale",
    primary: { label: "Shop deals", path: "/categories/filaments" },
    secondary: { label: "All products", path: "/categories" },
  },
  {
    id: "pay-on-delivery",
    image: "/images/hero/hero-pod.jpg",
    imageAlt: "Parcel with a filament spool",
    eyebrow: "Pay on delivery",
    heading: "Order now, pay when it arrives",
    paragraph:
      "Most filament, resin, parts and accessories can be paid in cash or EcoCash on delivery. Look for the Pay on delivery badge.",
    theme: "fresh",
    primary: { label: "Shop filament", path: "/categories/filaments" },
    secondary: { label: "Spare parts", path: "/categories/spare-parts-upgrades" },
  },
  {
    id: "printers",
    image: "/images/hero/hero-printer.jpg",
    imageAlt: "Desktop 3D printer",
    eyebrow: "3D printers",
    heading: "Start printing from $199",
    paragraph: "Beginner-friendly FDM and resin printers from Bambu Lab, Creality, Kingroon, Elegoo and Anycubic.",
    theme: "dark",
    primary: { label: "Shop printers", path: "/categories/3d-printers-more" },
    secondary: { label: "Compare brands", path: "/collections/bambu-lab" },
  },
]
