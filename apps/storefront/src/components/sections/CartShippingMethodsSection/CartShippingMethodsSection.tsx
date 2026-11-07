'use client';

import { Fragment, useEffect, useState, useTransition, type FC } from 'react';

import { Listbox, Transition } from '@headlessui/react';
import { CheckCircleSolid, ChevronUpDown, Loader } from '@medusajs/icons';
import type { HttpTypes } from '@medusajs/types';
import { clx, Heading, Text } from '@medusajs/ui';
import clsx from 'clsx';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';

import { Button } from '@/components/atoms';
import ErrorMessage from '@/components/molecules/ErrorMessage/ErrorMessage';
import { removeShippingMethod, setShippingMethod } from '@/lib/data/cart';
import { calculatePriceForShippingOption } from '@/lib/data/fulfillment';
import { getDeliveryQuote, type DeliveryQuote } from '@/lib/data/delivery';
import { TruckIcon } from '@/components/atoms';
import { convertToLocale } from '@/lib/helpers/money';

import { CartShippingMethodRow } from './CartShippingMethodRow';

type ExtendedStoreProduct = HttpTypes.StoreProduct & {
  seller?: {
    id: string;
    name: string;
  };
};

type CartItem = {
  product?: ExtendedStoreProduct;
};

export type StoreCardShippingMethod = HttpTypes.StoreCartShippingOption & {
  seller_id?: string;
  seller_name?: string;
  service_zone?: {
    fulfillment_set: {
      type: string;
    };
  };
};

type ShippingProps = {
  cart: Omit<HttpTypes.StoreCart, 'items'> & {
    items?: CartItem[];
  };
  availableShippingMethods:
    | (StoreCardShippingMethod &
        {
          rules: any;
          seller_id: string;
          price_type: string;
          id: string;
          amount?: number;
        }[])
    | null;
};

const CartShippingMethodsSection: FC<ShippingProps> = ({ cart, availableShippingMethods }) => {
  const [isLoadingPrices, setIsLoadingPrices] = useState(false);
  const [calculatedPricesMap, setCalculatedPricesMap] = useState<Record<string, number>>({});
  const [error, setError] = useState<string | null>(null);
  const [quote, setQuote] = useState<DeliveryQuote | null>(null);
  const [isPendingDeleteRow, startTransitionDeleteRow] = useTransition();

  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const isOpen = searchParams.get('step') === 'delivery';

  const _shippingMethods = availableShippingMethods?.filter(
    sm => sm.rules?.find((rule: any) => rule.attribute === 'is_return')?.value !== 'true'
  );

  // Price the distance-based options once per change of options / address / items.
  // (Depending on the filtered array itself re-ran this on every render — an endless loop.)
  const calculatedIds = (_shippingMethods ?? [])
    .filter(sm => sm.price_type === 'calculated')
    .map(sm => sm.id)
    .join(',');
  const itemsKey = (cart.items ?? [])
    .map((i: any) => `${i.id}:${i.quantity}`)
    .join(',');
  const addressKey = [cart.shipping_address?.address_1, cart.shipping_address?.city, (cart.shipping_address as any)?.metadata?.lat].join('|');
  const hasAddress = !!(cart.shipping_address?.city || cart.shipping_address?.address_1);

  useEffect(() => {
    if (!calculatedIds || !hasAddress) return;
    let cancelled = false;
    setIsLoadingPrices(true);
    Promise.allSettled(calculatedIds.split(',').map(id => calculatePriceForShippingOption(id, cart.id))).then(res => {
      if (cancelled) return;
      const pricesMap: Record<string, number> = {};
      res.forEach(r => {
        if (r.status === 'fulfilled' && r.value?.id) pricesMap[r.value.id] = r.value.amount!;
      });
      setCalculatedPricesMap(pricesMap);
      setIsLoadingPrices(false);
    });
    return () => {
      cancelled = true;
    };
  }, [calculatedIds, cart.id, itemsKey, addressKey, hasAddress]);

  // Per-vendor distance / free-delivery reason, from the same rules the "Delivery" price uses.
  useEffect(() => {
    let cancelled = false;
    getDeliveryQuote(cart.id).then(q => {
      if (!cancelled) setQuote(q);
    });
    return () => {
      cancelled = true;
    };
  }, [cart.id, itemsKey, addressKey]);

  const vendorQuote = (sellerId: string) => quote?.vendors.find(v => v.seller_id === sellerId);
  const customerCity = (cart.shipping_address?.city ?? '').trim().toLowerCase();
  const freeOrder = quote?.free_order;
  const freeOrderApplies =
    !!freeOrder &&
    freeOrder.min_order > 0 &&
    (!freeOrder.cities.length || freeOrder.cities.some(c => c.toLowerCase() === customerCity));

  const freeOrderScope = freeOrder
    ? `orders from ${convertToLocale({ amount: freeOrder.min_order, currency_code: cart.currency_code })}${
        freeOrder.cities.length ? ` in ${freeOrder.cities.join(', ')}` : ''
      }`
    : '';

  const priceLabel = (option: any) => {
    const amount = option.price_type === 'flat' ? option.amount : calculatedPricesMap[option.id];
    if (amount === undefined || amount === null) return null;
    if (Number(amount) === 0) return 'Free';
    return convertToLocale({ amount: Number(amount), currency_code: cart?.currency_code });
  };

  const handleSubmit = () => {
    router.push(pathname + '?step=payment', { scroll: false });
  };

  const handleSetShippingMethod = async (id: string | null) => {
    if (!id) {
      return;
    }

    try {
      setError(null);
      setIsLoadingPrices(true);
      const res = await setShippingMethod({
        cartId: cart.id,
        shippingMethodId: id
      });
      if (!res.ok) {
        return setError(res.error?.message);
      }
    } catch (error: any) {
      setError(
        error?.message?.replace('Error setting up the request: ', '') || 'An error occurred'
      );
    } finally {
      setIsLoadingPrices(false);
      router.refresh();
    }
  };

  const handleRemoveShippingMethod = (methodId: string) => {
    startTransitionDeleteRow(async () => {
      await removeShippingMethod(methodId);
    });
    router.refresh();
  };

  useEffect(() => {
    setError(null);
  }, [isOpen]);

  const groupedBySellerId = _shippingMethods?.reduce((acc: any, method) => {
    const sellerId = method.seller_id!;

    if (!acc[sellerId]) {
      acc[sellerId] = [];
    }

    const amount = Number(
      method.price_type === 'flat' ? method.amount : calculatedPricesMap[method.id]
    );

    if (!isNaN(amount)) {
      acc[sellerId]?.push(method);
    }

    return acc;
  }, {});

  const handleEdit = () => {
    router.replace(pathname + '?step=delivery');
  };
  const isEditEnabled = !isOpen && !!cart?.shipping_methods?.length;

  const filteredGroupedBySellerId = Object.keys(groupedBySellerId || {}).filter(
    key => groupedBySellerId?.[key]?.[0]?.seller_name
  );

  // The shipping method a seller currently has selected in the cart, matched by
  // the option ids that belong to that seller.
  const getSelectedMethodForSeller = (key: string) => {
    const optionIds = new Set<string>(
      (groupedBySellerId?.[key] ?? []).map((o: any) => o.id)
    );
    return cart.shipping_methods?.find(
      method =>
        !!method.shipping_option_id && optionIds.has(method.shipping_option_id)
    );
  };

  // Payment is only reachable once every seller in the cart has a method.
  const allSellersHaveMethod =
    filteredGroupedBySellerId.length > 0 &&
    filteredGroupedBySellerId.every(key => !!getSelectedMethodForSeller(key));

  // Map each selected method back to its seller name for the summary rows.
  const sellerNameByOptionId = new Map<string, string | undefined>(
    (_shippingMethods ?? []).map((option: any) => [option.id, option.seller_name])
  );

  return (
    <div className="bg-ui-bg-interactive rounded-sm border p-4">
      <div className="mb-6 flex flex-row items-center justify-between">
        <Heading
          level="h2"
          className="text-3xl-regular flex flex-row items-baseline gap-x-2"
        >
          {!isOpen && (cart.shipping_methods?.length ?? 0) > 0 && <CheckCircleSolid />}
          Delivery
        </Heading>
        {isEditEnabled && (
          <Text>
            <Button
              onClick={handleEdit}
              variant="tonal"
            >
              Edit
            </Button>
          </Text>
        )}
      </div>
      {isOpen ? (
        <>
          <div className="grid">
            <div data-testid="delivery-options-container">
              <div className="pb-8 pt-2 md:pt-0">
                {freeOrder?.label && (
                  <p
                    className="mb-4 flex items-center gap-2 rounded-sm bg-[#f0fdf4] px-3 py-2 text-sm text-[#15803d]"
                    data-testid="free-order-banner"
                  >
                    <TruckIcon />
                    {freeOrderApplies && freeOrder.remaining === 0
                      ? `Your order gets free delivery (${freeOrderScope}).`
                      : freeOrderApplies && freeOrder.remaining
                        ? `Add ${convertToLocale({ amount: freeOrder.remaining, currency_code: cart.currency_code })} more for free delivery (${freeOrderScope}).`
                        : `${freeOrder.label}.`}
                  </p>
                )}
                {filteredGroupedBySellerId.length === 0
                  ? 'No shipping options available'
                  : filteredGroupedBySellerId.map(key => {
                      const selectedMethod = getSelectedMethodForSeller(key);

                      return (
                      <div
                        key={key}
                        className="mb-4"
                      >
                        <Heading
                          level="h3"
                          className="mb-1"
                        >
                          {groupedBySellerId[key][0].seller_name}
                        </Heading>
                        {(() => {
                          const v = vendorQuote(key);
                          if (!v) return null;
                          return (
                            <p
                              className={clsx(
                                'mb-2 flex items-center gap-1.5 text-sm',
                                v.free ? 'font-semibold text-[#15803d]' : 'text-secondary'
                              )}
                              data-testid={`delivery-quote-${key}`}
                            >
                              <TruckIcon />
                              {v.error
                                ? v.error
                                : v.free
                                  ? `${v.free_reason}`
                                  : `Delivery from ${v.from_city}: ${v.km} km${v.estimated ? ' (estimated)' : ''} · ${convertToLocale({ amount: v.amount ?? 0, currency_code: cart.currency_code })}`}
                            </p>
                          );
                        })()}
                        <Listbox
                          value={selectedMethod?.shipping_option_id ?? null}
                          onChange={value => {
                            handleSetShippingMethod(value);
                          }}
                        >
                          <div className="relative">
                            <Listbox.Button
                              className={clsx(
                                'text-base-regular relative flex h-12 w-full cursor-default items-center justify-between rounded-lg border bg-component-secondary px-4 text-left focus:outline-none focus-visible:border-gray-300 focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-opacity-75 focus-visible:ring-offset-2 focus-visible:ring-offset-gray-300'
                              )}
                            >
                              {({ open }) => (
                                <>
                                  <span className="block truncate">
                                    {selectedMethod?.name ?? 'Choose delivery option'}
                                  </span>
                                  <ChevronUpDown
                                    className={clx('transition-rotate duration-200', {
                                      'rotate-180 transform': open
                                    })}
                                  />
                                </>
                              )}
                            </Listbox.Button>
                            <Transition
                              as={Fragment}
                              leave="transition ease-in duration-100"
                              leaveFrom="opacity-100"
                              leaveTo="opacity-0"
                            >
                              <Listbox.Options
                                className="text-small-regular border-top-0 absolute z-20 max-h-60 w-full overflow-auto rounded-lg border bg-white focus:outline-none sm:text-sm"
                                data-testid="shipping-address-options"
                              >
                                {groupedBySellerId[key].map((option: any) => (
                                  <Listbox.Option
                                    className="relative cursor-pointer select-none border-b py-4 pl-6 pr-10 hover:bg-gray-50"
                                    value={option.id}
                                    key={option.id}
                                  >
                                    {option.name}
                                    {' - '}
                                    {priceLabel(option) ?? (isLoadingPrices ? <Loader /> : '-')}
                                  </Listbox.Option>
                                ))}
                              </Listbox.Options>
                            </Transition>
                          </div>
                        </Listbox>
                      </div>
                      );
                    })}
                {!!cart?.shipping_methods?.length && (
                  <div className="flex flex-col">
                    {cart.shipping_methods?.map(method => (
                      <CartShippingMethodRow
                        key={method.id}
                        method={method}
                        sellerName={
                          method.shipping_option_id
                            ? sellerNameByOptionId.get(method.shipping_option_id)
                            : undefined
                        }
                        currency_code={cart.currency_code}
                        onRemoveShippingMethod={handleRemoveShippingMethod}
                      />
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
          <div>
            <ErrorMessage
              error={error}
              data-testid="delivery-option-error-message"
            />
            <Button
              onClick={handleSubmit}
              variant="tonal"
              disabled={!allSellersHaveMethod || isPendingDeleteRow}
              loading={isLoadingPrices}
            >
              Continue to payment
            </Button>
          </div>
        </>
      ) : (
        <div>
          <div className="text-small-regular">
            {cart && (cart.shipping_methods?.length ?? 0) > 0 && (
              <div className="flex flex-col">
                {cart.shipping_methods?.map(method => (
                  <div
                    key={method.id}
                    className="mb-4 rounded-md border p-4"
                  >
                    <Text className="txt-medium-plus text-ui-fg-base mb-1">Method</Text>
                    <Text className="txt-medium text-ui-fg-subtle">
                      {method.name}{' '}
                      {convertToLocale({
                        amount: method.amount!,
                        currency_code: cart?.currency_code
                      })}
                    </Text>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default CartShippingMethodsSection;
