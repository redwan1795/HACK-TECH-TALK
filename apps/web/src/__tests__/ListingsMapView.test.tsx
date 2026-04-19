import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ListingsMapView, MappableListing } from '../components/ListingsMapView';

// Mock react-leaflet to avoid canvas/DOM issues in jsdom
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
  useMap: () => ({
    setView: vi.fn(),
    fitBounds: vi.fn(),
  }),
}));

vi.mock('leaflet', () => ({
  default: {
    Icon: { Default: { prototype: {}, mergeOptions: vi.fn() } },
    latLngBounds: vi.fn(() => ({})),
  },
  latLngBounds: vi.fn(() => ({})),
}));

const baseListing: MappableListing = {
  id: 'abc-123',
  title: 'Fresh Zucchini',
  category: 'vegetable',
  price_cents: 300,
  quantity_available: 10,
  location_zip: '88001',
  location_lat: 32.3199,
  location_lng: -106.7637,
};

function renderMapView(listings: MappableListing[], onAddToCart?: (id: string) => void) {
  return render(
    <MemoryRouter>
      <ListingsMapView listings={listings} onAddToCart={onAddToCart} />
    </MemoryRouter>
  );
}

describe('ListingsMapView', () => {
  it('renders a Marker for each listing with location_lat/location_lng', () => {
    const listings = [baseListing, { ...baseListing, id: 'xyz-456', title: 'Tomatoes' }];
    renderMapView(listings);
    expect(screen.getAllByTestId('marker')).toHaveLength(2);
  });

  it('shows amber warning when at least one listing has null location', () => {
    const listings = [
      baseListing,
      { ...baseListing, id: 'no-loc', title: 'No Location', location_lat: null, location_lng: null },
    ];
    renderMapView(listings);
    expect(screen.getByText(/not shown on map/i)).toBeInTheDocument();
  });

  it('does not show amber warning when all listings have coordinates', () => {
    renderMapView([baseListing]);
    expect(screen.queryByText(/not shown on map/i)).not.toBeInTheDocument();
  });

  it('popup contains listing title and "View details" link', () => {
    renderMapView([baseListing]);
    expect(screen.getByText('Fresh Zucchini')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /view details/i })).toBeInTheDocument();
  });

  it('popup renders "Add to Cart" button when onAddToCart prop provided', () => {
    const onAddToCart = vi.fn();
    renderMapView([baseListing], onAddToCart);
    expect(screen.getByRole('button', { name: /add to cart/i })).toBeInTheDocument();
  });

  it('popup does not render "Add to Cart" when onAddToCart is omitted', () => {
    renderMapView([baseListing]);
    expect(screen.queryByRole('button', { name: /add to cart/i })).not.toBeInTheDocument();
  });

  it('renders 0 markers when all listings have null location', () => {
    const listings = [
      { ...baseListing, location_lat: null, location_lng: null },
    ];
    renderMapView(listings);
    expect(screen.queryAllByTestId('marker')).toHaveLength(0);
  });
});
