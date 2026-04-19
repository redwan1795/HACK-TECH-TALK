import { Link, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../lib/api';
import { useCartStore } from '../stores/cartStore';

const API_BASE = import.meta.env.VITE_API_URL?.replace('/api/v1', '') ?? 'http://localhost:3000';

export default function CartPage() {
  const navigate = useNavigate();
  const { items, removeItem, updateQuantity } = useCartStore();

  const { data: config } = useQuery<{ fee_percent: number }>({
    queryKey: ['admin-config'],
    queryFn: async () => {
      const res = await apiClient.get('/admin/config');
      return res.data;
    },
  });

  const feePercent = config?.fee_percent ?? 7;
  const subtotalCents = useCartStore((s) => s.subtotal)();
  const feeCents = Math.round(subtotalCents * feePercent / 100);
  const totalCents = subtotalCents + feeCents;

  const fmt = (cents: number) => `$${(cents / 100).toFixed(2)}`;

  if (items.length === 0) {
    return (
      <div className="min-h-screen bg-garden-50 flex items-center justify-center">
        <div className="text-center space-y-3">
          <p className="text-gray-500 text-sm">Your cart is empty.</p>
          <Link to="/search" className="text-garden-600 underline text-sm">Browse listings →</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-garden-50 py-8">
      <div className="max-w-lg mx-auto px-4 space-y-4">
        <h1 className="text-2xl font-bold text-garden-700">Your Cart</h1>

        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm divide-y divide-gray-50">
          {items.map(({ listing, quantity }) => {
            const img = listing.images[0] ? `${API_BASE}${listing.images[0]}` : null;
            return (
              <div key={listing.id} className="p-4 flex gap-3 items-start">
                {img && (
                  <img src={img} alt={listing.title} className="w-16 h-16 rounded-lg object-cover shrink-0" />
                )}
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-gray-800 text-sm truncate">{listing.title}</p>
                  <p className="text-xs text-garden-700 font-semibold mt-0.5">
                    {listing.priceCents != null ? `$${(listing.priceCents / 100).toFixed(2)} each` : 'Free'}
                  </p>

                  <div className="flex items-center gap-2 mt-2">
                    <button
                      aria-label="decrease quantity"
                      onClick={() =>
                        quantity > 1
                          ? updateQuantity(listing.id, quantity - 1)
                          : removeItem(listing.id)
                      }
                      className="w-6 h-6 rounded-full border border-gray-200 text-gray-500 hover:bg-gray-50 text-xs font-bold"
                    >
                      −
                    </button>
                    <span className="text-sm w-4 text-center">{quantity}</span>
                    <button
                      aria-label="increase quantity"
                      disabled={quantity >= listing.quantityAvailable}
                      onClick={() => updateQuantity(listing.id, quantity + 1)}
                      className="w-6 h-6 rounded-full border border-gray-200 text-gray-500 hover:bg-gray-50 text-xs font-bold disabled:opacity-40"
                    >
                      +
                    </button>
                  </div>
                </div>

                <div className="text-right shrink-0">
                  <p className="text-sm font-semibold text-gray-800">
                    {listing.priceCents != null ? fmt(listing.priceCents * quantity) : '—'}
                  </p>
                  <button
                    onClick={() => removeItem(listing.id)}
                    className="text-xs text-red-400 hover:text-red-600 mt-1"
                  >
                    Remove
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {/* Totals */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 space-y-2 text-sm">
          <div className="flex justify-between text-gray-600">
            <span>Subtotal</span>
            <span>{fmt(subtotalCents)}</span>
          </div>
          <div className="flex justify-between text-gray-600">
            <span>Service fee ({feePercent}%)</span>
            <span>{fmt(feeCents)}</span>
          </div>
          <div className="flex justify-between font-bold text-gray-800 pt-2 border-t border-gray-100">
            <span>Total</span>
            <span>{fmt(totalCents)}</span>
          </div>
        </div>

        <button
          onClick={() => navigate('/checkout')}
          className="w-full bg-garden-600 hover:bg-garden-700 text-white font-semibold py-3 rounded-xl transition-colors"
        >
          Proceed to Checkout
        </button>
      </div>
    </div>
  );
}
