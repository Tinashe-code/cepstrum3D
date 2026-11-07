import { redirect } from 'next/navigation';

import { UserNavigation } from '@/components/molecules';
import { MarkNotificationsRead } from '@/components/molecules/MarkNotificationsRead/MarkNotificationsRead';
import { retrieveCustomer } from '@/lib/data/customer';
import { listNotifications } from '@/lib/data/notifications';

const STAGE_ICON: Record<string, string> = {
  received: '🧾',
  packed: '📦',
  shipped: '🚚',
  delivered: '✅',
  canceled: '❌',
  promo: '🎁'
};

const when = (iso: string) =>
  new Date(iso).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

/** In-store messages: order packed / on its way / delivered (also sent by email). */
export default async function NotificationsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const user = await retrieveCustomer();
  if (!user) redirect(`/${locale}/login`);

  const { notifications, unread_count } = await listNotifications(50, 0);

  return (
    <main className="container" data-testid="notifications-page">
      <div className="mt-6 grid grid-cols-1 gap-5 md:grid-cols-4 md:gap-8">
        <UserNavigation />
        <div className="space-y-4 md:col-span-3">
          <h1 className="heading-md uppercase">Notifications</h1>
          {notifications.length === 0 ? (
            <p className="text-secondary" data-testid="notifications-empty">
              No notifications yet. We&apos;ll let you know here (and by email) when a vendor packs, sends or
              delivers your order.
            </p>
          ) : (
            <ul className="divide-y rounded-sm border" data-testid="notifications-list">
              {notifications.map(n => (
                <li
                  key={n.id}
                  className={`flex gap-3 p-4 ${n.unread ? 'bg-accent-soft' : 'bg-primary'}`}
                  data-testid="notification-item"
                  data-unread={n.unread}
                >
                  <span aria-hidden className="text-xl leading-none">
                    {STAGE_ICON[n.stage ?? ''] ?? '🔔'}
                  </span>
                  <div className="flex-1">
                    <p className="font-semibold text-primary">
                      {n.title}
                      {n.unread && (
                        <span className="ml-2 rounded-xs bg-accent px-1.5 py-0.5 text-[11px] font-bold uppercase text-white">
                          New
                        </span>
                      )}
                    </p>
                    <p className="mt-1 text-sm text-secondary">{n.body}</p>
                    <div className="mt-2 flex items-center gap-4 text-xs text-secondary">
                      <span>{when(n.created_at)}</span>
                      {n.link && (
                        <a href={n.link} className="font-semibold text-accent hover:underline">
                          View order
                        </a>
                      )}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
      {unread_count > 0 && <MarkNotificationsRead />}
    </main>
  );
}
