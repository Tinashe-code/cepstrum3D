import type { MedusaNextFunction, MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { ContainerRegistrationKeys, MedusaError } from "@medusajs/framework/utils";
import { emailAdmins, emailSellers, hiddenOfferIds, productSellerIds } from "./status";

/** GET /store/offers — leave out listings waiting for approval, rejected or suspended. */
export async function hideBlockedOffers(req: MedusaRequest, _res: MedusaResponse, next: MedusaNextFunction) {
  const hidden = await hiddenOfferIds(req.scope);
  if (hidden.length) {
    const f = ((req as any).filterableFields ??= {}) as Record<string, any>;
    if (f.id) {
      const ids = (Array.isArray(f.id) ? f.id : [f.id]).filter((id: string) => !hidden.includes(id));
      f.id = ids.length ? ids : ["__none__"];
    } else {
      f.id = { $nin: hidden };
    }
  }
  next();
}

/** GET /store/offers/:id */
export async function hideBlockedOffer(req: MedusaRequest, _res: MedusaResponse, next: MedusaNextFunction) {
  const [hidden] = await hiddenOfferIds(req.scope, [req.params.id]);
  if (hidden) return next(new MedusaError(MedusaError.Types.NOT_FOUND, "This listing isn't available."));
  next();
}

/** POST /store/carts/:id/line-items { offer_id } */
export async function guardBlockedOfferInCart(req: MedusaRequest, _res: MedusaResponse, next: MedusaNextFunction) {
  const offerId = (req.body as { offer_id?: string } | undefined)?.offer_id;
  if (offerId && (await hiddenOfferIds(req.scope, [offerId])).length) {
    return next(new MedusaError(MedusaError.Types.NOT_ALLOWED, "This item isn't available right now."));
  }
  next();
}

/** POST /store/carts/:id/complete — an item suspended after it went in the cart can't be bought. */
export async function guardBlockedOffersAtCheckout(req: MedusaRequest, _res: MedusaResponse, next: MedusaNextFunction) {
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY);
  const { data } = await query.graph({
    entity: "cart",
    fields: ["items.title", "items.product_title", "items.metadata", "items.product.status"],
    filters: { id: req.params.id },
  });
  const items = (((data[0] as any)?.items ?? []) as { product_title?: string; title?: string; metadata?: any; product?: { status?: string } }[]);
  const offerIds = items.map((i) => i.metadata?.offer_id).filter(Boolean) as string[];
  const hidden = new Set(offerIds.length ? await hiddenOfferIds(req.scope, offerIds) : []);
  const bad = items.filter((i) => hidden.has(i.metadata?.offer_id) || (i.product?.status && i.product.status !== "published"));
  if (bad.length) {
    return next(
      new MedusaError(
        MedusaError.Types.NOT_ALLOWED,
        `${bad.map((i) => i.product_title ?? i.title).join(", ")} ${bad.length > 1 ? "are" : "is"} no longer available. Please remove ${bad.length > 1 ? "them" : "it"} from your cart.`
      )
    );
  }
  next();
}

/**
 * After an admin approves / rejects / asks for changes on a product, email the
 * vendor. Runs when the response has been sent successfully.
 */
export function emailVendorOnProductDecision(kind: "approved" | "rejected" | "changes_requested") {
  return (req: MedusaRequest, res: MedusaResponse, next: MedusaNextFunction) => {
    res.on("finish", () => {
      if (res.statusCode >= 300) return;
      void (async () => {
        const query = req.scope.resolve(ContainerRegistrationKeys.QUERY);
        const { data } = await query.graph({ entity: "product", fields: ["id", "title"], filters: { id: req.params.id } });
        const p = data[0] as { id: string; title: string } | undefined;
        if (!p) return;
        const body = (req.body ?? {}) as { message?: string; reason?: string; external_note?: string };
        await emailSellers(req.scope, await productSellerIds(req.scope, p.id), kind, p.title, body.message ?? body.reason ?? body.external_note ?? null, {
          id: p.id,
          type: "product",
        });
      })().catch((e) => req.scope.resolve(ContainerRegistrationKeys.LOGGER).error(`Listing email failed: ${(e as Error).message}`));
    });
    next();
  };
}

/** POST /vendor/products — tell the marketplace team a new product is waiting. */
export function emailAdminsOnNewProduct(req: MedusaRequest, res: MedusaResponse, next: MedusaNextFunction) {
  res.on("finish", () => {
    if (res.statusCode >= 300) return;
    const title = (req.body as { title?: string } | undefined)?.title ?? "A product";
    void emailAdmins(req.scope, `New product waiting for approval: ${title}`, `A vendor submitted ${title}. Review it in Product requests.`, "/products").catch(
      () => undefined
    );
  });
  next();
}
