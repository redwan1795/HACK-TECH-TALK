import { http } from './httpClient';

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

export interface NotificationsResponse {
  notifications: Notification[];
  unreadCount: number;
}

export async function fetchNotifications(unreadOnly = false): Promise<NotificationsResponse> {
  const { data } = await http.get<NotificationsResponse>('/notifications', {
    params: unreadOnly ? { unread: 'true' } : undefined,
  });
  return data;
}

export async function markNotificationRead(id: string): Promise<void> {
  await http.post(`/notifications/${id}/read`);
}

export async function markAllNotificationsRead(): Promise<void> {
  await http.post('/notifications/read-all');
}
