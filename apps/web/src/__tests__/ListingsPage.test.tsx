import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import ListingsPage from '../pages/ListingsPage';

// Mock the api client
vi.mock('../lib/api', () => ({
  apiClient: {
    get: vi.fn(),
  },
}));

// Mock react-leaflet and leaflet
vi.mock('react-leaflet', () => ({
  MapContainer: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="map-container">{children}</div>
  ),
  TileLayer: () => null,
  Marker: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="marker">{children}</div>
  ),
  Popup: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="popup">{children}</div>
  ),
  useMap: () => ({ setView: vi.fn(), fitBounds: vi.fn() }),
}));

vi.mock('leaflet', () => ({
  default: {
    Icon: { Default: { prototype: {}, mergeOptions: vi.fn() } },
    latLngBounds: vi.fn(() => ({})),
  },
}));

import { apiClient } from '../lib/api';
const mockedApi = apiClient as unknown as { get: ReturnType<typeof vi.fn> };

const FIXTURE_LISTINGS = [
  {
    id: 'aaa-111',
    title: 'Fresh Zucchini',
    description: 'Great zucchini',
    category: 'vegetable',
    price_cents: 300,
    quantity_available: 10,
    location_zip: '88001',
    location_lat: 32.3199,
    location_lng: -106.7637,
    images: [],
    is_available: true,
  },
  {
    id: 'bbb-222',
    title: 'No-Location Tomatoes',
    category: 'vegetable',
    price_cents: 200,
    quantity_available: 5,
    location_zip: '99999',
    location_lat: null,
    location_lng: null,
    images: [],
    is_available: true,
  },
];

function renderPage() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter>
        <ListingsPage />
      </MemoryRouter>
    </QueryClientProvider>
  );
}

beforeEach(() => {
  mockedApi.get.mockReset();
});

describe('ListingsPage view toggle', () => {
  it('renders in grid mode by default — ListingCard components visible', async () => {
    mockedApi.get.mockResolvedValue({ data: { data: FIXTURE_LISTINGS, total: 2 } });
    renderPage();

    // Submit the default search form
    fireEvent.submit(screen.getByRole('button', { name: /search/i }).closest('form')!);

    await waitFor(() => {
      expect(screen.getByText('Fresh Zucchini')).toBeInTheDocument();
    });
    expect(screen.queryByTestId('map-container')).not.toBeInTheDocument();
  });

  it('Grid/Map toggle buttons visible only when results.total > 0', async () => {
    mockedApi.get.mockResolvedValue({ data: { data: FIXTURE_LISTINGS, total: 2 } });
    renderPage();
    fireEvent.submit(screen.getByRole('button', { name: /search/i }).closest('form')!);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /^grid$/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /^map$/i })).toBeInTheDocument();
    });
  });

  it('clicking "Map" renders ListingsMapView, hides card grid', async () => {
    mockedApi.get.mockResolvedValue({ data: { data: FIXTURE_LISTINGS, total: 2 } });
    renderPage();
    fireEvent.submit(screen.getByRole('button', { name: /search/i }).closest('form')!);

    await waitFor(() => screen.getByRole('button', { name: /^map$/i }));
    fireEvent.click(screen.getByRole('button', { name: /^map$/i }));

    expect(screen.getByTestId('map-container')).toBeInTheDocument();
    // ListingCard titles should not be present as standalone elements when map is shown
    expect(screen.queryByText('Fresh Zucchini')).toBeInTheDocument(); // still in popup
  });

  it('clicking "Grid" restores card grid, hides map', async () => {
    mockedApi.get.mockResolvedValue({ data: { data: FIXTURE_LISTINGS, total: 2 } });
    renderPage();
    fireEvent.submit(screen.getByRole('button', { name: /search/i }).closest('form')!);

    await waitFor(() => screen.getByRole('button', { name: /^map$/i }));
    fireEvent.click(screen.getByRole('button', { name: /^map$/i }));
    fireEvent.click(screen.getByRole('button', { name: /^grid$/i }));

    expect(screen.queryByTestId('map-container')).not.toBeInTheDocument();
    expect(screen.getByText('Fresh Zucchini')).toBeInTheDocument();
  });

  it('active toggle button has garden-600 background class', async () => {
    mockedApi.get.mockResolvedValue({ data: { data: FIXTURE_LISTINGS, total: 2 } });
    renderPage();
    fireEvent.submit(screen.getByRole('button', { name: /search/i }).closest('form')!);

    await waitFor(() => screen.getByRole('button', { name: /^grid$/i }));

    const gridBtn = screen.getByRole('button', { name: /^grid$/i });
    expect(gridBtn.className).toContain('bg-garden-600');

    fireEvent.click(screen.getByRole('button', { name: /^map$/i }));
    const mapBtn = screen.getByRole('button', { name: /^map$/i });
    expect(mapBtn.className).toContain('bg-garden-600');
  });

  it('toggle buttons hidden when search returns 0 results', async () => {
    mockedApi.get.mockResolvedValue({ data: { data: [], total: 0 } });
    renderPage();
    fireEvent.submit(screen.getByRole('button', { name: /search/i }).closest('form')!);

    await waitFor(() => screen.getByText(/0 results/i));
    expect(screen.queryByRole('button', { name: /^grid$/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^map$/i })).not.toBeInTheDocument();
  });
});
