// @vitest-environment jsdom
/**
 * TASK-INBOUNDALERT — the seam between the database's verdict and the card.
 *
 * `inbound_queue.alert_state` is the single definition of "was the owner told",
 * computed in the view from `request_alert_sends` (proven against production).
 * `listLeadQueue` merges it onto the lead, and `useOpenLeads` turns it into the
 * one sentence a card shows. This test covers that translation, which the
 * DashboardPanel test cannot: that one supplies `alertWarning` directly, so a
 * mistake HERE — warning an owner about a lead that was in fact emailed, or
 * staying quiet about one that was not — would pass it unnoticed.
 *
 * The rule being pinned: only 'failed' and 'not_attempted' speak, they say
 * DIFFERENT things, and a failure carries the provider's verbatim error.
 */
import { describe, it, expect, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import type { BookingRequest, RequestAlertState } from '../../src/lib/ops/api-intake';

function lead(id: string, alert: RequestAlertState): BookingRequest {
  return {
    id, created_at: '2026-08-12T10:00:00Z', status: 'new', contact_name: id,
    contact_email: `${id}@example.invalid`, request_selections: [], alert,
  } as unknown as BookingRequest;
}

const OPEN = [
  lead('sent', { state: 'sent', attemptedAt: '2026-08-12T10:00:01Z', recipient: 'ops@x.test', error: null }),
  lead('unknown', { state: 'unknown', attemptedAt: null, recipient: null, error: null }),
  lead('never', { state: 'not_attempted', attemptedAt: null, recipient: null, error: null }),
  lead('failed', {
    state: 'failed', attemptedAt: '2026-08-12T10:00:01Z', recipient: 'ops@x.test',
    error: '535-5.7.8 Username and Password not accepted',
  }),
  // A failure the provider gave no words for still has to speak.
  lead('failed-mute', { state: 'failed', attemptedAt: '2026-08-12T10:00:01Z', recipient: 'ops@x.test', error: null }),
];

vi.mock('../../src/lib/ops/api-intake', () => ({
  listLeadQueue: () => Promise.resolve({ open: OPEN, converted: [] }),
}));
vi.mock('../../src/lib/support', () => ({ listSupportRequests: () => Promise.resolve([]) }));

const { useOpenLeads } = await import('../../src/lib/ops/useOpenLeads');

describe('INBOUNDALERT — alert_state becomes (or does not become) a warning', () => {
  it('warns only where there is something to admit, and says which failure it was', async () => {
    const { result } = renderHook(() => useOpenLeads(true));
    await waitFor(() => expect(result.current.open).toHaveLength(OPEN.length));

    const warn = Object.fromEntries(
      result.current.open.map((e) => [e.request?.id, e.alertWarning]),
    );

    // Silent: the alert landed. Nothing to tell him.
    expect(warn.sent).toBeUndefined();
    // Silent: predates the attempt record. We do not know, so we do not claim.
    expect(warn.unknown).toBeUndefined();

    // Never attempted — the endpoint did not run. Distinct wording, because it
    // is a distinct fault: not a provider that refused, a call that never came.
    expect(warn.never).toBe(
      'Email alert never sent — this lead is saved, but you were not emailed about it.',
    );

    // Failed, with the provider's own words appended verbatim.
    expect(warn.failed).toBe(
      'Email alert failed — you were not emailed about this lead. 535-5.7.8 Username and Password not accepted',
    );

    // Failed with no reported cause still warns rather than falling silent.
    expect(warn['failed-mute']).toBe(
      'Email alert failed — this lead is saved, but you were not emailed about it.',
    );
  });
});
