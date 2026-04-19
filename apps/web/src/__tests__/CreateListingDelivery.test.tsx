import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { vi } from 'vitest';
import CreateListingPage from '../pages/CreateListingPage';

vi.mock('../lib/api', () => ({
  apiClient: { post: vi.fn() },
}));
vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>();
  return { ...actual, useNavigate: () => vi.fn() };
});

function renderPage() {
  return render(
    <MemoryRouter>
      <CreateListingPage />
    </MemoryRouter>
  );
}

describe('CreateListingPage — delivery toggle', () => {
  it('shows "Ready to deliver" checkbox checked by default', () => {
    renderPage();
    const checkbox = screen.getByRole('checkbox', { name: /Ready to deliver/i });
    expect(checkbox).toBeChecked();
  });

  it('does not show pickup fields when ready_to_deliver is checked', () => {
    renderPage();
    expect(screen.queryByLabelText(/Pickup Date/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/Pickup Time/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/Pickup Location/i)).not.toBeInTheDocument();
  });

  it('shows pickup fields when ready_to_deliver is unchecked', async () => {
    renderPage();
    const checkbox = screen.getByRole('checkbox', { name: /Ready to deliver/i });
    fireEvent.click(checkbox);
    await waitFor(() => {
      expect(screen.getByLabelText(/Pickup Date/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/Pickup Time/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/Pickup Location/i)).toBeInTheDocument();
    });
  });

  it('hides pickup fields again when re-checked', async () => {
    renderPage();
    const checkbox = screen.getByRole('checkbox', { name: /Ready to deliver/i });
    fireEvent.click(checkbox);
    await waitFor(() => expect(screen.getByLabelText(/Pickup Date/i)).toBeInTheDocument());
    fireEvent.click(checkbox);
    await waitFor(() => {
      expect(screen.queryByLabelText(/Pickup Date/i)).not.toBeInTheDocument();
    });
  });

  it('shows validation errors when submitting with ready_to_deliver=false and missing pickup fields', async () => {
    renderPage();
    const checkbox = screen.getByRole('checkbox', { name: /Ready to deliver/i });
    fireEvent.click(checkbox);
    await waitFor(() => expect(screen.getByLabelText(/Pickup Location/i)).toBeInTheDocument());

    // Fill in required base fields
    fireEvent.change(screen.getByLabelText(/Title \*/i), { target: { value: 'Test Listing' } });
    fireEvent.change(screen.getByLabelText(/ZIP code \*/i), { target: { value: '88001' } });
    fireEvent.change(screen.getByLabelText(/Quantity \*/i), { target: { value: '5' } });

    fireEvent.click(screen.getByRole('button', { name: /Create Listing/i }));

    await waitFor(() => {
      expect(screen.getByText(/Pickup date required/i)).toBeInTheDocument();
    });
  });
});
