import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { vi } from 'vitest';

vi.mock('../lib/api', () => ({
  apiClient: { get: vi.fn() },
}));

import { apiClient } from '../lib/api';
const mockGet = apiClient.get as ReturnType<typeof vi.fn>;

// ── Cart store mock ───────────────────────────────────────────────────────────
const mockRemoveItem     = vi.fn();
const mockUpdateQuantity = vi.fn();

const makeListing = (id: string, priceCents: number, qty: number) => ({
  id,
  producerId: 'prod-1',
  title: `Item ${id}`,
  category: 'vegetable' as const,
  priceCents,
  quantityAvailable: qty,
  locationZip: '88001',
  images: [],
  isAvailable: true,
  readyToDeliver: true,
  createdAt: '2026-04-01T00:00:00Z',
});

const cartItems = [
  { listing: makeListing('a', 300, 10), quantity: 2 },
  { listing: makeListing('b', 500, 5),  quantity: 1 },
];

// Two mock implementations: one with items, one empty
let currentItems = cartItems;

vi.mock('../stores/cartStore', () => ({
  useCartStore: vi.fn((selector) => {
    const store = {
      items:          currentItems,
      removeItem:     mockRemoveItem,
      updateQuantity: mockUpdateQuantity,
      subtotal:       () => currentItems.reduce((s, i) => s + i.listing.priceCents! * i.quantity, 0),
    };
    return selector ? selector(store) : store;
  }),
}));

import CartPage from '../pages/CartPage';

function renderCart() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={['/cart']}>
        <Routes>
          <Route path="/cart" element={<CartPage />} />
          <Route path="/checkout" element={<div>Checkout</div>} />
          <Route path="/search" element={<div>Search</div>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  );
}

describe('CartPage — with items', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    currentItems = cartItems;
    mockGet.mockResolvedValue({ data: { fee_percent: 7 } });
  });

  it('displays cart items', async () => {
    renderCart();
    await waitFor(() => expect(screen.getByText('Item a')).toBeInTheDocument());
    expect(screen.getByText('Item b')).toBeInTheDocument();
  });

  it('shows correct subtotal for 2×$3.00 + 1×$5.00 = $11.00', async () => {
    renderCart();
    await waitFor(() => expect(screen.getByText(/subtotal/i)).toBeInTheDocument());
    // $11.00 appears as subtotal
    expect(screen.getByText('$11.00')).toBeInTheDocument();
  });

  it('shows service fee row with fetched fee_percent', async () => {
    renderCart();
    await waitFor(() => expect(screen.getByText(/Service fee \(7%\)/i)).toBeInTheDocument());
  });

  it('shows correct total (subtotal + 7% fee = $11.77)', async () => {
    // subtotal = 1100 cents, fee = 77, total = 1177
    renderCart();
    await waitFor(() => expect(screen.getByText('$11.77')).toBeInTheDocument());
  });

  it('calls removeItem when Remove is clicked', async () => {
    renderCart();
    await waitFor(() => expect(screen.getAllByText('Remove')[0]).toBeInTheDocument());
    fireEvent.click(screen.getAllByText('Remove')[0]);
    expect(mockRemoveItem).toHaveBeenCalledWith('a');
  });

  it('"Proceed to Checkout" button navigates to /checkout', async () => {
    renderCart();
    await waitFor(() =>
      expect(screen.getByRole('button', { name: /Proceed to Checkout/i })).toBeInTheDocument()
    );
    fireEvent.click(screen.getByRole('button', { name: /Proceed to Checkout/i }));
    await waitFor(() => expect(screen.getByText('Checkout')).toBeInTheDocument());
  });
});

describe('CartPage — empty cart', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    currentItems = [];
    mockGet.mockResolvedValue({ data: { fee_percent: 7 } });
  });

  it('shows empty cart message and browse link', () => {
    renderCart();
    expect(screen.getByText(/Your cart is empty/i)).toBeInTheDocument();
    expect(screen.getByText(/Browse listings/i)).toBeInTheDocument();
  });
});
