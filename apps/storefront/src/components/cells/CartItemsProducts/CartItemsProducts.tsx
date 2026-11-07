'use client';

import { useEffect, useState } from 'react';
import { HttpTypes } from '@medusajs/types';
import Image from 'next/image';
import { useParams } from 'next/navigation';

import { DeleteCartItemButton } from '@/components/molecules';
import LocalizedClientLink from '@/components/molecules/LocalizedLink/LocalizedLink';
import { UpdateCartItemButton } from '@/components/molecules/UpdateCartItemButton/UpdateCartItemButton';
import { filterValidCartItems } from '@/lib/helpers/filter-valid-cart-items';
import { convertToLocale } from '@/lib/helpers/money';
import { getOfferStockByIds } from '@/lib/data/offers';

const offerIdOf = (item: HttpTypes.StoreCartLineItem) =>
  ((item.metadata as { offer_id?: string } | null)?.offer_id ??
    (item as { offer?: { id?: string } }).offer?.id ??
    '') as string;

/** Live stock per offer in the cart, so the quantity box can warn and cap. */
const useCartStock = (items: HttpTypes.StoreCartLineItem[], enabled: boolean) => {
  const { locale } = useParams<{ locale: string }>();
  const [stock, setStock] = useState<Record<string, number>>({});
  const key = items.map(offerIdOf).filter(Boolean).sort().join(',');

  useEffect(() => {
    if (!enabled || !key) return;
    let cancelled = false;
    getOfferStockByIds(key.split(','), locale).then(s => {
      if (!cancelled) setStock(s);
    });
    return () => {
      cancelled = true;
    };
  }, [enabled, key, locale]);

  return stock;
};

export const CartItemsProducts = ({
  products,
  currency_code,
  delete_item = true,
  change_quantity = true
}: {
  products: HttpTypes.StoreCartLineItem[];
  currency_code: string;
  delete_item?: boolean;
  change_quantity?: boolean;
}) => {
  const validProducts = filterValidCartItems(products);
  const stock = useCartStock(validProducts, change_quantity);

  return (
    <div>
      {validProducts.map((product, index) => {
        const options = Object.entries(product.variant_option_values ?? {});
        // Items added optimistically (before the server responds) have no id yet.
        const itemKey =
          product.id ??
          `${product.variant_id ?? 'item'}-${(product.metadata as { offer_id?: string } | null)?.offer_id ?? ''}-${index}`;

        const total = convertToLocale({
          amount: product.subtotal ?? 0,
          currency_code
        });

        return (
          <div
            key={itemKey}
            data-testid={`cart-item-${itemKey}`}
            className="flex gap-2 rounded-sm border p-1"
          >
            <LocalizedClientLink href={`/products/${product.product_handle}`}>
              <div className="w-[100px] h-[132px] flex items-center justify-center" data-testid="cart-item-image">
                {product.thumbnail ? (
                  <Image
                    src={decodeURIComponent(product.thumbnail)}
                    alt="Product thumbnail"
                    width={100}
                    height={132}
                    className="h-[132px] w-[100px] rounded-xs object-contain"
                  />
                ) : (
                  <Image
                    src={'/images/placeholder.svg'}
                    alt="Product thumbnail"
                    width={50}
                    height={66}
                    className="h-[66px] w-[50px] rounded-xs object-contain opacity-30"
                  />
                )}
              </div>
            </LocalizedClientLink>

            <div className="w-full p-2">
              <div className="flex justify-between lg:mb-4">
                <LocalizedClientLink href={`/products/${product.product_handle}`}>
                  <div className="mb-4 w-[100px] md:w-[200px] lg:mb-0 lg:w-[280px]">
                    <h3 className="heading-xs truncate uppercase" data-testid="cart-item-title">
                      {product.product_title}
                      {product.subtitle && ` - ${product.subtitle}`}
                    </h3>
                  </div>
                </LocalizedClientLink>
                {delete_item && (
                  <div className="lg:flex">
                    <DeleteCartItemButton id={product.id} />
                  </div>
                )}
              </div>
              <div className="lg:flex justify-between -mt-4 lg:mt-0">
                <div className="label-md text-secondary" data-testid="cart-item-details">
                  {options.map(([title, value]) => (
                    <p key={title}>
                      {title}: <span className="text-primary">{String(value)}</span>
                    </p>
                  ))}
                  {change_quantity ? (
                    <UpdateCartItemButton
                      quantity={product.quantity}
                      lineItemId={product.id}
                      stock={stock[offerIdOf(product)]}
                    />
                  ) : (
                    <p>
                      Quantity: <span className="text-primary">{product.quantity}</span>
                    </p>
                  )}
                </div>
                <div className="mt-4 flex items-center gap-2 lg:mt-0 lg:block lg:text-right">
                  <p className="label-lg" data-testid="cart-item-price">{total}</p>
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};
