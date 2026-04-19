import { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { fetchListing } from '../api';
import type { Listing } from '../../../shared/types';
import { formatCurrency } from '../../../shared/utils/formatCurrency';
import { formatDistance } from '../../../shared/utils/formatDistance';
import { useCartStore } from '../../../shared/stores/cartStore';

export default function ListingDetailPage() {
  const { id } = useParams<{ id: string }>();
  const nav = useNavigate();
  const addItem = useCartStore((s) => s.addItem);

  const [listing, setListing] = useState<Listing | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [qty, setQty] = useState(1);

  useEffect(() => {
    if (!id) return;
    fetchListing(id).then(setListing).catch((e) =>
      setError(e.response?.data?.error?.message ?? e.message)
    );
  }, [id]);

  function onAddToCart() {
    if (!listing || listing.priceCents === null) return;
    addItem({
      listingId: listing.id,
      title: listing.title,
      priceCents: listing.priceCents,
      unit: listing.unit,
      quantity: qty,
      producerName: listing.producer.name ?? 'Unknown',
      category: listing.category,
      maxQuantity: listing.quantityAvailable,
    });
    nav('/cart');
  }

  if (error) {
    return (
      <div className="max-w-4xl mx-auto px-6 py-10">
        <div className="bg-red-50 border border-red-200 text-red-800 rounded-lg p-4">{error}</div>
        <Link to="/" className="text-brand-600 mt-4 inline-block">← Back to listings</Link>
      </div>
    );
  }

  if (!listing) {
    return <div className="max-w-4xl mx-auto px-6 py-10 text-gray-500">Loading…</div>;
  }

  const isExchange = listing.priceCents === null;
  const outOfStock = listing.quantityAvailable === 0;

  return (
    <main className="max-w-4xl mx-auto px-6 py-8">
      <Link to="/" className="text-sm text-brand-600 hover:underline">← Back to listings</Link>

      <div className="mt-4 bg-white rounded-xl shadow-card overflow-hidden md:flex">
        <div className="md:w-2/5 bg-brand-100 flex items-center justify-center text-9xl aspect-square">
          {listing.images.length > 0 ? (
            <img src={listing.images[0]} alt={listing.title} className="w-full h-full object-cover" />
          ) : (
            <span>📦</span>
          )}
        </div>

        <div className="flex-1 p-8">
          <span className="inline-block bg-brand-100 text-brand-700 text-xs font-bold px-2 py-0.5 rounded-full uppercase">
            {listing.category}
          </span>
          <h1 className="text-3xl font-bold text-gray-900 mt-3">{listing.title}</h1>
          <p className="text-gray-600 mt-1">
            by <span className="font-semibold">{listing.producer.name ?? 'Unknown'}</span>
            {listing.producer.licensed && (
              <span className="ml-2 text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded">✓ Verified</span>
            )}
          </p>

          {listing.description && (
            <p className="text-gray-700 mt-4">{listing.description}</p>
          )}

          <div className="mt-6 text-3xl font-bold text-gray-900">
            {formatCurrency(listing.priceCents, listing.unit)}
          </div>
          <p className={`text-sm mt-1 ${outOfStock ? 'text-red-600 font-semibold' : 'text-gray-600'}`}>
            {outOfStock
              ? 'Out of stock'
              : `${listing.quantityAvailable} ${listing.unit}${listing.quantityAvailable !== 1 ? 's' : ''} available`}
          </p>
          <p className="text-gray-500 mt-1 text-sm">
            📍 ZIP {listing.locationZip}
            {listing.distanceMiles !== null && <> · {formatDistance(listing.distanceMiles)} away</>}
          </p>

          {!isExchange && !outOfStock && (
            <div className="mt-6 flex items-center gap-3">
              <div className="flex items-center gap-2 border border-gray-300 rounded-lg">
                <button
                  onClick={() => setQty(Math.max(1, qty - 1))}
                  className="w-10 h-10 text-gray-700 hover:bg-gray-50 rounded-l-lg"
                >–</button>
                <span className="w-10 text-center font-semibold">{qty}</span>
                <button
                  onClick={() => setQty(Math.min(listing.quantityAvailable, qty + 1))}
                  className="w-10 h-10 text-gray-700 hover:bg-gray-50 rounded-r-lg"
                >+</button>
              </div>
              <button
                onClick={onAddToCart}
                className="flex-1 bg-brand-600 hover:bg-brand-700 text-white font-bold py-3 rounded-lg"
              >
                + Add to Cart
              </button>
            </div>
          )}

          {isExchange && (
            <button disabled className="mt-6 w-full bg-cyan-600 text-white font-bold py-3 rounded-lg opacity-60">
              ⇄ Exchange only (coming soon)
            </button>
          )}
        </div>
      </div>
    </main>
  );
}
