import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCartStore } from '../../../shared/stores/cartStore';
import { createOrder, confirmOrder, type Order } from '../api';
import { formatCurrency } from '../../../shared/utils/formatCurrency';

export default function CheckoutPage() {
  const nav = useNavigate();
  const { items, clear } = useCartStore();
  const [order, setOrder] = useState<Order | null>(null);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Create order on mount (pending state — pre-fills fee breakdown)
  useEffect(() => {
    if (items.length === 0) {
      nav('/cart');
      return;
    }
    (async () => {
      try {
        const o = await createOrder(items.map((i) => ({ listingId: i.listingId, quantity: i.quantity })));
        setOrder(o);
      } catch (err: any) {
        setError(err.response?.data?.error?.message ?? 'Failed to start checkout');
      }
    })();
    // eslint-disable-next-line
  }, []);

  async function handlePay() {
    if (!order) return;
    setProcessing(true);
    setError(null);

    // Fake Stripe delay for realism
    await new Promise((r) => setTimeout(r, 800));

    try {
      const confirmed = await confirmOrder(order.orderId);
      clear();
      nav(`/order/${confirmed.orderId}`);
    } catch (err: any) {
      setError(err.response?.data?.error?.message ?? 'Payment failed');
      setProcessing(false);
    }
  }

  if (error && !order) {
    return (
      <main className="max-w-xl mx-auto px-6 py-10">
        <div className="bg-red-50 border border-red-200 text-red-800 rounded-lg p-4">{error}</div>
      </main>
    );
  }

  if (!order) {
    return <main className="max-w-xl mx-auto px-6 py-10 text-gray-500">Preparing checkout…</main>;
  }

  return (
    <main className="max-w-xl mx-auto px-6 py-8">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Checkout</h1>

      <div className="bg-white rounded-xl shadow-card p-6 space-y-4">
        <div className="space-y-2">
          <h2 className="font-semibold text-gray-900">Order summary</h2>
          {order.items.map((i) => (
            <div key={i.listingId} className="flex justify-between text-sm">
              <span className="text-gray-700">
                {i.title} <span className="text-gray-400">× {i.quantity}</span>
              </span>
              <span className="font-medium">{formatCurrency(i.lineTotalCents)}</span>
            </div>
          ))}
        </div>

        <div className="border-t border-gray-100 pt-3 space-y-2">
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
          <div className="flex justify-between text-lg font-bold text-gray-900 pt-1 border-t border-gray-100">
            <span>Total</span>
            <span>{formatCurrency(order.totalCents)}</span>
          </div>
        </div>

        <div className="border border-blue-200 bg-blue-50 rounded-lg p-3 text-xs text-blue-900">
          💡 <strong>Demo mode:</strong> Clicking "Pay" instantly marks this order paid — no real Stripe integration.
        </div>

        {error && (
          <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded px-3 py-2">
            {error}
          </div>
        )}

        <button
          onClick={handlePay}
          disabled={processing}
          className="w-full bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white font-semibold py-3 rounded-lg flex items-center justify-center gap-2"
        >
          {processing ? (
            <>
              <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" strokeDasharray="32" strokeDashoffset="8"/>
              </svg>
              Processing payment…
            </>
          ) : (
            <>💳 Pay with Stripe (demo)</>
          )}
        </button>

        <button
          onClick={() => nav('/cart')}
          disabled={processing}
          className="w-full text-sm text-gray-500 hover:text-gray-700"
        >
          ← Back to cart
        </button>
      </div>
    </main>
  );
}
