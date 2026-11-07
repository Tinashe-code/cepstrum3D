import {
  calculateShippingOptionsPricesWorkflow,
  listShippingOptionsForCartWithPricingWorkflow,
} from "@medusajs/medusa/core-flows";
import { StepResponse } from "@medusajs/framework/workflows-sdk";
import { buildDeliveryContext, DELIVERY_CONTEXT_KEY } from "../../lib/delivery/context";

/**
 * Give the distance-delivery provider the cart's vendor split, product
 * free-delivery rules and goods total. Both workflows that price calculated
 * shipping options expose this hook: listing options with prices (also used
 * when a delivery method is added and when the cart is refreshed) and the
 * per-option "calculate" route.
 */
const handler = async ({ input }: { input: { cart_id?: string } }, { container }: { container: never }) => {
  if (!input?.cart_id) return new StepResponse({});
  const delivery = await buildDeliveryContext(container, input.cart_id);
  return new StepResponse({ [DELIVERY_CONTEXT_KEY]: delivery });
};

listShippingOptionsForCartWithPricingWorkflow.hooks.setCalculatedShippingPricingContext(handler as never);
calculateShippingOptionsPricesWorkflow.hooks.setCalculatedShippingPricingContext(handler as never);
