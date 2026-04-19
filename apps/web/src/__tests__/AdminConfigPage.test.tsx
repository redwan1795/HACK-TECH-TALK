import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { vi } from 'vitest';
import AdminConfigPage from '../pages/AdminConfigPage';

vi.mock('../lib/api', () => ({
  apiClient: {
    get:   vi.fn(),
    patch: vi.fn(),
  },
}));

import { apiClient } from '../lib/api';
const mockGet   = apiClient.get   as ReturnType<typeof vi.fn>;
const mockPatch = apiClient.patch as ReturnType<typeof vi.fn>;

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <AdminConfigPage />
      </MemoryRouter>
    </QueryClientProvider>
  );
}

describe('AdminConfigPage', () => {
  beforeEach(() => vi.clearAllMocks());

  it('shows loading skeleton while fetching', () => {
    mockGet.mockReturnValueOnce(new Promise(() => {}));
    renderPage();
    expect(document.querySelector('.animate-pulse')).toBeInTheDocument();
  });

  it('M5-F-01: renders fee input and save button after load', async () => {
    mockGet.mockResolvedValueOnce({ data: { fee_percent: 7 } });
    renderPage();

    await waitFor(() =>
      expect(screen.getByRole('spinbutton')).toBeInTheDocument()
    );
    expect(screen.getByRole('button', { name: /save/i })).toBeInTheDocument();
    expect(screen.getByText(/Current fee: 7%/i)).toBeInTheDocument();
  });

  it('M5-F-01: submits correct value and shows success toast', async () => {
    mockGet.mockResolvedValueOnce({ data: { fee_percent: 7 } });
    mockPatch.mockResolvedValueOnce({ data: { fee_percent: 10 } });

    renderPage();
    await waitFor(() => expect(screen.getByRole('spinbutton')).toBeInTheDocument());

    const input = screen.getByRole('spinbutton');
    fireEvent.change(input, { target: { value: '10' } });
    fireEvent.click(screen.getByRole('button', { name: /save/i }));

    await waitFor(() =>
      expect(screen.getByText(/fee updated to 10%/i)).toBeInTheDocument()
    );
    expect(mockPatch).toHaveBeenCalledWith('/admin/config', { fee_percent: 10 });
  });

  it('shows error message on API failure', async () => {
    mockGet.mockResolvedValueOnce({ data: { fee_percent: 7 } });
    mockPatch.mockRejectedValueOnce(new Error('Server error'));

    renderPage();
    await waitFor(() => expect(screen.getByRole('spinbutton')).toBeInTheDocument());

    fireEvent.change(screen.getByRole('spinbutton'), { target: { value: '5' } });
    fireEvent.click(screen.getByRole('button', { name: /save/i }));

    await waitFor(() =>
      expect(screen.getByText(/Failed to update fee/i)).toBeInTheDocument()
    );
  });

  it('shows validation error for fee > 100', async () => {
    mockGet.mockResolvedValueOnce({ data: { fee_percent: 7 } });
    renderPage();
    await waitFor(() => expect(screen.getByRole('spinbutton')).toBeInTheDocument());

    // Directly fire the change event to bypass the DOM max constraint
    fireEvent.change(screen.getByRole('spinbutton'), { target: { value: '150' } });
    // Submit the form directly to bypass any button-level quirks
    fireEvent.submit(screen.getByRole('spinbutton').closest('form')!);

    await waitFor(() =>
      expect(screen.getByText(/Fee must be between 0 and 100/i)).toBeInTheDocument()
    );
    expect(mockPatch).not.toHaveBeenCalled();
  });
});
