import { http } from '../../shared/api/httpClient';
import type { Category } from '../../shared/types';

export interface FutureOrder {
  id: string;
  consumerId: string;
  productQuery: string;
  category: Category | null;
  quantityNeeded: number;
  proximityMiles: number;
  expiresAt: string;
  status: 'open' | 'matched' | 'fulfilled' | 'expired' | 'cancelled';
  matchedListingId: string | null;
  locationZip: string | null;
  createdAt: string;
}

export interface CreateFutureOrderInput {
  productQuery: string;
  category?: Category;
  quantityNeeded: number;
  proximityMiles: number;
  daysUntilExpiry: number;
  locationZip?: string;
}

export async function createFutureOrder(input: CreateFutureOrderInput): Promise<FutureOrder> {
  const { data } = await http.post<{ futureOrder: FutureOrder }>('/future-orders', input);
  return data.futureOrder;
}

export async function listMyFutureOrders(): Promise<FutureOrder[]> {
  const { data } = await http.get<{ futureOrders: FutureOrder[] }>('/future-orders');
  return data.futureOrders;
}

export async function cancelFutureOrder(id: string): Promise<void> {
  await http.delete(`/future-orders/${id}`);
}
