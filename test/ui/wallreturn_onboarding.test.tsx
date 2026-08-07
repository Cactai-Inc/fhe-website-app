// @vitest-environment jsdom
/**
 * TASK-WALLRETURN — the other half of the fix. AppLayout.tsx captures the
 * destination (see wallreturn_applayout.test.tsx); this file exercises where
 * it gets consumed: Onboarding.tsx's enterApp(), the single exit point every
 * step of the onboarding flow funnels through (sign → done → "Continue" →
 * app-tour modal → enterApp), including the exact journey from the bug
 * report — a member with nothing left but a reissued gating document lands
 * directly on the "done" screen.
 *
 * Reproduction record (docs/reports/TASK-WALLRETURN-REPORT.md has the full
 * run log): before the fix, enterApp() always landed on the dashboard/
 * community feed, even with a captured destination sitting in
 * sessionStorage — "navigates to the captured destination…" and "consumes
 * the destination once…" both failed. This suite now exercises the real
 * click path (Continue → the app-tour modal's "Enter the app") through the
 * actual component and asserts on which stub ROUTE ends up rendered — proof
 * the real react-router navigate() call landed where it should, not a
 * mocked stand-in. It stands as the permanent regression guard.
 */
import '@testing-library/jest-dom/vitest';
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import Onboarding from '../../src/pages/app/Onboarding';

vi.mock('../../src/contexts/AuthContext', () => ({
  useAuth: () => ({ hasModule: () => false }),
}));

// A member with nothing left to do here except what she already finished —
// mirrors the reported case (a reissued RELEASE_GENERAL, no horse step, and
// an old already-relevant purchase so the "nothing to do" short-circuit
// screen doesn't take over — see Onboarding.tsx's `!state.purchase` guard).
const DONE_STATE = {
  needed: false,
  profile_complete: true,
  documents: [{ document_id: 'doc-1', template_key: 'RELEASE_GENERAL', title: 'General Release', status: 'EXECUTED' }],
  purchase: {
    purchase_id: 'pur-1', horse_id: null, tier_label: 'Lessons', amount: 500,
    lessons_included: 4, cadence: null, paid: true, payment_method: 'zelle',
  },
  minor: null,
  horse_needed: false,
  prefill: null,
};

vi.mock('../../src/lib/api', () => ({
  myOnboardingState: () => Promise.resolve(DONE_STATE),
  getMyProfile: () => Promise.resolve({ first_name: 'Sarah', last_name: 'Test' }),
  updateMyOnboardingProfile: () => Promise.resolve(),
  generateMyOnboardingDocuments: () => Promise.resolve(),
  getOrder: () => Promise.resolve(null),
  getOrderPayment: () => Promise.resolve(null),
  attachPurchaseHorse: () => Promise.resolve(),
  setMyOnboardingHorses: () => Promise.resolve({ documents: 0, bindings: 0, deferred_reminders: 0 }),
  fetchMyCategories: () => Promise.resolve([]),
  myUnreadCount: () => Promise.resolve(0),
  myDocuments: () => Promise.resolve([]),
  markTourSeen: () => Promise.resolve(),
  myNameConfirmationState: () => Promise.resolve({ needs_confirmation: false }),
  myNavPresence: () => Promise.resolve({ orders: false, documents: false, stable: false, posts: false, saved: false }),
  currentTourFormFactor: () => 'desktop',
}));
vi.mock('../../src/lib/ops/api-client', () => ({
  signMyDocument: () => Promise.resolve(),
}));
vi.mock('../../src/lib/stable', () => ({
  listStableHorses: () => Promise.resolve([]),
}));

function renderOnboarding() {
  return render(
    <MemoryRouter initialEntries={['/app/onboarding']}>
      <Routes>
        <Route path="/app/onboarding" element={<Onboarding />} />
        <Route path="/app/contracts/:id" element={<div>CONTRACT PAGE STUB</div>} />
        <Route path="/app/dashboard" element={<div>DASHBOARD STUB</div>} />
        <Route path="/app" element={<div>COMMUNITY STUB</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

/** Drive the real UI from the "done" screen through to enterApp(): click
 *  Continue (opens the app-tour modal), then the modal's "Enter the app". */
async function finishThroughTour() {
  const continueBtn = await screen.findByRole('button', { name: /continue/i });
  fireEvent.click(continueBtn);
  const enterBtn = await screen.findByRole('button', { name: /enter the app/i });
  fireEvent.click(enterBtn);
}

beforeEach(() => {
  sessionStorage.clear();
});
afterEach(() => cleanup());

describe('returns to the captured destination', () => {
  it('navigates to the captured destination instead of the default landing page', async () => {
    sessionStorage.setItem('fhe.wallReturnTo', '/app/contracts/704c8d2d-stub');
    renderOnboarding();
    await screen.findByText("You're all set.");
    await finishThroughTour();
    expect(await screen.findByText('CONTRACT PAGE STUB')).toBeInTheDocument();
    expect(screen.queryByText('COMMUNITY STUB')).not.toBeInTheDocument();
  });

  it('consumes the destination once — it is gone from storage after the return', async () => {
    sessionStorage.setItem('fhe.wallReturnTo', '/app/contracts/704c8d2d-stub');
    renderOnboarding();
    await screen.findByText("You're all set.");
    await finishThroughTour();
    await screen.findByText('CONTRACT PAGE STUB');
    expect(sessionStorage.getItem('fhe.wallReturnTo')).toBeNull();
  });

  it('defaults cleanly to today\'s behavior when nothing was captured', async () => {
    renderOnboarding();
    await screen.findByText("You're all set.");
    await finishThroughTour();
    expect(await screen.findByText('COMMUNITY STUB')).toBeInTheDocument();
  });

  it('refuses an off-origin destination and falls back to default behavior', async () => {
    sessionStorage.setItem('fhe.wallReturnTo', 'https://evil.example.com/phish');
    renderOnboarding();
    await screen.findByText("You're all set.");
    await finishThroughTour();
    expect(await screen.findByText('COMMUNITY STUB')).toBeInTheDocument();
  });
});
