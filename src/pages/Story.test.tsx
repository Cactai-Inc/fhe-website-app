// @vitest-environment jsdom
/**
 * LANE-PUBLIC story smoke test.
 *
 * The brand-story page is the "come learn about us" narrative. This proves the
 * key section headings render, the two CTAs (hero + closing band) advance the
 * lessons funnel, and the offerings grid links out to the real service pages.
 */
import { describe, it, expect } from 'vitest';
import { renderWithRouter, screen } from '../test/render';
import Story from './Story';

describe('Story', () => {
  it('renders the hero headline and the core section headings', () => {
    renderWithRouter(<Story />);

    expect(
      screen.getByRole('heading', { name: /a place to ride,\s*and a place to belong/i }),
    ).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /the horse learns best/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /carmel creek ranch/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /every way into the barn/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /joining a barn/i })).toBeInTheDocument();
  });

  it('wires both CTAs into the lessons funnel', () => {
    renderWithRouter(<Story />);

    const ctas = screen.getAllByRole('link', { name: /lessons|come ride with us/i });
    // Hero "See lessons & pricing" + closing "Come ride with us" both → /lessons.
    const lessonsCtas = ctas.filter((a) => a.getAttribute('href') === '/lessons');
    expect(lessonsCtas.length).toBeGreaterThanOrEqual(2);
  });

  it('links the offerings grid out to the real service pages', () => {
    renderWithRouter(<Story />);

    expect(screen.getByRole('link', { name: /riding lessons/i })).toHaveAttribute('href', '/lessons');
    expect(screen.getByRole('link', { name: /finding a horse/i })).toHaveAttribute('href', '/acquisition');
    expect(screen.getByRole('link', { name: /horse care/i })).toHaveAttribute('href', '/horse');
  });
});
