import { ProductPageAccordion } from '@/components/molecules';
import { siteConfig } from '@/config/site';
import type { DeliverySettings } from '@/lib/data/delivery';
import { freeDeliveryLabel, getFreeDeliveryRule } from '@/lib/helpers/free-delivery';

const usd = (n: number) => `$${Number.isInteger(n) ? n : n.toFixed(2)}`;

/**
 * Delivery & returns for Zimbabwe: this product's free-delivery rule, the
 * store-wide threshold and the per-km rate come from the backend; the returns
 * text is in src/config/site.ts.
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
              <strong>{freeDeliveryLabel(rule)}.</strong>
            </li>
          )}
          {settings?.free_order_label && <li>{settings.free_order_label}.</li>}
          <li>
            Otherwise delivery is priced by road distance from the vendor to you
            {settings
              ? `: ${usd(settings.base_fee)} + ${usd(settings.per_km)} per km (minimum ${usd(settings.min_fee)})`
              : ''}
            . You&apos;ll see the exact price at checkout after entering your address.
          </li>
          <li>Each vendor delivers their own items, so an order from two vendors has two deliveries.</li>
          <li>You can also collect from the vendor for free.</li>
          <li>{siteConfig.returnsPolicy}</li>
        </ul>
      </div>
    </ProductPageAccordion>
  );
};
