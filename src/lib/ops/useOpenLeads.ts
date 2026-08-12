import { useCallback, useEffect, useState } from 'react';
import { listLeadQueue, type BookingRequest, type ConvertedLead } from './api-intake';
import { listSupportRequests, type SupportRequest } from '../support';

/** One open lead/request, ready to render as a dashboard entry. */
export interface LeadEntry {
  id: string;
  when: string; // ISO, for sorting
  title: string;
  sub: string;
  to: string;
  /** The whole booking request behind this entry. Present for booking leads so a
   *  surface can open the working drawer IN PLACE rather than navigating to a
   *  page; support entries have none and fall back to `to`. */
  request?: BookingRequest;
  /** INBOUNDALERT — set ONLY when the owner was not told by email about this
   *  lead, and says which way it failed. The lead itself is captured either way;
   *  this is the honest admission that the notification did not reach him, shown
   *  where he already looks instead of in a serverless log nobody reads.
   *  Undefined when the alert sent, and when the request predates the record
   *  ('unknown') — we do not accuse a path we have no evidence about. */
  alertWarning?: string;
}

export interface LeadQueueState {
  /** Cards that still need working — converted leads have already left. */
  open: LeadEntry[];
  /** Leads that retired themselves by becoming clients (history, not work). */
  converted: ConvertedLead[];
  /** Re-read both sides — call after the drawer changes a request. */
  reload: () => void;
}

/** The one sentence a lead card shows when the email alert did not reach the
 *  owner. Deliberately says the lead is still here — the failure is the telling,
 *  not the capturing — and carries the provider's own words when there are any,
 *  because "it failed" without a cause is how this defect survived two leads. */
function alertWarning(r: BookingRequest): string | undefined {
  const a = r.alert;
  if (!a || a.state === 'sent' || a.state === 'unknown') return undefined;
  if (a.state === 'not_attempted') {
    return 'Email alert never sent — this lead is saved, but you were not emailed about it.';
  }
  return a.error
    ? `Email alert failed — you were not emailed about this lead. ${a.error}`
    : 'Email alert failed — this lead is saved, but you were not emailed about it.';
}

function bookingEntry(r: BookingRequest): LeadEntry {
  const summary = (r.request_selections ?? []).map((s) => s.label).filter(Boolean).join(', ');
  return {
    id: `req-${r.id}`,
    when: r.created_at,
    title: r.contact_name || r.contact_email || 'New inquiry',
    sub: summary || 'New booking request',
    // Fallback destination for surfaces that link rather than expand. The
    // Inbound page is retired (INTAKE_PAGE_RETIRED), so this is the dashboard,
    // which opens that lead's drawer from the `request` param.
    to: `/app/dashboard?request=${r.id}`,
    request: r,
    alertWarning: alertWarning(r),
  };
}

function supportEntry(s: SupportRequest): LeadEntry {
  return {
    id: `sup-${s.id}`,
    when: s.created_at,
    title: s.subject,
    sub: s.body.length > 90 ? `${s.body.slice(0, 90)}…` : s.body,
    to: '/app/ops/support',
  };
}

/**
 * The lead queue for staff surfaces: booking requests that are still real work,
 * plus support requests not yet resolved.
 *
 * "Still real work" is NOT restated here — it comes from `listLeadQueue`, which
 * reads `inbound_queue.already_converted`, the definition the database already
 * computes on every row. A request whose person is now a client leaves `open`
 * and appears in `converted` instead: nothing is written, so nothing can drift,
 * and it is right retroactively for rows that were never closed by hand.
 *
 * Deliberately the same predicate `inbound_open_count()` counts for the
 * Dashboard nav badge (AppLayout.tsx), so the dashboard's entry list and its
 * badge number never disagree. `enabled` gates the fetch for callers rendered to
 * non-staff viewers.
 */
export function useOpenLeads(enabled: boolean): LeadQueueState {
  const [open, setOpen] = useState<LeadEntry[]>([]);
  const [converted, setConverted] = useState<ConvertedLead[]>([]);
  const [tick, setTick] = useState(0);
  const reload = useCallback(() => setTick((t) => t + 1), []);

  useEffect(() => {
    if (!enabled) { setOpen([]); setConverted([]); return; }
    let active = true;
    Promise.all([
      listLeadQueue().catch(() => ({ open: [], converted: [] })),
      listSupportRequests().catch(() => [] as SupportRequest[]),
    ]).then(([leads, support]) => {
      if (!active) return;
      const merged = [
        ...leads.open.map(bookingEntry),
        ...support.filter((s) => s.status !== 'resolved').map(supportEntry),
      ].sort((a, b) => new Date(b.when).getTime() - new Date(a.when).getTime());
      setOpen(merged);
      setConverted(leads.converted);
    });
    return () => { active = false; };
  }, [enabled, tick]);

  return { open, converted, reload };
}
