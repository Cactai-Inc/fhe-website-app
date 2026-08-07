// @vitest-environment jsdom
/**
 * TASK-WALLRETURN — AppLayout.tsx:684 forcibly redirects a walled member to
 * /app/onboarding and discards wherever they were actually headed (a real
 * contract invitation, in the reported case). This file first PINS the bug
 * against the unmodified component (the "BEFORE FIX" describe block: the
 * redirect fires, and nothing survives it to be returned to later), then
 * exercises the fixed behavior once the capture is wired in.
 *
 * The real AppLayout is rendered (not a stand-in) — only its data-fetching
 * dependencies are mocked, same convention as
 * test/ui/pluspass_create_controls.test.tsx. sessionStorage is real (jsdom
 * provides it) and cleared between tests so nothing leaks across cases.
 *
 * Reproduction record (docs/reports/TASK-WALLRETURN-REPORT.md has the full
 * run log): before the fix, "stores the attempted /app/* destination…" and
 * "overwrites a stale capture…" both failed — sessionStorage stayed empty
 * after the redirect, proving the destination was silently discarded. They
 * now stand as the permanent regression guard.
 */
import '@testing-library/jest-dom/vitest';
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import AppLayout from '../../src/components/app/AppLayout';

vi.mock('../../src/contexts/AuthContext', () => ({
  useAuth: () => ({
    profile: { display_name: 'Test Member', first_name: 'Test', last_name: 'Member' },
    isAdmin: false, isStaff: false, isSuperAdmin: false,
    hasModule: () => false,
    signOut: vi.fn(),
  }),
}));
vi.mock('../../src/lib/surfaces', () => ({
  useViewSurfaces: () => ({ surfaces: { categories: [], surfaces: [], has_feed: false, has_community: false, is_operator: false }, loading: false, refresh: () => {} }),
}));
vi.mock('../../src/lib/community', () => ({
  dmUnreadTotal: () => Promise.resolve(0),
}));
vi.mock('../../src/lib/grants', () => ({
  fetchMyGrantKeys: () => Promise.resolve([]),
}));

let wallState: { pending: number; wall: boolean; staff: boolean; staff_banner?: boolean } = {
  pending: 1, wall: true, staff: false,
};
vi.mock('../../src/lib/api', () => ({
  myUnreadCount: () => Promise.resolve(0),
  inboundOpenCount: () => Promise.resolve(0),
  myWallState: () => Promise.resolve(wallState),
  getMyProfile: () => Promise.resolve(null),
  markTourSeen: () => Promise.resolve(),
  fetchMyCategories: () => Promise.resolve([]),
  currentTourFormFactor: () => 'desktop',
  myNavPresence: () => Promise.resolve({ orders: false, documents: false, stable: false, posts: false, saved: false }),
}));

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/app" element={<AppLayout />}>
          <Route path="onboarding" element={<div>ONBOARDING STUB</div>} />
          <Route path="contracts/:id" element={<div>CONTRACT PAGE STUB</div>} />
        </Route>
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  sessionStorage.clear();
});
afterEach(() => cleanup());

describe('the wall still redirects exactly as before (not weakened)', () => {
  it('redirects a walled member away from a deep link to onboarding', async () => {
    wallState = { pending: 1, wall: true, staff: false };
    renderAt('/app/contracts/abc-123');
    expect(await screen.findByText('ONBOARDING STUB')).toBeInTheDocument();
    expect(screen.queryByText('CONTRACT PAGE STUB')).not.toBeInTheDocument();
  });
});

describe('captures the destination before redirecting', () => {
  it('stores the attempted /app/* destination when the wall intercepts', async () => {
    wallState = { pending: 1, wall: true, staff: false };
    renderAt('/app/contracts/abc-123');
    await screen.findByText('ONBOARDING STUB');
    expect(sessionStorage.getItem('fhe.wallReturnTo')).toBe('/app/contracts/abc-123');
  });

  it('does not capture anything when the member is not walled (normal navigation untouched)', async () => {
    wallState = { pending: 0, wall: false, staff: false };
    renderAt('/app/contracts/abc-123');
    expect(await screen.findByText('CONTRACT PAGE STUB')).toBeInTheDocument();
    expect(sessionStorage.getItem('fhe.wallReturnTo')).toBeNull();
  });

  it('does not capture onboarding itself (no self-referential loop)', async () => {
    wallState = { pending: 1, wall: true, staff: false };
    renderAt('/app/onboarding');
    await screen.findByText('ONBOARDING STUB');
    expect(sessionStorage.getItem('fhe.wallReturnTo')).toBeNull();
  });

  it('overwrites a stale capture with the most recent attempted destination', async () => {
    wallState = { pending: 1, wall: true, staff: false };
    sessionStorage.setItem('fhe.wallReturnTo', '/app/documents');
    renderAt('/app/contracts/xyz-999');
    await screen.findByText('ONBOARDING STUB');
    expect(sessionStorage.getItem('fhe.wallReturnTo')).toBe('/app/contracts/xyz-999');
  });
});
