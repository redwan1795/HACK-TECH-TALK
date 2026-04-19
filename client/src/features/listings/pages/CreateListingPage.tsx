import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { createListing } from '../api';
import type { Category } from '../../../shared/types';

const CATEGORIES: { value: Category; label: string; emoji: string }[] = [
  { value: 'vegetable', label: 'Vegetable', emoji: '🥦' },
  { value: 'fruit',     label: 'Fruit',     emoji: '🍎' },
  { value: 'herb',      label: 'Herb',      emoji: '🌿' },
  { value: 'flower',    label: 'Flower',    emoji: '🌸' },
  { value: 'egg',       label: 'Egg',       emoji: '🥚' },
  { value: 'dairy',     label: 'Dairy',     emoji: '🥛' },
  { value: 'other',     label: 'Other',     emoji: '📦' },
];

export default function CreateListingPage() {
  const nav = useNavigate();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<Category>('vegetable');
  const [priceDollars, setPriceDollars] = useState('');
  const [unit, setUnit] = useState('lb');
  const [quantityAvailable, setQuantityAvailable] = useState('1');
  const [isExchange, setIsExchange] = useState(false);
  const [exchangeFor, setExchangeFor] = useState('');
  const [locationZip, setLocationZip] = useState('');
  const [images, setImages] = useState<File[]>([]);

  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const created = await createListing({
        title,
        description: description || undefined,
        category,
        priceCents: isExchange || !priceDollars
          ? undefined
          : Math.round(parseFloat(priceDollars) * 100),
        unit,
        quantityAvailable: parseInt(quantityAvailable, 10),
        exchangeFor: isExchange && exchangeFor ? exchangeFor : undefined,
        locationZip,
        images,
      });
      nav(`/listing/${created.id}`);
    } catch (err: any) {
      setError(err.response?.data?.error?.message ?? 'Failed to create listing');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="max-w-2xl mx-auto px-6 py-8">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Create a listing</h1>

      <form onSubmit={onSubmit} className="bg-white rounded-xl shadow-card p-6 space-y-5">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Title *</label>
          <input
            type="text" value={title} required maxLength={200}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-500 outline-none"
            placeholder="Fresh Zucchini"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
          <textarea
            value={description} maxLength={2000} rows={3}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-500 outline-none"
            placeholder="Tell consumers about your produce…"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Category *</label>
          <div className="grid grid-cols-4 gap-2">
            {CATEGORIES.map((c) => (
              <button
                key={c.value}
                type="button"
                onClick={() => setCategory(c.value)}
                className={`p-3 rounded-lg border-2 text-sm font-medium transition ${
                  category === c.value
                    ? 'border-brand-500 bg-brand-50 text-brand-700'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <div className="text-xl">{c.emoji}</div>
                <div className="mt-1">{c.label}</div>
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox" checked={isExchange}
              onChange={(e) => setIsExchange(e.target.checked)}
              className="w-4 h-4 text-brand-600"
            />
            <span className="text-sm">Exchange / barter only (no price)</span>
          </label>
        </div>

        {!isExchange && (
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Price ($) *</label>
              <input
                type="number" step="0.01" min="0" value={priceDollars} required={!isExchange}
                onChange={(e) => setPriceDollars(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-500 outline-none"
                placeholder="3.00"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Unit</label>
              <input
                type="text" value={unit}
                onChange={(e) => setUnit(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-500 outline-none"
                placeholder="lb"
              />
            </div>
          </div>
        )}

        {isExchange && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Willing to exchange for</label>
            <input
              type="text" value={exchangeFor} maxLength={200}
              onChange={(e) => setExchangeFor(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-500 outline-none"
              placeholder="tomatoes, eggs, or seedlings"
            />
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Quantity *</label>
            <input
              type="number" min="0" value={quantityAvailable} required
              onChange={(e) => setQuantityAvailable(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-500 outline-none"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">ZIP *</label>
            <input
              type="text" value={locationZip} required pattern="\d{5}" maxLength={5}
              onChange={(e) => setLocationZip(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-500 outline-none"
              placeholder="88001"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Photos <span className="text-gray-400 text-xs">(optional, up to 5)</span>
          </label>
          <input
            type="file" accept="image/*" multiple
            onChange={(e) => setImages(Array.from(e.target.files ?? []).slice(0, 5))}
            className="w-full text-sm"
          />
          {images.length > 0 && (
            <p className="text-xs text-gray-500 mt-1">{images.length} file{images.length !== 1 ? 's' : ''} selected</p>
          )}
        </div>

        {error && (
          <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</div>
        )}

        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => nav('/producer')}
            className="px-4 py-2.5 border border-gray-300 text-gray-700 rounded-lg font-medium"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={loading}
            className="flex-1 bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white font-semibold py-2.5 rounded-lg"
          >
            {loading ? 'Publishing…' : 'Publish listing'}
          </button>
        </div>
      </form>
    </main>
  );
}
