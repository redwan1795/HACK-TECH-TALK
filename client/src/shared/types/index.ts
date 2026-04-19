export type Category =
  | 'fruit' | 'vegetable' | 'herb' | 'flower' | 'egg' | 'dairy' | 'other';

export interface Listing {
  id: string;
  title: string;
  description: string | null;
  category: Category;
  priceCents: number | null;
  unit: string;
  quantityAvailable: number;
  exchangeFor: string | null;
  locationZip: string;
  locationLat: number | null;
  locationLng: number | null;
  images: string[];
  isAvailable: boolean;
  createdAt: string;
  distanceMiles: number | null;
  producer: {
    id: string;
    name: string | null;
    licensed: boolean;
  };
}

export interface SearchResponse {
  listings: Listing[];
  total: number;
  page: number;
  limit: number;
  anchor: { zip: string; lat: number; lng: number } | null;
}
