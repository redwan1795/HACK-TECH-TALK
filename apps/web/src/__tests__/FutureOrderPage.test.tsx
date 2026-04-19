import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { vi } from 'vitest';
import FutureOrderPage from '../pages/FutureOrderPage';

vi.mock('../lib/api', () => ({
  apiClient: { post: vi.fn() },
}));

import { apiClient } from '../lib/api';
const mockPost = apiClient.post as ReturnType<typeof vi.fn>;

const parsedIntent = {
  product_keyword: 'orange',
  quantity: 10,
  unit: 'unit',
  needed_by_date: '2026-04-21T00:00:00Z',
  max_price_cents: null,
  zip: '88001',
  proximity_miles: 25,
};

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <FutureOrderPage />
      </MemoryRouter>
    </QueryClientProvider>
  );
}

describe('FutureOrderPage', () => {
  beforeEach(() => vi.clearAllMocks());

  it('renders the freetext input and parse button', () => {
    renderPage();
    expect(screen.getByRole('textbox')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /parse my request/i })).toBeInTheDocument();
  });

  it('M4-F-01: shows confirmation card with parsed intent after parse', async () => {
    mockPost.mockResolvedValueOnce({ data: parsedIntent });
    renderPage();

    fireEvent.change(screen.getByRole('textbox'), {
      target: { value: 'I need 10 oranges in 2 days near 88001' },
    });
    fireEvent.click(screen.getByRole('button', { name: /parse my request/i }));

    await waitFor(() => {
      expect(screen.getByText(/confirm your request/i)).toBeInTheDocument();
    });

    expect(screen.getByText('orange')).toBeInTheDocument();
    expect(screen.getByText(/10 unit/i)).toBeInTheDocument();
    expect(screen.getByText(/Apr \d+, 2026/i)).toBeInTheDocument();
    expect(screen.getByText('88001')).toBeInTheDocument();
  });

  it('M4-F-02: confirm button calls POST /future-orders', async () => {
    mockPost
      .mockResolvedValueOnce({ data: parsedIntent })   // parse-demand
      .mockResolvedValueOnce({ data: { id: 'fo-1', status: 'open' } }); // future-orders

    renderPage();

    fireEvent.change(screen.getByRole('textbox'), {
      target: { value: 'I need 10 oranges in 2 days near 88001' },
    });
    fireEvent.click(screen.getByRole('button', { name: /parse my request/i }));

    await waitFor(() => screen.getByText(/confirm your request/i));

    fireEvent.click(screen.getByRole('button', { name: /confirm & save/i }));

    await waitFor(() => {
      expect(mockPost).toHaveBeenCalledWith(
        '/future-orders',
        expect.objectContaining({
          product_keyword: 'orange',
          quantity_needed: 10,
          zip: '88001',
        })
      );
    });
  });

  it('M4-F-03: shows success state after saving', async () => {
    mockPost
      .mockResolvedValueOnce({ data: parsedIntent })
      .mockResolvedValueOnce({ data: { id: 'fo-1', status: 'open' } });

    renderPage();

    fireEvent.change(screen.getByRole('textbox'), {
      target: { value: 'I need 10 oranges in 2 days near 88001' },
    });
    fireEvent.click(screen.getByRole('button', { name: /parse my request/i }));
    await waitFor(() => screen.getByText(/confirm your request/i));

    fireEvent.click(screen.getByRole('button', { name: /confirm & save/i }));

    await waitFor(() => {
      expect(screen.getByText(/we.ll notify you/i)).toBeInTheDocument();
    });
  });

  it('shows parse error on API failure', async () => {
    mockPost.mockRejectedValueOnce({
      response: { data: { error: { message: 'Could not parse' } } },
    });

    renderPage();

    fireEvent.change(screen.getByRole('textbox'), {
      target: { value: 'gibberish request' },
    });
    fireEvent.click(screen.getByRole('button', { name: /parse my request/i }));

    await waitFor(() => {
      expect(screen.getByText(/could not parse/i)).toBeInTheDocument();
    });
  });
});
