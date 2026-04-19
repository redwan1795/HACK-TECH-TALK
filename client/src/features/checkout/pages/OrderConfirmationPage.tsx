import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { fetchOrder, type Order } from '../api';
import { formatCurrency } from '../../../shared/utils/formatCurrency';

export default function OrderConfirmationPage() {
  const { id } = useParams<{ id: string }>();
  const [order, setOrder] = useState<Order | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    fetchOrder(id)
      .then(setOrder)
      .catch((e) => setError(e.response?.data?.error?.message ?? 'Failed to load order'));
  }, [id]);

  if (error) {
    return (
      <main className="max-w-xl mx-auto px-6 py-10">
        <div className="bg-red-50 border border-red-200 text-red-800 rounded-lg p-4">{error}</div>
        <Link to="/" className="text-brand-600 mt-4 inline-block">← Back to listings</Link>
      </main>
    );
  }

  if (!order) {
    return <main className="max-w-xl mx-auto px-6 py-10 text-gray-500">Loading…</main>;
  }

  const isPaid = order.status === 'paid';

  return (
    <main className="max-w-xl mx-auto px-6 py-8">
      <div className="bg-white rounded-xl shadow-card p-6 space-y-5 text-center">
        <div className={`mx-auto w-16 h-16 rounded-full flex items-center justify-center text-3xl ${isPaid ? 'bg-brand-100 text-brand-700' : 'bg-yellow-100 text-yellow-700'}`}>
          {isPaid ? '✓' : '⏳'}
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            {isPaid ? 'Payment successful!' : 'Order pending'}
          </h1>
          <p className="text-gray-500 mt-1 text-sm">
            Order <span className="font-mono text-gray-700">{order.orderId.slice(0, 8)}</span>
          </p>
          {order.paymentRef && (
            <p className="text-xs text-gray-400 mt-1 font-mono">{order.paymentRef}</p>
          )}
        </div>

        <div className="text-left bg-gray-50 rounded-lg p-4 space-y-2">
          {order.items.map((i) => (
            <div key={i.listingId} className="flex justify-between text-sm">
              <span className="text-gray-700">
                {i.title} <span className="text-gray-400">× {i.quantity}</span>
              </span>
              <span className="font-medium">{formatCurrency(i.lineTotalCents)}</span>
            </div>
          ))}

          <div className="border-t border-gray-200 pt-2 space-y-1">
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Subtotal</span>
              <span>{formatCurrency(order.subtotalCents)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">
                Platform fee <span className="text-xs text-gray-400">({order.feePercent}%)</span>
              </span>
              <span>{formatCurrency(order.platformFeeCents)}</span>
            </div>
            <div className="flex justify-between text-lg font-bold text-gray-900 pt-1 border-t border-gray-200">
              <span>Total paid</span>
              <span>{formatCurrency(order.totalCents)}</span>
            </div>
          </div>
        </div>

        <div className="flex gap-3">
          <Link
            to="/"
            className="flex-1 border border-gray-300 text-gray-700 py-2.5 rounded-lg font-semibold hover:bg-gray-50"
          >
            Keep shopping
          </Link>
          <Link
            to="/orders"
            className="flex-1 bg-brand-600 hover:bg-brand-700 text-white py-2.5 rounded-lg font-semibold"
          >
            My orders
          </Link>
        </div>
      </div>
    </main>
  );
}
