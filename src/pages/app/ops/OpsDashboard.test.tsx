// @vitest-environment jsdom
/**
 * OPS-DASH UI-interaction test (§15.2). Renders the REAL OpsDashboard over the
 * router harness, mocks `useModules()` + injects the four count fns, and proves:
 *  (a) enabled-module tiles render as <Link>s to the correct routes,
 *  (b) a disabled-module tile renders LOCKED and is NOT a link,
 *  (c) all four count fns are called ON MOUNT and their resolved numbers render,
 *  (d) a rejecting count fn renders an INLINE error, not a blank tile.
 * Static dead-end audit: every KPI + module tile is a real <Link> (has href) or
 * a gated locked node — no dead tiles, no swallowed-then-lost count error.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderWithRouter, screen } from '../../../test/render';

// Mock the entitlement hook: brokerage ON, boarding OFF.
vi.mock('../../../lib/ops/useModules', () => ({
  useModules: () => ({
    'mod.brokerage': true,
    'mod.lessons': false,
    'mod.boarding': false,
    'mod.barnops': false,
    'mod.horserecords': false,
    'mod.employees': false,
  }),
}));

import OpsDashboard from './OpsDashboard';

type CountFn = () => Promise<number>;

function makeCounts(overrides: Partial<Record<string, CountFn>> = {}) {
  return {
    openEngagements: vi.fn<CountFn>().mockResolvedValue(7),
    pendingIntake: vi.fn<CountFn>().mockResolvedValue(3),
    draftDocuments: vi.fn<CountFn>().mockResolvedValue(5),
    openBillableLines: vi.fn<CountFn>().mockResolvedValue(2),
    ...overrides,
  };
}

beforeEach(() => vi.clearAllMocks());

describe('OPS-DASH — ops home dashboard', () => {
  it('(c) calls every count fn on mount and renders the resolved numbers', async () => {
    const counts = makeCounts();
    renderWithRouter(<OpsDashboard counts={counts} />, { route: '/app/ops' });

    // All four fire on mount…
    expect(counts.openEngagements).toHaveBeenCalledTimes(1);
    expect(counts.pendingIntake).toHaveBeenCalledTimes(1);
    expect(counts.draftDocuments).toHaveBeenCalledTimes(1);
    expect(counts.openBillableLines).toHaveBeenCalledTimes(1);

    // …and their resolved numbers land in the right tiles.
    expect(await screen.findByTestId('kpi-engagements-value')).toHaveTextContent('7');
    expect(screen.getByTestId('kpi-intake-value')).toHaveTextContent('3');
    expect(screen.getByTestId('kpi-documents-value')).toHaveTextContent('5');
    expect(screen.getByTestId('kpi-billing-value')).toHaveTextContent('2');
  });

  it('(a) KPI tiles are real links to their screens', async () => {
    renderWithRouter(<OpsDashboard counts={makeCounts()} />, { route: '/app/ops' });
    await screen.findByTestId('kpi-engagements-value');

    expect(screen.getByTestId('kpi-engagements')).toHaveAttribute('href', '/app/ops/engagements');
    expect(screen.getByTestId('kpi-intake')).toHaveAttribute('href', '/app/ops/intake');
    expect(screen.getByTestId('kpi-documents')).toHaveAttribute('href', '/app/ops/documents');
    expect(screen.getByTestId('kpi-billing')).toHaveAttribute('href', '/app/ops/billing');
  });

  it('(a) an enabled-module tile renders as a Link to the right route', async () => {
    renderWithRouter(<OpsDashboard counts={makeCounts()} />, { route: '/app/ops' });

    const brokerage = await screen.findByTestId('module-mod.brokerage-tile');
    expect(brokerage.tagName).toBe('A');
    expect(brokerage).toHaveAttribute('href', '/app/ops/brokerage');
    expect(brokerage).toHaveTextContent('Brokerage');
  });

  it('(b) a disabled-module tile renders LOCKED and does NOT link', async () => {
    renderWithRouter(<OpsDashboard counts={makeCounts()} />, { route: '/app/ops' });
    await screen.findByTestId('kpi-engagements-value');

    // The locked fallback is present…
    const locked = screen.getByTestId('module-mod.boarding-locked');
    expect(locked).toHaveTextContent('Boarding');
    expect(locked).toHaveTextContent('Locked');
    // …and there is NO navigating tile (no <Link>) for the disabled module.
    expect(screen.queryByTestId('module-mod.boarding-tile')).toBeNull();
    expect(locked.tagName).not.toBe('A');
    expect(locked.querySelector('a')).toBeNull();
  });

  it('(d) a rejecting count fn renders an inline error, not a blank tile', async () => {
    const counts = makeCounts({
      openBillableLines: vi.fn<CountFn>().mockRejectedValue(new Error('rls denied')),
    });
    renderWithRouter(<OpsDashboard counts={counts} />, { route: '/app/ops' });

    // The billing tile shows an inline error…
    const err = await screen.findByTestId('kpi-billing-error');
    expect(err).toHaveTextContent(/couldn/i);
    expect(err).toHaveAttribute('role', 'alert');
    // …the tile is still a link (not blank/removed), and the OTHER tiles resolve.
    expect(screen.getByTestId('kpi-billing')).toHaveAttribute('href', '/app/ops/billing');
    expect(screen.queryByTestId('kpi-billing-value')).toBeNull();
    expect(await screen.findByTestId('kpi-engagements-value')).toHaveTextContent('7');
  });

  it('static audit: every rendered tile is either a link (href) or a gated locked node', async () => {
    renderWithRouter(<OpsDashboard counts={makeCounts()} />, { route: '/app/ops' });
    await screen.findByTestId('kpi-engagements-value');

    // KPI tiles: all four are anchors with hrefs.
    for (const key of ['engagements', 'intake', 'documents', 'billing']) {
      const tile = screen.getByTestId(`kpi-${key}`);
      expect(tile.tagName).toBe('A');
      expect(tile.getAttribute('href')).toBeTruthy();
    }
    // Module tiles: brokerage links; every other (disabled) module is a locked node.
    expect(screen.getByTestId('module-mod.brokerage-tile').tagName).toBe('A');
    for (const key of ['mod.lessons', 'mod.boarding', 'mod.barnops', 'mod.horserecords', 'mod.employees']) {
      expect(screen.getByTestId(`module-${key}-locked`)).toBeInTheDocument();
      expect(screen.queryByTestId(`module-${key}-tile`)).toBeNull();
    }
  });
});
