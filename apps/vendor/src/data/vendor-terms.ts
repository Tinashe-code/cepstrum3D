/**
 * Text and numbers for two vendor portal pages:
 *   • Fees & charges  (routes/fees/page.tsx)
 *   • Listing rules   (routes/listing-rules/page.tsx)
 *
 * Edit here, then deploy. Leave a rate as null until it is decided: the page
 * then shows "To be announced" instead of a number.
 *
 * Model (like Takealot): no listing fees; a success fee (a % of each sale,
 * by category) and a monthly subscription fee. Vendors deliver their own
 * orders, so there are no warehouse, storage or fulfilment fees.
 */

export const FEES = {
  /** Length of the free trial for new vendors. */
  trialLength: "first month",

  /**
   * Date the charges start, e.g. "2027-01-01". null = not set yet (trial still
   * running). Vendors are emailed at least `noticeDays` before this date.
   */
  effectiveFrom: null as string | null,
  noticeDays: 30,

  /** Monthly subscription fee in US$, per vendor account. null = to be announced. */
  monthlySubscription: null as number | null,
  /** Months where the vendor sells less than this (US$) pay no subscription. null = no waiver. */
  subscriptionWaivedBelow: null as number | null,

  /**
   * Success fee: % of the item price (excluding delivery) on each item sold
   * and delivered. Category names match the shop's main categories.
   */
  successFees: [
    { category: "Filaments", rate: null as number | null },
    { category: "Resin", rate: null as number | null },
    { category: "3D Printers & More", rate: null as number | null },
    { category: "Spare Parts & Upgrades", rate: null as number | null },
    { category: "Accessories", rate: null as number | null },
  ],

  /** How fees are billed and paid. */
  billing: [
    "Fees are worked out on orders that were delivered during the calendar month.",
    "You receive a statement by email in the first week of the next month, listing each order and its fee.",
    "Payment is due within 7 days of the statement, by bank transfer or mobile money.",
  ],

  /** What vendors are never charged for. */
  neverCharged: [
    "Creating an account or listing products",
    "Orders that are cancelled before delivery",
    "Items that are returned and refunded (the success fee is credited back)",
    "Delivery fees paid by the customer",
  ],

  contact: "EzoD Tech (Cepstrum3D vendor support): 0786 179 303 · admin@ezodtech.com",
}

export type RuleSection = { title: string; rules: string[] }

export const LISTING_RULES: RuleSection[] = [
  {
    title: "What you can sell",
    rules: [
      "New, genuine 3D printing products: filament, resin, 3D printers, spare parts, upgrades, tools and accessories.",
      "Each product must be listed in the right category.",
      "Used or refurbished items may only be listed if the title and description say so clearly.",
    ],
  },
  {
    title: "What you can't sell",
    rules: [
      "Counterfeit or copied branded products, or anything that infringes someone else's design, trademark or copyright.",
      "Weapons, firearm parts or files for printing them.",
      "Recalled, unsafe or expired products (for example, expired resin).",
      "Anything illegal to sell in Zimbabwe.",
    ],
  },
  {
    title: "Titles, descriptions and photos",
    rules: [
      "Titles follow: Brand, product, key spec. For example: \"eSUN PLA+ – 1.75mm, 1kg\".",
      "Fill in the attributes accurately (material, diameter, net weight, colour, brand). Customers filter by them.",
      "Photos must show the actual product on a plain background. No watermarks, logos over the product, or stock photos of a different item.",
      "Each colour or size variant should have its own photo.",
      "No phone numbers, emails, website links or social media handles in titles, descriptions or photos.",
    ],
  },
  {
    title: "Prices and promotions",
    rules: [
      "Prices are in US dollars and are the full price of the item. Delivery is added at checkout.",
      "A \"was\" price on a sale must be a price you actually charged before the sale.",
      "Don't change prices on orders already placed.",
    ],
  },
  {
    title: "Stock",
    rules: [
      "Keep stock levels up to date. Customers see your stock live, so set an item to 0 as soon as it runs out.",
      "Only list stock you have on hand and can deliver.",
    ],
  },
  {
    title: "Orders and delivery",
    rules: [
      "Accept or cancel a new order within 1 business day.",
      "Update each order as you pack, ship and deliver it. Customers get an email at every step.",
      "Deliver within the time you promised. Contact the customer if anything changes.",
      "Collect payment only on delivery, for the amount shown on the order.",
    ],
  },
  {
    title: "Customers and reviews",
    rules: [
      "Keep all sales on Cepstrum3D. Don't ask customers to order from you directly instead.",
      "Never write, buy or ask for fake reviews. You may reply to reviews politely.",
      "Accept returns in line with the shop's returns policy: unused items in their original packaging, within 7 days of delivery.",
    ],
  },
  {
    title: "Approval and enforcement",
    rules: [
      "Every new listing, and changes to product details, are checked by the Cepstrum3D team before customers see them.",
      "A listing that breaks these rules can be rejected or suspended. You'll get an email with the reason, and can see it under Listing status.",
      "Repeated or serious breaches can lead to your vendor account being suspended.",
      "These rules may be updated. We'll email you before any change takes effect.",
    ],
  },
]
