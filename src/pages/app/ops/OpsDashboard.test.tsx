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

  it('(a) every KPI tile links to its registered screen (intake screen shipped in Wave-7)', async () => {
    renderWithRouter(<OpsDashboard counts={makeCounts()} />, { route: '/app/ops' });
    await screen.findByTestId('kpi-engagements-value');

    expect(screen.getByTestId('kpi-engagements')).toHaveAttribute('href', '/app/ops/engagements');
    expect(screen.getByTestId('kpi-intake')).toHaveAttribute('href', '/app/ops/intake');
    expect(screen.getByTestId('kpi-documents')).toHaveAttribute('href', '/app/ops/documents');
    // Open charges surface (and settle) on the transactions reconcile screen.
    expect(screen.getByTestId('kpi-billing')).toHaveAttribute('href', '/app/ops/transactions');
  });

  it('(a) Wave-7 hub map lists live hubs; an enabled module WITHOUT a hub stays a status tile', async () => {
    renderWithRouter(<OpsDashboard counts={makeCounts()} />, { route: '/app/ops' });

    // Five hubs shipped in Wave-7; employees has no hub yet.
    expect(MODULE_HUB_ROUTES).toMatchObject({
      'mod.brokerage': '/app/ops/brokerage',
      'mod.lessons': '/app/ops/lessons',
      'mod.boarding': '/app/ops/boarding',
      'mod.barnops': '/app/ops/barnops',
      'mod.horserecords': '/app/ops/records',
    });
    expect(MODULE_HUB_ROUTES['mod.employees']).toBeUndefined();

    // brokerage is enabled AND has a hub — it renders as a real link tile now.
    const brokerage = await screen.findByTestId('module-mod.brokerage-tile');
    expect(brokerage.tagName).toBe('A');
    expect(brokerage).toHaveAttribute('href', '/app/ops/brokerage');
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
      '/app/ops/intake',
      '/app/ops/documents',
      '/app/ops/transactions',
      '/app/ops/brokerage',
    ]);
    // KPI tiles: every KPI is a link targeting a registered route (Wave-7 shipped intake).
    for (const key of ['engagements', 'intake', 'documents', 'billing']) {
      const tile = screen.getByTestId(`kpi-${key}`);
      expect(tile.tagName).toBe('A');
      expect(registered.has(tile.getAttribute('href') ?? '')).toBe(true);
    }

    // Module tiles: enabled brokerage links to its live hub (registered route);
    // every disabled module is a locked node with no anchor.
    const brokerage = screen.getByTestId('module-mod.brokerage-tile');
    expect(brokerage.tagName).toBe('A');
    expect(registered.has(brokerage.getAttribute('href') ?? '')).toBe(true);
    for (const key of ['mod.lessons', 'mod.boarding', 'mod.barnops', 'mod.horserecords', 'mod.employees']) {
      expect(screen.getByTestId(`module-${key}-locked`)).toBeInTheDocument();
      expect(screen.queryByTestId(`module-${key}-tile`)).toBeNull();
    }
  });
});
