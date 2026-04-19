import { useState } from 'react';
import { Link } from 'react-router-dom';
import { apiClient } from '../lib/api';
import { ListingCard } from '../components/ListingCard';
import { useCartStore } from '../stores/cartStore';
import type { AISearchResponse, Listing } from '@community-garden/types';



function SkeletonCard() {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 animate-pulse space-y-3">
      <div className="h-40 bg-gray-100 rounded-xl" />
      <div className="h-4 bg-gray-100 rounded w-3/4" />
      <div className="h-3 bg-gray-100 rounded w-1/2" />
    </div>
  );
}

function toListingShape(raw: any): Listing {
  return {
    id:                raw.id,
    producerId:        raw.producer_id,
    title:             raw.title,
    description:       raw.description ?? undefined,
    category:          raw.category,
    priceCents:        raw.price_cents ?? undefined,
    quantityAvailable: raw.quantity_available,
    exchangeFor:       raw.exchange_for ?? undefined,
    locationZip:       raw.location_zip,
    locationLat:       raw.location_lat ?? undefined,
    locationLng:       raw.location_lng ?? undefined,
    images:            raw.images ?? [],
    isAvailable:       raw.is_available,
    readyToDeliver:    raw.ready_to_deliver ?? true,
    pickupDate:        raw.pickup_date ?? undefined,
    pickupTime:        raw.pickup_time ?? undefined,
    pickupLocation:    raw.pickup_location ?? undefined,
    distanceMiles:     raw.distance_miles ?? undefined,
    createdAt:         raw.created_at,
  };
}

export default function AISearchPage() {
  const [query, setQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<AISearchResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const addItem = useCartStore((s) => s.addItem);
  const setLastAISearch = useCartStore((s) => s.setLastAISearch);
  const lastAISearchResults = useCartStore((s) => s.lastAISearchResults);
  const lastAISearchQuery = useCartStore((s) => s.lastAISearchQuery);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim().length < 2) return;
    setIsLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await apiClient.post<AISearchResponse>('/ai/search', { query: query.trim() });
      setResult(res.data);
      setLastAISearch(query.trim(), res.data);
    } catch {
      setError('Search failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-garden-50">
      <div className="max-w-3xl mx-auto px-4 py-10 space-y-6">
        <div className="text-center space-y-1">
          <h1 className="text-3xl font-bold text-garden-700">Find Fresh Produce</h1>
          <p className="text-gray-500 text-sm">Ask in plain language — AI will find what's nearby.</p>
        </div>

        <form onSubmit={handleSearch} className="flex gap-2">
          <textarea
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder='e.g. "fresh zucchini near me" or "I need 5 lbs of tomatoes"'
            rows={2}
            className="flex-1 border border-gray-200 rounded-xl px-4 py-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-garden-500"
          />
          <button
            type="submit"
            disabled={query.trim().length < 2 || isLoading}
            className="bg-garden-600 hover:bg-garden-700 text-white font-semibold px-5 rounded-xl disabled:opacity-50 disabled:cursor-not-allowed transition-colors shrink-0"
          >
            {isLoading ? '…' : 'Search'}
          </button>
        </form>

        {error && (
          <div className="space-y-3">
            <div className="bg-red-50 border border-red-100 rounded-xl px-4 py-3 text-sm text-red-700 flex items-center justify-between">
              <span>{error}</span>
              <Link to="/browse" className="underline text-red-600 shrink-0 ml-3">
                Try standard search →
              </Link>
            </div>
            {lastAISearchResults && lastAISearchQuery && (
              <div className="space-y-3">
                <div className="bg-yellow-50 border border-yellow-200 rounded-xl px-4 py-2 text-sm text-yellow-800">
                  Showing cached results from your last search — "{lastAISearchQuery}"
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {lastAISearchResults.results.map((raw: any) => {
                    const listing = toListingShape(raw);
                    return (
                      <ListingCard
                        key={listing.id}
                        id={listing.id}
                        title={listing.title}
                        description={listing.description}
                        category={listing.category}
                        price_cents={listing.priceCents}
                        quantity_available={listing.quantityAvailable}
                        location_zip={listing.locationZip}
                        images={listing.images}
                        ready_to_deliver={listing.readyToDeliver}
                        pickup_date={listing.pickupDate}
                        pickup_time={listing.pickupTime}
                        pickup_location={listing.pickupLocation}
                        distance_miles={listing.distanceMiles}
                        onAddToCart={() => addItem(listing, 1)}
                      />
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {isLoading && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} />)}
          </div>
        )}

        {result && !isLoading && (
          <div className="space-y-4">
            <div className="bg-garden-50 border border-garden-100 rounded-xl px-4 py-3 text-sm text-garden-800">
              {result.explanation}
              {result.intent === 'fallback' && (
                <Link to="/browse" className="ml-2 underline text-garden-600">
                  Try standard search →
                </Link>
              )}
            </div>

            {result.results.length === 0 ? (
              <div className="text-center py-10 text-gray-400 text-sm">
                No listings found.{' '}
                <Link to="/browse" className="underline text-garden-600">Browse all →</Link>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {result.results.map((raw: any) => {
                  const listing = toListingShape(raw);
                  return (
                    <ListingCard
                      key={listing.id}
                      id={listing.id}
                      title={listing.title}
                      description={listing.description}
                      category={listing.category}
                      price_cents={listing.priceCents}
                      quantity_available={listing.quantityAvailable}
                      location_zip={listing.locationZip}
                      images={listing.images}
                      ready_to_deliver={listing.readyToDeliver}
                      pickup_date={listing.pickupDate}
                      pickup_time={listing.pickupTime}
                      pickup_location={listing.pickupLocation}
                      distance_miles={listing.distanceMiles}
                      onAddToCart={() => addItem(listing, 1)}
                    />
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
