/**
 * Sets up pay on delivery. Safe to re-run.
 *
 *   1. Creates the global "Pay on delivery" toggle attribute (handle `pay-on-delivery`).
 *      Operators and vendors switch it on/off per product in the admin / vendor panels.
 *   2. Enables the pay-on-delivery payment provider on every region.
 *   3. Sets the flag on products that don't have it yet, using DEFAULT_RULE below
 *      (consumables and parts: yes; printers: no, as they're high value).
 *
 * Run on an existing database:  bunx medusa exec ./src/scripts/setup-pay-on-delivery.ts
 * The main seed calls it automatically.
 */
import { ExecArgs, MedusaContainer } from "@medusajs/framework/types";
import { ContainerRegistrationKeys } from "@medusajs/framework/utils";
import { AttributeType } from "@mercurjs/types";
import {
  addProductAttributesToProductWorkflow,
  createProductAttributesWorkflow,
} from "@mercurjs/core/workflows";
import { updateRegionsWorkflow } from "@medusajs/medusa/core-flows";
import { POD_ATTRIBUTE_HANDLE, POD_PROVIDER_ID } from "../lib/pay-on-delivery";

/** Category handles whose products are NOT pay-on-delivery by default. */
const POD_EXCLUDED_CATEGORY_HANDLES = ["fdm-printers", "resin-printers"];

const DEFAULT_RULE = (product: { categories?: { handle: string }[] | null }) =>
  !(product.categories ?? []).some((c) => POD_EXCLUDED_CATEGORY_HANDLES.includes(c.handle));

export async function setupPayOnDelivery(container: MedusaContainer) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER);
  const query = container.resolve(ContainerRegistrationKeys.QUERY);

  // 1. Attribute -------------------------------------------------------------
  const loadAttr = async () => {
    const { data } = await query.graph({
      entity: "product_attribute",
      fields: ["id", "values.id", "values.name"],
      filters: { handle: POD_ATTRIBUTE_HANDLE, product_id: null },
    });
    return data[0] as { id: string; values: { id: string; name: string }[] } | undefined;
  };
  let attr = await loadAttr();
  if (!attr) {
    await createProductAttributesWorkflow(container).run({
      input: {
        attributes: [
          {
            name: "Pay on delivery",
            handle: POD_ATTRIBUTE_HANDLE,
            description: "Customers can order this product and pay when it is delivered.",
            type: AttributeType.TOGGLE,
            is_variant_axis: false,
            is_filterable: false,
            rank: 100,
          },
        ],
      },
    });
    attr = await loadAttr();
    logger.info("Created 'Pay on delivery' attribute.");
  }
  if (!attr) {
    throw new Error("Could not create the 'Pay on delivery' attribute.");
  }

  // 2. Provider on regions -------------------------------------------------------
  const { data: regions } = await query.graph({
    entity: "region",
    fields: ["id", "name", "payment_providers.id"],
  });
  for (const region of regions as { id: string; name: string; payment_providers?: { id: string }[] }[]) {
    const current = (region.payment_providers ?? []).map((p) => p.id);
    if (!current.includes(POD_PROVIDER_ID)) {
      await updateRegionsWorkflow(container).run({
        input: { selector: { id: region.id }, update: { payment_providers: [...current, POD_PROVIDER_ID] } },
      });
      logger.info(`Enabled pay on delivery in region "${region.name}".`);
    }
  }

  // 3. Default flags on products that don't have one yet ---------------------------
  const { data: products } = await query.graph({
    entity: "product",
    fields: ["id", "title", "categories.handle", "product_attribute_values.attribute.handle"],
  });
  let yes = 0;
  let no = 0;
  for (const product of products as {
    id: string;
    categories?: { handle: string }[];
    product_attribute_values?: { attribute?: { handle?: string } }[];
  }[]) {
    const hasFlag = (product.product_attribute_values ?? []).some((v) => v?.attribute?.handle === POD_ATTRIBUTE_HANDLE);
    if (hasFlag) continue;
    const eligible = DEFAULT_RULE(product);
    await addProductAttributesToProductWorkflow(container).run({
      input: { product_id: product.id, add: [{ id: attr.id, value: eligible }] },
    });
    eligible ? yes++ : no++;
  }
  logger.info(`Pay on delivery flags set: ${yes} eligible, ${no} not eligible.`);
}

export default async function run({ container }: ExecArgs) {
  await setupPayOnDelivery(container);
}
