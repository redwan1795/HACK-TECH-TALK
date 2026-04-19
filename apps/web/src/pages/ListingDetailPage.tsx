import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../lib/api';
import { useCartStore } from '../stores/cartStore';
import { useAuthStore } from '../stores/authStore';
import { SubscriptionModal } from '../components/SubscriptionModal';
import type { Listing } from '@community-garden/types';

const API_BASE = (import.meta as any).env?.VITE_API_URL?.replace('/api/v1', '') ?? 'http://localhost:3000';
const CATEGORY_EMOJI: Record<string, string> = {
  vegetable: '🥦', fruit: '🍎', flower: '🌸', egg: '🥚', other: '🌿',
};

function toListingShape(raw: any): Listing {
  return {
    id: raw.id,
    producerId: raw.producer_id,
    title: raw.title,
    description: raw.description ?? undefined,
    category: raw.category,
    priceCents: raw.price_cents ?? undefined,
    quantityAvailable: raw.quantity_available,
    exchangeFor: raw.exchange_for ?? undefined,
    locationZip: raw.location_zip,
    locationLat: raw.location_lat ?? undefined,
    locationLng: raw.location_lng ?? undefined,
    images: raw.images ?? [],
    isAvailable: raw.is_available,
    readyToDeliver: raw.ready_to_deliver ?? true,
    pickupDate: raw.pickup_date ?? undefined,
    pickupTime: raw.pickup_time ?? undefined,
    pickupLocation: raw.pickup_location ?? undefined,
    distanceMiles: raw.distance_miles ?? undefined,
    createdAt: raw.created_at,
  };
}

export default function ListingDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuthStore();
  const addItem = useCartStore((s) => s.addItem);
  const [showSubscribeModal, setShowSubscribeModal] = useState(false);
  const [addedToCart, setAddedToCart] = useState(false);

  const { data, isLoading, isError } = useQuery({
    queryKey: ['listing', id],
    queryFn: async () => {
      const res = await apiClient.get(`/listings/${id}`);
      return toListingShape(res.data);
    },
    enabled: !!id,
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-garden-50">
        <div className="max-w-2xl mx-auto px-4 py-10 space-y-4">
          <div className="h-64 bg-gray-100 rounded-2xl animate-pulse" />
          <div className="h-6 bg-gray-100 rounded w-2/3 animate-pulse" />
          <div className="h-4 bg-gray-100 rounded w-1/3 animate-pulse" />
          <div className="h-4 bg-gray-100 rounded w-1/2 animate-pulse" />
        </div>
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="min-h-screen bg-garden-50 flex items-center justify-center">
        <div className="text-center p-8">
          <p className="text-gray-500">Listing not found.</p>
          <Link to="/browse" className="mt-4 inline-block text-garden-600 underline text-sm">
            Browse all listings
          </Link>
        </div>
      </div>
    );
  }

  const imageSrc = data.images[0] ? `${API_BASE}${data.images[0]}` : null;
  const priceDisplay = data.priceCents != null
    ? `$${(data.priceCents / 100).toFixed(2)}`
    : 'Free / Exchange';

  const handleAddToCart = () => {
    addItem(data, 1);
    setAddedToCart(true);
    setTimeout(() => setAddedToCart(false), 2000);
  };

  return (
    <div className="min-h-screen bg-garden-50">
      <div className="max-w-2xl mx-auto px-4 py-10 space-y-6">
        <Link to="/browse" className="text-sm text-garden-600 hover:underline">
          ← Back to listings
        </Link>

        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="h-64 bg-garden-50 flex items-center justify-center overflow-hidden">
            {imageSrc ? (
              <img src={imageSrc} alt={data.title} className="w-full h-full object-cover" />
            ) : (
              <span className="text-7xl">{CATEGORY_EMOJI[data.category] ?? '🌿'}</span>
            )}
          </div>

          <div className="p-6 space-y-4">
            <div className="flex items-start justify-between gap-3">
              <h1 className="text-xl font-bold text-gray-800">{data.title}</h1>
              <span className="text-xs text-garden-700 bg-garden-50 px-2 py-1 rounded-full capitalize shrink-0">
                {data.category}
              </span>
            </div>

            {data.description && (
              <p className="text-sm text-gray-600">{data.description}</p>
            )}

            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="bg-gray-50 rounded-lg p-3">
                <p className="text-xs text-gray-400">Price</p>
                <p className="font-bold text-garden-700 text-base mt-0.5">{priceDisplay}</p>
              </div>
              <div className="bg-gray-50 rounded-lg p-3">
                <p className="text-xs text-gray-400">Available</p>
                <p className="font-semibold text-gray-800 mt-0.5">{data.quantityAvailable} units</p>
              </div>
              <div className="bg-gray-50 rounded-lg p-3">
                <p className="text-xs text-gray-400">ZIP Code</p>
                <p className="font-semibold text-gray-800 mt-0.5">{data.locationZip}</p>
              </div>
              {data.distanceMiles != null && (
                <div className="bg-gray-50 rounded-lg p-3">
                  <p className="text-xs text-gray-400">Distance</p>
                  <p className="font-semibold text-gray-800 mt-0.5">{data.distanceMiles} mi away</p>
                </div>
              )}
            </div>

            {!data.readyToDeliver && data.pickupDate && data.pickupTime && data.pickupLocation && (
              <div className="bg-amber-50 rounded-lg px-3 py-2 text-sm text-amber-800">
                Pickup: {new Date(`${data.pickupDate}T${data.pickupTime}`).toLocaleString([], {
                  month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
                })} · {data.pickupLocation}
              </div>
            )}

            <div className="flex gap-3 pt-2">
              <button
                onClick={handleAddToCart}
                disabled={!data.isAvailable || data.quantityAvailable === 0}
                className="flex-1 bg-garden-600 hover:bg-garden-700 disabled:opacity-50 text-white text-sm font-semibold py-2.5 rounded-xl transition-colors"
              >
                {addedToCart ? 'Added!' : 'Add to Cart'}
              </button>

              {user?.role === 'consumer' && data.priceCents != null && (
                <button
                  onClick={() => setShowSubscribeModal(true)}
                  className="flex-1 border border-garden-300 text-garden-700 text-sm font-semibold py-2.5 rounded-xl hover:bg-garden-50 transition-colors"
                >
                  Subscribe
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {showSubscribeModal && data.priceCents != null && (
        <SubscriptionModal
          listingId={data.id}
          listingTitle={data.title}
          pricePerUnit={data.priceCents}
          onClose={() => setShowSubscribeModal(false)}
        />
      )}
    </div>
  );
}
