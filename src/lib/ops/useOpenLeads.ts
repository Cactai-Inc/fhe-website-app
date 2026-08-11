import { useEffect, useState } from 'react';
import { listBookingRequests, type BookingRequest } from './api-intake';
import { listSupportRequests, type SupportRequest } from '../support';

/** One open lead/request, ready to render as a dashboard entry. */
export interface LeadEntry {
  id: string;
  when: string; // ISO, for sorting
  title: string;
  sub: string;
  to: string;
}

function bookingEntry(r: BookingRequest): LeadEntry {
  const summary = (r.request_selections ?? []).map((s) => s.label).filter(Boolean).join(', ');
  return {
    id: `req-${r.id}`,
    when: r.created_at,
    title: r.contact_name || r.contact_email || 'New inquiry',
    sub: summary || 'New booking request',
    to: `/app/ops/intake?request=${r.id}`,
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
 * Open leads awaiting staff action — booking requests still `new` plus support
 * requests not yet `resolved`. Deliberately the SAME two conditions
 * `inbound_open_count()` counts for the Dashboard nav badge (AppLayout.tsx),
 * so the dashboard's entry list and its badge number never disagree. Reads
 * `requests`/`support_requests` directly rather than the per-user
 * `notifications` table — no notification pipeline involved, just the rows.
 * `enabled` gates the fetch for callers rendered to non-staff viewers.
 */
export function useOpenLeads(enabled: boolean): LeadEntry[] {
  const [entries, setEntries] = useState<LeadEntry[]>([]);
  useEffect(() => {
    if (!enabled) { setEntries([]); return; }
    let active = true;
    Promise.all([
      listBookingRequests('new').catch(() => [] as BookingRequest[]),
      listSupportRequests().catch(() => [] as SupportRequest[]),
    ]).then(([requests, support]) => {
      if (!active) return;
      const merged = [
        ...requests.map(bookingEntry),
        ...support.filter((s) => s.status !== 'resolved').map(supportEntry),
      ].sort((a, b) => new Date(b.when).getTime() - new Date(a.when).getTime());
      setEntries(merged);
    });
    return () => { active = false; };
  }, [enabled]);
  return entries;
}
