import { useEffect, useState, useCallback } from 'react';
import { fetchNotifications, type Notification } from '../api/notifications';
import { useAuthStore } from '../stores/authStore';

const POLL_INTERVAL_MS = 10_000;

// Tracks which notification IDs we've already shown as toasts this session.
const toastedIds = new Set<string>();

export function useNotifications() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated());
  const [items, setItems] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [newToasts, setNewToasts] = useState<Notification[]>([]);

  const poll = useCallback(async () => {
    if (!isAuthenticated) return;
    try {
      const res = await fetchNotifications();
      setItems(res.notifications);
      setUnreadCount(res.unreadCount);

      // Find notifications we haven't shown as toasts yet (unread + new this session)
      const freshToasts = res.notifications.filter(
        (n) => !n.read && !toastedIds.has(n.id)
      );
      if (freshToasts.length > 0) {
        freshToasts.forEach((n) => toastedIds.add(n.id));
        setNewToasts((prev) => [...freshToasts, ...prev]);
      }
    } catch {
      // silent — server might be briefly offline
    }
  }, [isAuthenticated]);

  useEffect(() => {
    if (!isAuthenticated) {
      setItems([]); setUnreadCount(0); setNewToasts([]);
      return;
    }
    poll();
    const t = setInterval(poll, POLL_INTERVAL_MS);
    return () => clearInterval(t);
  }, [isAuthenticated, poll]);

  function dismissToast(id: string) {
    setNewToasts((prev) => prev.filter((n) => n.id !== id));
  }

  return { items, unreadCount, newToasts, dismissToast, refresh: poll };
}
