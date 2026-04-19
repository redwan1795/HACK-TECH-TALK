import { http } from '../../shared/api/httpClient';
import type { Listing, SearchResponse, Category } from '../../shared/types';

export interface SearchFilters {
  q?: string;
  zip?: string;
  radiusMiles?: number;
  category?: Category;
  page?: number;
  limit?: number;
  sort?: 'distance' | 'newest' | 'price_asc' | 'price_desc';
}

export async function searchListings(f: SearchFilters = {}): Promise<SearchResponse> {
  const params: Record<string, any> = {};
  if (f.q) params.q = f.q;
  if (f.zip) params.zip = f.zip;
  if (f.radiusMiles) params.radius_miles = f.radiusMiles;
  if (f.category) params.category = f.category;
  if (f.page) params.page = f.page;
  if (f.limit) params.limit = f.limit;
  if (f.sort) params.sort = f.sort;
  const { data } = await http.get<SearchResponse>('/listings', { params });
  return data;
}

export async function fetchListing(id: string): Promise<Listing> {
  const { data } = await http.get<{ listing: Listing }>(`/listings/${id}`);
  return data.listing;
}

export async function fetchMyListings(): Promise<Listing[]> {
  const { data } = await http.get<{ listings: Listing[] }>('/listings/mine');
  return data.listings;
}

export async function createListing(input: {
  title: string;
  description?: string;
  category: Category;
  priceCents?: number;
  unit?: string;
  quantityAvailable: number;
  exchangeFor?: string;
  locationZip: string;
  images?: File[];
}): Promise<Listing> {
  const form = new FormData();
  form.append('title', input.title);
  if (input.description) form.append('description', input.description);
  form.append('category', input.category);
  if (input.priceCents !== undefined) form.append('priceCents', String(input.priceCents));
  form.append('unit', input.unit ?? 'lb');
  form.append('quantityAvailable', String(input.quantityAvailable));
  if (input.exchangeFor) form.append('exchangeFor', input.exchangeFor);
  form.append('locationZip', input.locationZip);
  (input.images ?? []).forEach((f) => form.append('images', f));

  const { data } = await http.post<{ listing: Listing }>('/listings', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return data.listing;
}

export async function togglePublish(id: string) {
  const { data } = await http.patch<{ id: string; isAvailable: boolean }>(`/listings/${id}/publish`);
  return data;
}

export async function deleteListing(id: string) {
  await http.delete(`/listings/${id}`);
}
