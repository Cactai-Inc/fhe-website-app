// @vitest-environment jsdom
/**
 * TASK-PAGEVIS — the control surface and the status tile, in the absence of a
 * browser. No staff browser session exists in this environment, so these stand
 * in for clicking it, and they are deliberately about BEHAVIOUR that could be
 * got wrong rather than about layout:
 *
 *  1. Every page is listed, visible ones included — a list of only the hidden
 *     pages cannot be used to hide anything.
 *  2. Hiding sends the KEY, never the path. This is the whole rename defence:
 *     if a path ever reached set_page_hidden, a route move would orphan the row.
 *  3. Hiding one page leaves its siblings alone, and touches nothing that looks
 *     like an entitlement.
 *  4. The page-visibility page itself has no toggle at all.
 *  5. A locked module's pages are listed but not togglable.
 *  6. The Ops status tile tells "Hidden" apart from "Locked" — and Hidden is
 *     still a link, because it is the way back.
 */
import '@testing-library/jest-dom/vitest';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { HelmetProvider } from 'react-helmet-async';

import { PAGE_REGISTRY } from '../../src/lib/pageRegistry';

/* The tenant under test. `hidden` and `modules` are mutated per-test. */
const tenant = {
  hidden: [] as string[],
  modules: [
    'mod.brokerage', 'mod.lessons', 'mod.boarding',
    'mod.barnops', 'mod.horserecords', 'mod.employees',
  ] as string[],
};

const setPageHidden = vi.fn(async (_key: string, hidden: boolean) => hidden);
const refreshHiddenPages = vi.fn(async () => {});

vi.mock('../../src/contexts/AuthContext', () => ({
  useAuth: () => ({
    get hiddenPages() { return tenant.hidden; },
    // useModules() (which OpsDashboard's ModuleGate reads) builds its map from
    // this array, so the tenant's entitlements have to be here too.
    get modules() { return tenant.modules; },
    hasModule: (k: string) => tenant.modules.includes(k),
    isPageHidden: (k: string) => tenant.hidden.includes(k),
    refreshHiddenPages,
  }),
}));

vi.mock('../../src/lib/api', () => ({
  setPageHidden: (k: string, h: boolean) => setPageHidden(k, h),
  countOpenDocuments: () => Promise.resolve(0),
  listIntake: () => Promise.resolve([]),
}));

const { default: AdminPageVisibilityPage } = await import(
  '../../src/pages/app/ops/admin/AdminPageVisibilityPage'
);
const { default: OpsDashboard } = await import('../../src/pages/app/ops/OpsDashboard');

function renderPage(ui: React.ReactElement) {
  // HelmetProvider because OpsDashboard sets its own <title>.
  return render(<HelmetProvider><MemoryRouter>{ui}</MemoryRouter></HelmetProvider>);
}

beforeEach(() => {
  tenant.hidden = [];
  tenant.modules = [
    'mod.brokerage', 'mod.lessons', 'mod.boarding',
    'mod.barnops', 'mod.horserecords', 'mod.employees',
  ];
  setPageHidden.mockClear();
  refreshHiddenPages.mockClear();
});
afterEach(cleanup);

describe('PAGEVIS — the Page visibility settings page', () => {
  it('lists EVERY registered page, visible ones included', () => {
    renderPage(<AdminPageVisibilityPage />);
    for (const p of PAGE_REGISTRY) {
      expect(
        screen.getByTestId(`pagevis-row-${p.key}`),
        `${p.label} is missing, so it cannot be hidden`,
      ).toBeInTheDocument();
    }
  });

  it('sends the page KEY, never the route path', async () => {
    const user = userEvent.setup();
    renderPage(<AdminPageVisibilityPage />);

    await user.click(screen.getByTestId('pagevis-toggle-boarding.facilities'));

    await waitFor(() => expect(setPageHidden).toHaveBeenCalledTimes(1));
    const [key, hidden] = setPageHidden.mock.calls[0];
    expect(key).toBe('boarding.facilities');
    expect(hidden).toBe(true);
    // The rename defence, stated as an assertion: a path must never be the key.
    expect(key.startsWith('/')).toBe(false);
    expect(key).not.toBe('/app/ops/boarding/facilities');
  });

  it('hides exactly one page — siblings and the module are untouched', async () => {
    const user = userEvent.setup();
    renderPage(<AdminPageVisibilityPage />);

    await user.click(screen.getByTestId('pagevis-toggle-boarding.facilities'));
    await waitFor(() => expect(setPageHidden).toHaveBeenCalledTimes(1));

    // exactly one write, for exactly one key
    expect(setPageHidden.mock.calls.map((c) => c[0])).toEqual(['boarding.facilities']);
    // and nothing resembling a module key was ever written
    for (const [key] of setPageHidden.mock.calls) {
      expect(key.startsWith('mod.')).toBe(false);
    }
    // the siblings still render their own toggles, unchanged
    for (const sib of ['boarding.hub', 'boarding.agreements', 'boarding.charges']) {
      expect(screen.getByTestId(`pagevis-toggle-${sib}`)).toHaveAttribute('aria-pressed', 'false');
    }
  });

  it('brings a hidden page back', async () => {
    const user = userEvent.setup();
    tenant.hidden = ['community.moderation'];
    renderPage(<AdminPageVisibilityPage />);

    expect(screen.getByTestId('pagevis-toggle-community.moderation'))
      .toHaveAttribute('aria-pressed', 'true');

    await user.click(screen.getByTestId('pagevis-toggle-community.moderation'));
    await waitFor(() => expect(setPageHidden).toHaveBeenCalledWith('community.moderation', false));
  });

  it('offers NO toggle for the page-visibility page itself', () => {
    renderPage(<AdminPageVisibilityPage />);
    expect(screen.getByTestId('pagevis-row-settings.page_visibility')).toBeInTheDocument();
    expect(screen.queryByTestId('pagevis-toggle-settings.page_visibility')).toBeNull();
    expect(screen.getByTestId('pagevis-row-settings.page_visibility')).toHaveTextContent(/always shown/i);
  });

  it('leaves the other Settings pages hideable — this one is enough to undo them', () => {
    renderPage(<AdminPageVisibilityPage />);
    for (const k of ['settings.branding', 'settings.products', 'settings.editor', 'settings.team']) {
      expect(screen.getByTestId(`pagevis-toggle-${k}`)).toBeEnabled();
    }
  });

  it('lists a locked module\'s pages but does not let you hide them', () => {
    tenant.modules = tenant.modules.filter((m) => m !== 'mod.employees');
    renderPage(<AdminPageVisibilityPage />);

    for (const k of ['employees.hub', 'employees.staff', 'employees.schedule']) {
      expect(screen.getByTestId(`pagevis-row-${k}`)).toBeInTheDocument();
      expect(screen.getByTestId(`pagevis-locked-${k}`)).toBeInTheDocument();
      expect(screen.queryByTestId(`pagevis-toggle-${k}`)).toBeNull();
    }
  });

  it('says the no-cascade rule out loud, next to the hub it applies to', () => {
    renderPage(<AdminPageVisibilityPage />);
    const boarding = screen.getByLabelText('Boarding & Facility');
    expect(boarding).toHaveTextContent(/hides only its own nav row/i);
    expect(boarding).toHaveTextContent(/keep theirs/i);
  });
});

describe('PAGEVIS — the Ops status tile keeps all four states apart', () => {
  it('renders a navigating tile when the module is on and the hub is shown', async () => {
    renderPage(<OpsDashboard />);
    expect(await screen.findByTestId('module-mod.boarding-tile')).toBeInTheDocument();
    expect(screen.queryByTestId('module-mod.boarding-hidden')).toBeNull();
  });

  it('renders HIDDEN — distinct from Locked, and still a link back', async () => {
    tenant.hidden = ['boarding.hub'];
    renderPage(<OpsDashboard />);

    const tile = await screen.findByTestId('module-mod.boarding-hidden');
    expect(tile).toHaveTextContent(/hidden/i);
    expect(tile.tagName).toBe('A');                        // the way back
    expect(tile).toHaveAttribute('href', '/app/ops/boarding');
    expect(screen.queryByTestId('module-mod.boarding-locked')).toBeNull();
    expect(screen.queryByTestId('module-mod.boarding-tile')).toBeNull();
  });

  it('renders LOCKED when the entitlement is missing — not the same thing', async () => {
    tenant.modules = tenant.modules.filter((m) => m !== 'mod.boarding');
    renderPage(<OpsDashboard />);

    const tile = await screen.findByTestId('module-mod.boarding-locked');
    expect(tile).toHaveTextContent(/locked/i);
    expect(tile.tagName).not.toBe('A');                    // nothing to click
    expect(screen.queryByTestId('module-mod.boarding-hidden')).toBeNull();
  });

  it('keeps ENABLED for an entitled module with no hub (brokerage)', async () => {
    renderPage(<OpsDashboard />);
    expect(await screen.findByTestId('module-mod.brokerage-enabled')).toBeInTheDocument();
  });

  it('hiding one module\'s hub leaves the other tiles alone', async () => {
    tenant.hidden = ['boarding.hub'];
    renderPage(<OpsDashboard />);

    await screen.findByTestId('module-mod.boarding-hidden');
    for (const m of ['mod.barnops', 'mod.employees', 'mod.horserecords', 'mod.lessons']) {
      expect(screen.getByTestId(`module-${m}-tile`)).toBeInTheDocument();
    }
  });
});
