import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { listMyFutureOrders, cancelFutureOrder, type FutureOrder } from '../api';

const STATUS_STYLES: Record<string, string> = {
  open:      'bg-blue-100 text-blue-700',
  matched:   'bg-green-100 text-green-700',
  fulfilled: 'bg-purple-100 text-purple-700',
  expired:   'bg-gray-100 text-gray-600',
  cancelled: 'bg-gray-100 text-gray-500',
};

const STATUS_ICONS: Record<string, string> = {
  open: '🔔', matched: '✓', fulfilled: '✓', expired: '⌛', cancelled: '✕',
};

export default function FutureOrdersListPage() {
  const [items, setItems] = useState<FutureOrder[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    try {
      setItems(await listMyFutureOrders());
    } catch (e: any) {
      setError(e.response?.data?.error?.message ?? 'Failed to load');
    }
  }

  useEffect(() => { load(); }, []);

  async function onCancel(id: string) {
    if (!confirm('Cancel this demand signal?')) return;
    try {
      await cancelFutureOrder(id);
      load();
    } catch (e: any) {
      alert(e.response?.data?.error?.message ?? 'Failed');
    }
  }

  return (
    <main className="max-w-4xl mx-auto px-6 py-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Future Orders</h1>
          <p className="text-sm text-gray-500 mt-1">Demand signals you've posted</p>
        </div>
        <Link
          to="/future-orders/new"
          className="bg-brand-600 hover:bg-brand-700 text-white px-4 py-2 rounded-lg font-semibold"
        >
          + New demand
        </Link>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-800 rounded-lg p-4 mb-4">{error}</div>
      )}

      {items === null && <p className="text-gray-500">Loading…</p>}

      {items && items.length === 0 && (
        <div className="bg-white rounded-xl shadow-card p-10 text-center">
          <div className="text-5xl mb-3">🔔</div>
          <h2 className="text-lg font-semibold text-gray-900">No demand signals yet</h2>
          <p className="text-gray-500 mt-1">Tell growers what you're looking for and we'll notify you when it's listed nearby.</p>
          <Link
            to="/future-orders/new"
            className="inline-block mt-4 bg-brand-600 hover:bg-brand-700 text-white px-4 py-2 rounded-lg font-semibold"
          >
            + Post your first demand
          </Link>
        </div>
      )}

      {items && items.length > 0 && (
        <div className="space-y-3">
          {items.map((fo) => {
            const statusKey = fo.status.toLowerCase();
            const expired = new Date(fo.expiresAt).getTime() < Date.now();
            return (
              <div key={fo.id} className="bg-white rounded-xl shadow-card p-5">
                <div className="flex items-start gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className={`text-xs font-bold px-2 py-0.5 rounded-full uppercase ${STATUS_STYLES[statusKey] ?? ''}`}>
                        {STATUS_ICONS[statusKey]} {fo.status}
                      </span>
                      {fo.category && (
                        <span className="text-xs bg-brand-100 text-brand-700 px-2 py-0.5 rounded-full capitalize">
                          {fo.category}
                        </span>
                      )}
                    </div>

                    <h3 className="font-semibold text-gray-900 mt-2 truncate">
                      Looking for {fo.quantityNeeded}× <span className="italic">{fo.productQuery}</span>
                    </h3>

                    <p className="text-sm text-gray-500 mt-1">
                      Within {fo.proximityMiles} mi
                      {fo.locationZip && ` of ${fo.locationZip}`}
                      · Expires {new Date(fo.expiresAt).toLocaleDateString()}
                      {expired && fo.status === 'open' && ' (expired — will auto-close)'}
                    </p>

                    {fo.matchedListingId && (
                      <Link
                        to={`/listing/${fo.matchedListingId}`}
                        className="inline-block mt-2 text-sm text-brand-600 font-semibold hover:underline"
                      >
                        View matched listing →
                      </Link>
                    )}
                  </div>

                  {fo.status === 'open' && (
                    <button
                      onClick={() => onCancel(fo.id)}
                      className="text-sm text-gray-400 hover:text-red-600"
                    >
                      Cancel
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </main>
  );
}
