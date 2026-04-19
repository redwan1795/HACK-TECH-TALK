import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { loadStripe } from '@stripe/stripe-js';
import {
  Elements,
  PaymentElement,
  useStripe,
  useElements,
} from '@stripe/react-stripe-js';
import { apiClient } from '../lib/api';
import { useCartStore } from '../stores/cartStore';
import type { CreateOrderResponse } from '@community-garden/types';

const stripePublishableKey = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY ?? '';
const stripePromise = stripePublishableKey && !stripePublishableKey.includes('placeholder')
  ? loadStripe(stripePublishableKey)
  : null;

const fmt = (cents: number) => `$${(cents / 100).toFixed(2)}`;

// ── Inner form rendered inside <Elements> ─────────────────────────────────────
function PaymentForm({
  orderId,
  subtotalCents,
  feePercent,
  platformFeeCents,
  totalCents,
}: {
  orderId: string;
  subtotalCents: number;
  feePercent: number;
  platformFeeCents: number;
  totalCents: number;
}) {
  const stripe = useStripe();
  const elements = useElements();
  const navigate = useNavigate();
  const clearCart = useCartStore((s) => s.clearCart);
  const [paying, setPaying] = useState(false);
  const [payError, setPayError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stripe || !elements) return;
    setPaying(true);
    setPayError(null);
    try {
      const { error: stripeError, paymentIntent } = await stripe.confirmPayment({
        elements,
        redirect: 'if_required',
      });

      if (stripeError) {
        setPayError(stripeError.message ?? 'Payment failed.');
        setPaying(false);
        return;
      }

      if (paymentIntent?.status === 'succeeded') {
        await apiClient.post(`/orders/${orderId}/confirm`);
        clearCart();
        navigate(`/orders/${orderId}/confirmation`);
      }
    } catch {
      setPayError('Something went wrong. Please try again.');
      setPaying(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 space-y-2 text-sm">
        <div className="flex justify-between text-gray-600">
          <span>Subtotal</span><span>{fmt(subtotalCents)}</span>
        </div>
        <div className="flex justify-between text-gray-600">
          <span>Service fee ({feePercent}%)</span><span>{fmt(platformFeeCents)}</span>
        </div>
        <div className="flex justify-between font-bold text-gray-800 pt-2 border-t border-gray-100">
          <span>Total</span><span>{fmt(totalCents)}</span>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
        <PaymentElement />
      </div>

      {payError && (
        <p className="text-sm text-red-500 text-center">{payError}</p>
      )}

      <button
        type="submit"
        disabled={!stripe || paying}
        className="w-full bg-garden-600 hover:bg-garden-700 text-white font-semibold py-3 rounded-xl disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        {paying ? 'Processing…' : `Pay ${fmt(totalCents)}`}
      </button>
    </form>
  );
}

// ── Demo mode form (no Stripe required) ───────────────────────────────────────
function DemoPaymentForm({
  orderId,
  subtotalCents,
  feePercent,
  platformFeeCents,
  totalCents,
}: {
  orderId: string;
  subtotalCents: number;
  feePercent: number;
  platformFeeCents: number;
  totalCents: number;
}) {
  const navigate = useNavigate();
  const clearCart = useCartStore((s) => s.clearCart);
  const [placing, setPlacing] = useState(false);

  const handlePlace = async () => {
    setPlacing(true);
    try {
      await apiClient.post(`/orders/${orderId}/confirm`);
      clearCart();
      navigate(`/orders/${orderId}/confirmation`);
    } catch {
      setPlacing(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 space-y-2 text-sm">
        <div className="flex justify-between text-gray-600">
          <span>Subtotal</span><span>{fmt(subtotalCents)}</span>
        </div>
        <div className="flex justify-between text-gray-600">
          <span>Service fee ({feePercent}%)</span><span>{fmt(platformFeeCents)}</span>
        </div>
        <div className="flex justify-between font-bold text-gray-800 pt-2 border-t border-gray-100">
          <span>Total</span><span>{fmt(totalCents)}</span>
        </div>
      </div>
      <div className="bg-yellow-50 border border-yellow-200 rounded-xl px-4 py-3 text-xs text-yellow-700">
        Demo mode — payment processing is simulated.
      </div>
      <button
        onClick={handlePlace}
        disabled={placing}
        className="w-full bg-garden-600 hover:bg-garden-700 text-white font-semibold py-3 rounded-xl disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        {placing ? 'Placing order…' : `Place Order · ${fmt(totalCents)}`}
      </button>
    </div>
  );
}

// ── Outer page: creates the order, then renders Elements + form ───────────────
export default function CartCheckoutPage() {
  const navigate = useNavigate();
  const items = useCartStore((s) => s.items);
  const [orderData, setOrderData] = useState<CreateOrderResponse | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    if (items.length === 0) {
      navigate('/cart', { replace: true });
      return;
    }

    const payload = {
      items: items.map((i) => ({ listingId: i.listing.id, quantity: i.quantity })),
    };

    apiClient
      .post<CreateOrderResponse>('/orders', payload)
      .then((res) => setOrderData(res.data))
      .catch((err) => {
        const detail = err?.response?.data?.error?.details;
        if (Array.isArray(detail) && detail.length > 0) {
          setLoadError(detail.map((d: any) => d.message).join(', '));
        } else {
          setLoadError('Could not start checkout. Please check your cart and try again.');
        }
      });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (loadError) {
    return (
      <div className="min-h-screen bg-garden-50 flex items-center justify-center">
        <div className="text-center space-y-3 max-w-sm px-4">
          <p className="text-red-500 text-sm">{loadError}</p>
          <button
            onClick={() => navigate('/cart')}
            className="text-sm text-garden-600 underline"
          >
            Back to cart
          </button>
        </div>
      </div>
    );
  }

  if (!orderData) {
    return (
      <div className="min-h-screen bg-garden-50 flex items-center justify-center">
        <div
          role="status"
          aria-label="Loading checkout"
          className="animate-pulse text-garden-600 text-sm"
        >
          Setting up checkout…
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-garden-50 py-8">
      <div className="max-w-lg mx-auto px-4 space-y-4">
        <button onClick={() => navigate('/cart')} className="text-sm text-garden-600 hover:underline">
          ← Back to cart
        </button>
        <h1 className="text-2xl font-bold text-garden-700">Payment</h1>

        {orderData.stripeClientSecret === 'demo_mode' || !stripePromise ? (
          <DemoPaymentForm
            orderId={orderData.orderId}
            subtotalCents={orderData.subtotalCents}
            feePercent={orderData.feePercent}
            platformFeeCents={orderData.platformFeeCents}
            totalCents={orderData.totalCents}
          />
        ) : (
          <Elements
            stripe={stripePromise}
            options={{ clientSecret: orderData.stripeClientSecret }}
          >
            <PaymentForm
              orderId={orderData.orderId}
              subtotalCents={orderData.subtotalCents}
              feePercent={orderData.feePercent}
              platformFeeCents={orderData.platformFeeCents}
              totalCents={orderData.totalCents}
            />
          </Elements>
        )}
      </div>
    </div>
  );
}
