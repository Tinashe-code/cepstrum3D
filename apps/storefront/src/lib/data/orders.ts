'use server';

import { HttpTypes } from '@medusajs/types';

import { SellerDTO } from '@mercurjs/types';

import { sdk } from '../client';
import medusaError from '../helpers/medusa-error';
import { revalidateTag } from 'next/cache';

import { getAuthHeaders, getCacheOptions, getCacheTag } from './cookies';

// TODO: legacy returns endpoints — migrate when the returns module lands
type LooseRoute = {
  query: <T = unknown>(i?: never) => Promise<T>;
  mutate: <T = unknown>(i?: never) => Promise<T>;
  delete: <T = unknown>(i?: never) => Promise<T>;
} & { [k: string]: LooseRoute };
const storeLoose = sdk.store as unknown as LooseRoute;

export const retrieveOrderGroup = async (id: string) => {
  return (
    sdk.store.orderGroups.$id.query({
      $id: id,
      fetchOptions: {
        headers: { ...(await getAuthHeaders()) },
        cache: 'no-cache'
      }
    } as never) as unknown as Promise<{ order_group: Record<string, unknown> }>
  )
    .then(async ({ order_group }) => {
      // Order groups don't carry each order's status; fetch it so the page can
      // show "Cancel order" only while the vendor hasn't packed it.
      const orders = ((order_group.orders ?? []) as { id: string }[]);
      if (!orders.length) return order_group;
      const statuses = await (
        sdk.store.orders.query({
          id: orders.map(o => o.id),
          limit: orders.length,
          fields: 'id,status,fulfillment_status,payment_status',
          fetchOptions: { headers: { ...(await getAuthHeaders()) }, cache: 'no-cache' }
        } as never) as unknown as Promise<{
          orders: { id: string; status: string; fulfillment_status: string; payment_status: string }[];
        }>
      )
        .then(r => new Map(r.orders.map(o => [o.id, o])))
        .catch(() => new Map());
      return { ...order_group, orders: orders.map(o => ({ ...o, ...(statuses.get(o.id) ?? {}) })) };
    })
    .catch(err => medusaError(err));
};

/** Cancel one vendor's order while it hasn't been packed yet. */
export const cancelOrder = async (orderId: string): Promise<{ ok: boolean; message?: string }> => {
  const res = await fetch(
    `${process.env.MEDUSA_BACKEND_URL || 'http://localhost:9000'}/store/orders/${orderId}/cancel`,
    {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-publishable-api-key': process.env.NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY || '',
        ...(await getAuthHeaders())
      },
      cache: 'no-store'
    }
  ).catch(() => null);
  if (!res) return { ok: false, message: "We couldn't reach the store. Please try again." };
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { message?: string };
    return { ok: false, message: body.message || 'Could not cancel the order.' };
  }
  revalidateTag(await getCacheTag('orders'));
  return { ok: true };
};

export const retrieveOrder = async (id: string) => {
  const next = {
    ...(await getCacheOptions('orders'))
  };

  return (
    sdk.store.orders.$id.query({
      $id: id,
      fields:
        '*payment_collections.payments,*items,*items.metadata,*items.variant,*items.product,*seller,*order_group',
      fetchOptions: {
        headers: { ...(await getAuthHeaders()) },
        next,
        cache: 'force-cache'
      }
    } as never) as unknown as Promise<
      HttpTypes.StoreOrderResponse & { seller: SellerDTO }
    >
  )
    .then(({ order }) => order)
    .catch(err => medusaError(err));
};

export const createReturnRequest = async (data: Record<string, unknown>) => {
  const response = await storeLoose.returnRequest
    .mutate<{ order_return_request: { id: string } }>({
      ...data,
      fetchOptions: { headers: { ...(await getAuthHeaders()) } }
    } as never)
    .catch(err => medusaError(err));

  return response;
};

export const getReturns = async () => {
  return storeLoose.returnRequest
    .query<{
      order_return_requests: Array<
        { line_items: Array<{ created_at: string; reason_id?: string }> } & Record<
          string,
          unknown
        >
      >;
    }>({
      fields: '*line_items.reason_id',
      fetchOptions: {
        headers: { ...(await getAuthHeaders()) },
        cache: 'force-cache'
      }
    } as never)
    .then(res => res)
    .catch(err => medusaError(err));
};

export const retriveReturnMethods = async (order_id: string) => {
  return storeLoose.shippingOptions.return
    .query<{ shipping_options: Array<Record<string, unknown>> }>({
      order_id,
      fetchOptions: {
        headers: { ...(await getAuthHeaders()) },
        cache: 'no-cache'
      }
    } as never)
    .then(({ shipping_options }) => shipping_options)
    .catch(() => []);
};

export type StoreOrderGroup = {
  id: string;
  display_id: number;
  total: number;
  created_at: string;
  orders: Array<
    HttpTypes.StoreOrder & {
      seller: { id: string; name: string; handle?: string; logo?: string | null };
    }
  >;
};

/**
 * The signed-in customer's order sets, newest first. Each set holds one order
 * per vendor, with items and seller. (The plain /store/orders list no longer
 * returns order_group or seller, so the Orders page lists order groups instead.)
 */
export const listOrderGroups = async (limit: number = 10, offset: number = 0) => {
  return (
    sdk.store.orderGroups.query({
      limit,
      offset,
      order: '-created_at',
      fetchOptions: {
        headers: { ...(await getAuthHeaders()) },
        cache: 'no-cache'
      }
    } as never) as unknown as Promise<{ order_groups: StoreOrderGroup[]; count: number }>
  )
    .then(async ({ order_groups, count }) => {
      // Order groups don't compute fulfillment/payment status; /store/orders does.
      const ids = order_groups.flatMap(g => g.orders.map(o => o.id));
      const statuses = ids.length
        ? await (
            sdk.store.orders.query({
              id: ids,
              limit: ids.length,
              fields: 'id,fulfillment_status,payment_status',
              fetchOptions: { headers: { ...(await getAuthHeaders()) }, cache: 'no-cache' }
            } as never) as unknown as Promise<{
              orders: { id: string; fulfillment_status: string; payment_status: string }[];
            }>
          )
            .then(({ orders }) => new Map(orders.map(o => [o.id, o])))
            .catch(() => new Map())
        : new Map();

      const orderGroups = order_groups.map(g => ({
        ...g,
        orders: g.orders.map(o => ({ ...o, ...(statuses.get(o.id) ?? {}) }))
      })) as StoreOrderGroup[];
      return { orderGroups, count };
    })
    .catch(err => medusaError(err));
};

export const listOrders = async (
  limit: number = 10,
  offset: number = 0,
  filters?: Record<string, unknown>
) => {
  const next = {
    ...(await getCacheOptions('orders'))
  };

  return (
    sdk.store.orders.query({
      limit,
      offset,
      order: '-created_at',
      fields:
        '*items,+items.metadata,*items.variant,*items.product,*seller,*order_group,shipping_total,total,created_at',
      ...filters,
      fetchOptions: {
        headers: { ...(await getAuthHeaders()) },
        next,
        cache: 'no-cache'
      }
    } as never) as unknown as Promise<{
      orders: Array<
        HttpTypes.StoreOrder & {
          seller: { id: string; name: string };
          order_group: { id: string };
        }
      >;
    }>
  )
    .then(({ orders }) => orders.filter(order => order.order_group))
    .catch(err => medusaError(err));
};

export const createTransferRequest = async (
  state: {
    success: boolean;
    error: string | null;
    order: HttpTypes.StoreOrder | null;
  },
  formData: FormData
): Promise<{
  success: boolean;
  error: string | null;
  order: HttpTypes.StoreOrder | null;
}> => {
  const id = formData.get('order_id') as string;

  if (!id) {
    return { success: false, error: 'Order ID is required', order: null };
  }

  const headers = { ...(await getAuthHeaders()) };

  return await (
    sdk.store.orders.$id.transfer.request.mutate({
      $id: id,
      fetchOptions: { headers }
    } as never) as unknown as Promise<{ order: HttpTypes.StoreOrder }>
  )
    .then(({ order }) => ({ success: true, error: null, order }))
    .catch(err => ({ success: false, error: err.message, order: null }));
};

export const acceptTransferRequest = async (id: string, token: string) => {
  const headers = { ...(await getAuthHeaders()) };

  return await (
    sdk.store.orders.$id.transfer.accept.mutate({
      $id: id,
      token,
      fetchOptions: { headers }
    } as never) as unknown as Promise<{ order: HttpTypes.StoreOrder }>
  )
    .then(({ order }) => ({ success: true, error: null, order }))
    .catch(err => ({ success: false, error: err.message, order: null }));
};

export const declineTransferRequest = async (id: string, token: string) => {
  const headers = { ...(await getAuthHeaders()) };

  return await (
    sdk.store.orders.$id.transfer.decline.mutate({
      $id: id,
      token,
      fetchOptions: { headers }
    } as never) as unknown as Promise<{ order: HttpTypes.StoreOrder }>
  )
    .then(({ order }) => ({ success: true, error: null, order }))
    .catch(err => ({ success: false, error: err.message, order: null }));
};

export const retrieveReturnReasons = async () => {
  return (
    sdk.store.returnReasons.query({
      fetchOptions: {
        headers: { ...(await getAuthHeaders()) },
        cache: 'force-cache'
      }
    } as never) as unknown as Promise<{
      return_reasons: Array<HttpTypes.StoreReturnReason>;
    }>
  )
    .then(({ return_reasons }) => return_reasons)
    .catch(err => medusaError(err));
};
