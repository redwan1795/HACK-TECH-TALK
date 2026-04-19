import { Link } from 'react-router-dom';
import type { Notification } from '../api/notifications';

interface Props {
  notification: Notification;
  onDismiss: () => void;
}

export default function NotificationToast({ notification, onDismiss }: Props) {
  const data = notification.data ?? {};
  const linkTo = data.listingId ? `/listing/${data.listingId}` : '/future-orders';

  return (
    <div className="bg-brand-700 text-white rounded-xl shadow-toast overflow-hidden relative animate-slide-in">
      <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-brand-500 rounded-l-xl" />
      <div className="flex items-start gap-3 px-5 py-4 pr-10">
        <div className="w-9 h-9 rounded-full bg-white/15 flex items-center justify-center text-xl flex-shrink-0">
          🔔
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-[10px] font-bold text-white/70 uppercase tracking-wide">
            {notification.type === 'future_order_match' ? 'Future Order Matched' : 'Notification'}
          </div>
          <div className="text-sm font-semibold mt-0.5">
            {notification.message}
          </div>
          {data.distanceMiles !== undefined && (
            <div className="text-xs text-white/70 mt-0.5">
              📍 {data.distanceMiles} mi away · Just now
            </div>
          )}
          {linkTo && (
            <Link
              to={linkTo}
              onClick={onDismiss}
              className="inline-block mt-2 text-xs font-bold text-white bg-white/15 hover:bg-white/25 px-3 py-1 rounded"
            >
              View →
            </Link>
          )}
        </div>
      </div>
      <button
        onClick={onDismiss}
        className="absolute top-2 right-3 text-white/50 hover:text-white text-lg leading-none"
        aria-label="Dismiss"
      >×</button>
    </div>
  );
}
