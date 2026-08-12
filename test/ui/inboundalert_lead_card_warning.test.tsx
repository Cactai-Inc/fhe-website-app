// @vitest-environment jsdom
/**
 * TASK-INBOUNDALERT — a lead whose alert email did not reach the owner says so
 * on the card he already looks at.
 *
 * The defect this closes: /api/request-received returned 200 { emailed:false }
 * on every failure and wrote the cause to a serverless log nobody reads, so a
 * lead could arrive with the owner never told and nothing anywhere saying so.
 * The database half of the fix (one `request_alert_sends` row per attempt, the
 * verdict computed in `inbound_queue`) is proven against production. This test
 * proves the other half — that the verdict actually reaches the screen — which
 * no production query can show, because there is no staff Supabase session in
 * this environment and the dashboard cannot be logged into from a test.
 *
 * Four states, and the two that must stay SILENT matter as much as the two that
 * must speak: 'sent' has nothing to admit, and 'unknown' is a request that
 * predates the attempt record — accusing that path would be inventing evidence.
 *
 * Mocks mirror `leadclean_dashboard_leads.test.tsx`, whose card design this only
 * adds a line to. `vi.mock` is hoisted, so the calls live at top level.
 */
import '@testing-library/jest-dom/vitest';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { LeadEntry } from '../../src/lib/ops/useOpenLeads';
import type { BookingRequest } from '../../src/lib/ops/api-intake';

const req = (id: string) => ({ id, contact_name: id }) as unknown as BookingRequest;

/** One lead per alert outcome, exactly as `useOpenLeads` would build them. */
const LEADS: LeadEntry[] = [
  {
    id: 'req-failed', when: '2026-08-12T10:00:00Z', title: 'Failed Send',
    sub: 'Riding Lessons', to: '/app/dashboard?request=failed', request: req('failed'),
    alertWarning:
      'Email alert failed — you were not emailed about this lead. 535-5.7.8 Username and Password not accepted',
  },
  {
    id: 'req-never', when: '2026-08-12T09:00:00Z', title: 'Never Attempted',
    sub: 'Horse Care', to: '/app/dashboard?request=never', request: req('never'),
    alertWarning: 'Email alert never sent — this lead is saved, but you were not emailed about it.',
  },
  {
    id: 'req-sent', when: '2026-08-12T08:00:00Z', title: 'Alert Sent',
    sub: 'Riding Lessons', to: '/app/dashboard?request=sent', request: req('sent'),
  },
  {
    id: 'req-unknown', when: '2026-08-09T08:00:00Z', title: 'Predates The Record',
    sub: 'Riding Lessons', to: '/app/dashboard?request=unknown', request: req('unknown'),
  },
];

vi.mock('../../src/lib/ops/useOpenLeads', () => ({
  useOpenLeads: () => ({ open: LEADS, converted: [], reload: vi.fn() }),
}));
vi.mock('../../src/contexts/AuthContext', () => ({
  useAuth: () => ({ isStaff: true, isAdmin: true, profile: { first_name: 'Odile' } }),
}));
vi.mock('../../src/components/app/LeadWorkDrawer', () => ({
  LeadWorkDrawer: () => <div data-testid="lead-drawer" />,
}));
vi.mock('../../src/lib/api', () => ({
  myNotifications: () => Promise.resolve([]),
  consumeNotification: () => Promise.resolve(),
  markNotificationRead: () => Promise.resolve(),
}));
vi.mock('../../src/lib/communityFeed', () => ({ sayHiBack: () => Promise.resolve() }));
vi.mock('../../src/lib/ops/api-member', () => ({ myLessonSessions: () => Promise.resolve([]) }));
vi.mock('../../src/lib/ops/api-calendar', () => ({ fetchMyPendingChanges: () => Promise.resolve([]) }));
vi.mock('../../src/lib/horses', () => ({ fetchHorseOnboardingState: () => Promise.resolve(null) }));
vi.mock('../../src/lib/acquisition', () => ({ fetchAcquisitionIntakeState: () => Promise.resolve(null) }));
vi.mock('../../src/lib/community', () => ({ fetchEvents: () => Promise.resolve([]) }));
vi.mock('../../src/lib/supabase', () => ({
  supabase: { rpc: () => Promise.resolve({ data: [], error: null }) },
}));

const { DashboardPanel } = await import('../../src/components/app/DashboardPanel');

// Two renders in one file — without this the second finds both copies.
afterEach(cleanup);

/** The card the given lead title sits on. */
function cardFor(title: string): HTMLElement {
  const heading = screen.getByText(title);
  const card = heading.closest('div');
  if (!card) throw new Error(`no card for ${title}`);
  return card;
}

describe('INBOUNDALERT — the dashboard admits an alert that did not land', () => {
  it('shows the failure, its cause, and never loses the lead', () => {
    render(<MemoryRouter><DashboardPanel /></MemoryRouter>);

    // 1. A failed send is visible HERE, not only in a serverless log — and it
    //    carries the provider's own words, because "it failed" with no cause is
    //    how this defect survived two real leads.
    expect(cardFor('Failed Send')).toHaveTextContent(
      'Email alert failed — you were not emailed about this lead. 535-5.7.8 Username and Password not accepted',
    );

    // 2. Never attempted is a DIFFERENT failure and reads differently: the
    //    endpoint never ran at all. That was every real lead's state before
    //    this task, because the only caller was the /contact form.
    expect(cardFor('Never Attempted')).toHaveTextContent('Email alert never sent');

    // 3. The lead is still on the board in both cases. A mail failure costs the
    //    telling, never the lead.
    expect(screen.getByText('Failed Send')).toBeInTheDocument();
    expect(screen.getByText('Never Attempted')).toBeInTheDocument();
  });

  it('stays silent when it has nothing to admit', () => {
    render(<MemoryRouter><DashboardPanel /></MemoryRouter>);

    // A successful alert says nothing — the card is unchanged from LEADCLEAN's.
    expect(cardFor('Alert Sent')).not.toHaveTextContent('Email alert');

    // 'unknown' is a request older than the attempt record. We do not know
    // whether the owner was told, so we do not claim he was not.
    expect(cardFor('Predates The Record')).not.toHaveTextContent('Email alert');
  });
});
