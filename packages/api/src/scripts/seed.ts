/**
 * Cepstrum3D marketplace — 3D printing catalogue seed.
 *
 * Owned by Cepstrum Technologies. Commercial partner and anchor vendor: EzoD Tech.
 *
 * The catalogue structure follows 3DJake:
 *   - Top categories: 3D Printers & More, Filaments, Resin, Spare Parts & Upgrades, Accessories
 *   - Sub-categories by material / part type (PLA, PETG, Nozzles, ...)
 *   - Brand pages (Kingroon, Elegoo, ...) as product collections → /collections/<brand>
 *   - Filters: Material, Brand, Colour, Diameter, Net weight, Compatibility system, Printer technology
 *
 * Products are shared "master products"; each vendor sells them through Offers
 * with its own price and stock, Takealot-style. Prices are demo values in USD.
 *
 * Run from packages/api:  bun run seed   (safe to re-run; skips existing data)
 */
import { ExecArgs } from "@medusajs/framework/types";
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils";
import {
  AttributeType,
  ProductStatus,
  type CreateOfferDTO,
  type CreateProductDTO,
} from "@mercurjs/types";
import {
  approveSellerWorkflow,
  createOffersWorkflow,
  createProductAttributesWorkflow,
  createProductsWorkflow,
  createSellerAccountWorkflow,
  createSellerShippingOptionsWorkflow,
  createSellerStockLocationsWorkflow,
} from "@mercurjs/core/workflows";
import {
  createApiKeysWorkflow,
  createCollectionsWorkflow,
  createLocationFulfillmentSetWorkflow,
  createProductCategoriesWorkflow,
  createRegionsWorkflow,
  createSalesChannelsWorkflow,
  createServiceZonesWorkflow,
  createShippingProfilesWorkflow,
  createTaxRegionsWorkflow,
  linkSalesChannelsToApiKeyWorkflow,
  linkSalesChannelsToStockLocationWorkflow,
  updateStoresWorkflow,
} from "@medusajs/medusa/core-flows";
import { setupPayOnDelivery } from "./setup-pay-on-delivery";
import { setupDemoDiscounts } from "./setup-demo-discounts";
import { setupVariantImages } from "./setup-variant-images";
import { setupDistanceDelivery } from "./setup-distance-delivery";
import { linkAllSellersToCategories } from "../lib/catalog/category-sellers";
import { setupProductTypes } from "./setup-product-types";

// ---------------------------------------------------------------------------
// Marketplace configuration
// ---------------------------------------------------------------------------

const MARKETPLACE_NAME = "Cepstrum3D"; // store name in the admin; the storefront name is in apps/storefront/src/config/site.ts
const CURRENCY = "usd";
const COUNTRIES = ["zw"]; // add "za", "zm", "bw", "mz" when expanding
const IMG = (file: string) =>
  `${process.env.FILE_BACKEND_URL || "http://localhost:9000/static"}/catalog/${file}.png`;

// 3DJake-style navigation. Array order = nav rank.
const CATEGORY_TREE: Record<string, string[]> = {
  "3D Printers & More": ["FDM Printers", "Resin Printers"],
  Filaments: ["PLA", "PETG", "ABS & ASA", "TPU (Flexible)", "Composites (CF)"],
  Resin: ["Standard Resin", "Water-Washable Resin", "ABS-Like Resin"],
  "Spare Parts & Upgrades": ["Nozzles", "Build Plates", "PTFE & Bowden", "Belts & Motion"],
  Accessories: ["Filament Dryers", "Filament Storage", "Tools", "Adhesion", "Post-Processing"],
};

// Brands become collections, giving each brand a landing page like 3djake.com/kingroon.
const BRANDS = [
  "Kingroon", "eSUN", "Elegoo", "Polymaker", "Sunlu", "Anycubic", "Creality", "Bambu Lab", "Generic",
];

const COLOR_VALUES = [
  "Black", "White", "Grey", "Red", "Blue", "Green", "Yellow", "Orange", "Purple",
  "Transparent", "Clear", "Natural",
];
const DIAMETER_VALUES = ["1.75 mm", "2.85 mm"];
const NET_WEIGHT_VALUES = ["250 g", "500 g", "750 g", "1000 g", "3000 g", "5000 g"];
const MATERIAL_VALUES = [
  "PLA", "PLA+", "PLA-CF", "PETG", "ABS", "ASA", "TPU", "Nylon",
  "Standard Resin", "Water-Washable Resin", "ABS-Like Resin", "Brass", "Hardened Steel",
  "PEI Spring Steel", "PTFE", "Rubber/Fibreglass",
];
const COMPATIBILITY_VALUES = [
  "Universal", "Bambu Lab A1/P1/X1", "Creality Ender-3 series", "Kingroon KP3S/KLP1",
  "Prusa MK3/MK4", "MSLA resin printers",
];
const TECHNOLOGY_VALUES = ["FDM", "MSLA (Resin)"];

// Mercur's Store API filters products through variant options, so every filterable
// attribute is a global variant axis. Descriptor attributes (Brand, Material,
// Compatibility, Technology) carry exactly ONE value per product, so they label the
// variants without multiplying them; only Colour / Diameter / Net weight fan out.
const ATTRIBUTE_DEFS = [
  { name: "Colour", handle: "color", values: COLOR_VALUES, axis: true },
  { name: "Diameter", handle: "diameter", values: DIAMETER_VALUES, axis: true },
  { name: "Net weight", handle: "net-weight", values: NET_WEIGHT_VALUES, axis: true },
  { name: "Material", handle: "material", values: MATERIAL_VALUES, axis: true },
  { name: "Brand", handle: "brand", values: BRANDS, axis: true },
  { name: "Compatibility system", handle: "compatibility", values: COMPATIBILITY_VALUES, axis: true },
  { name: "Printer technology", handle: "printer-technology", values: TECHNOLOGY_VALUES, axis: true },
];

// ---------------------------------------------------------------------------
// Vendors. EzoD Tech is the anchor vendor; the other two are fictional demo sellers.
// Emails use the reserved .test domain so nothing is ever delivered.
// ---------------------------------------------------------------------------

const SELLER_PASSWORD = "supersecret"; // dev only — change before any shared deployment
const SELLERS = [
  {
    name: "EzoD Tech", email: "ezod@layerline.test", first_name: "EzoD", last_name: "Tech",
    city: "Harare", address_1: "116 Nelson Mandela Avenue",
    description: "3D printing supplies, printers and product design, Harare. Official commercial partner of Cepstrum3D.",
    carriesAll: true,
  },
  {
    name: "Bulawayo Maker Supply (demo)", email: "bulawayo@layerline.test", first_name: "Demo", last_name: "Bulawayo",
    city: "Bulawayo", address_1: "1 Demo Street",
    description: "Demo vendor — filament and spare parts for Matabeleland makers.",
    carriesAll: false,
  },
  {
    name: "Mutare PrintWorks (demo)", email: "mutare@layerline.test", first_name: "Demo", last_name: "Mutare",
    city: "Mutare", address_1: "1 Demo Road",
    description: "Demo vendor — resin printing specialists in the Eastern Highlands.",
    carriesAll: false,
  },
];

// ---------------------------------------------------------------------------
// Catalogue. Each product line is one master product; colours are variants,
// matching how a 3DJake product line is browsed by colour.
// ---------------------------------------------------------------------------

type Item = {
  title: string;
  brand: string;
  category: string; // sub-category name
  price: number; // USD, demo
  bullets: [string, string, string]; // 3DJake-style card bullets
  description: string;
  material?: string;
  colors?: string[];
  diameters?: string[];
  weight?: string;
  compatibility?: string; // one primary system per product (see note above)
  technology?: string;
  image: (color?: string) => string;
  shipWeightG: number;
};

const filament = (color?: string) => IMG(`filament-${(color ?? "natural").toLowerCase()}`);
const resin = (color?: string) => IMG(`resin-${(color ?? "grey").toLowerCase()}`);

const CATALOG: Item[] = [
  // Filaments
  { title: "Kingroon PLA Basic, 1.75 mm / 1000 g", brand: "Kingroon", category: "PLA", price: 14, material: "PLA",
    colors: ["Black", "White", "Grey", "Red", "Blue", "Green", "Yellow"], diameters: ["1.75 mm"], weight: "1000 g",
    bullets: ["Reliable PLA filament", "Wide colour range", "Neatly wound"],
    description: "Easy-printing PLA for everyday parts and prototypes. Print at 190–220 °C, bed 0–60 °C.",
    image: filament, shipWeightG: 1300 },
  { title: "Kingroon PETG Basic, 1.75 mm / 1000 g", brand: "Kingroon", category: "PETG", price: 14, material: "PETG",
    colors: ["Black", "White", "Transparent", "Red", "Blue"], diameters: ["1.75 mm"], weight: "1000 g",
    bullets: ["High impact strength", "Low warping", "Neatly wound"],
    description: "Tough, slightly flexible PETG for functional parts. Print at 230–250 °C, bed 70–80 °C.",
    image: filament, shipWeightG: 1300 },
  { title: "Kingroon TPU 95A, 1.75 mm / 1000 g", brand: "Kingroon", category: "TPU (Flexible)", price: 22, material: "TPU",
    colors: ["Black", "Transparent", "Yellow", "Blue"], diameters: ["1.75 mm"], weight: "1000 g",
    bullets: ["Shore hardness 95A", "Flexible & soft", "High impact strength"],
    description: "Flexible TPU for gaskets, phone cases and grips. Print slowly at 210–230 °C.",
    image: filament, shipWeightG: 1300 },
  { title: "Kingroon ABS Basic, 1.75 mm / 1000 g", brand: "Kingroon", category: "ABS & ASA", price: 16, material: "ABS",
    colors: ["Black", "White"], diameters: ["1.75 mm"], weight: "1000 g",
    bullets: ["High impact strength", "High heat resistance", "Water-repellent"],
    description: "Heat-resistant ABS for enclosures and automotive parts. Enclosed printer recommended.",
    image: filament, shipWeightG: 1300 },
  { title: "eSUN PLA+, 1000 g", brand: "eSUN", category: "PLA", price: 17, material: "PLA+",
    colors: ["Black", "White", "Grey", "Orange", "Purple"], diameters: ["1.75 mm", "2.85 mm"], weight: "1000 g",
    bullets: ["Tougher than standard PLA", "Available in 1.75 & 2.85 mm", "Low odour"],
    description: "Modified PLA with better toughness and layer adhesion than standard PLA.",
    image: filament, shipWeightG: 1300 },
  { title: "eSUN PETG, 1.75 mm / 1000 g", brand: "eSUN", category: "PETG", price: 18, material: "PETG",
    colors: ["Black", "White", "Transparent"], diameters: ["1.75 mm"], weight: "1000 g",
    bullets: ["Food-contact grade resin base", "Glossy finish", "Chemical resistant"],
    description: "General-purpose PETG with a glossy finish and good chemical resistance.",
    image: filament, shipWeightG: 1300 },
  { title: "Elegoo PLA, 1.75 mm / 1000 g", brand: "Elegoo", category: "PLA", price: 15, material: "PLA",
    colors: ["Black", "White", "Grey", "Red"], diameters: ["1.75 mm"], weight: "1000 g",
    bullets: ["Consistent diameter", "Vacuum sealed", "Easy to print"],
    description: "Dependable PLA, vacuum sealed with desiccant.",
    image: filament, shipWeightG: 1300 },
  { title: "Elegoo PLA-CF Carbon Fibre, 1.75 mm / 1000 g", brand: "Elegoo", category: "Composites (CF)", price: 25, material: "PLA-CF",
    colors: ["Black", "Red"], diameters: ["1.75 mm"], weight: "1000 g",
    compatibility: "Bambu Lab A1/P1/X1",
    bullets: ["Matte technical surface", "High stiffness", "Hardened nozzle required"],
    description: "Carbon-fibre reinforced PLA for stiff, matte parts. Use a hardened steel nozzle.",
    image: filament, shipWeightG: 1300 },
  { title: "Polymaker PolyTerra PLA, 1.75 mm / 1000 g", brand: "Polymaker", category: "PLA", price: 20, material: "PLA",
    colors: ["Black", "White", "Green"], diameters: ["1.75 mm"], weight: "1000 g",
    bullets: ["Matte finish", "Cardboard spool", "Hides layer lines"],
    description: "Matte PLA on a recycled cardboard spool.",
    image: filament, shipWeightG: 1250 },
  { title: "Sunlu ASA, 1.75 mm / 1000 g", brand: "Sunlu", category: "ABS & ASA", price: 22, material: "ASA",
    colors: ["Black", "White", "Grey"], diameters: ["1.75 mm"], weight: "1000 g",
    bullets: ["UV & weather resistant", "Outdoor parts", "Low warping for ASA"],
    description: "UV-stable ASA for outdoor parts that sit in the Zimbabwean sun.",
    image: filament, shipWeightG: 1300 },

  // Resin
  { title: "Elegoo Standard Photopolymer Resin, 1000 g", brand: "Elegoo", category: "Standard Resin", price: 28, material: "Standard Resin",
    colors: ["Grey", "Black", "Clear", "White"], weight: "1000 g", compatibility: "MSLA resin printers",
    bullets: ["405 nm LCD/MSLA", "Fine detail", "Low shrinkage"],
    description: "Standard 405 nm resin for miniatures and detailed models.",
    image: resin, shipWeightG: 1200 },
  { title: "Anycubic Water-Wash Resin+, 1000 g", brand: "Anycubic", category: "Water-Washable Resin", price: 32, material: "Water-Washable Resin",
    colors: ["Grey", "White", "Clear"], weight: "1000 g", compatibility: "MSLA resin printers",
    bullets: ["Clean with water", "No IPA needed", "Low odour"],
    description: "Resin you can wash with tap water instead of isopropyl alcohol.",
    image: resin, shipWeightG: 1200 },
  { title: "Elegoo ABS-Like Resin 3.0, 1000 g", brand: "Elegoo", category: "ABS-Like Resin", price: 33, material: "ABS-Like Resin",
    colors: ["Grey", "Black"], weight: "1000 g", compatibility: "MSLA resin printers",
    bullets: ["Tougher prints", "Less brittle", "Functional parts"],
    description: "Tougher resin for functional parts that need to survive drops.",
    image: resin, shipWeightG: 1200 },

  // Printers
  { title: "Bambu Lab A1 Mini", brand: "Bambu Lab", category: "FDM Printers", price: 329, technology: "FDM",
    compatibility: "Bambu Lab A1/P1/X1",
    bullets: ["180 × 180 × 180 mm", "Fully automatic calibration", "Quiet operation"],
    description: "Compact, fast and beginner-friendly FDM printer with automatic calibration.",
    image: () => IMG("printer-fdm"), shipWeightG: 7000 },
  { title: "Creality Ender-3 V3 SE", brand: "Creality", category: "FDM Printers", price: 249, technology: "FDM",
    compatibility: "Creality Ender-3 series",
    bullets: ["220 × 220 × 250 mm", "Auto bed levelling", "Direct drive"],
    description: "Affordable entry printer with auto levelling and a direct-drive extruder.",
    image: () => IMG("printer-fdm"), shipWeightG: 8500 },
  { title: "Kingroon KP3S Pro S1", brand: "Kingroon", category: "FDM Printers", price: 229, technology: "FDM",
    compatibility: "Kingroon KP3S/KLP1",
    bullets: ["200 × 200 × 200 mm", "Klipper-ready", "Linear rails"],
    description: "Compact printer with linear rails, ready for Klipper firmware.",
    image: () => IMG("printer-fdm"), shipWeightG: 8000 },
  { title: "Elegoo Mars 5", brand: "Elegoo", category: "Resin Printers", price: 219, technology: "MSLA (Resin)",
    compatibility: "MSLA resin printers",
    bullets: ["4K mono LCD", "Auto levelling", "Resin heating"],
    description: "Entry resin printer for miniatures, jewellery and dental models.",
    image: () => IMG("printer-resin"), shipWeightG: 7500 },
  { title: "Anycubic Photon Mono 4", brand: "Anycubic", category: "Resin Printers", price: 199, technology: "MSLA (Resin)",
    compatibility: "MSLA resin printers",
    bullets: ["10K LCD", "Laser-engraved plate", "Large build volume"],
    description: "High-resolution resin printer for fine detail.",
    image: () => IMG("printer-resin"), shipWeightG: 7000 },

  // Spare parts & upgrades
  { title: "MK8 Brass Nozzle Set, 0.2–1.0 mm (10 pcs)", brand: "Generic", category: "Nozzles", price: 8, material: "Brass",
    compatibility: "Universal",
    bullets: ["10 assorted sizes", "M6 thread", "For 1.75 mm filament"],
    description: "Assorted brass nozzles for MK8-style hotends.",
    image: () => IMG("part-brass"), shipWeightG: 100 },
  { title: "Hardened Steel Nozzle 0.4 mm for Bambu Lab", brand: "Generic", category: "Nozzles", price: 15, material: "Hardened Steel",
    compatibility: "Bambu Lab A1/P1/X1",
    bullets: ["For abrasive filaments", "CF / GF compatible", "Drop-in fit"],
    description: "Wear-resistant nozzle for carbon-fibre and glass-fibre filaments.",
    image: () => IMG("part-steel"), shipWeightG: 60 },
  { title: "PEI Spring Steel Build Plate 235 × 235 mm", brand: "Generic", category: "Build Plates", price: 18, material: "PEI Spring Steel",
    compatibility: "Creality Ender-3 series",
    bullets: ["Flex to release prints", "Magnetic base included", "Textured PEI"],
    description: "Flexible textured PEI sheet with magnetic base.",
    image: () => IMG("accessory-plate"), shipWeightG: 600 },
  { title: "PTFE Bowden Tube 2 mm ID, 1 m", brand: "Generic", category: "PTFE & Bowden", price: 5, material: "PTFE",
    compatibility: "Universal",
    bullets: ["Low friction", "1.75 mm filament", "Cut to length"],
    description: "Replacement PTFE tube for Bowden extruders.",
    image: () => IMG("accessory-misc"), shipWeightG: 80 },
  { title: "GT2 Timing Belt 6 mm, 5 m", brand: "Generic", category: "Belts & Motion", price: 7, material: "Rubber/Fibreglass",
    compatibility: "Universal",
    bullets: ["Fibreglass reinforced", "2 mm pitch", "5 m length"],
    description: "Replacement belt for most hobby printers.",
    image: () => IMG("accessory-misc"), shipWeightG: 150 },

  // Accessories
  { title: "Sunlu FilaDryer S2", brand: "Sunlu", category: "Filament Dryers", price: 55,
    compatibility: "Universal",
    bullets: ["Dries one spool", "Print while drying", "Up to 70 °C"],
    description: "Dry damp filament — essential in the rainy season.",
    image: () => IMG("accessory-dryer"), shipWeightG: 2000 },
  { title: "Vacuum Filament Storage Bags (10 pack)", brand: "Generic", category: "Filament Storage", price: 12,
    compatibility: "Universal",
    bullets: ["Keeps filament dry", "Hand pump included", "Reusable"],
    description: "Reusable vacuum bags with humidity indicators.",
    image: () => IMG("accessory-misc"), shipWeightG: 500 },
  { title: "3D Printing Tool Kit (25 pcs)", brand: "Generic", category: "Tools", price: 19,
    compatibility: "Universal",
    bullets: ["Scraper & deburring tool", "Tweezers & cutters", "Storage pouch"],
    description: "Everything for removing supports and finishing prints.",
    image: () => IMG("accessory-tools"), shipWeightG: 800 },
  { title: "Bed Adhesion Glue Stick (3 pack)", brand: "Generic", category: "Adhesion", price: 6,
    compatibility: "Universal",
    bullets: ["Stops warping", "Washes off with water", "PLA / PETG / ABS"],
    description: "Glue sticks for reliable first layers.",
    image: () => IMG("accessory-misc"), shipWeightG: 150 },
  { title: "Elegoo Mercury Plus 2-in-1 Wash & Cure", brand: "Elegoo", category: "Post-Processing", price: 99,
    compatibility: "MSLA resin printers",
    bullets: ["Wash and cure in one", "Rotating turntable", "Timer control"],
    description: "Wash and UV-cure station for resin prints.",
    image: () => IMG("accessory-dryer"), shipWeightG: 4000 },
];

// ---------------------------------------------------------------------------

export default async function seedMarketplace({ container }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER);
  const link = container.resolve(ContainerRegistrationKeys.LINK);
  const query = container.resolve(ContainerRegistrationKeys.QUERY);
  const salesChannelService = container.resolve(Modules.SALES_CHANNEL);
  const storeService = container.resolve(Modules.STORE);
  const regionService = container.resolve(Modules.REGION);
  const taxService = container.resolve(Modules.TAX);
  const productService = container.resolve(Modules.PRODUCT);
  const authService = container.resolve(Modules.AUTH);

  // --- Store, sales channel, currency -------------------------------------
  logger.info("Seeding store…");
  const [store] = await storeService.listStores();
  let [salesChannel] = await salesChannelService.listSalesChannels({ name: "Default Sales Channel" });
  if (!salesChannel) {
    const { result } = await createSalesChannelsWorkflow(container).run({
      input: { salesChannelsData: [{ name: "Default Sales Channel" }] },
    });
    salesChannel = result[0];
  }
  await updateStoresWorkflow(container).run({
    input: {
      selector: { id: store.id },
      update: {
        name: MARKETPLACE_NAME,
        default_sales_channel_id: salesChannel.id,
        supported_currencies: [{ currency_code: CURRENCY, is_default: true }],
      },
    },
  });

  // --- Region & tax ---------------------------------------------------------
  logger.info("Seeding Zimbabwe region…");
  const regions = await regionService.listRegions({}, { relations: ["countries"] });
  let region = regions.find((r) => r.countries?.some((c) => COUNTRIES.includes(c.iso_2)));
  if (!region) {
    const { result } = await createRegionsWorkflow(container).run({
      input: {
        regions: [{
          name: "Zimbabwe",
          currency_code: CURRENCY,
          countries: COUNTRIES,
          // Manual/test payments until the Paynow provider is added.
          payment_providers: ["pp_system_default"],
        }],
      },
    });
    region = result[0];
  }
  const taxRegions = await taxService.listTaxRegions();
  const missingTax = COUNTRIES.filter((c) => !taxRegions.some((t) => t.country_code === c));
  if (missingTax.length) {
    await createTaxRegionsWorkflow(container).run({
      input: missingTax.map((country_code) => ({ country_code, provider_id: "tp_system" })),
    });
  }

  // --- Publishable key -------------------------------------------------------
  const { data: keys } = await query.graph({ entity: "api_key", fields: ["id", "token"], filters: { type: "publishable" } });
  let apiKey = keys[0];
  if (!apiKey) {
    const { result } = await createApiKeysWorkflow(container).run({
      input: { api_keys: [{ title: "Storefront", type: "publishable", created_by: "" }] },
    });
    apiKey = result[0] as never;
  }
  try {
    await linkSalesChannelsToApiKeyWorkflow(container).run({ input: { id: apiKey.id, add: [salesChannel.id] } });
  } catch (e) {
    if (!(e instanceof Error && e.message.includes("already"))) throw e;
  }

  // --- Categories ------------------------------------------------------------
  logger.info("Seeding 3DJake-style categories…");
  // Clean URL handles: "3D Printers & More" → "3d-printers-more", "TPU (Flexible)" → "tpu-flexible"
  const catHandle = (name: string) => name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
  const parents = Object.keys(CATEGORY_TREE);
  const children = Object.values(CATEGORY_TREE).flat();
  const existingCats = await productService.listProductCategories({ name: [...parents, ...children] });
  const catByName = new Map(existingCats.map((c) => [c.name, c]));
  const newParents = parents.filter((n) => !catByName.has(n));
  if (newParents.length) {
    const { result } = await createProductCategoriesWorkflow(container).run({
      input: { product_categories: newParents.map((name) => ({ name, handle: catHandle(name), is_active: true, rank: parents.indexOf(name) })) },
    });
    result.forEach((c) => catByName.set(c.name, c));
  }
  const childInputs = parents.flatMap((parent) =>
    CATEGORY_TREE[parent]
      .map((name, rank) => ({ name, handle: catHandle(name), rank, is_active: true, parent_category_id: catByName.get(parent)!.id }))
      .filter((c) => !catByName.has(c.name))
  );
  if (childInputs.length) {
    const { result } = await createProductCategoriesWorkflow(container).run({ input: { product_categories: childInputs } });
    result.forEach((c) => catByName.set(c.name, c));
  }

  // --- Brand collections -----------------------------------------------------
  logger.info("Seeding brand collections…");
  const brandHandle = (b: string) => b.toLowerCase().replace(/[^a-z0-9]+/g, "-");
  const existingCollections = await productService.listProductCollections({ handle: BRANDS.map(brandHandle) });
  const collectionByBrand = new Map(existingCollections.map((c) => [c.title, c]));
  const newBrands = BRANDS.filter((b) => b !== "Generic" && !collectionByBrand.has(b));
  if (newBrands.length) {
    const { result } = await createCollectionsWorkflow(container).run({
      input: { collections: newBrands.map((title) => ({ title, handle: brandHandle(title) })) },
    });
    result.forEach((c) => collectionByBrand.set(c.title, c));
  }

  // --- Attributes ------------------------------------------------------------
  logger.info("Seeding product attributes (filters)…");
  type Attr = { id: string; handle: string; values: { id: string; name: string }[] };
  const loadAttrs = async () => {
    const { data } = await query.graph({
      entity: "product_attribute",
      fields: ["id", "handle", "values.id", "values.name"],
      filters: { handle: ATTRIBUTE_DEFS.map((a) => a.handle), product_id: null },
    });
    return new Map((data as Attr[]).map((a) => [a.handle, a]));
  };
  let attrs = await loadAttrs();
  const missingAttrs = ATTRIBUTE_DEFS.filter((a) => !attrs.has(a.handle));
  if (missingAttrs.length) {
    await createProductAttributesWorkflow(container).run({
      input: {
        attributes: missingAttrs.map((a) => ({
          name: a.name,
          handle: a.handle,
          type: AttributeType.MULTI_SELECT,
          is_variant_axis: a.axis,
          is_filterable: true,
          rank: ATTRIBUTE_DEFS.indexOf(a),
          // Explicit handles so "PLA" and "PLA+" don't collide on the same slug.
          values: a.values.map((name, rank) => ({
            name,
            rank,
            handle: name.toLowerCase().replace(/\+/g, "-plus").replace(/[^a-z0-9-]+/g, "-").replace(/(^-|-$)/g, ""),
          })),
        })),
      },
    });
    attrs = await loadAttrs();
  }
  const attrEntry = (handle: string, names: string[]) => {
    const attr = attrs.get(handle)!;
    const ids = names.map((n) => attr.values.find((v) => v.name === n)?.id).filter((x): x is string => !!x);
    if (ids.length !== names.length) throw new Error(`Unknown value in ${handle}: ${names.join(", ")}`);
    return { id: attr.id, value_ids: ids };
  };

  // --- Sellers -----------------------------------------------------------------
  const { data: existing } = await query.graph({ entity: "seller", fields: ["id"], filters: { email: SELLERS[0].email } });
  if (existing[0]) {
    logger.info("Sellers already exist — skipping sellers, products and offers.");
    return;
  }

  let shippingProfileId: string;
  const { data: profiles } = await query.graph({ entity: "shipping_profile", fields: ["id"], filters: { name: "Marketplace Shipping" } });
  if (profiles[0]) {
    shippingProfileId = profiles[0].id as string;
  } else {
    const { result } = await createShippingProfilesWorkflow(container).run({
      input: { data: [{ name: "Marketplace Shipping", type: "default" }] },
    });
    shippingProfileId = result[0].id;
  }

  type Seller = { id: string; memberId: string; locationId: string; carriesAll: boolean };
  const sellers: Seller[] = [];

  for (const [i, cfg] of SELLERS.entries()) {
    logger.info(`Seeding vendor "${cfg.name}"…`);
    const reg = await authService.register("emailpass", { body: { email: cfg.email, password: SELLER_PASSWORD } });
    const authIdentityId = reg.success && reg.authIdentity
      ? reg.authIdentity.id
      : (await authService.listProviderIdentities({ entity_id: cfg.email, provider: "emailpass" }))[0].auth_identity_id!;

    const { result: seller } = await createSellerAccountWorkflow(container).run({
      input: {
        auth_identity_id: authIdentityId,
        member_email: cfg.email,
        first_name: cfg.first_name,
        last_name: cfg.last_name,
        seller: {
          name: cfg.name,
          email: cfg.email,
          currency_code: CURRENCY,
          description: cfg.description,
          logo: `https://api.dicebear.com/9.x/initials/svg?seed=${encodeURIComponent(cfg.name)}`,
        },
      },
    });
    await approveSellerWorkflow(container).run({ input: { seller_id: seller.id } });

    const { data: members } = await query.graph({ entity: "member", fields: ["id"], filters: { email: cfg.email } });

    const { result: locations } = await createSellerStockLocationsWorkflow(container).run({
      input: {
        seller_id: seller.id,
        locations: [{ name: `${cfg.name} — ${cfg.city}`, address: { city: cfg.city, country_code: "ZW", address_1: cfg.address_1 } }],
      },
    });
    const location = locations[0];
    await link.create({
      [Modules.STOCK_LOCATION]: { stock_location_id: location.id },
      [Modules.FULFILLMENT]: { fulfillment_provider_id: "manual_manual" },
    });
    await linkSalesChannelsToStockLocationWorkflow(container).run({ input: { id: location.id, add: [salesChannel.id] } });
    if (i === 0) {
      await updateStoresWorkflow(container).run({ input: { selector: { id: store.id }, update: { default_location_id: location.id } } });
    }

    await createLocationFulfillmentSetWorkflow(container).run({
      input: { location_id: location.id, fulfillment_set_data: { name: `${cfg.name} delivery`, type: "shipping" } },
    });
    const { data: [withSet] } = await query.graph({
      entity: "stock_location", fields: ["fulfillment_sets.id"], filters: { id: location.id },
    });
    const { result: zones } = await createServiceZonesWorkflow(container).run({
      input: {
        data: [{
          fulfillment_set_id: withSet.fulfillment_sets![0]!.id,
          name: `${cfg.name} — Zimbabwe`,
          geo_zones: COUNTRIES.map((country_code) => ({ country_code, type: "country" as const })),
        }],
      },
    });

    const rules = [
      { attribute: "enabled_in_store", value: "true", operator: "eq" as const },
      { attribute: "is_return", value: "false", operator: "eq" as const },
    ];
    const option = (name: string, code: string, description: string, amount: number) => ({
      name,
      price_type: "flat" as const,
      provider_id: "manual_manual",
      service_zone_id: zones[0].id,
      shipping_profile_id: shippingProfileId,
      type: { label: name, description, code },
      prices: [{ currency_code: CURRENCY, amount }, { region_id: region!.id, amount }],
      rules,
    });
    await createSellerShippingOptionsWorkflow(container).run({
      input: {
        seller_id: seller.id,
        shipping_options: [
          option("Collect from vendor", "pickup", `Collect in ${cfg.city}.`, 0),
          // "Delivery" (priced per km) is added by setupDistanceDelivery below.
        ],
      },
    });

    sellers.push({ id: seller.id, memberId: members[0].id, locationId: location.id, carriesAll: cfg.carriesAll });
  }

  // --- Products ----------------------------------------------------------------
  logger.info("Seeding 3D printing catalogue…");
  const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

  const products: CreateProductDTO[] = CATALOG.map((item) => {
    const handle = slug(item.title.split(",")[0]);
    const sku = handle.toUpperCase().replace(/-/g, "").slice(0, 16);
    const colors = item.colors ?? [];
    const diameters = item.diameters ?? [];
    const weights = item.weight ? [item.weight] : [];

    const attributes = [
      attrEntry("brand", [item.brand]),
      ...(item.material ? [attrEntry("material", [item.material])] : []),
      ...(item.compatibility ? [attrEntry("compatibility", [item.compatibility])] : []),
      ...(item.technology ? [attrEntry("printer-technology", [item.technology])] : []),
      ...(colors.length ? [attrEntry("color", colors)] : []),
      ...(diameters.length ? [attrEntry("diameter", diameters)] : []),
      ...(weights.length ? [attrEntry("net-weight", weights)] : []),
    ];

    // Cartesian product of the variant axes this product uses.
    type Combo = Record<string, string>;
    let combos: Combo[] = [{}];
    for (const [key, values] of [["Colour", colors], ["Diameter", diameters], ["Net weight", weights]] as const) {
      if (values.length) combos = combos.flatMap((c) => values.map((v) => ({ ...c, [key]: v })));
    }
    const descriptors: Record<string, string> = {
      Brand: item.brand,
      ...(item.material ? { Material: item.material } : {}),
      ...(item.compatibility ? { "Compatibility system": item.compatibility } : {}),
      ...(item.technology ? { "Printer technology": item.technology } : {}),
    };
    const variants = combos.map((axes) => {
      const label = Object.values(axes).join(" / ") || "Standard";
      const options = { ...descriptors, ...axes };
      return {
        title: label,
        sku: `${sku}-${slug(label).toUpperCase()}`,
        options,
        weight: item.shipWeightG,
      };
    });

    const images = (colors.length ? colors : [undefined]).map((c) => ({ url: item.image(c) }));
    // Use a colourful variant as the card thumbnail so listings aren't a wall of black spools.
    const thumbColor = colors.find((c) => !["Black", "White", "Grey"].includes(c)) ?? colors[0];
    const collection = collectionByBrand.get(item.brand);

    return {
      title: item.title,
      subtitle: item.bullets.join(" · "),
      description: `${item.description}\n\n• ${item.bullets.join("\n• ")}`,
      handle,
      status: ProductStatus.PUBLISHED,
      category_ids: [catByName.get(item.category)!.id],
      ...(collection ? { collection_id: collection.id } : {}),
      weight: item.shipWeightG,
      thumbnail: item.image(thumbColor),
      images,
      attributes,
      variants,
      metadata: { brand: item.brand, highlights: item.bullets },
    } as CreateProductDTO;
  });

  await createProductsWorkflow(container).run({ input: { created_by: sellers[0].memberId, products } });

  // --- Offers: each vendor lists against the master products -------------------
  logger.info("Creating vendor offers…");
  let seed = 0x2f6b9e1d;
  const rand = () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), seed | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  const priceByHandle = new Map(products.map((p, i) => [p.handle, CATALOG[i].price]));
  const { data: seeded } = await query.graph({
    entity: "product",
    fields: ["handle", "variants.id", "variants.sku"],
    filters: { handle: products.map((p) => p.handle!) },
  });

  const offers: CreateOfferDTO[] = [];
  for (const product of seeded) {
    const base = priceByHandle.get(product.handle) ?? 10;
    for (const seller of sellers) {
      if (!seller.carriesAll && rand() < 0.5) continue; // demo vendors carry ~half the range
      const markup = seller.carriesAll ? 1 : 0.92 + rand() * 0.2; // ±10% competition
      for (const variant of product.variants as { id: string; sku: string }[]) {
        const sku = `${seller.id.slice(-4).toUpperCase()}-${variant.sku}`;
        offers.push({
          seller_id: seller.id,
          created_by: seller.memberId,
          sku,
          variant_id: variant.id,
          shipping_profile_id: shippingProfileId,
          inventory_items: [{
            sku,
            stock_levels: [{ location_id: seller.locationId, stocked_quantity: 5 + Math.floor(rand() * 40) }],
          }],
          prices: [{ amount: Math.round(base * markup * 100) / 100, currency_code: CURRENCY }],
        });
      }
    }
  }
  await createOffersWorkflow(container).run({ input: { offers } });

  logger.info(`Seeded ${products.length} products and ${offers.length} offers across ${sellers.length} vendors.`);

  // Pay on delivery: attribute, provider on the region, default product flags.
  await setupPayOnDelivery(container);

  // A picture per colour variant (colour picker + gallery).
  await setupVariantImages(container);

  // Demo "Black November" sale so the storefront shows discounts.
  await setupDemoDiscounts(container);

  // Delivery priced per km from vendor to customer + demo free-delivery rules.
  await setupDistanceDelivery(container);

  // Every store may sell in every category (vendor promotion conditions list them).
  await linkAllSellersToCategories(container);

  // Product types (Filament, Resin, …) for promotion conditions.
  await setupProductTypes(container);
  logger.info(`Publishable key for the storefront: ${(apiKey as { token?: string }).token ?? apiKey.id}`);
}
