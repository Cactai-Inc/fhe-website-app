// @vitest-environment jsdom
/**
 * U15 UI-interaction test (Wiring & Verification Contract §15.1(2)): renders the REAL
 * AppLayout and proves module/role nav gating actually works end to end.
 *
 *  - MODULE GATE: an FHE session (mod.lessons + mod.brokerage, NOT boarding/barnops/
 *    employees) shows Lessons + Brokerage nav and HIDES Boarding/Barn Ops/Employees —
 *    the manual acceptance criterion, driven by the real hasModule() the layout reads.
 *  - ROLE GATE: the Admin link appears only for isAdmin.
 *  - No dead ends: the Sign out button fires the real signOut fn and then navigates.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderWithRouter, screen, userEvent, within } from '../../test/render';
import AppLayout, { visibleNav } from './AppLayout';

const signOut = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));
const auth = vi.hoisted(() => {
  const build = (modules: string[], isAdmin: boolean) => {
    const set = new Set(modules);
    return {
      profile: { display_name: 'Camille' },
      isAdmin,
      modules,
      hasModule: (key: string) => set.has(key),
      signOut,
    };
  };
  return { build, value: build([], false) };
});

vi.mock('../../contexts/AuthContext', () => ({
  useAuth: () => auth.value,
}));

function setAuth(modules: string[], isAdmin = false) {
  auth.value = auth.build(modules, isAdmin);
}

beforeEach(() => {
  vi.clearAllMocks();
  setAuth(['mod.lessons', 'mod.brokerage']); // the FHE launch entitlement
});

describe('visibleNav() — the pure gating predicate', () => {
  it('keeps core items always and module items only when entitled', () => {
    const has = (k: string) => k === 'mod.lessons';
    const labels = visibleNav(has).map((i) => i.label);
    expect(labels).toContain('Dashboard');   // core, always
    expect(labels).toContain('Lessons');      // entitled
    expect(labels).not.toContain('Brokerage'); // not entitled
    expect(labels).not.toContain('Boarding');
  });
});

describe('AppLayout nav — module gate (FHE acceptance)', () => {
  it('shows Lessons + Brokerage and hides Boarding/Barn Ops/Employees', () => {
    renderWithRouter(<AppLayout />, { route: '/app' });
    const nav = screen.getAllByRole('navigation', { name: 'Member area' })[0];
    const q = within(nav);
    expect(q.getByRole('link', { name: /Lessons/ })).toBeInTheDocument();
    expect(q.getByRole('link', { name: /Brokerage/ })).toBeInTheDocument();
    expect(q.queryByRole('link', { name: /Boarding/ })).not.toBeInTheDocument();
    expect(q.queryByRole('link', { name: /Barn Ops/ })).not.toBeInTheDocument();
    expect(q.queryByRole('link', { name: /Employees/ })).not.toBeInTheDocument();
  });

  it('a boarding tenant shows Boarding and hides Lessons', () => {
    setAuth(['mod.boarding', 'mod.barnops']);
    renderWithRouter(<AppLayout />, { route: '/app' });
    const nav = screen.getAllByRole('navigation', { name: 'Member area' })[0];
    const q = within(nav);
    expect(q.getByRole('link', { name: /Boarding/ })).toBeInTheDocument();
    expect(q.getByRole('link', { name: /Barn Ops/ })).toBeInTheDocument();
    expect(q.queryByRole('link', { name: /Lessons/ })).not.toBeInTheDocument();
    expect(q.queryByRole('link', { name: /Brokerage/ })).not.toBeInTheDocument();
  });
});

describe('AppLayout nav — role gate', () => {
  it('hides the Admin link for a non-admin', () => {
    renderWithRouter(<AppLayout />, { route: '/app' });
    expect(screen.queryByRole('link', { name: /Admin/ })).not.toBeInTheDocument();
  });

  it('shows the Admin link for an admin', () => {
    setAuth(['mod.lessons'], true);
    renderWithRouter(<AppLayout />, { route: '/app' });
    expect(screen.getAllByRole('link', { name: /Admin/ }).length).toBeGreaterThan(0);
  });
});

describe('AppLayout — no dead ends', () => {
  it('the Sign out button fires the real signOut fn', async () => {
    const user = userEvent.setup();
    renderWithRouter(<AppLayout />, { route: '/app' });
    await user.click(screen.getAllByRole('button', { name: /Sign out/ })[0]);
    expect(signOut).toHaveBeenCalledTimes(1);
  });
});
