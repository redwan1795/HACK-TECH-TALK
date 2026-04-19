import { Link } from 'react-router-dom';

interface ListingCardProps {
  id: string;
  title: string;
  description?: string | null;
  category: string;
  price_cents?: number | null;
  quantity_available: number;
  location_zip: string;
  images: string[];
  ready_to_deliver?: boolean;
  pickup_date?: string | null;
  pickup_time?: string | null;
  pickup_location?: string | null;
  distance_miles?: number;
  onAddToCart?: (id: string) => void;
}

const API_BASE = import.meta.env.VITE_API_URL?.replace('/api/v1', '') ?? 'http://localhost:3000';
const CATEGORY_EMOJI: Record<string, string> = {
  vegetable: '🥦', fruit: '🍎', flower: '🌸', egg: '🥚', other: '🌿',
};

export function ListingCard({
  id, title, description, category, price_cents,
  quantity_available, location_zip, images,
  ready_to_deliver = true, pickup_date, pickup_time, pickup_location,
  distance_miles, onAddToCart,
}: ListingCardProps) {
  const imageSrc = images[0] ? `${API_BASE}${images[0]}` : null;
  const priceDisplay = price_cents != null
    ? `$${(price_cents / 100).toFixed(2)}`
    : 'Free / Exchange';

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden flex flex-col hover:shadow-md transition-shadow">
      <div className="h-40 bg-garden-50 flex items-center justify-center overflow-hidden">
        {imageSrc ? (
          <img src={imageSrc} alt={title} className="w-full h-full object-cover" />
        ) : (
          <span className="text-5xl">{CATEGORY_EMOJI[category] ?? '🌿'}</span>
        )}
      </div>
      <div className="p-4 flex flex-col gap-1 flex-1">
        <div className="flex items-start justify-between gap-2">
          <h3 className="font-semibold text-gray-800 text-sm leading-tight line-clamp-2">{title}</h3>
          <span className="text-xs text-garden-700 bg-garden-50 px-2 py-0.5 rounded-full capitalize shrink-0">
            {category}
          </span>
        </div>
        {description && (
          <p className="text-xs text-gray-500 line-clamp-2">{description}</p>
        )}

        {/* Delivery / pickup badge */}
        {ready_to_deliver ? (
          <span className="inline-flex items-center gap-1 text-xs font-medium text-green-700 bg-green-50 px-2 py-0.5 rounded-full w-fit">
            <span>✓</span> Delivers
          </span>
        ) : (
          <div>
            <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full w-fit">
              <span>↗</span> Pickup
            </span>
            {pickup_date && pickup_time && pickup_location && (
              <p className="text-xs text-gray-400 mt-0.5">
                {new Date(`${pickup_date}T${pickup_time}`).toLocaleString([], {
                  month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
                })} · {pickup_location}
              </p>
            )}
          </div>
        )}

        <div className="mt-auto pt-2 flex items-center justify-between">
          <div>
            <p className="font-bold text-garden-700">{priceDisplay}</p>
            <p className="text-xs text-gray-400">
              {quantity_available} available · ZIP {location_zip}
              {distance_miles != null && ` · ${distance_miles} mi away`}
            </p>
          </div>
          {onAddToCart ? (
            <button
              onClick={() => onAddToCart(id)}
              className="text-xs bg-garden-600 hover:bg-garden-700 text-white font-semibold px-3 py-1.5 rounded-lg"
            >
              Add to Cart
            </button>
          ) : (
            <Link
              to={`/checkout/${id}`}
              className="text-xs text-garden-600 hover:underline font-semibold"
            >
              View →
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
