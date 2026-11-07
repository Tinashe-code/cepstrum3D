'use server';

import { getAuthHeaders } from './cookies';

const BACKEND = process.env.MEDUSA_BACKEND_URL || 'http://localhost:9000';
const KEY = process.env.NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY || '';

export type InboxMessage = {
  id: string;
  title: string;
  body: string;
  link: string | null;
  stage: 'packed' | 'shipped' | 'delivered' | null;
  created_at: string;
  unread: boolean;
};

const headers = async () => ({ 'x-publishable-api-key': KEY, ...(await getAuthHeaders()) });

/** The signed-in customer's in-store messages (order updates), newest first. */
export async function listNotifications(limit = 20, offset = 0) {
  try {
    const res = await fetch(`${BACKEND}/store/customers/me/notifications?limit=${limit}&offset=${offset}`, {
      headers: await headers(),
      cache: 'no-store'
    });
    if (!res.ok) return { notifications: [] as InboxMessage[], count: 0, unread_count: 0 };
    return (await res.json()) as { notifications: InboxMessage[]; count: number; unread_count: number };
  } catch {
    return { notifications: [] as InboxMessage[], count: 0, unread_count: 0 };
  }
}

export async function getUnreadNotificationCount() {
  return (await listNotifications(1, 0)).unread_count;
}

export async function markNotificationsRead() {
  try {
    await fetch(`${BACKEND}/store/customers/me/notifications/read`, {
      method: 'POST',
      headers: await headers(),
      cache: 'no-store'
    });
  } catch {
    // non-critical
  }
}
