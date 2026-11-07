'use client';

import { useEffect, useState } from 'react';

import { TruckIcon } from '@/components/atoms';
import { getDeliverySettings, type DeliverySettings } from '@/lib/data/delivery';
import { convertToLocale } from '@/lib/helpers/money';

/**
 * Cart: "Add $45.20 more for free delivery (orders from $300 in Harare)" with a
 * progress bar, or "Your order qualifies…" once the goods total reaches it.
 */
export const FreeDeliveryProgress = ({
  goodsTotal,
  currencyCode,
}: {
  goodsTotal: number;
  currencyCode: string;
}) => {
  const [settings, setSettings] = useState<DeliverySettings | null>(null);

  useEffect(() => {
    getDeliverySettings().then(setSettings);
  }, []);

  if (!settings || settings.free_min_order <= 0) return null;

  const money = (amount: number) => convertToLocale({ amount, currency_code: currencyCode });
  const remaining = Math.max(0, settings.free_min_order - goodsTotal);
  const scope = `orders from ${money(settings.free_min_order)}${
    settings.free_order_cities.length ? ` in ${settings.free_order_cities.join(', ')}` : ''
  }`;
  const pct = Math.min(100, Math.round((goodsTotal / settings.free_min_order) * 100));

  return (
    <div className="mb-4 rounded-sm bg-[#f0fdf4] px-3 py-2 text-sm text-[#15803d]" data-testid="free-delivery-progress">
      <p className="flex items-center gap-2 font-medium">
        <TruckIcon />
        {remaining > 0
          ? `Add ${money(remaining)} more for free delivery (${scope}).`
          : `Your order qualifies for free delivery (${scope}).`}
      </p>
      <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-white">
        <div className="h-full rounded-full bg-[#16a34a] transition-all" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
};
