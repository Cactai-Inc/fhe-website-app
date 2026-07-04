// @vitest-environment jsdom
/**
 * LANE-PUBLIC story smoke test.
 *
 * The brand-story page is a four-section cinematic arc through one place:
 *   1 · the place (coastal establishing)   — "Coastal air, and trails without end."
 *   2 · the stables (her own horse)          — "In good hands."
 *   3 · the arena / community (the people)   — "Rarely alone in the arena."
 *   4 · closing CTA band (toward the hills)  — "The gate is open."
 * This proves the four headlines render, the ways-in preview links onward, and
 * the closing CTA points at the shop (/shop).
 */
import { describe, it, expect } from 'vitest';
import { renderWithRouter, screen } from '../test/render';
import Story from './Story';

describe('Story', () => {
  it('renders the four section headlines in the cinematic arc', () => {
    renderWithRouter(<Story />);

    // 1 · the place
    expect(
      screen.getByRole('heading', { name: /coastal air, and trails without end/i }),
    ).toBeInTheDocument();
    // 2 · the stables
    expect(
      screen.getByRole('heading', { name: /in good hands/i }),
    ).toBeInTheDocument();
    // 3 · the arena / community
    expect(
      screen.getByRole('heading', { name: /rarely alone\s+in the arena/i }),
    ).toBeInTheDocument();
    // 4 · closing band
    expect(
      screen.getByRole('heading', { name: /the gate is open/i }),
    ).toBeInTheDocument();
  });

  it('routes the closing CTA into the shop', () => {
    renderWithRouter(<Story />);

    const cta = screen.getByRole('link', { name: /come ride with us/i });
    expect(cta).toHaveAttribute('href', '/shop');
  });

  it('previews the ways in and links them onward', () => {
    renderWithRouter(<Story />);

    expect(screen.getByRole('link', { name: /riding lessons/i })).toHaveAttribute('href', '/shop');
    expect(screen.getByRole('link', { name: /membership/i })).toHaveAttribute('href', '/shop');
    expect(screen.getByRole('link', { name: /finding a horse/i })).toHaveAttribute('href', '/acquisition');
  });
});
