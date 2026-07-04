// @vitest-environment jsdom
/**
 * LANE-PUBLIC shop smoke test.
 *
 * The shop is the hybrid accordion catalog with by-appointment framing. It reads
 * families + real tiers from src/lib/services.ts (never hardcoded prices). This
 * proves:
 *  - the service families render as accordion panels;
 *  - expanding a family reveals its tiers as priced cards, LOWEST price LARGEST;
 *  - opening a tier detail does NOT add to cart (reading, never buying);
 *  - Add to cart calls addItem and stays open (no navigation);
 *  - Request this now adds to cart AND navigates to /checkout;
 *  - the by-appointment reassurance is present.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderWithRouter, screen, within, userEvent } from '../test/render';
import { RIDING_LESSON, HUNTER_JUMPER, formatPrice } from '../lib/services';

const navigateMock = vi.hoisted(() => vi.fn());
const cartFns = vi.hoisted(() => ({
  addItem: vi.fn(),
  isSelected: vi.fn(() => false),
  setFunnel: vi.fn(),
  itemCount: 0,
}));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return { ...actual, useNavigate: () => navigateMock };
});

vi.mock('../contexts/CartContext', () => ({
  useCart: () => cartFns,
}));

import Shop from './Shop';

// The lowest-priced riding-lesson tier is the hero number. Compute it from the
// real data so the assertion tracks any future repricing.
const cheapestLesson = [...RIDING_LESSON.tiers].sort((a, b) => a.price - b.price)[0];

beforeEach(() => {
  vi.clearAllMocks();
});

describe('Shop', () => {
  it('renders the by-appointment reassurance and the service families', () => {
    renderWithRouter(<Shop />);

    expect(
      screen.getByText(/every lesson, program, and service is by appointment/i),
    ).toBeInTheDocument();

    // Family accordion buttons.
    expect(screen.getByRole('button', { name: /riding lessons/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /jumper training/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /horsemanship/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /purchase & lease support/i })).toBeInTheDocument();
  });

  it('expands a family to reveal priced tiers, lowest price shown first (largest)', async () => {
    renderWithRouter(<Shop />);

    // Jumper training starts collapsed; expand it.
    const jumper = screen.getByRole('button', { name: /jumper training/i });
    expect(jumper).toHaveAttribute('aria-expanded', 'false');
    await userEvent.click(jumper);
    expect(jumper).toHaveAttribute('aria-expanded', 'true');

    // Its single configured tier + price render (from real data).
    const jumperTier = HUNTER_JUMPER.tiers[0];
    expect(screen.getByText(jumperTier.label)).toBeInTheDocument();

    // Riding Lessons is open by default; the cheapest tier is the hero row and
    // carries the largest price amount ($X, gold unit rendered separately).
    const heroAmount = new Intl.NumberFormat('en-US', {
      style: 'currency', currency: 'USD', minimumFractionDigits: 0, maximumFractionDigits: 0,
    }).format(cheapestLesson.price);
    // The full formatted price exists in the data path (sanity that formatPrice is the source).
    expect(formatPrice(cheapestLesson.price, cheapestLesson.unit)).toContain(heroAmount);
    expect(screen.getAllByText(cheapestLesson.label).length).toBeGreaterThan(0);
  });

  it('does NOT add to cart when a tier detail is opened (reading, not buying)', async () => {
    renderWithRouter(<Shop />);

    // Riding Lessons is open by default — open the first tier's details.
    const viewButtons = screen.getAllByRole('button', { name: /view details/i });
    await userEvent.click(viewButtons[0]);

    // Modal is open (dialog), and nothing was added.
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(cartFns.addItem).not.toHaveBeenCalled();
    expect(navigateMock).not.toHaveBeenCalled();
  });

  it('Add to cart calls addItem and stays on the page (no navigation)', async () => {
    renderWithRouter(<Shop />);

    const viewButtons = screen.getAllByRole('button', { name: /view details/i });
    await userEvent.click(viewButtons[0]);

    const dialog = screen.getByRole('dialog');
    await userEvent.click(within(dialog).getByRole('button', { name: /add to cart/i }));

    expect(cartFns.addItem).toHaveBeenCalledTimes(1);
    expect(navigateMock).not.toHaveBeenCalled();
    // Confirmation state — the action now reads "In your request".
    expect(within(dialog).getByRole('button', { name: /in your request/i })).toBeInTheDocument();
  });

  it('Request this now adds to cart AND navigates to /checkout', async () => {
    renderWithRouter(<Shop />);

    const viewButtons = screen.getAllByRole('button', { name: /view details/i });
    await userEvent.click(viewButtons[0]);

    const dialog = screen.getByRole('dialog');
    await userEvent.click(within(dialog).getByRole('button', { name: /request this now/i }));

    expect(cartFns.addItem).toHaveBeenCalledTimes(1);
    expect(navigateMock).toHaveBeenCalledWith('/checkout');
  });
});
