import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../lib/api';

const API_BASE = import.meta.env.VITE_API_URL?.replace('/api/v1', '') ?? 'http://localhost:3000';

interface ListingDetail {
  id: string;
  title: string;
  description: string | null;
  category: string;
  price_cents: number | null;
  quantity_available: number;
  location_zip: string;
  images: string[];
  ready_to_deliver: boolean;
  pickup_date: string | null;
  pickup_time: string | null;
  pickup_location: string | null;
  producer_name?: string;
  exchange_for?: string | null;
}

function formatPickupDate(date: string, time: string) {
  return new Date(`${date}T${time}`).toLocaleString([], {
    weekday: 'long', month: 'long', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

export default function CheckoutPage() {
  const { listingId } = useParams<{ listingId: string }>();
  const navigate = useNavigate();
  const [qty, setQty] = useState(1);
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [placing, setPlacing] = useState(false);

  const { data: listing, isLoading, isError } = useQuery<ListingDetail>({
    queryKey: ['listing', listingId],
    queryFn: async () => {
      const res = await apiClient.get(`/listings/${listingId}`);
      return res.data;
    },
    enabled: !!listingId,
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-garden-50 flex items-center justify-center">
        <div className="animate-pulse text-garden-600 text-sm">Loading listing…</div>
      </div>
    );
  }

  if (isError || !listing) {
    return (
      <div className="min-h-screen bg-garden-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-500 text-sm mb-3">Could not load listing.</p>
          <button onClick={() => navigate(-1)} className="text-sm text-garden-600 underline">
            Go back
          </button>
        </div>
      </div>
    );
  }

  const imageSrc = listing.images[0] ? `${API_BASE}${listing.images[0]}` : null;
  const priceDisplay = listing.price_cents != null
    ? `$${(listing.price_cents / 100).toFixed(2)} per unit`
    : listing.exchange_for
      ? `Exchange for: ${listing.exchange_for}`
      : 'Free';
  const total = listing.price_cents != null
    ? `$${((listing.price_cents * qty) / 100).toFixed(2)}`
    : null;

  const canPlace = listing.ready_to_deliver ? deliveryAddress.trim().length > 5 : true;

  const handlePlaceOrder = async () => {
    if (!listing || !listingId) return;
    setPlacing(true);
    try {
      const payload = {
        items: [{ listingId, quantity: qty }],
        ...(listing.ready_to_deliver && deliveryAddress ? { delivery_address: deliveryAddress } : {}),
      };
      const { data } = await apiClient.post('/orders', payload);
      await apiClient.post(`/orders/${data.orderId}/confirm`);
      navigate(`/orders/${data.orderId}/confirmation`);
    } catch {
      setPlacing(false);
    }
  };

  return (
    <div className="min-h-screen bg-garden-50 py-8">
      <div className="max-w-lg mx-auto px-4 space-y-4">
        <button onClick={() => navigate(-1)} className="text-sm text-garden-600 hover:underline">
          ← Back
        </button>

        <h1 className="text-2xl font-bold text-garden-700">Checkout</h1>

        {/* Listing summary */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          {imageSrc && (
            <img src={imageSrc} alt={listing.title} className="w-full h-48 object-cover" />
          )}
          <div className="p-4 space-y-1">
            <div className="flex items-start justify-between gap-2">
              <h2 className="font-semibold text-gray-800">{listing.title}</h2>
              <span className="text-xs text-garden-700 bg-garden-50 px-2 py-0.5 rounded-full capitalize shrink-0">
                {listing.category}
              </span>
            </div>
            {listing.description && (
              <p className="text-xs text-gray-500">{listing.description}</p>
            )}
            {listing.producer_name && (
              <p className="text-xs text-gray-400">Sold by {listing.producer_name}</p>
            )}
            <p className="font-bold text-garden-700 pt-1">{priceDisplay}</p>

            {/* Delivery/pickup badge */}
            {listing.ready_to_deliver ? (
              <span className="inline-flex items-center gap-1 text-xs font-medium text-green-700 bg-green-50 px-2 py-0.5 rounded-full">
                ✓ Producer delivers
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full">
                ↗ Pickup only
              </span>
            )}
          </div>
        </div>

        {/* Quantity */}
        {listing.price_cents != null && (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">Quantity</label>
            <div className="flex items-center gap-3">
              <button
                onClick={() => setQty((q) => Math.max(1, q - 1))}
                className="w-8 h-8 rounded-full border border-gray-200 text-gray-600 hover:bg-gray-50 font-bold"
              >
                −
              </button>
              <span className="text-sm font-semibold w-6 text-center">{qty}</span>
              <button
                onClick={() => setQty((q) => Math.min(listing.quantity_available, q + 1))}
                className="w-8 h-8 rounded-full border border-gray-200 text-gray-600 hover:bg-gray-50 font-bold"
              >
                +
              </button>
              <span className="text-xs text-gray-400">{listing.quantity_available} available</span>
            </div>
            {total && (
              <p className="text-sm font-bold text-garden-700 mt-2">Total: {total}</p>
            )}
          </div>
        )}

        {/* Delivery address or pickup info */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
          {listing.ready_to_deliver ? (
            <>
              <label htmlFor="delivery-address" className="block text-sm font-medium text-gray-700 mb-1">
                Delivery Address <span className="text-red-500">*</span>
              </label>
              <p className="text-xs text-gray-400 mb-2">
                The producer will deliver your order to this address.
              </p>
              <input
                id="delivery-address"
                type="text"
                value={deliveryAddress}
                onChange={(e) => setDeliveryAddress(e.target.value)}
                placeholder="e.g. 123 Main St, Las Cruces, NM 88001"
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-garden-500"
              />
            </>
          ) : (
            <>
              <h3 className="text-sm font-medium text-gray-700 mb-3">Pickup Information</h3>
              {listing.pickup_date && listing.pickup_time ? (
                <div className="space-y-2 text-sm">
                  <div className="flex gap-2 items-start">
                    <span className="text-amber-600 shrink-0">📅</span>
                    <div>
                      <p className="font-medium text-gray-700">When</p>
                      <p className="text-gray-500 text-xs">
                        {formatPickupDate(listing.pickup_date, listing.pickup_time)}
                      </p>
                    </div>
                  </div>
                  {listing.pickup_location && (
                    <div className="flex gap-2 items-start">
                      <span className="text-amber-600 shrink-0">📍</span>
                      <div>
                        <p className="font-medium text-gray-700">Where</p>
                        <p className="text-gray-500 text-xs">{listing.pickup_location}</p>
                      </div>
                    </div>
                  )}
                  <p className="text-xs text-amber-700 bg-amber-50 rounded-lg px-3 py-2 mt-1">
                    Please arrive during the pickup window set by the producer.
                  </p>
                </div>
              ) : (
                <p className="text-xs text-gray-400">
                  Pickup details not provided. Contact the producer for more info.
                </p>
              )}
            </>
          )}
        </div>

        {/* Place order */}
        <button
          onClick={handlePlaceOrder}
          disabled={!canPlace || placing}
          className="w-full bg-garden-600 hover:bg-garden-700 text-white font-semibold py-3 rounded-xl disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {placing ? 'Placing order…' : 'Place Order'}
        </button>
        {listing.ready_to_deliver && !canPlace && (
          <p className="text-xs text-red-500 text-center">Please enter a delivery address to continue.</p>
        )}
      </div>
    </div>
  );
}
