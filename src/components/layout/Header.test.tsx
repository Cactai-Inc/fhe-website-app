// @vitest-environment jsdom
/**
 * LANE-PUBLIC header smoke test.
 *
 * One shared header, used on the landing + every inner page. This proves:
 *  - the nav renders (Our Story / Services for Horses / Find a Horse / Say Hello)
 *    with no redundant "Ride With Us", plus Sign In;
 *  - the unified heritage nameplate renders both words + the FH logo monogram;
 *  - state-aware color: LIGHT nav text while transparent over the hero, and
 *    DARK-GREEN once the frosted panel is present on scroll (with the shadow
 *    dropped on frost). We drive the scroll state via a scroll event.
 *
 * The header reads useAuth + useCart, so both are mocked.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('../../contexts/AuthContext', () => ({
  useAuth: () => ({ user: null }),
}));
vi.mock('../../contexts/CartContext', () => ({
  useCart: () => ({ itemCount: 0 }),
}));

import { renderWithRouter, screen, within, act } from '../../test/render';
import Header from './Header';

function setScrollY(y: number) {
  Object.defineProperty(window, 'scrollY', { value: y, writable: true, configurable: true });
  act(() => {
    window.dispatchEvent(new Event('scroll'));
  });
}

beforeEach(() => setScrollY(0));
afterEach(() => setScrollY(0));

describe('Header', () => {
  it('renders the nav (no "Ride With Us") + Sign In', () => {
    renderWithRouter(<Header />);
    const nav = screen.getByRole('navigation', { name: /^primary$/i });
    expect(within(nav).getByRole('link', { name: /our story/i })).toHaveAttribute('href', '/story');
    expect(within(nav).getByRole('link', { name: /services for horses/i })).toHaveAttribute('href', '/horse');
    expect(within(nav).getByRole('link', { name: /find a horse/i })).toHaveAttribute('href', '/acquisition');
    expect(within(nav).getByRole('link', { name: /say hello/i })).toHaveAttribute('href', '/contact');
    expect(within(nav).queryByRole('link', { name: /ride with us/i })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: /sign in/i })).toHaveAttribute('href', '/login');
  });

  it('renders the unified nameplate (both words) + the FH logo monogram', () => {
    renderWithRouter(<Header />);
    const home = screen.getByRole('link', { name: /french heritage equestrian — home/i });
    expect(within(home).getByText('French Heritage')).toBeInTheDocument();
    expect(within(home).getByText('Equestrian')).toBeInTheDocument();
    // Logo monogram (the labeled slot's placeholder mark).
    expect(within(home).getByText('FH')).toBeInTheDocument();
  });

  it('is state-aware: light nav text over the hero, dark-green + no shadow on frost', () => {
    renderWithRouter(<Header />);
    const nav = screen.getByRole('navigation', { name: /^primary$/i });
    const link = within(nav).getByRole('link', { name: /our story/i });

    // Naked (top of scroll): light text + a subtle text-shadow.
    expect(link.className).toMatch(/text-white/);
    expect(link.className).toMatch(/text-shadow/);

    // Scrolled: dark-green text, shadow dropped.
    setScrollY(200);
    expect(link.className).toMatch(/text-green-800/);
    expect(link.className).not.toMatch(/text-shadow/);
  });
});
