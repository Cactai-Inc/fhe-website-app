// @vitest-environment jsdom
/**
 * OPS-DASH UI-interaction test (§15.2). Renders the REAL OpsDashboard over the
 * router harness, mocks `useModules()` + injects the four count fns, and proves:
 *  (a) tiles with a live screen render as <Link>s to REGISTERED routes only;
 *      tiles whose screen has not shipped render non-navigating (no dead links),
 *  (b) a disabled-module tile renders LOCKED and is NOT a link,
 *  (c) all four count fns are called ON MOUNT and their resolved numbers render,
 *  (d) a rejecting count fn renders an INLINE error, not a blank tile,
 *  (e) the Wave-7 seam: registering a hub in the MODULE_HUB_ROUTES map turns an
 *      enabled module's status tile into a real navigating <Link>.
 * Static dead-end audit: every tile is a real <Link> to an existing route, a
 * non-navigating status tile, or a gated locked node — no dead links anywhere.
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

import OpsDashboard, { MODULE_HUB_ROUTES } from './OpsDashboard';

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

  it('(a) KPI tiles link ONLY to screens that exist; the intake tile does not navigate yet', async () => {
    renderWithRouter(<OpsDashboard counts={makeCounts()} />, { route: '/app/ops' });
    await screen.findByTestId('kpi-engagements-value');

    expect(screen.getByTestId('kpi-engagements')).toHaveAttribute('href', '/app/ops/engagements');
    expect(screen.getByTestId('kpi-documents')).toHaveAttribute('href', '/app/ops/documents');
    // Open charges surface (and settle) on the transactions reconcile screen.
    expect(screen.getByTestId('kpi-billing')).toHaveAttribute('href', '/app/ops/transactions');

    // No intake-review screen is registered — the tile still shows its count
    // but is NOT a link (no dead /app/ops/intake click).
    const intake = screen.getByTestId('kpi-intake');
    expect(intake.tagName).not.toBe('A');
    expect(intake).not.toHaveAttribute('href');
    expect(intake.querySelector('a')).toBeNull();
  });

  it('(a) an enabled module WITHOUT a live hub renders a non-navigating Enabled tile', async () => {
    renderWithRouter(<OpsDashboard counts={makeCounts()} />, { route: '/app/ops' });

    // No module hub routes ship yet — the default map is EMPTY.
    expect(Object.keys(MODULE_HUB_ROUTES)).toHaveLength(0);

    const brokerage = await screen.findByTestId('module-mod.brokerage-enabled');
    expect(brokerage).toHaveTextContent('Brokerage');
    expect(brokerage).toHaveTextContent('Enabled');
    // Not a link, and nothing navigable inside — no dead /app/ops/brokerage click.
    expect(brokerage.tagName).not.toBe('A');
    expect(brokerage.querySelector('a')).toBeNull();
    expect(screen.queryByTestId('module-mod.brokerage-tile')).toBeNull();
  });

  it('(e) Wave-7 seam: a hub registered in the route map turns the tile into a real Link', async () => {
    // Simulates Wave 7 registering the hub route in App.tsx AND adding its
    // MODULE_HUB_ROUTES entry — the tile then navigates.
    renderWithRouter(
      <OpsDashboard
        counts={makeCounts()}
        hubRoutes={{ 'mod.brokerage': '/app/ops/brokerage' }}
      />,
      { route: '/app/ops' },
    );

    const brokerage = await screen.findByTestId('module-mod.brokerage-tile');
    expect(brokerage.tagName).toBe('A');
    expect(brokerage).toHaveAttribute('href', '/app/ops/brokerage');
    expect(brokerage).toHaveTextContent('Brokerage');
    expect(screen.queryByTestId('module-mod.brokerage-enabled')).toBeNull();
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
    expect(screen.getByTestId('kpi-billing')).toHaveAttribute('href', '/app/ops/transactions');
    expect(screen.queryByTestId('kpi-billing-value')).toBeNull();
    expect(await screen.findByTestId('kpi-engagements-value')).toHaveTextContent('7');
  });

  it('static audit: every rendered tile is a link to a registered route, a status tile, or a locked node', async () => {
    renderWithRouter(<OpsDashboard counts={makeCounts()} />, { route: '/app/ops' });
    await screen.findByTestId('kpi-engagements-value');

    // Routes registered in App.tsx — the ONLY legal link targets on this page.
    const registered = new Set([
      '/app/ops/engagements',
      '/app/ops/documents',
      '/app/ops/transactions',
    ]);
    // KPI tiles: linked tiles target registered routes; intake is non-navigating.
    for (const key of ['engagements', 'documents', 'billing']) {
      const tile = screen.getByTestId(`kpi-${key}`);
      expect(tile.tagName).toBe('A');
      expect(registered.has(tile.getAttribute('href') ?? '')).toBe(true);
    }
    expect(screen.getByTestId('kpi-intake').tagName).not.toBe('A');

    // Module tiles: enabled brokerage is a status tile (default map is empty);
    // every disabled module is a locked node. NO anchors in the module grid.
    expect(screen.getByTestId('module-mod.brokerage-enabled').tagName).not.toBe('A');
    for (const key of ['mod.lessons', 'mod.boarding', 'mod.barnops', 'mod.horserecords', 'mod.employees']) {
      expect(screen.getByTestId(`module-${key}-locked`)).toBeInTheDocument();
      expect(screen.queryByTestId(`module-${key}-tile`)).toBeNull();
    }
  });
});
