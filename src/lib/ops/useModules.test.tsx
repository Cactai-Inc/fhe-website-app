// @vitest-environment jsdom
/**
 * INT-AUTH — Layer-C entitlement bridge (PLATFORM_ARCHITECTURE.md §4.3, §15.1).
 *
 * Real-path proof (NO mock at the entitlement seam): renders the REAL
 * `AuthProvider` over a mocked supabase client, drives its real `loadProfile`
 * path (`supabase.rpc('my_modules')` + `profiles` role/org read), and asserts a
 * probe using the REAL `useModules()`/`useEntitlements()` hooks sees:
 *   - the module map with entitled keys true and un-entitled catalog keys FALSE,
 *   - role / orgId / isSuperAdmin surfaced off the context,
 *   - the error branch fails CLOSED (no modules) without blocking sign-in.
 *
 * Static dead-end audit: the my_modules RPC is actually called; useModules /
 * useEntitlements are actually invoked and their output rendered (no
 * defined-but-unused hook, no swallowed-then-lost data).
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderWithRouter, screen } from '../../test/render';
import { AuthProvider } from '../../contexts/AuthContext';
import { useModules, useEntitlements } from './useModules';

// ── Mock the supabase client the real AuthProvider drives ────────────────────
const rpc = vi.hoisted(() => vi.fn());
const from = vi.hoisted(() => vi.fn());
const getSession = vi.hoisted(() => vi.fn());
const onAuthStateChange = vi.hoisted(() => vi.fn());
vi.mock('../supabase', () => ({
  supabase: { rpc, from, auth: { getSession, onAuthStateChange } },
}));

const USER_ID = 'user-1';
const ORG_ID = 'org-abc';

/** A single-user session, as supabase.auth.getSession() returns it. */
function stubSession() {
  getSession.mockResolvedValue({ data: { session: { user: { id: USER_ID } } } });
  onAuthStateChange.mockReturnValue({ data: { subscription: { unsubscribe: vi.fn() } } });
}

/** profiles → role/org row; memberships → active. loadProfile reads both. */
function stubProfileFrom(profileRow: Record<string, unknown> | null) {
  from.mockImplementation((table: string) => ({
    select: () => ({
      eq: () => ({
        maybeSingle: () =>
          Promise.resolve({
            data:
              table === 'profiles'
                ? profileRow
                : { user_id: USER_ID, status: 'active' },
          }),
      }),
    }),
  }));
}

/** A probe that renders the REAL hooks so we can assert their real output. */
function EntitlementProbe() {
  const modules = useModules();
  const { role, orgId, isSuperAdmin, has } = useEntitlements();
  return (
    <div>
      <span data-testid="brokerage">{String(modules['mod.brokerage'])}</span>
      <span data-testid="lessons">{String(modules['mod.lessons'])}</span>
      <span data-testid="boarding">{String(modules['mod.boarding'])}</span>
      <span data-testid="barnops">{String(modules['mod.barnops'])}</span>
      <span data-testid="has-lessons">{String(has('mod.lessons'))}</span>
      <span data-testid="role">{role ?? 'none'}</span>
      <span data-testid="orgId">{orgId ?? 'none'}</span>
      <span data-testid="isSuperAdmin">{String(isSuperAdmin)}</span>
    </div>
  );
}

function renderProbe() {
  return renderWithRouter(
    <AuthProvider>
      <EntitlementProbe />
    </AuthProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  stubSession();
});

describe('INT-AUTH entitlement bridge — useModules / useEntitlements', () => {
  it('surfaces the my_modules() set as a fail-closed map and projects role/orgId', async () => {
    rpc.mockResolvedValue({ data: ['mod.brokerage', 'mod.lessons'], error: null });
    stubProfileFrom({ user_id: USER_ID, role: 'ADMIN', org_id: ORG_ID });

    renderProbe();

    // Entitled keys resolve true…
    expect(await screen.findByTestId('brokerage')).toHaveTextContent('true');
    expect(screen.getByTestId('lessons')).toHaveTextContent('true');
    // …and un-entitled CATALOG keys are present as false (fail-closed), not absent.
    expect(screen.getByTestId('boarding')).toHaveTextContent('false');
    expect(screen.getByTestId('barnops')).toHaveTextContent('false');
    expect(screen.getByTestId('has-lessons')).toHaveTextContent('true');

    // Role / org surfaced off the real context.
    expect(screen.getByTestId('role')).toHaveTextContent('ADMIN');
    expect(screen.getByTestId('orgId')).toHaveTextContent(ORG_ID);
    expect(screen.getByTestId('isSuperAdmin')).toHaveTextContent('false');

    // The real RPC seam was actually exercised (no defined-but-uncalled path).
    expect(rpc).toHaveBeenCalledWith('my_modules');
  });

  it('surfaces isSuperAdmin for a SUPER_ADMIN role', async () => {
    rpc.mockResolvedValue({ data: ['mod.brokerage'], error: null });
    stubProfileFrom({ user_id: USER_ID, role: 'SUPER_ADMIN', org_id: ORG_ID });

    renderProbe();

    expect(await screen.findByTestId('isSuperAdmin')).toHaveTextContent('true');
    expect(screen.getByTestId('role')).toHaveTextContent('SUPER_ADMIN');
  });

  it('fails CLOSED to no modules when my_modules() errors (does not block sign-in)', async () => {
    // The wrapper throws on an error payload; loadProfile catches → modules = [].
    rpc.mockResolvedValue({ data: null, error: { message: 'rpc not deployed' } });
    stubProfileFrom({ user_id: USER_ID, role: 'USER', org_id: ORG_ID });

    renderProbe();

    // Role/org still surface (sign-in not blocked) but EVERY module is off.
    expect(await screen.findByTestId('role')).toHaveTextContent('USER');
    expect(screen.getByTestId('brokerage')).toHaveTextContent('false');
    expect(screen.getByTestId('lessons')).toHaveTextContent('false');
    expect(screen.getByTestId('boarding')).toHaveTextContent('false');
    expect(screen.getByTestId('has-lessons')).toHaveTextContent('false');
  });
});
