// ─── Enums ────────────────────────────────────────────────────────────────────

export type UserRole = 'consumer' | 'producer' | 'broker' | 'admin';
export type ListingCategory = 'vegetable' | 'fruit' | 'flower' | 'egg' | 'other';
export type OrderStatus = 'pending' | 'paid' | 'fulfilled' | 'cancelled';
export type SubscriptionCadence = 'weekly' | 'biweekly' | 'monthly';
export type SubscriptionStatus = 'active' | 'paused' | 'cancelled';
export type ExchangeStatus = 'pending' | 'accepted' | 'declined';
export type FutureOrderStatus = 'open' | 'matched' | 'expired' | 'cancelled';

// ─── Domain objects ───────────────────────────────────────────────────────────

export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  locationZip?: string;
  locationLat?: number;
  locationLng?: number;
  licensed: boolean;
  createdAt: string;
}

export interface Listing {
  id: string;
  producerId: string;
  title: string;
  description?: string;
  category: ListingCategory;
  priceCents?: number;
  quantityAvailable: number;
  exchangeFor?: string;
  locationZip: string;
  locationLat?: number;
  locationLng?: number;
  images: string[];
  isAvailable: boolean;
  readyToDeliver: boolean;
  pickupDate?: string;
  pickupTime?: string;
  pickupLocation?: string;
  distanceMiles?: number;
  createdAt: string;
}

export interface OrderItem {
  id: string;
  listingId: string;
  quantity: number;
  unitPriceCents: number;
}

export interface Order {
  id: string;
  consumerId: string;
  status: OrderStatus;
  items: OrderItem[];
  subtotalCents: number;
  feePercent: number;
  platformFeeCents: number;
  totalCents: number;
  paymentRef?: string;
  deliveryAddress?: string;
  createdAt: string;
}

export interface Subscription {
  id: string;
  consumerId: string;
  listingId: string;
  cadence: SubscriptionCadence;
  status: SubscriptionStatus;
  nextBillingAt?: string;
  createdAt: string;
}

export interface Exchange {
  id: string;
  initiatorId: string;
  listingId: string;
  offeredItem: string;
  message?: string;
  status: ExchangeStatus;
  createdAt: string;
}

export interface FutureOrder {
  id: string;
  consumerId: string;
  productQuery: string;
  productKeyword: string;
  category?: ListingCategory;
  quantityNeeded: number;
  unit: string;
  maxPriceCents?: number;
  proximityMiles: number;
  zip: string;
  expiresAt: string;
  status: FutureOrderStatus;
  matchedListingId?: string;
  createdAt: string;
}

export interface CartItem {
  listing: Listing;
  quantity: number;
}

export interface PlatformConfig {
  key: string;
  value: string;
  updatedAt: string;
}

// ─── API request / response shapes ────────────────────────────────────────────

export interface AuthRegisterRequest {
  email: string;
  password: string;
  name: string;
  role: UserRole;
  locationZip?: string;
}

export interface AuthLoginRequest {
  email: string;
  password: string;
}

export interface AuthTokenResponse {
  accessToken: string;
  refreshToken: string;
  user: Omit<User, 'createdAt'>;
}

export interface AISearchRequest {
  query: string;
  userZip?: string;
  radiusMiles?: number;
}

export interface AISearchResponse {
  intent: string;
  results: Listing[];
  explanation: string;
}

export interface AIParseDemandRequest {
  query: string;
  zip: string;
}

export interface AIParseDemandResponse {
  productKeyword: string;
  category?: ListingCategory;
  quantityNeeded: number;
  unit: string;
  maxPriceCents?: number;
  proximityMiles: number;
  expiresAt: string;
}

export interface CreateOrderRequest {
  items: { listingId: string; quantity: number }[];
  deliveryAddress?: string;
}

export interface CreateOrderResponse {
  orderId: string;
  subtotalCents: number;
  feePercent: number;
  platformFeeCents: number;
  totalCents: number;
  stripeClientSecret: string;
}

export interface ApiResponse<T> {
  data: T;
  total?: number;
  page?: number;
  limit?: number;
}

export interface ApiError {
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}
