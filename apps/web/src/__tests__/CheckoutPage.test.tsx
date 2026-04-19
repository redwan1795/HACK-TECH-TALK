import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { vi } from 'vitest';
import CheckoutPage from '../pages/CheckoutPage';

vi.mock('../lib/api', () => ({
  apiClient: {
    get: vi.fn(),
  },
}));

import { apiClient } from '../lib/api';

const mockGet = apiClient.get as ReturnType<typeof vi.fn>;

function renderCheckout(listingId = 'listing-123') {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[`/checkout/${listingId}`]}>
        <Routes>
          <Route path="/checkout/:listingId" element={<CheckoutPage />} />
          <Route path="/orders" element={<div>Orders page</div>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  );
}

const baseListing = {
  id: 'listing-123',
  title: 'Fresh Zucchini',
  description: 'Organic zucchini',
  category: 'vegetable',
  price_cents: 200,
  quantity_available: 10,
  location_zip: '88001',
  images: [],
  producer_name: 'Jane Farmer',
  exchange_for: null,
};

describe('CheckoutPage — ready_to_deliver = true', () => {
  beforeEach(() => {
    mockGet.mockResolvedValue({
      data: { ...baseListing, ready_to_deliver: true, pickup_date: null, pickup_time: null, pickup_location: null },
    });
  });

  it('shows delivery address input', async () => {
    renderCheckout();
    await waitFor(() => expect(screen.getByText('Fresh Zucchini')).toBeInTheDocument());
    expect(screen.getByLabelText(/Delivery Address/i)).toBeInTheDocument();
  });

  it('shows "Producer delivers" badge', async () => {
    renderCheckout();
    await waitFor(() => expect(screen.getByText(/Producer delivers/i)).toBeInTheDocument());
  });

  it('disables Place Order when delivery address is empty', async () => {
    renderCheckout();
    await waitFor(() => expect(screen.getByText('Place Order')).toBeInTheDocument());
    expect(screen.getByText('Place Order')).toBeDisabled();
  });

  it('enables Place Order when delivery address is filled', async () => {
    renderCheckout();
    await waitFor(() => expect(screen.getByLabelText(/Delivery Address/i)).toBeInTheDocument());
    fireEvent.change(screen.getByLabelText(/Delivery Address/i), {
      target: { value: '123 Main St, Las Cruces NM 88001' },
    });
    expect(screen.getByText('Place Order')).not.toBeDisabled();
  });
});

describe('CheckoutPage — ready_to_deliver = false', () => {
  beforeEach(() => {
    mockGet.mockResolvedValue({
      data: {
        ...baseListing,
        ready_to_deliver: false,
        pickup_date: '2026-05-01',
        pickup_time: '10:00',
        pickup_location: '123 Main St, front porch',
      },
    });
  });

  it('shows pickup info section instead of delivery address', async () => {
    renderCheckout();
    await waitFor(() => expect(screen.getByText('Pickup Information')).toBeInTheDocument());
    expect(screen.queryByLabelText(/Delivery Address/i)).not.toBeInTheDocument();
  });

  it('shows "Pickup only" badge', async () => {
    renderCheckout();
    await waitFor(() => expect(screen.getByText(/Pickup only/i)).toBeInTheDocument());
  });

  it('shows pickup location', async () => {
    renderCheckout();
    await waitFor(() => expect(screen.getByText(/123 Main St, front porch/i)).toBeInTheDocument());
  });

  it('Place Order is enabled without extra input', async () => {
    renderCheckout();
    await waitFor(() => expect(screen.getByText('Place Order')).toBeInTheDocument());
    expect(screen.getByText('Place Order')).not.toBeDisabled();
  });
});

describe('CheckoutPage — error state', () => {
  it('shows error message when listing fetch fails', async () => {
    mockGet.mockRejectedValue(new Error('Network error'));
    renderCheckout();
    await waitFor(() => expect(screen.getByText(/Could not load listing/i)).toBeInTheDocument());
  });
});
