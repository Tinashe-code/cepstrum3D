import { siteConfig } from "@/config/site"

/**
 * Text for the footer pages at /info/<slug>. Edit freely: each page is a title,
 * a short intro and sections of paragraphs. "{FREE_DELIVERY}" is replaced with
 * the live free-delivery rule from admin → Delivery.
 *
 * The Privacy Policy and Terms are a plain-language starting point. Have them
 * checked by someone qualified before relying on them.
 */

export type InfoSection = { heading: string; paragraphs: string[] }
export type InfoPage = { title: string; intro: string; sections: InfoSection[] }

const name = siteConfig.name
const owner = siteConfig.owner

const contactLine = () => {
  const ways = [
    siteConfig.supportEmail && `email ${siteConfig.supportEmail}`,
    siteConfig.supportWhatsApp && `WhatsApp +${siteConfig.supportWhatsApp}`,
  ].filter(Boolean)
  return ways.length
    ? `You can reach the ${name} team by ${ways.join(" or ")}.`
    : `You can reach the ${name} team through the contact details on this site.`
}

export const infoPages: Record<string, InfoPage> = {
  help: {
    title: "Help & FAQs",
    intro: `Answers to the questions we hear most. ${contactLine()}`,
    sections: [
      {
        heading: "How does ordering work?",
        paragraphs: [
          `${name} is a marketplace: products are sold and delivered by independent vendors across Zimbabwe. You can buy from several vendors in one checkout; each vendor receives and delivers their part of the order.`,
          "You'll get an email when your order is received, and again when each vendor packs, ships and delivers it. You can also follow it under Account → Orders.",
        ],
      },
      {
        heading: "Can I cancel an order?",
        paragraphs: [
          "Yes, until the vendor starts packing it. Open the order under Account → Orders and choose Cancel order. The vendor is told straight away.",
        ],
      },
      {
        heading: "How much is delivery?",
        paragraphs: [
          "Delivery is priced by road distance from the vendor to your address. You see the exact amount at checkout before you place the order. {FREE_DELIVERY}",
        ],
      },
      {
        heading: "How do I pay?",
        paragraphs: ["You pay when your order is delivered. See Payment options for details."],
      },
      {
        heading: "Can I return something?",
        paragraphs: [siteConfig.returnsPolicy],
      },
      {
        heading: "Who writes the reviews?",
        paragraphs: [
          "Only customers who received the product can review it, so every review comes from a real purchase. Vendors can reply, and their replies are shown under the review.",
        ],
      },
    ],
  },

  delivery: {
    title: "Delivery in Zimbabwe",
    intro: "Each vendor delivers their own items to your door.",
    sections: [
      {
        heading: "Price",
        paragraphs: [
          "Delivery is priced by road distance from the vendor to your address, and shown at checkout before you pay anything. If your cart has items from two vendors, there are two deliveries, each priced separately.",
          "{FREE_DELIVERY}",
          "Some products deliver free in certain towns; this is shown on the product page.",
        ],
      },
      {
        heading: "Your address",
        paragraphs: [
          "Start typing your street at checkout and pick it from the list. If your exact address isn't listed, choose the closest shop, school or landmark and add directions, or use “Use my location” so the vendor can find you.",
        ],
      },
      {
        heading: "Tracking",
        paragraphs: [
          "You'll get an email when the vendor packs, ships and delivers your order. You can also check it any time under Account → Orders.",
        ],
      },
    ],
  },

  returns: {
    title: "Returns",
    intro: siteConfig.returnsPolicy,
    sections: [
      {
        heading: "How to return an item",
        paragraphs: [
          "Open the order under Account → Orders and contact the vendor who sold the item. They will arrange collection or drop-off and the refund.",
          "Items must be unused and in their original packaging. Opened filament, resin and other consumables may not be returnable unless they are faulty.",
        ],
      },
      {
        heading: "Faulty or wrong items",
        paragraphs: [
          `If something arrives damaged, faulty or isn't what you ordered, contact the vendor as soon as possible with photos. If you can't resolve it with the vendor, contact the ${name} team and we'll help.`,
        ],
      },
    ],
  },

  payment: {
    title: "Payment options",
    intro: "You pay when your order is delivered.",
    sections: [
      {
        heading: "Pay on delivery",
        paragraphs: [
          "Place your order without paying online. When the vendor delivers, you pay them the order total shown in your order confirmation, including delivery.",
          "Ask the vendor which methods they accept when they contact you (for example cash or mobile money).",
        ],
      },
      {
        heading: "Online payment",
        paragraphs: ["Paying online by card or mobile money is coming soon."],
      },
    ],
  },

  about: {
    title: `About ${name}`,
    intro: `${name} is Zimbabwe's 3D printing marketplace, run by ${owner}.`,
    sections: [
      {
        heading: "What we do",
        paragraphs: [
          "We bring together trusted local vendors of filament, resin, 3D printers, spare parts and accessories, so you can compare and buy everything for 3D printing in one place and have it delivered.",
          siteConfig.partner ? `${siteConfig.partner} is our commercial partner and one of the first vendors on the platform.` : "",
        ].filter(Boolean),
      },
      {
        heading: "Trusted listings",
        paragraphs: [
          `Every new vendor listing is checked by the ${name} team before customers can see it, and listings that break our rules are removed. Reviews only come from customers who received the product.`,
        ],
      },
    ],
  },

  sell: {
    title: `Sell on ${name}`,
    intro: "Reach 3D printing customers across Zimbabwe.",
    sections: [
      {
        heading: "How it works",
        paragraphs: [
          "Create a vendor account, add your products, and our team approves each listing before it goes live. You receive orders by email, pack and deliver them, and get paid on delivery.",
        ],
      },
    ],
  },

  privacy: {
    title: "Privacy Policy",
    intro: `How ${owner} collects and uses your information when you use ${name}.`,
    sections: [
      {
        heading: "What we collect",
        paragraphs: [
          "Your name, email address, phone number and delivery addresses; the orders you place; reviews you write; and the map location of your address if you choose it or use “Use my location”.",
        ],
      },
      {
        heading: "How we use it",
        paragraphs: [
          "To process and deliver your orders, to send you order updates, to let you manage your account, and to show your reviews (with your first name and last initial only).",
          "We share the details needed to deliver an order (name, phone, address and items) with the vendor who fulfils it. We use Google Maps to find addresses and work out delivery distances, and an email provider to send order emails. We do not sell your information.",
        ],
      },
      {
        heading: "Your choices",
        paragraphs: [
          `You can update your details and addresses under Account at any time. To have your account deleted, contact the ${name} team. ${contactLine()}`,
        ],
      },
    ],
  },

  terms: {
    title: "Terms & Conditions",
    intro: `These terms apply when you use ${name}, a marketplace operated by ${owner}.`,
    sections: [
      {
        heading: "The marketplace",
        paragraphs: [
          `Products on ${name} are sold by independent vendors. When you place an order, your contract of sale is with the vendor of each item. ${owner} runs the platform, checks listings and helps resolve problems.`,
        ],
      },
      {
        heading: "Orders, prices and payment",
        paragraphs: [
          "Prices are shown in US dollars and include the vendor's price for the item. Delivery is added at checkout. Orders are paid on delivery unless another payment option is offered at checkout.",
          "You can cancel an order until the vendor starts packing it. Vendors may cancel an order if an item is unavailable; you won't be charged for cancelled items.",
        ],
      },
      {
        heading: "Returns",
        paragraphs: [siteConfig.returnsPolicy],
      },
      {
        heading: "Reviews and conduct",
        paragraphs: [
          "Reviews must be honest and about the product. We may hide reviews or remove listings that are misleading, abusive or break the law.",
        ],
      },
      {
        heading: "Changes",
        paragraphs: [
          `We may update these terms. The version on this page applies to orders placed after the update. ${contactLine()}`,
        ],
      },
    ],
  },
}
