// @vitest-environment jsdom
/**
 * LANE-PUBLIC header smoke test.
 *
 * One shared header, used on the landing + every inner page. This proves:
 *  - the nav renders (Our Story / Horse Care Services / Find a Horse / Say Hello)
 *    with no redundant "Ride With Us", plus Sign In;
 *  - the unified heritage nameplate renders both words + the FH logo monogram;
 *  - CONTEXT-AWARE color: the nav is WHITE (+ subtle shadow) when the header band
 *    is over a `data-header-tone="dark"` region, and DARK GREEN (no shadow) when
 *    over a light region — driven by the region behind the fixed header, live.
 *
 * The header reads useAuth + useCart, so both are mocked. Region detection uses
 * getBoundingClientRect sampling on a rAF; we mock rects to place a dark section
 * under (or clear of) the header band and flush the frame with a scroll event.
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

const HEADER_BOTTOM = 72; // px — the header band is [0, 72]

/** Force a synchronous rAF so the detection effect runs during act(). */
function stubRaf() {
  vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb: FrameRequestCallback) => {
    cb(0);
    return 1;
  });
  vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => {});
}

/** Mock getBoundingClientRect: the <header> returns the band; any element with
 *  data-header-tone="dark" returns `darkTop..darkBottom`; everything else 0. */
function mockRects(darkTop: number, darkBottom: number) {
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (
    this: HTMLElement,
  ) {
    if (this.tagName === 'HEADER') {
      return { top: 0, bottom: HEADER_BOTTOM, left: 0, right: 0, width: 0, height: HEADER_BOTTOM, x: 0, y: 0, toJSON() {} } as DOMRect;
    }
    if (this.getAttribute('data-header-tone') === 'dark') {
      return { top: darkTop, bottom: darkBottom, left: 0, right: 0, width: 0, height: darkBottom - darkTop, x: 0, y: darkTop, toJSON() {} } as DOMRect;
    }
    return { top: 0, bottom: 0, left: 0, right: 0, width: 0, height: 0, x: 0, y: 0, toJSON() {} } as DOMRect;
  });
}

function fireScroll() {
  act(() => {
    window.dispatchEvent(new Event('scroll'));
  });
}

beforeEach(() => {
  Object.defineProperty(window, 'scrollY', { value: 0, writable: true, configurable: true });
  stubRaf();
});
afterEach(() => {
  vi.restoreAllMocks();
});

describe('Header', () => {
  it('renders the nav (no "Ride With Us") + Sign In', () => {
    renderWithRouter(<Header />);
    const nav = screen.getByRole('navigation', { name: /^primary$/i });
    expect(within(nav).getByRole('link', { name: /our story/i })).toHaveAttribute('href', '/story');
    expect(within(nav).getByRole('link', { name: /horse care services/i })).toHaveAttribute('href', '/horse');
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
    expect(within(home).getByText('FH')).toBeInTheDocument();
  });

  it('is WHITE (+ shadow) when a dark region is under the header band', () => {
    // Dark section spans [0, 800] → overlaps the header band [0, 72].
    mockRects(0, 800);
    renderWithRouter(
      <>
        <Header />
        <div data-header-tone="dark" />
      </>,
    );
    fireScroll();

    const nav = screen.getByRole('navigation', { name: /^primary$/i });
    const link = within(nav).getByRole('link', { name: /our story/i });
    expect(link.className).toMatch(/text-white/);
    expect(link.className).toMatch(/text-shadow/);
  });

  it('is DARK GREEN (no shadow) when only light regions are under the header band', () => {
    // Dark section is far below [1000, 1800] → clear of the header band.
    mockRects(1000, 1800);
    renderWithRouter(
      <>
        <Header />
        <div data-header-tone="dark" />
      </>,
    );
    fireScroll();

    const nav = screen.getByRole('navigation', { name: /^primary$/i });
    const link = within(nav).getByRole('link', { name: /our story/i });
    expect(link.className).toMatch(/text-green-800/);
    expect(link.className).not.toMatch(/text-shadow/);
  });
});
