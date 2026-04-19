import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../lib/api';
import { ListingCard } from '../components/ListingCard';
import { ListingsMapView } from '../components/ListingsMapView';

interface Listing {
  id: string;
  title: string;
  description?: string | null;
  category: string;
  price_cents?: number | null;
  quantity_available: number;
  location_zip: string;
  location_lat: number | null;
  location_lng: number | null;
  images: string[];
  ready_to_deliver: boolean;
  pickup_date?: string | null;
  pickup_time?: string | null;
  pickup_location?: string | null;
  distance_miles?: number;
}

const CATEGORIES = ['vegetable', 'fruit', 'flower', 'egg', 'other'];

export default function ListingsPage() {
  const [q, setQ] = useState('');
  const [zip, setZip] = useState('');
  const [radius, setRadius] = useState(25);
  const [category, setCategory] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'map'>('grid');
  const [submitted, setSubmitted] = useState<{
    q: string; zip: string; radius: number; category: string;
  }>({ q: '', zip: '', radius: 25, category: '' });

  const params = new URLSearchParams();
  if (submitted.q) params.set('q', submitted.q);
  if (submitted.zip) {
    params.set('zip', submitted.zip);
    params.set('radius_miles', String(submitted.radius));
  }
  if (submitted.category) params.set('category', submitted.category);

  const { data, isLoading, isError } = useQuery({
    queryKey: ['listings', submitted],
    queryFn: async () => {
      const res = await apiClient.get<{ data: Listing[]; total: number }>(
        `/listings?${params.toString()}`
      );
      return res.data;
    },
  });

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitted({ q, zip, radius, category });
  };

  return (
    <div className="min-h-screen bg-garden-50">
      <div className="max-w-5xl mx-auto px-4 py-8">
        <h1 className="text-2xl font-bold text-garden-700 mb-6">Browse Listings</h1>

        <form
          onSubmit={handleSearch}
          className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 mb-8 flex flex-wrap gap-3 items-end"
        >
          <div className="flex-1 min-w-[180px]">
            <label className="block text-xs font-medium text-gray-600 mb-1">Keyword</label>
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="e.g. zucchini"
              className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-garden-500"
            />
          </div>
          <div className="min-w-[120px]">
            <label className="block text-xs font-medium text-gray-600 mb-1">ZIP code</label>
            <input
              value={zip}
              onChange={(e) => setZip(e.target.value)}
              placeholder="88001"
              maxLength={5}
              className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-garden-500"
            />
          </div>
          <div className="min-w-[160px]">
            <label className="block text-xs font-medium text-gray-600 mb-1">
              Radius: {radius} miles
            </label>
            <input
              type="range"
              min={5} max={100} step={5}
              value={radius}
              onChange={(e) => setRadius(Number(e.target.value))}
              className="w-full accent-garden-600"
              disabled={!zip}
            />
          </div>
          <div className="min-w-[140px]">
            <label className="block text-xs font-medium text-gray-600 mb-1">Category</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full border rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-garden-500"
            >
              <option value="">All categories</option>
              {CATEGORIES.map((c) => (
                <option key={c} value={c} className="capitalize">{c}</option>
              ))}
            </select>
          </div>
          <button
            type="submit"
            className="bg-garden-600 hover:bg-garden-700 text-white font-semibold px-5 py-2 rounded-lg text-sm"
          >
            Search
          </button>
        </form>

        {isLoading && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="bg-white rounded-2xl h-64 animate-pulse" />
            ))}
          </div>
        )}
        {isError && (
          <p className="text-red-500 text-center">Failed to load listings. Try again.</p>
        )}

        {data && (
          <>
            <div className="flex items-center justify-between mb-4">
              <p className="text-sm text-gray-500">
                {data.total} result{data.total !== 1 ? 's' : ''}
              </p>
              {data.total > 0 && (
                <div className="flex rounded-lg border border-gray-200 overflow-hidden text-sm">
                  <button
                    onClick={() => setViewMode('grid')}
                    className={`px-4 py-1.5 font-medium transition-colors ${
                      viewMode === 'grid'
                        ? 'bg-garden-600 text-white'
                        : 'bg-white text-gray-600 hover:bg-garden-50'
                    }`}
                  >
                    Grid
                  </button>
                  <button
                    onClick={() => setViewMode('map')}
                    className={`px-4 py-1.5 font-medium transition-colors border-l border-gray-200 ${
                      viewMode === 'map'
                        ? 'bg-garden-600 text-white'
                        : 'bg-white text-gray-600 hover:bg-garden-50'
                    }`}
                  >
                    Map
                  </button>
                </div>
              )}
            </div>

            {data.total === 0 ? (
              <div className="text-center py-16">
                <p className="text-4xl mb-3">🌱</p>
                <p className="text-gray-500">
                  No listings match your search. Try a broader radius or different keyword.
                </p>
              </div>
            ) : viewMode === 'map' ? (
              <ListingsMapView key={JSON.stringify(submitted)} listings={data.data} />
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {data.data.map((listing) => (
                  <ListingCard key={listing.id} {...listing} />
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
