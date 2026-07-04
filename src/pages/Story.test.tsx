// @vitest-environment jsdom
/**
 * LANE-PUBLIC story smoke test.
 *
 * The brand-story page is four sections:
 *   1 · the place        — "Coastal air, and trails without end."
 *   2 · transformation   — "New friends. New adventures. A new you."
 *   3 · belonging        — "You will not ride alone." (community, the climax)
 *   4 · visual closer    — image only (no heading, no copy, no CTA)
 * The onward path to /shop lives in Section 3's "Ways In" preview (Section 4
 * carries no CTA). This proves the section headlines render, the ways-in preview
 * links onward, and the region-aware nav tone map is exactly S2+S4 dark (the
 * scroll sequence dark-green → white → dark-green → white).
 */
import { describe, it, expect } from 'vitest';
import { renderWithRouter, screen } from '../test/render';
import Story from './Story';

describe('Story', () => {
  it('renders the section headlines (place, transformation, belonging)', () => {
    renderWithRouter(<Story />);

    // 1 · the place
    expect(
      screen.getByRole('heading', { name: /coastal air, and trails without end/i }),
    ).toBeInTheDocument();
    // 2 · transformation
    expect(
      screen.getByRole('heading', { name: /new friends\.\s*new adventures\.\s*a new you/i }),
    ).toBeInTheDocument();
    // 3 · belonging (community, rebuilt)
    expect(
      screen.getByRole('heading', { name: /you will not\s+ride alone/i }),
    ).toBeInTheDocument();

    // The old "in good hands" line is gone.
    expect(screen.queryByRole('heading', { name: /in good hands/i })).not.toBeInTheDocument();
  });

  it('section 4 is image-only — no closing CTA on the story page', () => {
    renderWithRouter(<Story />);
    // The "come ride with us" CTA now lives only on the landing.
    expect(screen.queryByRole('link', { name: /come ride with us/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: /the gate is open/i })).not.toBeInTheDocument();
  });

  it('previews the ways in and links them onward', () => {
    renderWithRouter(<Story />);

    expect(screen.getByRole('link', { name: /riding lessons/i })).toHaveAttribute('href', '/shop');
    expect(screen.getByRole('link', { name: /membership/i })).toHaveAttribute('href', '/shop');
    expect(screen.getByRole('link', { name: /finding a horse/i })).toHaveAttribute('href', '/acquisition');
  });

  it('marks EXACTLY the dark sections for the region-aware nav (S2 + S4 only)', () => {
    const { container } = renderWithRouter(<Story />);

    // The authoritative tone map: dark-green(S1) → white(S2) → dark-green(S3 +
    // Ways In) → white(S4). Only S2 and S4 carry data-header-tone="dark".
    const dark = Array.from(container.querySelectorAll('[data-header-tone="dark"]'));
    expect(dark).toHaveLength(2);

    // S2 (transformation) is a dark green band → marked.
    const s2 = container.querySelector('[data-header-tone="dark"].bg-green-900');
    expect(s2).toBeTruthy();
    expect(s2?.textContent).toMatch(/new friends/i);

    // Every marked element is a <section> (full-bleed band), never S1/S3 content.
    dark.forEach((el) => expect(el.tagName).toBe('SECTION'));

    // S1 (place) and S3 (belonging) are LIGHT (cream) → NOT marked, so the nav
    // reads dark-green there. Their headings must live outside any dark marker.
    const s1Heading = screen.getByRole('heading', { name: /coastal air, and trails without end/i });
    const s3Heading = screen.getByRole('heading', { name: /you will not\s+ride alone/i });
    expect(s1Heading.closest('[data-header-tone="dark"]')).toBeNull();
    expect(s3Heading.closest('[data-header-tone="dark"]')).toBeNull();

    // The "Ways In" preview is inside S3 → also unmarked (dark-green nav).
    const waysIn = screen.getByRole('heading', { name: /find the way that fits you/i });
    expect(waysIn.closest('[data-header-tone="dark"]')).toBeNull();
  });
});
