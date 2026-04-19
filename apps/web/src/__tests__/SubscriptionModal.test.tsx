import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi } from 'vitest';
import { SubscriptionModal } from '../components/SubscriptionModal';

vi.mock('../lib/api', () => ({
  apiClient: { post: vi.fn() },
}));

import { apiClient } from '../lib/api';
const mockPost = apiClient.post as ReturnType<typeof vi.fn>;

const defaultProps = {
  listingId: 'listing-abc',
  listingTitle: 'Navel Oranges',
  pricePerUnit: 200,
  onClose: vi.fn(),
};

describe('SubscriptionModal', () => {
  beforeEach(() => vi.clearAllMocks());

  it('M5-U-01: renders all cadence options', () => {
    render(<SubscriptionModal {...defaultProps} />);
    expect(screen.getByRole('option', { name: 'Weekly' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Biweekly' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Monthly' })).toBeInTheDocument();
  });

  it('shows listing title', () => {
    render(<SubscriptionModal {...defaultProps} />);
    expect(screen.getByText('Navel Oranges')).toBeInTheDocument();
  });

  it('shows estimated charge based on quantity and price', () => {
    render(<SubscriptionModal {...defaultProps} />);
    // 200 cents × 1 = $2.00
    expect(screen.getByText('$2.00')).toBeInTheDocument();
  });

  it('calls POST /subscriptions on confirm with correct payload', async () => {
    mockPost.mockResolvedValueOnce({ data: { id: 'sub-1', status: 'active' } });

    render(<SubscriptionModal {...defaultProps} />);

    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'monthly' } });
    fireEvent.change(screen.getByRole('spinbutton'), { target: { value: '3' } });
    fireEvent.click(screen.getByRole('button', { name: /confirm subscription/i }));

    await waitFor(() =>
      expect(mockPost).toHaveBeenCalledWith('/subscriptions', {
        listing_id: 'listing-abc',
        cadence: 'monthly',
        quantity: 3,
      })
    );
  });

  it('shows success state after confirm', async () => {
    mockPost.mockResolvedValueOnce({ data: { id: 'sub-1', status: 'active' } });
    render(<SubscriptionModal {...defaultProps} />);
    fireEvent.click(screen.getByRole('button', { name: /confirm subscription/i }));

    await waitFor(() =>
      expect(screen.getByText(/Subscription created/i)).toBeInTheDocument()
    );
  });

  it('shows error message on API failure', async () => {
    mockPost.mockRejectedValueOnce(new Error('Network error'));
    render(<SubscriptionModal {...defaultProps} />);
    fireEvent.click(screen.getByRole('button', { name: /confirm subscription/i }));

    await waitFor(() =>
      expect(screen.getByText(/Failed to create subscription/i)).toBeInTheDocument()
    );
  });

  it('calls onClose when Cancel is clicked', () => {
    render(<SubscriptionModal {...defaultProps} />);
    fireEvent.click(screen.getByRole('button', { name: /cancel/i }));
    expect(defaultProps.onClose).toHaveBeenCalled();
  });
});
