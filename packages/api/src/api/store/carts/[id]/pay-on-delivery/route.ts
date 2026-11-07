import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { MedusaError } from "@medusajs/framework/utils";
import { getCartPodEligibility, podIneligibleMessage } from "../../../../../lib/pay-on-delivery";

/**
 * GET /store/carts/:id/pay-on-delivery
 *
 * Tells the storefront whether the cart can use pay on delivery and, if not,
 * which items are blocking it.
 */
export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  try {
    const eligibility = await getCartPodEligibility(req.scope, req.params.id);
    res.json({
      pay_on_delivery: {
        ...eligibility,
        message: eligibility.eligible ? null : podIneligibleMessage(eligibility),
      },
    });
  } catch (e) {
    throw new MedusaError(MedusaError.Types.NOT_FOUND, (e as Error).message);
  }
};
