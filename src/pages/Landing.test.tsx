// @vitest-environment jsdom
/**
 * LANE-PUBLIC landing smoke test.
 *
 * The landing is a single-viewport cinematic hero that uses the SAME shared
 * <Header> as every inner page (one header everywhere) and renders bare (no
 * footer). This proves the restored hero copy renders, the single CTA points at
 * the story, the shared-header nav is wired (Our Story / Horse Care Services /
 * Find a Horse / Say Hello / Sign In — no "Ride With Us"), and the route-scoped
 * scroll-lock class is applied on mount and cleaned up on unmount.
 *
 * The shared Header reads useAuth + useCart, so both are mocked here.
 */
import { describe, it, expect, vi, afterEach } from 'vitest';

vi.mock('../contexts/AuthContext', () => ({
  useAuth: () => ({ user: null }),
}));
vi.mock('../contexts/CartContext', () => ({
  useCart: () => ({ itemCount: 0 }),
}));

import { renderWithRouter, screen, within } from '../test/render';
import Landing from './Landing';

afterEach(() => {
  document.documentElement.classList.remove('qs-no-scroll');
});

describe('Landing', () => {
  it('renders the restored hero copy, eyebrow, and single primary CTA', () => {
    renderWithRouter(<Landing />);

    // Restored owner headline (two lines, second is the gold accent line).
    const heading = screen.getByRole('heading', {
      name: /join our riding community\s+california days are made for this/i,
    });
    expect(heading).toBeInTheDocument();
    expect(screen.getByText(/carmel creek ranch · coastal san diego/i)).toBeInTheDocument();

    // Exactly one primary CTA into the story funnel.
    const cta = screen.getByRole('link', { name: /come ride with us/i });
    expect(cta).toHaveAttribute('href', '/story');
  });

  it('wires the shared-header nav (no "Ride With Us"; includes Horse Care Services)', () => {
    renderWithRouter(<Landing />);

    const primaryNav = screen.getByRole('navigation', { name: /^primary$/i });
    expect(within(primaryNav).getByRole('link', { name: /our story/i })).toHaveAttribute('href', '/story');
    expect(within(primaryNav).getByRole('link', { name: /horse care services/i })).toHaveAttribute('href', '/horse');
    expect(within(primaryNav).getByRole('link', { name: /find a horse/i })).toHaveAttribute('href', '/acquisition');
    expect(within(primaryNav).getByRole('link', { name: /say hello/i })).toHaveAttribute('href', '/contact');

    // The redundant "Ride With Us" link is gone.
    expect(within(primaryNav).queryByRole('link', { name: /ride with us/i })).not.toBeInTheDocument();

    expect(screen.getByRole('link', { name: /sign in/i })).toHaveAttribute('href', '/login');
  });

  it('scopes scroll-lock to the route: adds the class on mount, removes on unmount', () => {
    const { unmount } = renderWithRouter(<Landing />);
    expect(document.documentElement.classList.contains('qs-no-scroll')).toBe(true);
    unmount();
    expect(document.documentElement.classList.contains('qs-no-scroll')).toBe(false);
  });
});
