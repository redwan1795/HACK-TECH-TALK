import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { vi } from 'vitest';
import AISearchPage from '../pages/AISearchPage';

vi.mock('../lib/api', () => ({
  apiClient: { post: vi.fn() },
}));

vi.mock('../stores/cartStore', () => ({
  useCartStore: vi.fn((selector) => {
    const store = { items: [], addItem: vi.fn() };
    return selector ? selector(store) : store;
  }),
}));

import { apiClient } from '../lib/api';
const mockPost = apiClient.post as ReturnType<typeof vi.fn>;

const fixtureResults = [
  {
    id: 'listing-1',
    producer_id: 'prod-1',
    title: 'Fresh Zucchini',
    category: 'vegetable',
    price_cents: 300,
    quantity_available: 10,
    location_zip: '88001',
    images: [],
    is_available: true,
    ready_to_deliver: true,
    created_at: '2026-04-01T00:00:00Z',
  },
];

const successResponse = {
  data: {
    intent: '{"keyword":"zucchini","zip":"88001"}',
    results: fixtureResults,
    explanation: 'Found 1 listing matching "zucchini" near ZIP 88001.',
  },
};

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <AISearchPage />
      </MemoryRouter>
    </QueryClientProvider>
  );
}

describe('AISearchPage', () => {
  beforeEach(() => vi.clearAllMocks());

  it('renders textarea and Search button', () => {
    renderPage();
    expect(screen.getByRole('textbox')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /search/i })).toBeInTheDocument();
  });

  it('Search button is disabled when query is empty', () => {
    renderPage();
    expect(screen.getByRole('button', { name: /search/i })).toBeDisabled();
  });

  it('Search button is disabled when query is 1 character', () => {
    renderPage();
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'z' } });
    expect(screen.getByRole('button', { name: /search/i })).toBeDisabled();
  });

  it('shows skeleton grid while loading', async () => {
    let resolvePromise!: (v: any) => void;
    mockPost.mockReturnValueOnce(new Promise((r) => { resolvePromise = r; }));

    renderPage();
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'zucchini' } });
    fireEvent.click(screen.getByRole('button', { name: /search/i }));

    // Skeleton cards rendered during loading
    const skeletons = document.querySelectorAll('.animate-pulse');
    expect(skeletons.length).toBeGreaterThan(0);

    resolvePromise(successResponse);
  });

  it('shows explanation and listing card on success', async () => {
    mockPost.mockResolvedValueOnce(successResponse);
    renderPage();
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'zucchini' } });
    fireEvent.click(screen.getByRole('button', { name: /search/i }));

    await waitFor(() =>
      expect(screen.getByText(/Found 1 listing matching/i)).toBeInTheDocument()
    );
    expect(screen.getByText('Fresh Zucchini')).toBeInTheDocument();
  });

  it('shows fallback link when intent is fallback', async () => {
    mockPost.mockResolvedValueOnce({
      data: { intent: 'fallback', results: fixtureResults, explanation: 'Showing results for "zucchini".' },
    });
    renderPage();
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'zucchini' } });
    fireEvent.click(screen.getByRole('button', { name: /search/i }));

    await waitFor(() =>
      expect(screen.getByText(/Try standard search/i)).toBeInTheDocument()
    );
  });

  it('shows error message when API fails', async () => {
    mockPost.mockRejectedValueOnce(new Error('Network error'));
    renderPage();
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'tomatoes' } });
    fireEvent.click(screen.getByRole('button', { name: /search/i }));

    await waitFor(() =>
      expect(screen.getByText(/Search failed/i)).toBeInTheDocument()
    );
  });

  it('shows "No listings found" empty-state block when results array is empty', async () => {
    mockPost.mockResolvedValueOnce({
      data: { intent: '{}', results: [], explanation: 'No listings found for "mango".' },
    });
    renderPage();
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'mango' } });
    fireEvent.click(screen.getByRole('button', { name: /search/i }));

    await waitFor(() =>
      // The empty-state paragraph contains both this text and a Browse link
      expect(screen.getByText(/Browse all/i)).toBeInTheDocument()
    );
  });
});
