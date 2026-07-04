// @vitest-environment jsdom
/**
 * LANE-PUBLIC shop smoke test.
 *
 * The shop is a boutique CATALOG whose family sections EXPAND IN PLACE (no
 * modal). It reads families + real tiers from src/lib/services.ts (never
 * hardcoded prices). This proves:
 *  - the service families render with a "View details" toggle;
 *  - expanding a family reveals its offerings inline in ascending order with
 *    uniform price sizing (no per-tier detail modal anywhere);
 *  - expanding does NOT add to cart (reading, not buying);
 *  - "Save it" calls addItem and stays on the page (no navigation);
 *  - "Inquire" adds AND navigates to /checkout;
 *  - the compact by-appointment reassurance is present.
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

// Riding-lesson tiers in the ascending order the expanded region renders them.
const lessonsAscending = [...RIDING_LESSON.tiers].sort((a, b) => a.price - b.price);

beforeEach(() => {
  vi.clearAllMocks();
});

describe('Shop', () => {
  it('renders the by-appointment reassurance and the service families', () => {
    renderWithRouter(<Shop />);

    expect(
      screen.getByText(/everything here is by appointment, arranged personally/i),
    ).toBeInTheDocument();

    // Family headings.
    expect(screen.getByRole('heading', { name: /riding lessons/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /jumper training/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /horsemanship/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /purchase & lease support/i })).toBeInTheDocument();

    // NO detail modal anywhere in the shop.
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('expands a family IN PLACE to reveal offerings in ascending order, uniform price size', async () => {
    renderWithRouter(<Shop />);

    // Jumper Training starts collapsed; expand it via its View details toggle.
    const jumperToggle = document.getElementById('family-toggle-jumper-training') as HTMLButtonElement;
    expect(jumperToggle).toBeTruthy();
    expect(jumperToggle).toHaveAttribute('aria-expanded', 'false');
    await userEvent.click(jumperToggle);
    expect(jumperToggle).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByText(HUNTER_JUMPER.tiers[0].label)).toBeInTheDocument();

    // Riding Lessons is expanded by default. Offerings render in ascending order.
    const region = document.getElementById('family-region-riding-lessons') as HTMLElement;
    expect(region).toBeTruthy();
    const scope = within(region);
    const labelNodes = lessonsAscending.map((t) => scope.getByText(t.label));
    const rows = Array.from(region.querySelectorAll('div.bg-white'));
    const rowOf = (el: Element) => el.closest('div.bg-white') as Element;
    const domIndex = (el: Element) => rows.indexOf(rowOf(el));
    for (let i = 1; i < labelNodes.length; i++) {
      expect(domIndex(labelNodes[i - 1])).toBeLessThan(domIndex(labelNodes[i]));
    }

    // Uniform price sizing: every price carries the same size class; none stepped.
    // Price elements are the serif green-800 tags (distinct from serif labels).
    const priceEls = Array.from(region.querySelectorAll('p.font-serif.text-green-800'));
    expect(priceEls.length).toBe(lessonsAscending.length);
    priceEls.forEach((p) => {
      expect(p.className).toContain('text-2xl');
      expect(p.className).toContain('sm:text-3xl');
      expect(p.className).not.toContain('text-4xl');
      expect(p.className).not.toContain('text-5xl');
    });
  });

  it('does NOT add to cart when a family is expanded (reading, not buying)', async () => {
    renderWithRouter(<Shop />);

    const horsemanshipToggle = document.getElementById('family-toggle-horsemanship') as HTMLButtonElement;
    await userEvent.click(horsemanshipToggle);

    expect(cartFns.addItem).not.toHaveBeenCalled();
    expect(navigateMock).not.toHaveBeenCalled();
  });

  it('"Save it" calls addItem and stays on the page (no navigation)', async () => {
    renderWithRouter(<Shop />);

    // Riding Lessons is expanded by default — save the first offering.
    const region = document.getElementById('family-region-riding-lessons') as HTMLElement;
    const saveButtons = within(region).getAllByRole('button', { name: /save it/i });
    await userEvent.click(saveButtons[0]);

    expect(cartFns.addItem).toHaveBeenCalledTimes(1);
    expect(navigateMock).not.toHaveBeenCalled();
  });

  it('"Inquire" adds to cart AND navigates to /checkout', async () => {
    renderWithRouter(<Shop />);

    const region = document.getElementById('family-region-riding-lessons') as HTMLElement;
    const inquireButtons = within(region).getAllByRole('button', { name: /^inquire$/i });
    await userEvent.click(inquireButtons[0]);

    expect(cartFns.addItem).toHaveBeenCalledTimes(1);
    expect(navigateMock).toHaveBeenCalledWith('/checkout');
  });
});
