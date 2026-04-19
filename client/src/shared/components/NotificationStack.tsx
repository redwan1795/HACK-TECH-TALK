import { useNotifications } from '../hooks/useNotifications';
import NotificationToast from './NotificationToast';

export default function NotificationStack() {
  const { newToasts, dismissToast } = useNotifications();

  if (newToasts.length === 0) return null;

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-3 max-w-sm">
      {newToasts.slice(0, 3).map((n) => (
        <NotificationToast
          key={n.id}
          notification={n}
          onDismiss={() => dismissToast(n.id)}
        />
      ))}
    </div>
  );
}
