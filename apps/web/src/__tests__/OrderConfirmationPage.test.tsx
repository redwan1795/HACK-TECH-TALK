import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { vi } from 'vitest';
import OrderConfirmationPage from '../pages/OrderConfirmationPage';

vi.mock('../lib/api', () => ({
  apiClient: { get: vi.fn() },
}));

import { apiClient } from '../lib/api';
const mockGet = apiClient.get as ReturnType<typeof vi.fn>;

const orderFixture = {
  id: 'order-abc',
  consumer_id: 'consumer-1',
  status: 'paid',
  subtotal_cents: 300,
  fee_percent: 7,
  platform_fee_cents: 21,
  total_cents: 321,
  created_at: '2026-04-01T00:00:00Z',
  items: [
    { id: 'item-1', listing_id: 'listing-1', quantity: 1, unit_price_cents: 300 },
  ],
};

function renderConfirmation(orderId = 'order-abc') {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[`/orders/${orderId}/confirmation`]}>
        <Routes>
          <Route
            path="/orders/:id/confirmation"
            element={<OrderConfirmationPage />}
          />
          <Route path="/" element={<div>Home</div>} />
          <Route path="/search" element={<div>Search</div>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  );
}

describe('OrderConfirmationPage', () => {
  beforeEach(() => vi.clearAllMocks());

  it('shows skeleton while loading', () => {
    mockGet.mockReturnValueOnce(new Promise(() => {}));
    renderConfirmation();
    expect(document.querySelector('.animate-pulse')).toBeInTheDocument();
  });

  it('renders order confirmed heading', async () => {
    mockGet.mockResolvedValueOnce({ data: orderFixture });
    renderConfirmation();
    await waitFor(() =>
      expect(screen.getByText(/Order Confirmed/i)).toBeInTheDocument()
    );
  });

  it('shows subtotal line item', async () => {
    mockGet.mockResolvedValueOnce({ data: orderFixture });
    renderConfirmation();
    await waitFor(() => expect(screen.getByText('Subtotal')).toBeInTheDocument());
    // $3.00 appears twice (item row + subtotal row) — use getAllByText
    expect(screen.getAllByText('$3.00').length).toBeGreaterThanOrEqual(1);
  });

  it('shows platform fee line item (7% of $3.00 = $0.21)', async () => {
    mockGet.mockResolvedValueOnce({ data: orderFixture });
    renderConfirmation();
    await waitFor(() => expect(screen.getByText(/Service fee \(7%\)/i)).toBeInTheDocument());
    expect(screen.getByText('$0.21')).toBeInTheDocument();
  });

  it('shows correct total ($3.21)', async () => {
    mockGet.mockResolvedValueOnce({ data: orderFixture });
    renderConfirmation();
    await waitFor(() => expect(screen.getByText('$3.21')).toBeInTheDocument());
  });

  it('redirects to / when order is not found (404)', async () => {
    mockGet.mockRejectedValueOnce({ response: { status: 404 } });
    renderConfirmation();
    await waitFor(() => expect(screen.getByText('Home')).toBeInTheDocument());
  });

  it('"Continue Shopping" button navigates to /search', async () => {
    mockGet.mockResolvedValueOnce({ data: orderFixture });
    renderConfirmation();
    await waitFor(() =>
      expect(screen.getByRole('button', { name: /Continue Shopping/i })).toBeInTheDocument()
    );
    screen.getByRole('button', { name: /Continue Shopping/i }).click();
    await waitFor(() => expect(screen.getByText('Search')).toBeInTheDocument());
  });
});
