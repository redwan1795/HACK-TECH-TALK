import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { vi } from 'vitest';
import FutureOrdersListPage from '../pages/FutureOrdersListPage';

vi.mock('../lib/api', () => ({
  apiClient: { get: vi.fn(), delete: vi.fn() },
}));

import { apiClient } from '../lib/api';
const mockGet    = apiClient.get    as ReturnType<typeof vi.fn>;
const mockDelete = apiClient.delete as ReturnType<typeof vi.fn>;

const fixtureDemands = [
  {
    id: 'fo-1',
    product_keyword: 'orange',
    quantity_needed: 10,
    unit: 'unit',
    zip: '88001',
    expires_at: '2026-04-25T00:00:00Z',
    status: 'open',
    matched_listing_id: null,
    created_at: '2026-04-19T00:00:00Z',
  },
  {
    id: 'fo-2',
    product_keyword: 'apple',
    quantity_needed: 5,
    unit: 'lb',
    zip: '88001',
    expires_at: '2026-04-20T00:00:00Z',
    status: 'matched',
    matched_listing_id: 'listing-abc',
    created_at: '2026-04-18T00:00:00Z',
  },
  {
    id: 'fo-3',
    product_keyword: 'tomato',
    quantity_needed: 2,
    unit: 'kg',
    zip: '88001',
    expires_at: '2026-04-10T00:00:00Z',
    status: 'expired',
    matched_listing_id: null,
    created_at: '2026-04-05T00:00:00Z',
  },
];

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <FutureOrdersListPage />
      </MemoryRouter>
    </QueryClientProvider>
  );
}

describe('FutureOrdersListPage', () => {
  beforeEach(() => vi.clearAllMocks());

  it('M4-F-04: shows correct status badges for each demand', async () => {
    mockGet.mockResolvedValueOnce({ data: { data: fixtureDemands } });
    renderPage();

    await waitFor(() => {
      expect(screen.getByText('Open')).toBeInTheDocument();
      expect(screen.getByText('Matched')).toBeInTheDocument();
      expect(screen.getByText('Expired')).toBeInTheDocument();
    });
  });

  it('renders product keywords for each demand', async () => {
    mockGet.mockResolvedValueOnce({ data: { data: fixtureDemands } });
    renderPage();

    await waitFor(() => {
      expect(screen.getByText('orange')).toBeInTheDocument();
      expect(screen.getByText('apple')).toBeInTheDocument();
      expect(screen.getByText('tomato')).toBeInTheDocument();
    });
  });

  it('shows matched listing link for matched demand', async () => {
    mockGet.mockResolvedValueOnce({ data: { data: fixtureDemands } });
    renderPage();

    await waitFor(() => {
      const link = screen.getByText(/view matched listing/i);
      expect(link.closest('a')).toHaveAttribute('href', '/listings/listing-abc');
    });
  });

  it('cancel button visible only for open demands', async () => {
    mockGet.mockResolvedValueOnce({ data: { data: fixtureDemands } });
    renderPage();

    await waitFor(() => {
      const cancelBtns = screen.getAllByRole('button', { name: /cancel/i });
      expect(cancelBtns).toHaveLength(1);
    });
  });

  it('cancel button calls DELETE and refreshes list', async () => {
    mockGet
      .mockResolvedValueOnce({ data: { data: fixtureDemands } })
      .mockResolvedValueOnce({ data: { data: [] } });
    mockDelete.mockResolvedValueOnce({});

    renderPage();

    await waitFor(() => screen.getByRole('button', { name: /cancel/i }));
    fireEvent.click(screen.getByRole('button', { name: /cancel/i }));

    await waitFor(() => {
      expect(mockDelete).toHaveBeenCalledWith('/future-orders/fo-1');
    });
  });

  it('shows empty state when no demands', async () => {
    mockGet.mockResolvedValueOnce({ data: { data: [] } });
    renderPage();

    await waitFor(() => {
      expect(screen.getByText(/no future requests yet/i)).toBeInTheDocument();
    });
  });
});
