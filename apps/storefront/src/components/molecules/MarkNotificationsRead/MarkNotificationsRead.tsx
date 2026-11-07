'use client';

import { useEffect } from 'react';

import { markNotificationsRead } from '@/lib/data/notifications';

/** Opening the Notifications page marks them read (the "New" tags stay until the next visit). */
export const MarkNotificationsRead = () => {
  useEffect(() => {
    markNotificationsRead().then(() => window.dispatchEvent(new Event('notifications-read')));
  }, []);
  return null;
};
