import crypto from 'crypto';

// In-memory notifications store. Replaces SendGrid/email for the demo.
// Frontend polls /notifications every 10s to render toasts.

export interface Notification {
  id: string;
  userId: string;
  type: 'future_order_match';
  title: string;
  message: string;
  data: Record<string, any>;
  read: boolean;
  createdAt: string;
}

const store: Notification[] = [];

// Reasonable cap so memory doesn't grow forever in a long-running process.
const MAX_NOTIFICATIONS = 1000;

export function pushNotification(n: Omit<Notification, 'id' | 'read' | 'createdAt'>): Notification {
  const notification: Notification = {
    id: crypto.randomUUID(),
    read: false,
    createdAt: new Date().toISOString(),
    ...n,
  };

  store.unshift(notification);
  if (store.length > MAX_NOTIFICATIONS) store.length = MAX_NOTIFICATIONS;

  // Console-log so you see it in the server terminal during the demo
  console.log(
    `🔔 [NOTIFY → ${n.userId.slice(0, 8)}] ${n.title} — ${n.message}`
  );

  return notification;
}

export function listForUser(userId: string, opts: { unreadOnly?: boolean } = {}): Notification[] {
  return store
    .filter((n) => n.userId === userId && (!opts.unreadOnly || !n.read))
    .slice(0, 50);
}

export function markRead(userId: string, notificationId: string): boolean {
  const n = store.find((x) => x.id === notificationId && x.userId === userId);
  if (!n) return false;
  n.read = true;
  return true;
}

export function markAllRead(userId: string): number {
  let count = 0;
  for (const n of store) {
    if (n.userId === userId && !n.read) {
      n.read = true;
      count++;
    }
  }
  return count;
}

export function unreadCount(userId: string): number {
  return store.filter((n) => n.userId === userId && !n.read).length;
}

// For testing only
export function _clearAll() {
  store.length = 0;
}
