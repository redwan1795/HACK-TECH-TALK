import { useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';
import { Link } from 'react-router-dom';

// Fix Leaflet's default marker icons broken by Vite's asset hashing
// eslint-disable-next-line @typescript-eslint/no-explicit-any
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconUrl: markerIcon,
  iconRetinaUrl: markerIcon2x,
  shadowUrl: markerShadow,
});

export interface MappableListing {
  id: string;
  title: string;
  category: string;
  price_cents?: number | null;
  quantity_available: number;
  location_zip: string;
  location_lat: number | null;
  location_lng: number | null;
  distance_miles?: number;
}

interface Props {
  listings: MappableListing[];
  onAddToCart?: (id: string) => void;
}

const CATEGORY_EMOJI: Record<string, string> = {
  vegetable: '🥦', fruit: '🍎', flower: '🌸', egg: '🥚', other: '🌿',
};

function FitBounds({ listings }: { listings: MappableListing[] }) {
  const map = useMap();
  useEffect(() => {
    if (listings.length === 0) return;
    if (listings.length === 1) {
      map.setView([listings[0].location_lat!, listings[0].location_lng!], 12);
    } else {
      const bounds = L.latLngBounds(
        listings.map((l) => [l.location_lat!, l.location_lng!] as [number, number])
      );
      map.fitBounds(bounds, { padding: [40, 40] });
    }
  }, [listings, map]);
  return null;
}

export function ListingsMapView({ listings, onAddToCart }: Props) {
  const mappable = listings.filter(
    (l): l is MappableListing & { location_lat: number; location_lng: number } =>
      l.location_lat != null && l.location_lng != null
  );
  const unmappableCount = listings.length - mappable.length;

  return (
    <div className="relative">
      {unmappableCount > 0 && (
        <p className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mb-3">
          {unmappableCount} listing{unmappableCount !== 1 ? 's' : ''} not shown on map (no
          location data — re-create the listing to geocode it).
        </p>
      )}
      <MapContainer
        center={[39.5, -98.35]}
        zoom={4}
        className="w-full rounded-2xl border border-gray-100 shadow-sm"
        style={{ height: '520px' }}
      >
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        />
        <FitBounds listings={mappable} />
        {mappable.map((listing) => (
          <Marker
            key={listing.id}
            position={[listing.location_lat, listing.location_lng]}
          >
            <Popup maxWidth={220}>
              <div className="space-y-1 py-0.5">
                <div className="flex items-center gap-1.5">
                  <span>{CATEGORY_EMOJI[listing.category] ?? '🌿'}</span>
                  <p className="font-semibold text-sm text-gray-800 leading-tight">
                    {listing.title}
                  </p>
                </div>
                <p className="text-garden-700 font-bold text-sm">
                  {listing.price_cents != null
                    ? `$${(listing.price_cents / 100).toFixed(2)}`
                    : 'Free / Exchange'}
                </p>
                <p className="text-xs text-gray-400">
                  {listing.quantity_available} available · ZIP {listing.location_zip}
                  {listing.distance_miles != null && ` · ${listing.distance_miles} mi`}
                </p>
                <div className="pt-1 flex items-center gap-3">
                  <Link
                    to={`/listings/${listing.id}`}
                    className="text-xs text-garden-600 hover:underline font-semibold"
                  >
                    View details →
                  </Link>
                  {onAddToCart && (
                    <button
                      onClick={() => onAddToCart(listing.id)}
                      className="text-xs bg-garden-600 text-white px-2 py-0.5 rounded font-semibold"
                    >
                      Add to Cart
                    </button>
                  )}
                </div>
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
}
