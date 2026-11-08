import { defineMiddlewares } from "@medusajs/medusa";
import { authenticate } from "@medusajs/framework/http";
import type { MedusaNextFunction, MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { ContainerRegistrationKeys, MedusaError } from "@medusajs/framework/utils";
import {
  getCartPodEligibility,
  isPodProvider,
  podIneligibleMessage,
} from "../lib/pay-on-delivery";
import { fillSaleOfferIds } from "./store/products/fill-sale-offer-ids";
import {
  adminOrderGroupsFulfillmentFilter,
  vendorOrdersFulfillmentFilter,
} from "../lib/orders/fulfillment-filter";
import { vendorFulfillmentNotifyFlag } from "../lib/orders/notify-flag-middleware";
import { inventoryExtraFilters } from "../lib/inventory/inventory-filters";
import { guardSaleLimits } from "../lib/sales/sale-limit-guard";
import { revalidateAfterPriceListChange } from "../lib/storefront-cache";
import { expandCategoryRulesInBody } from "../lib/promotions/category-descendants";
import { guardRecipientCodes, guardRecipientCodesAtCheckout } from "../lib/promotions/recipient";
import { refreshDeliveryOverrides } from "../lib/delivery/overrides";
import { mergeIntoPendingProductChange } from "../lib/listings/merge-product-changes";
import {
  emailAdminsOnNewProduct,
  emailVendorOnProductDecision,
  guardBlockedOfferInCart,
  guardBlockedOffersAtCheckout,
  hideBlockedOffer,
  hideBlockedOffers,
} from "../lib/listings/middlewares";

/**
 * Pay on delivery guard #1 — choosing the payment method.
 * Rejects creating a POD payment session for a cart that has any ineligible item.
 */
async function guardPodPaymentSession(req: MedusaRequest, _res: MedusaResponse, next: MedusaNextFunction) {
  const providerId = (req.body as { provider_id?: string } | undefined)?.provider_id;
  if (!isPodProvider(providerId)) {
    return next();
  }

  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY);
  const { data } = await query.graph({
    entity: "payment_collection",
    fields: ["id", "cart.id"],
    filters: { id: req.params.id },
  });
  const cartId = (data[0] as { cart?: { id: string } } | undefined)?.cart?.id;
  if (!cartId) {
    return next(new MedusaError(MedusaError.Types.NOT_FOUND, "Payment collection has no cart."));
  }

  const eligibility = await getCartPodEligibility(req.scope, cartId);
  if (!eligibility.eligible) {
    return next(new MedusaError(MedusaError.Types.NOT_ALLOWED, podIneligibleMessage(eligibility)));
  }
  return next();
}

/**
 * Pay on delivery guard #2 — placing the order.
 * Catches carts that became ineligible after POD was chosen (e.g. an ineligible
 * item was added afterwards), so the rule can't be bypassed.
 */
async function guardPodCartCompletion(req: MedusaRequest, _res: MedusaResponse, next: MedusaNextFunction) {
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY);
  const { data } = await query.graph({
    entity: "cart",
    fields: ["id", "payment_collection.payment_sessions.provider_id"],
    filters: { id: req.params.id },
  });
  const sessions =
    (data[0] as { payment_collection?: { payment_sessions?: { provider_id: string }[] } } | undefined)
      ?.payment_collection?.payment_sessions ?? [];

  if (!sessions.some((s) => isPodProvider(s?.provider_id))) {
    return next();
  }

  const eligibility = await getCartPodEligibility(req.scope, req.params.id);
  if (!eligibility.eligible) {
    return next(
      new MedusaError(
        MedusaError.Types.NOT_ALLOWED,
        `${podIneligibleMessage(eligibility)} Please choose another payment method.`
      )
    );
  }
  return next();
}

export default defineMiddlewares({
  routes: [
    // ---- Product reviews (src/lib/reviews)
    {
      method: ["GET"],
      matcher: "/store/product-reviews/:product_id",
      middlewares: [authenticate("customer", ["session", "bearer"], { allowUnauthenticated: true })],
    },
    {
      method: ["POST"],
      matcher: "/store/product-reviews/:product_id",
      middlewares: [authenticate("customer", ["session", "bearer"])],
    },
    // ---- Vendor edits pile into one approval request per product (src/lib/listings/merge-product-changes.ts)
    ...[
      "/vendor/products/:id",
      "/vendor/products/:id/variants",
      "/vendor/products/:id/variants/:variant_id",
      "/vendor/products/:id/attributes/batch",
    ].map((matcher) => ({
      method: ["POST", "DELETE"] as ("POST" | "DELETE")[],
      matcher,
      middlewares: [mergeIntoPendingProductChange],
    })),
    // ---- Listing approval / suspension (src/lib/listings)
    { method: ["GET"], matcher: "/store/offers", middlewares: [hideBlockedOffers] },
    { method: ["GET"], matcher: "/store/offers/:id", middlewares: [hideBlockedOffer] },
    { method: ["POST"], matcher: "/store/carts/:id/line-items", middlewares: [guardBlockedOfferInCart] },
    { method: ["POST"], matcher: "/admin/products/:id/confirm", middlewares: [emailVendorOnProductDecision("approved")] },
    { method: ["POST"], matcher: "/admin/products/:id/reject", middlewares: [emailVendorOnProductDecision("rejected")] },
    {
      method: ["POST"],
      matcher: "/admin/products/:id/request-changes",
      middlewares: [emailVendorOnProductDecision("changes_requested")],
    },
    { method: ["POST"], matcher: "/vendor/products", middlewares: [emailAdminsOnNewProduct] },
    {
      // Free-delivery amount/towns changed in the admin panel (cached 30s).
      matcher: "/store/*",
      middlewares: [refreshDeliveryOverrides],
    },
    {
      // Discounted (sale) variants need their offer_id for quick add-to-cart.
      method: ["GET"],
      matcher: "/store/products*",
      middlewares: [fillSaleOfferIds],
    },
    {
      method: ["POST"],
      matcher: "/store/payment-collections/:id/payment-sessions",
      middlewares: [guardPodPaymentSession],
    },
    {
      method: ["POST"],
      matcher: "/store/carts/:id/complete",
      middlewares: [guardPodCartCompletion, guardSaleLimits, guardRecipientCodesAtCheckout, guardBlockedOffersAtCheckout],
    },
    {
      // "Fulfillment" filter on the admin and vendor order lists. Wildcard matchers
      // so these run before Mercur's own query validation (Medusa orders wildcard
      // matchers first); they do nothing unless ?fulfillment_status= is present.
      method: ["GET"],
      matcher: "/admin/order-groups*",
      middlewares: [adminOrderGroupsFulfillmentFilter],
    },
    {
      method: ["GET"],
      matcher: "/vendor/orders*",
      middlewares: [vendorOrdersFulfillmentFilter],
    },
    {
      // Vendor "Notify customer" switch on Create fulfilment → additional_data.
      method: ["POST"],
      matcher: "/vendor/orders/*",
      middlewares: [vendorFulfillmentNotifyFlag],
    },
    {
      // Title / reservations / stock-level filters on Manage inventory.
      method: ["GET"],
      matcher: "/admin/inventory-items*",
      middlewares: [inventoryExtraFilters],
    },
    {
      method: ["GET"],
      matcher: "/vendor/inventory-items*",
      middlewares: [inventoryExtraFilters],
    },
    {
      // Edited discounts (price lists) show in the shop straight away.
      method: ["POST", "DELETE"],
      matcher: "/vendor/price-lists*",
      middlewares: [revalidateAfterPriceListChange],
    },
    {
      method: ["POST", "DELETE"],
      matcher: "/admin/price-lists*",
      middlewares: [revalidateAfterPriceListChange],
    },
    {
      // Customer-only promo codes: refuse them for anyone else.
      method: ["POST"],
      matcher: "/store/carts/:id",
      middlewares: [guardRecipientCodes],
    },
    {
      method: ["POST"],
      matcher: "/store/carts/:id/promotions",
      middlewares: [guardRecipientCodes],
    },
    {
      // Promotion "Product Category" conditions include sub-categories.
      // Wildcards so it runs before Mercur's/Medusa's body validation.
      method: ["POST"],
      matcher: "/admin/promotions*",
      middlewares: [expandCategoryRulesInBody],
    },
    {
      method: ["POST"],
      matcher: "/vendor/promotions*",
      middlewares: [expandCategoryRulesInBody],
    },
    {
      // Customer cancels their own order (until the vendor packs it).
      method: ["POST"],
      matcher: "/store/orders/:id/cancel",
      middlewares: [authenticate("customer", ["session", "bearer"])],
    },
    {
      // In-store messages for the signed-in customer.
      matcher: "/store/customers/me/notifications*",
      middlewares: [authenticate("customer", ["session", "bearer"])],
    },
  ],
});
