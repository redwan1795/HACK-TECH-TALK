import { http } from '../../shared/api/httpClient';

export interface OrderItem {
  listingId: string;
  title: string;
  quantity: number;
  unitPriceCents: number;
  lineTotalCents: number;
}

export interface Order {
  orderId: string;
  status: 'pending' | 'paid' | 'fulfilled' | 'cancelled';
  subtotalCents: number;
  platformFeeCents: number;
  totalCents: number;
  feePercent: number;
  items: OrderItem[];
  paymentRef: string | null;
  createdAt: string;
}

export interface FeeBreakdown {
  subtotalCents: number;
  platformFeeCents: number;
  totalCents: number;
  feePercent: number;
}

export async function feePreview(items: { listingId: string; quantity: number }[]): Promise<FeeBreakdown> {
  const { data } = await http.post<FeeBreakdown>('/orders/fee-preview', { items });
  return data;
}

export async function createOrder(items: { listingId: string; quantity: number }[]): Promise<Order> {
  const { data } = await http.post<{ order: Order }>('/orders', { items });
  return data.order;
}

export async function confirmOrder(orderId: string): Promise<Order> {
  const { data } = await http.post<{ order: Order }>(`/orders/${orderId}/confirm`);
  return data.order;
}

export async function fetchOrder(orderId: string): Promise<Order> {
  const { data } = await http.get<{ order: Order }>(`/orders/${orderId}`);
  return data.order;
}

export async function fetchMyOrders(): Promise<Order[]> {
  const { data } = await http.get<{ orders: Order[] }>('/orders');
  return data.orders;
}
