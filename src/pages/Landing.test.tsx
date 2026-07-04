// @vitest-environment jsdom
/**
 * LANE-PUBLIC landing smoke test.
 *
 * The landing is a single-viewport cinematic hero with its own naked nav (no
 * shared Layout chrome, no footer) and exactly one primary CTA. This proves the
 * key content renders, the four nav destinations + Sign In are wired, the one
 * CTA points into the story funnel, and the route-scoped scroll-lock class is
 * applied on mount and cleaned up on unmount (so the rest of the site scrolls).
 */
import { describe, it, expect, afterEach } from 'vitest';
import { renderWithRouter, screen, within } from '../test/render';
import Landing from './Landing';

afterEach(() => {
  document.documentElement.classList.remove('qs-no-scroll');
});

describe('Landing', () => {
  it('renders the hero headline, eyebrow, and single primary CTA', () => {
    renderWithRouter(<Landing />);

    expect(
      screen.getByRole('heading', { name: /a morning\s+that could be yours/i }),
    ).toBeInTheDocument();
    expect(screen.getByText(/carmel creek ranch · coastal san diego/i)).toBeInTheDocument();

    // Exactly one primary CTA into the story funnel.
    const cta = screen.getByRole('link', { name: /come ride with us/i });
    expect(cta).toHaveAttribute('href', '/story');
  });

  it('wires the four naked-nav destinations and the Sign In link', () => {
    renderWithRouter(<Landing />);

    const primaryNav = screen.getByRole('navigation', { name: /^primary$/i });
    expect(within(primaryNav).getByRole('link', { name: /ride with us/i })).toHaveAttribute('href', '/shop');
    expect(within(primaryNav).getByRole('link', { name: /our story/i })).toHaveAttribute('href', '/story');
    expect(within(primaryNav).getByRole('link', { name: /find a horse/i })).toHaveAttribute('href', '/acquisition');
    expect(within(primaryNav).getByRole('link', { name: /say hello/i })).toHaveAttribute('href', '/contact');

    expect(screen.getByRole('link', { name: /sign in/i })).toHaveAttribute('href', '/login');
  });

  it('scopes scroll-lock to the route: adds the class on mount, removes on unmount', () => {
    const { unmount } = renderWithRouter(<Landing />);
    expect(document.documentElement.classList.contains('qs-no-scroll')).toBe(true);
    unmount();
    expect(document.documentElement.classList.contains('qs-no-scroll')).toBe(false);
  });
});
