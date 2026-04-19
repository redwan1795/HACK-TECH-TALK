import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import LandingPage from '../pages/LandingPage';

function renderLanding() {
  return render(
    <MemoryRouter>
      <LandingPage />
    </MemoryRouter>
  );
}

describe('LandingPage', () => {
  it('renders the hero headline', () => {
    renderLanding();
    expect(screen.getByText(/Grow Together/i)).toBeInTheDocument();
    expect(screen.getByText(/Eat Fresh/i)).toBeInTheDocument();
  });

  it('renders "Join as Producer" CTA linking to /register', () => {
    renderLanding();
    const links = screen.getAllByRole('link', { name: /Join as Producer/i });
    expect(links.length).toBeGreaterThan(0);
    links.forEach((l) => expect(l).toHaveAttribute('href', '/register'));
  });

  it('renders "Join as Consumer" CTA linking to /register', () => {
    renderLanding();
    const links = screen.getAllByRole('link', { name: /Join as Consumer/i });
    expect(links.length).toBeGreaterThan(0);
    links.forEach((l) => expect(l).toHaveAttribute('href', '/register'));
  });

  it('renders skip/sign-in link pointing to /login', () => {
    renderLanding();
    const skipLink = screen.getByText(/Skip.*already have an account/i);
    expect(skipLink.closest('a')).toHaveAttribute('href', '/login');
  });

  it('shows producer value props section', () => {
    renderLanding();
    expect(screen.getByText('For Producers')).toBeInTheDocument();
    expect(screen.getByText(/No middleman fees/i)).toBeInTheDocument();
    expect(screen.getByText(/Flexible fulfillment/i)).toBeInTheDocument();
  });

  it('shows consumer value props section', () => {
    renderLanding();
    expect(screen.getByText('For Consumers')).toBeInTheDocument();
    expect(screen.getByText(/Fresh from your neighborhood/i)).toBeInTheDocument();
    expect(screen.getByText(/Know your grower/i)).toBeInTheDocument();
  });

  it('renders Sign In in the navbar', () => {
    renderLanding();
    const navSignIn = screen.getAllByRole('link', { name: /Sign In/i })[0];
    expect(navSignIn).toHaveAttribute('href', '/login');
  });
});
