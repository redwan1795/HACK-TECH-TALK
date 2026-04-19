import { useEffect, useState } from 'react';
import { fetchAggregate, type AggregateProducer } from '../api';
import { useCartStore } from '../../../shared/stores/cartStore';
import { formatCurrency } from '../../../shared/utils/formatCurrency';
import { Link } from 'react-router-dom';

export default function BrokerDashboard() {
  const [producers, setProducers] = useState<AggregateProducer[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const addItem = useCartStore((s) => s.addItem);
  const cartItems = useCartStore((s) => s.items);

  useEffect(() => {
    fetchAggregate()
      .then(setProducers)
      .catch((e) => setError(e.response?.data?.error?.message ?? 'Failed to load'));
  }, []);

  function addProducerBundle(p: AggregateProducer) {
    // Add 1 of each listing from this producer (cap at 3 for demo)
    const picks = p.listings.slice(0, 3);
    picks.forEach((l) => {
      addItem({
        listingId: l.id,
        title: l.title,
        priceCents: l.priceCents,
        unit: l.unit,
        quantity: 1,
        producerName: p.producer_name,
        category: l.category,
        maxQuantity: l.quantityAvailable,
      });
    });
  }

  return (
    <main className="max-w-6xl mx-auto px-6 py-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Broker Dashboard</h1>
          <p className="text-sm text-gray-500 mt-1">
            Aggregate orders across multiple producers in a single basket.
          </p>
        </div>
        <Link
          to="/cart"
          className="bg-brand-600 hover:bg-brand-700 text-white px-4 py-2 rounded-lg font-semibold"
        >
          View cart ({cartItems.length})
        </Link>
      </div>

      {error && <div className="bg-red-50 border border-red-200 text-red-800 rounded-lg p-4 mb-4">{error}</div>}
      {producers === null && <p className="text-gray-500">Loading producers…</p>}

      {producers && producers.length === 0 && (
        <div className="bg-white rounded-xl shadow-card p-10 text-center">
          <div className="text-5xl mb-3">🌾</div>
          <p className="text-gray-500">No producers with active listings yet.</p>
        </div>
      )}

      {producers && producers.length > 0 && (
        <div className="space-y-4">
          {producers.map((p) => (
            <div key={p.producer_id} className="bg-white rounded-xl shadow-card p-5">
              <div className="flex items-start justify-between gap-4 mb-4">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-gray-900">{p.producer_name}</h3>
                    {p.licensed && (
                      <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded">
                        ✓ Verified
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-gray-500 mt-0.5">
                    📍 ZIP {p.producer_zip} · {p.listing_count} active listings
                    · {p.total_quantity} total items
                    · {formatCurrency(p.min_price_cents)}–{formatCurrency(p.max_price_cents)}
                  </p>
                </div>
                <button
                  onClick={() => addProducerBundle(p)}
                  className="bg-brand-600 hover:bg-brand-700 text-white px-4 py-2 rounded-lg font-semibold text-sm whitespace-nowrap"
                >
                  + Bundle to cart
                </button>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                {p.listings.map((l) => (
                  <div key={l.id} className="border border-gray-200 rounded-lg p-3 text-sm">
                    <div className="font-medium text-gray-900 truncate">{l.title}</div>
                    <div className="text-xs text-gray-500 mt-0.5 capitalize">{l.category}</div>
                    <div className="flex justify-between items-baseline mt-2">
                      <div className="font-bold text-gray-900">{formatCurrency(l.priceCents)}</div>
                      <div className="text-xs text-gray-500">x{l.quantityAvailable}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
