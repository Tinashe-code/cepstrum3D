import { ProductPageAccordion } from '@/components/molecules';
import { siteConfig } from '@/config/site';
import type { DeliverySettings } from '@/lib/data/delivery';
import { freeDeliveryLabel, getFreeDeliveryRule } from '@/lib/helpers/free-delivery';

/**
 * Delivery & returns for Zimbabwe: this product's free-delivery rule and the
 * store-wide free-delivery amount come from the backend (amount is editable in
 * the admin panel → Delivery); the returns text is in src/config/site.ts.
 */
export const ProductDetailsShipping = ({
  metadata,
  settings,
}: {
  metadata?: Record<string, unknown> | null;
  settings?: DeliverySettings | null;
}) => {
  const rule = getFreeDeliveryRule(metadata);

  return (
    <ProductPageAccordion heading="Delivery & Returns" defaultOpen>
      <div className="product-details" data-testid="product-delivery-returns">
        <ul>
          {rule && (
            <li>
              <strong>
                {freeDeliveryLabel(rule)}
                {rule.minQty ? '' : ' on qualifying orders'}.
              </strong>
            </li>
          )}
          {settings?.free_order_label && <li>{settings.free_order_label}.</li>}
          <li>Each vendor delivers their own items, so an order from two vendors has two deliveries.</li>
          <li>{siteConfig.returnsPolicy}</li>
        </ul>
      </div>
    </ProductPageAccordion>
  );
};
