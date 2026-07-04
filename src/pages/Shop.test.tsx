// @vitest-environment jsdom
/**
 * LANE-PUBLIC shop smoke test.
 *
 * The shop is the hybrid accordion catalog with by-appointment framing. It reads
 * families + real tiers from src/lib/services.ts (never hardcoded prices). This
 * proves:
 *  - the service families render as accordion panels;
 *  - expanding a family reveals its tiers as priced cards in ascending rank
 *    order (entry/lowest option first) with UNIFORM price sizing (no stepped
 *    font scale);
 *  - opening a tier detail does NOT add to cart (reading, never buying);
 *  - Add to cart calls addItem and stays open (no navigation);
 *  - Request this now adds to cart AND navigates to /checkout;
 *  - the by-appointment reassurance is present.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderWithRouter, screen, within, userEvent } from '../test/render';
import { RIDING_LESSON, HUNTER_JUMPER } from '../lib/services';

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

// Riding-lesson tiers in the ascending rank order the panel renders them.
// Computed from real data so the assertion tracks any future repricing.
const lessonsAscending = [...RIDING_LESSON.tiers].sort((a, b) => a.price - b.price);

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

  it('expands a family to reveal priced tiers in ascending order with uniform price sizing', async () => {
    renderWithRouter(<Shop />);

    // Jumper training starts collapsed; expand it.
    const jumper = screen.getByRole('button', { name: /jumper training/i });
    expect(jumper).toHaveAttribute('aria-expanded', 'false');
    await userEvent.click(jumper);
    expect(jumper).toHaveAttribute('aria-expanded', 'true');
    // Its single configured tier renders (from real data).
    expect(screen.getByText(HUNTER_JUMPER.tiers[0].label)).toBeInTheDocument();

    // Riding Lessons is open by default. Its panel lists tiers in ascending
    // rank order (entry/lowest option first).
    const panel = document.getElementById('family-panel-riding-lessons') as HTMLElement;
    expect(panel).toBeTruthy();
    const region = within(panel);

    // The first tier label in DOM order is the lowest-priced tier.
    const labelNodes = lessonsAscending.map((t) => region.getByText(t.label));
    const domIndex = (el: Element) =>
      Array.prototype.indexOf.call(panel.querySelectorAll('li'), el.closest('li'));
    for (let i = 1; i < labelNodes.length; i++) {
      expect(domIndex(labelNodes[i - 1])).toBeLessThan(domIndex(labelNodes[i]));
    }

    // Uniform price sizing: every price amount carries the SAME size class, and
    // none of the old stepped sizes (text-4xl/5xl → text-2xl → text-xl) survive.
    const priceEls = Array.from(panel.querySelectorAll('li p.font-serif'));
    expect(priceEls.length).toBe(lessonsAscending.length);
    priceEls.forEach((p) => {
      expect(p.className).toContain('text-2xl');
      expect(p.className).toContain('sm:text-3xl');
      expect(p.className).not.toContain('text-4xl');
      expect(p.className).not.toContain('text-5xl');
      expect(p.className).not.toContain('text-xl'); // no stepped-down rows
    });
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
