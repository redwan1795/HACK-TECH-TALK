import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { createFutureOrder } from '../api';
import type { Category } from '../../../shared/types';

const CATEGORIES: { value: Category | ''; label: string; emoji: string }[] = [
  { value: '',          label: 'Any',        emoji: '🌾' },
  { value: 'vegetable', label: 'Vegetable',  emoji: '🥦' },
  { value: 'fruit',     label: 'Fruit',      emoji: '🍎' },
  { value: 'herb',      label: 'Herb',       emoji: '🌿' },
  { value: 'flower',    label: 'Flower',     emoji: '🌸' },
  { value: 'egg',       label: 'Egg',        emoji: '🥚' },
  { value: 'dairy',     label: 'Dairy',      emoji: '🥛' },
  { value: 'other',     label: 'Other',      emoji: '📦' },
];

export default function FutureOrderPage() {
  const nav = useNavigate();

  const [productQuery, setProductQuery] = useState('');
  const [category, setCategory] = useState<Category | ''>('');
  const [quantityNeeded, setQuantityNeeded] = useState('1');
  const [proximityMiles, setProximityMiles] = useState('25');
  const [daysUntilExpiry, setDaysUntilExpiry] = useState('2');
  const [locationZip, setLocationZip] = useState('');

  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await createFutureOrder({
        productQuery,
        category: category || undefined,
        quantityNeeded: parseInt(quantityNeeded, 10),
        proximityMiles: parseInt(proximityMiles, 10),
        daysUntilExpiry: parseInt(daysUntilExpiry, 10),
        locationZip: locationZip || undefined,
      });
      nav('/future-orders');
    } catch (err: any) {
      setError(err.response?.data?.error?.message ?? 'Failed to post demand signal');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="max-w-2xl mx-auto px-6 py-8">
      <h1 className="text-2xl font-bold text-gray-900">Post a Future Order</h1>
      <p className="text-gray-500 mt-1 text-sm">
        Tell the community what you need. We'll notify you when a matching listing is published nearby.
      </p>

      <form onSubmit={onSubmit} className="mt-6 bg-white rounded-xl shadow-card p-6 space-y-5">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">What are you looking for? *</label>
          <input
            type="text" value={productQuery} required minLength={2} maxLength={200}
            onChange={(e) => setProductQuery(e.target.value)}
            className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-500 outline-none"
            placeholder="oranges"
          />
          <p className="text-xs text-gray-400 mt-1">Keywords — we'll match listings whose title or description contains these.</p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Category</label>
          <div className="grid grid-cols-4 gap-2">
            {CATEGORIES.map((c) => (
              <button
                key={c.value || 'any'}
                type="button"
                onClick={() => setCategory(c.value)}
                className={`p-2.5 rounded-lg border-2 text-xs font-medium transition ${
                  category === c.value
                    ? 'border-brand-500 bg-brand-50 text-brand-700'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <div className="text-lg">{c.emoji}</div>
                <div className="mt-0.5">{c.label}</div>
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Quantity needed</label>
            <input
              type="number" min="1" max="1000" value={quantityNeeded}
              onChange={(e) => setQuantityNeeded(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-500 outline-none"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">ZIP (optional)</label>
            <input
              type="text" value={locationZip} pattern="\d{5}" maxLength={5}
              onChange={(e) => setLocationZip(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-500 outline-none"
              placeholder="uses your profile ZIP if blank"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Search within (mi)</label>
            <select
              value={proximityMiles}
              onChange={(e) => setProximityMiles(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-500 outline-none"
            >
              <option value="5">5 miles</option>
              <option value="10">10 miles</option>
              <option value="25">25 miles</option>
              <option value="50">50 miles</option>
              <option value="100">100 miles</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Demand valid for (days)</label>
            <select
              value={daysUntilExpiry}
              onChange={(e) => setDaysUntilExpiry(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-500 outline-none"
            >
              <option value="1">1 day</option>
              <option value="2">2 days</option>
              <option value="3">3 days</option>
              <option value="7">1 week</option>
              <option value="14">2 weeks</option>
              <option value="30">30 days</option>
            </select>
          </div>
        </div>

        {error && (
          <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded px-3 py-2">{error}</div>
        )}

        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => nav('/future-orders')}
            className="px-4 py-2.5 border border-gray-300 text-gray-700 rounded-lg font-medium"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={loading}
            className="flex-1 bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white font-semibold py-2.5 rounded-lg"
          >
            {loading ? 'Posting…' : '🔔 Post demand signal'}
          </button>
        </div>
      </form>
    </main>
  );
}
