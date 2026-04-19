import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { vi } from 'vitest';

// ── Mock Stripe (factory only — no variable refs) ─────────────────────────────
const mockConfirmPayment = vi.fn();

vi.mock('@stripe/react-stripe-js', () => ({
  loadStripe: vi.fn(() => Promise.resolve({})),
  Elements: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  PaymentElement: () => <div data-testid="payment-element">Payment form</div>,
  useStripe:   () => ({ confirmPayment: mockConfirmPayment }),
  useElements: () => ({}),
}));

// ── Mock api ──────────────────────────────────────────────────────────────────
vi.mock('../lib/api', () => ({
  apiClient: { post: vi.fn() },
}));

import { apiClient } from '../lib/api';
const mockPost = apiClient.post as ReturnType<typeof vi.fn>;

// ── Mock cart store ───────────────────────────────────────────────────────────
const mockClearCart = vi.fn();

vi.mock('../stores/cartStore', () => ({
  useCartStore: vi.fn((selector) => {
    const store = {
      items: [
        {
          listing: {
            id: 'listing-1', title: 'Zucchini', priceCents: 300,
            quantityAvailable: 10, category: 'vegetable', locationZip: '88001',
            images: [], isAvailable: true, readyToDeliver: true,
            createdAt: '2026-04-01T00:00:00Z',
          },
          quantity: 1,
        },
      ],
      clearCart: mockClearCart,
    };
    return selector ? selector(store) : store;
  }),
}));

import CartCheckoutPage from '../pages/CartCheckoutPage';

const orderResponse = {
  orderId: 'order-abc',
  subtotalCents: 300,
  feePercent: 7,
  platformFeeCents: 21,
  totalCents: 321,
  stripeClientSecret: 'pi_test_secret',
};

function renderCheckout() {
  return render(
    <MemoryRouter initialEntries={['/checkout']}>
      <Routes>
        <Route path="/checkout" element={<CartCheckoutPage />} />
        <Route path="/orders/:id/confirmation" element={<div>Confirmed</div>} />
        <Route path="/cart" element={<div>Cart</div>} />
      </Routes>
    </MemoryRouter>
  );
}

describe('CartCheckoutPage', () => {
  beforeEach(() => vi.clearAllMocks());

  it('shows loading skeleton while creating order', () => {
    let resolve!: (v: any) => void;
    mockPost.mockReturnValueOnce(new Promise((r) => { resolve = r; }));

    renderCheckout();
    expect(screen.getByRole('status')).toBeInTheDocument();
    resolve({ data: orderResponse });
  });

  it('calls POST /orders with cart items on mount', async () => {
    mockPost.mockResolvedValueOnce({ data: orderResponse });
    renderCheckout();
    await waitFor(() => expect(mockPost).toHaveBeenCalledWith(
      '/orders',
      { items: [{ listingId: 'listing-1', quantity: 1 }] }
    ));
  });

  it('renders PaymentElement after order is created', async () => {
    mockPost.mockResolvedValueOnce({ data: orderResponse });
    renderCheckout();
    await waitFor(() =>
      expect(screen.getByTestId('payment-element')).toBeInTheDocument()
    );
  });

  it('shows totals breakdown after order is created', async () => {
    mockPost.mockResolvedValueOnce({ data: orderResponse });
    renderCheckout();
    await waitFor(() => expect(screen.getByText('$3.00')).toBeInTheDocument());
    expect(screen.getByText('$0.21')).toBeInTheDocument();
    expect(screen.getByText('$3.21')).toBeInTheDocument();
  });

  it('calls stripe.confirmPayment when Pay button clicked', async () => {
    mockPost.mockResolvedValueOnce({ data: orderResponse });
    mockConfirmPayment.mockResolvedValueOnce({
      paymentIntent: { status: 'succeeded' },
    });
    mockPost.mockResolvedValueOnce({});

    renderCheckout();
    await waitFor(() => expect(screen.getByRole('button', { name: /Pay/i })).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: /Pay/i }));

    await waitFor(() => expect(mockConfirmPayment).toHaveBeenCalled());
  });

  it('on payment success: calls /orders/:id/confirm and clears cart', async () => {
    mockPost.mockResolvedValueOnce({ data: orderResponse });
    mockConfirmPayment.mockResolvedValueOnce({
      paymentIntent: { status: 'succeeded' },
    });
    mockPost.mockResolvedValueOnce({});

    renderCheckout();
    await waitFor(() => expect(screen.getByRole('button', { name: /Pay/i })).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: /Pay/i }));

    await waitFor(() => {
      expect(mockPost).toHaveBeenCalledWith('/orders/order-abc/confirm');
      expect(mockClearCart).toHaveBeenCalled();
    });
    await waitFor(() => expect(screen.getByText('Confirmed')).toBeInTheDocument());
  });

  it('shows inline error when stripe.confirmPayment returns an error', async () => {
    mockPost.mockResolvedValueOnce({ data: orderResponse });
    mockConfirmPayment.mockResolvedValueOnce({
      error: { message: 'Your card was declined.' },
    });

    renderCheckout();
    await waitFor(() => expect(screen.getByRole('button', { name: /Pay/i })).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: /Pay/i }));

    await waitFor(() =>
      expect(screen.getByText(/Your card was declined/i)).toBeInTheDocument()
    );
  });

  it('shows error when POST /orders fails due to insufficient stock', async () => {
    mockPost.mockRejectedValueOnce({
      response: {
        data: {
          error: { code: 'INSUFFICIENT_STOCK', details: [{ message: 'Only 2 available' }] },
        },
      },
    });

    renderCheckout();
    await waitFor(() =>
      expect(screen.getByText(/Only 2 available/i)).toBeInTheDocument()
    );
  });
});
