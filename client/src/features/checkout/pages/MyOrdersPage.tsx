import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { fetchMyOrders, type Order } from '../api';
import { formatCurrency } from '../../../shared/utils/formatCurrency';

const STATUS_STYLES: Record<string, string> = {
  pending:   'bg-yellow-100 text-yellow-700',
  paid:      'bg-green-100 text-green-700',
  fulfilled: 'bg-blue-100 text-blue-700',
  cancelled: 'bg-gray-100 text-gray-600',
};

export default function MyOrdersPage() {
  const [orders, setOrders] = useState<Order[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchMyOrders()
      .then(setOrders)
      .catch((e) => setError(e.response?.data?.error?.message ?? 'Failed to load'));
  }, []);

  return (
    <main className="max-w-4xl mx-auto px-6 py-8">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">My Orders</h1>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-800 rounded-lg p-4 mb-4">{error}</div>
      )}

      {orders === null && <p className="text-gray-500">Loading…</p>}

      {orders && orders.length === 0 && (
        <div className="bg-white rounded-xl shadow-card p-10 text-center">
          <div className="text-5xl mb-3">📦</div>
          <p className="text-gray-500">No orders yet.</p>
          <Link to="/" className="inline-block mt-4 text-brand-600 font-semibold">
            Browse listings →
          </Link>
        </div>
      )}

      {orders && orders.length > 0 && (
        <div className="space-y-4">
          {orders.map((o) => (
            <Link
              to={`/order/${o.orderId}`}
              key={o.orderId}
              className="block bg-white rounded-xl shadow-card p-5 hover:shadow-lg transition-shadow"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full uppercase ${STATUS_STYLES[o.status] ?? 'bg-gray-100 text-gray-600'}`}>
                      {o.status}
                    </span>
                    <span className="text-xs text-gray-500 font-mono">
                      {o.orderId.slice(0, 8)}
                    </span>
                  </div>
                  <p className="text-sm text-gray-600 mt-2 truncate">
                    {o.items.map((i) => `${i.title} × ${i.quantity}`).join(', ')}
                  </p>
                  <p className="text-xs text-gray-400 mt-1">
                    {new Date(o.createdAt).toLocaleString()}
                  </p>
                </div>
                <div className="text-right">
                  <div className="text-lg font-bold text-gray-900">{formatCurrency(o.totalCents)}</div>
                  <div className="text-xs text-gray-500">
                    incl. {formatCurrency(o.platformFeeCents)} fee
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </main>
  );
}
