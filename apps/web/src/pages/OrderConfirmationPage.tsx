import { useEffect } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../lib/api';

interface OrderDetail {
  id: string;
  consumer_id: string;
  status: string;
  subtotal_cents: number;
  fee_percent: number;
  platform_fee_cents: number;
  total_cents: number;
  created_at: string;
  items: {
    id: string;
    listing_id: string;
    quantity: number;
    unit_price_cents: number;
  }[];
}

const fmt = (cents: number) => `$${(cents / 100).toFixed(2)}`;

function SkeletonRow() {
  return (
    <div className="animate-pulse flex justify-between py-2">
      <div className="h-3 bg-gray-100 rounded w-1/3" />
      <div className="h-3 bg-gray-100 rounded w-16" />
    </div>
  );
}

export default function OrderConfirmationPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const { data: order, isLoading, isError } = useQuery<OrderDetail>({
    queryKey: ['order', id],
    queryFn: async () => {
      const res = await apiClient.get(`/orders/${id}`);
      return res.data;
    },
    enabled: !!id,
    retry: false,
  });

  useEffect(() => {
    if (isError) navigate('/', { replace: true });
  }, [isError, navigate]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-garden-50 py-8">
        <div className="max-w-lg mx-auto px-4 space-y-4">
          <div className="animate-pulse h-6 bg-gray-200 rounded w-40" />
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 space-y-2">
            {Array.from({ length: 4 }).map((_, i) => <SkeletonRow key={i} />)}
          </div>
        </div>
      </div>
    );
  }

  if (!order) return null;

  return (
    <div className="min-h-screen bg-garden-50 py-8">
      <div className="max-w-lg mx-auto px-4 space-y-4">
        <div className="flex items-center gap-2">
          <span className="text-2xl">✓</span>
          <h1 className="text-2xl font-bold text-garden-700">Order Confirmed</h1>
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm divide-y divide-gray-50">
          {/* Order items */}
          {order.items.map((item) => (
            <div key={item.id} className="flex justify-between px-4 py-3 text-sm text-gray-700">
              <span>Item × {item.quantity}</span>
              <span>{fmt(item.unit_price_cents * item.quantity)}</span>
            </div>
          ))}

          {/* Totals */}
          <div className="px-4 py-3 space-y-2 text-sm">
            <div className="flex justify-between text-gray-600">
              <span>Subtotal</span>
              <span>{fmt(order.subtotal_cents)}</span>
            </div>
            <div className="flex justify-between text-gray-600">
              <span>Service fee ({order.fee_percent}%)</span>
              <span>{fmt(order.platform_fee_cents)}</span>
            </div>
            <div className="flex justify-between font-bold text-gray-800 pt-2 border-t border-gray-100">
              <span>Total</span>
              <span>{fmt(order.total_cents)}</span>
            </div>
          </div>
        </div>

        <Link
          to="/search"
          className="block w-full bg-garden-600 hover:bg-garden-700 text-white font-semibold py-3 rounded-xl transition-colors text-center"
        >
          Continue Shopping
        </Link>
      </div>
    </div>
  );
}
