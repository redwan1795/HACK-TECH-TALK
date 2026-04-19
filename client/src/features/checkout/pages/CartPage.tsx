import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useCartStore } from '../../../shared/stores/cartStore';
import { useAuthStore } from '../../../shared/stores/authStore';
import { feePreview, type FeeBreakdown } from '../api';
import { formatCurrency } from '../../../shared/utils/formatCurrency';

const CATEGORY_EMOJI: Record<string, string> = {
  vegetable: '🥦', fruit: '🍎', herb: '🌿',
  flower: '🌸', egg: '🥚', dairy: '🥛', other: '📦',
};

export default function CartPage() {
  const navigate = useNavigate();
  const { items, removeItem, updateQuantity, clear } = useCartStore();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated());
  const [fee, setFee] = useState<FeeBreakdown | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function refreshFee() {
    setError(null);
    if (items.length === 0) { setFee(null); return; }
    if (!isAuthenticated) { setFee(null); return; }
    try {
      const f = await feePreview(items.map((i) => ({ listingId: i.listingId, quantity: i.quantity })));
      setFee(f);
    } catch (err: any) {
      setError(err.response?.data?.error?.message ?? 'Failed to compute fee');
    }
  }

  useEffect(() => { refreshFee(); /* eslint-disable-next-line */ }, [items, isAuthenticated]);

  function checkout() {
    if (!isAuthenticated) {
      navigate('/login');
      return;
    }
    navigate('/checkout');
  }

  // Non-authenticated client-side subtotal (fee is server-only)
  const clientSubtotal = items.reduce((sum, i) => sum + i.priceCents * i.quantity, 0);

  return (
    <main className="max-w-4xl mx-auto px-6 py-8">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Your Cart</h1>

      {items.length === 0 ? (
        <div className="bg-white rounded-xl shadow-card p-12 text-center">
          <div className="text-5xl mb-3">🛒</div>
          <h2 className="text-lg font-semibold text-gray-900">Your cart is empty</h2>
          <p className="text-gray-500 mt-1">Find fresh produce from local growers.</p>
          <Link
            to="/"
            className="inline-block mt-4 bg-brand-600 hover:bg-brand-700 text-white px-5 py-2 rounded-lg font-semibold"
          >
            Browse listings
          </Link>
        </div>
      ) : (
        <div className="grid md:grid-cols-3 gap-6">
          <div className="md:col-span-2 bg-white rounded-xl shadow-card divide-y divide-gray-100">
            {items.map((item) => (
              <div key={item.listingId} className="p-4 flex items-center gap-4">
                <div className="w-16 h-16 bg-brand-100 rounded-lg flex items-center justify-center text-3xl flex-shrink-0">
                  {CATEGORY_EMOJI[item.category] ?? '📦'}
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-gray-900 truncate">{item.title}</h3>
                  <p className="text-sm text-gray-500 truncate">{item.producerName}</p>
                  <p className="text-sm text-gray-700 mt-1">
                    {formatCurrency(item.priceCents, item.unit)}
                  </p>
                </div>

                <div className="flex items-center gap-2 flex-shrink-0">
                  <button
                    onClick={() => updateQuantity(item.listingId, item.quantity - 1)}
                    disabled={item.quantity <= 1}
                    className="w-8 h-8 rounded-full border border-gray-300 text-gray-700 disabled:opacity-30 hover:bg-gray-50"
                  >–</button>
                  <span className="w-8 text-center font-semibold">{item.quantity}</span>
                  <button
                    onClick={() => updateQuantity(item.listingId, item.quantity + 1)}
                    disabled={item.quantity >= item.maxQuantity}
                    className="w-8 h-8 rounded-full border border-gray-300 text-gray-700 disabled:opacity-30 hover:bg-gray-50"
                  >+</button>
                </div>

                <div className="w-20 text-right font-bold text-gray-900 flex-shrink-0">
                  {formatCurrency(item.priceCents * item.quantity)}
                </div>

                <button
                  onClick={() => removeItem(item.listingId)}
                  className="text-gray-400 hover:text-red-600 ml-2"
                  aria-label="Remove"
                >✕</button>
              </div>
            ))}

            <div className="p-4 flex justify-end">
              <button
                onClick={() => clear()}
                className="text-sm text-gray-500 hover:text-red-600"
              >
                Clear cart
              </button>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-card p-5 h-fit space-y-3">
            <h2 className="font-bold text-gray-900">Summary</h2>

            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Subtotal</span>
              <span className="font-medium">{formatCurrency(clientSubtotal)}</span>
            </div>

            {fee && (
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">
                  Platform fee <span className="text-xs text-gray-400">({fee.feePercent}%)</span>
                </span>
                <span className="font-medium">{formatCurrency(fee.platformFeeCents)}</span>
              </div>
            )}

            {!fee && isAuthenticated && (
              <div className="text-xs text-gray-400">Calculating fee…</div>
            )}
            {!isAuthenticated && (
              <div className="text-xs text-gray-400">Sign in to see platform fee</div>
            )}

            <div className="border-t border-gray-100 pt-3 flex justify-between">
              <span className="font-bold text-gray-900">Total</span>
              <span className="font-bold text-gray-900 text-lg">
                {formatCurrency(fee ? fee.totalCents : clientSubtotal)}
              </span>
            </div>

            {error && (
              <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded px-3 py-2">
                {error}
              </div>
            )}

            <button
              onClick={checkout}
              className="w-full bg-brand-600 hover:bg-brand-700 text-white font-semibold py-3 rounded-lg"
            >
              {isAuthenticated ? 'Checkout →' : 'Sign in to checkout →'}
            </button>
          </div>
        </div>
      )}
    </main>
  );
}
