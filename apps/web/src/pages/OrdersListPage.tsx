import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../lib/api';

interface OrderRow {
  id: string;
  status: string;
  subtotal_cents: number;
  fee_percent: number;
  platform_fee_cents: number;
  total_cents: number;
  created_at: string;
  items: { id: string; listing_id: string; quantity: number; unit_price_cents: number }[];
}

const STATUS_BADGE: Record<string, string> = {
  paid:      'bg-green-100 text-green-700',
  pending:   'bg-yellow-100 text-yellow-700',
  cancelled: 'bg-red-100 text-red-600',
  fulfilled: 'bg-blue-100 text-blue-700',
};

const fmt = (cents: number) => `$${(cents / 100).toFixed(2)}`;

function SkeletonRow() {
  return (
    <div className="animate-pulse bg-white rounded-2xl border border-gray-100 p-4 flex justify-between items-center">
      <div className="space-y-2">
        <div className="h-3 bg-gray-100 rounded w-32" />
        <div className="h-3 bg-gray-100 rounded w-20" />
      </div>
      <div className="h-4 bg-gray-100 rounded w-16" />
    </div>
  );
}

export default function OrdersListPage() {
  const { data, isLoading, isError } = useQuery<{ data: OrderRow[] }>({
    queryKey: ['orders'],
    queryFn: async () => {
      const res = await apiClient.get('/orders');
      return res.data;
    },
  });

  const orders = data?.data ?? [];

  return (
    <div className="min-h-screen bg-garden-50 py-8">
      <div className="max-w-2xl mx-auto px-4 space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-garden-700">My Orders</h1>
          <Link to="/search" className="text-sm text-garden-600 hover:underline">
            ← Find more produce
          </Link>
        </div>

        {isLoading && (
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => <SkeletonRow key={i} />)}
          </div>
        )}

        {isError && (
          <div className="bg-red-50 border border-red-100 rounded-xl px-4 py-3 text-sm text-red-600">
            Could not load orders. Please try again.
          </div>
        )}

        {!isLoading && !isError && orders.length === 0 && (
          <div className="text-center py-16 space-y-3">
            <p className="text-gray-400 text-sm">You haven't placed any orders yet.</p>
            <Link to="/search" className="text-garden-600 underline text-sm">
              Find fresh produce →
            </Link>
          </div>
        )}

        {orders.map((order) => {
          const date = new Date(order.created_at).toLocaleDateString([], {
            month: 'short', day: 'numeric', year: 'numeric',
          });
          const itemCount = order.items.reduce((s, i) => s + i.quantity, 0);
          const badge = STATUS_BADGE[order.status] ?? 'bg-gray-100 text-gray-600';

          return (
            <div
              key={order.id}
              className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 space-y-3"
            >
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <p className="text-xs text-gray-400">{date}</p>
                  <p className="text-sm text-gray-600">
                    {itemCount} item{itemCount !== 1 ? 's' : ''}
                  </p>
                </div>
                <span className={`text-xs font-semibold px-2.5 py-1 rounded-full capitalize ${badge}`}>
                  {order.status}
                </span>
              </div>

              <div className="border-t border-gray-50 pt-3 flex items-end justify-between text-sm">
                <div className="space-y-1 text-gray-500 text-xs">
                  <div className="flex gap-4">
                    <span>Subtotal: {fmt(order.subtotal_cents)}</span>
                    <span>Fee ({order.fee_percent}%): {fmt(order.platform_fee_cents)}</span>
                  </div>
                </div>
                <span className="font-bold text-gray-800">{fmt(order.total_cents)}</span>
              </div>

              <Link
                to={`/orders/${order.id}/confirmation`}
                className="block text-xs text-garden-600 hover:underline text-right"
              >
                View receipt →
              </Link>
            </div>
          );
        })}
      </div>
    </div>
  );
}
