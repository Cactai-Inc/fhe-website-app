import { useState } from 'react';
import { Link } from 'react-router-dom';
import { X } from 'lucide-react';
import type { NotificationRow } from '../../../lib/ops/api-dashboard';
import { consumeNotification, markNotificationRead } from '../../../lib/api';
import { ageLabel } from '../../../lib/dashboard/format';

/**
 * N1 · NOTIFICATIONS — on both desks, first, and the only uncapped zone.
 *
 * Owner, 2026-08-26: *"the one thing i dont see is a clear set of
 * notifications"*, and when asked for the shape: *"dashboard zone, full list of
 * notifications, collapsable, never sticky."*
 *
 * ⚠️ WHY THIS DID NOT EXIST, because it explains the shape. `notifications` is
 * written all day and was read back only by `DashboardPanel` — which
 * `DashboardHome` renders for MEMBERS. Staff are routed to `OwnerDashboard`
 * (`if (isStaff) return <OwnerDashboard />`), which had no notifications zone at
 * all. 77 unread for admin@ and 60 for hello@ the day it was found. So this is
 * not a new capability; it is the existing one reaching the people who were
 * routed past it.
 *
 * THREE DELIBERATE DIFFERENCES FROM EVERY OTHER ZONE:
 *
 *   1. IT IS A LIST, NOT A CARD GRID. Seventy-five items in a three-column grid
 *      is a wall. A notification list should read top to bottom, newest first.
 *   2. IT IS NOT CAPPED. The other zones show `CAP` rows and link onward; a
 *      notification list that hides notifications is the complaint that produced
 *      this zone. `dash_notifications` returns all unread and this renders all
 *      of them — which is exactly why it is the zone that got a collapse
 *      control.
 *   3. DISMISSING IS PART OF IT. With a backlog this size a read-only list is
 *      just a longer complaint. `consume_notification` already exists, already
 *      logs to `audit_logs` and `_log_notification_resolution` before deleting,
 *      and is already per-user — dismissing on one desk never touches the other
 *      owner's copy. Opening one marks it read, which is the same contract
 *      `DashboardPanel` has always had.
 *
 * ⚠️ NEVER STICKY. It scrolls with the page like everything else — the same
 * ruling the greeting bar got on 2026-08-25 (*"they need to be part of the page
 * and move with the rest of the content on scroll"*).
 */

/** `notifications.kind` → the word shown on the row. Unknown kinds fall back to
 *  the kind itself with its underscores opened out, so a newly added kind is
 *  legible on the day it ships rather than on the day someone updates a map. */
const KIND_LABEL: Record<string, string> = {
  party_signed: 'Signature',
  document_executed: 'Executed',
  contract_in_review: 'Contract',
  contract_locked: 'Contract',
  contract_terminated: 'Contract',
  contract_termination_requested: 'Contract',
  request_new: 'Inquiry',
  payment_received: 'Payment',
  purchase_unpaid: 'Payment',
  booking_reminder_1h: 'Session',
  booking_reminder_2h: 'Session',
  booking_time_requested: 'Session',
  insurance_unresolved: 'Insurance',
  member_hi: 'Community',
};

const kindLabel = (kind: string) =>
  KIND_LABEL[kind] ?? kind.replace(/_/g, ' ');

/** Hours since an ISO timestamp, for the shared `ageLabel` vocabulary. */
const hoursSince = (iso: string) =>
  Math.max(0, (Date.now() - new Date(iso).getTime()) / 36e5);

export function NotificationsZone({
  items, onDone,
}: { items: NotificationRow[]; onDone: () => void }) {
  /* Dismissed ids drop out immediately rather than waiting for the dashboard's
     next read. The row is already gone server-side by then; leaving it on screen
     until a refetch lands makes a working button look broken. */
  const [gone, setGone] = useState<Set<string>>(new Set());
  const shown = items.filter((n) => !gone.has(n.id));

  const dismiss = (id: string) => {
    setGone((s) => new Set(s).add(id));
    consumeNotification(id).catch(() => {
      // Put it back: the server still has it, so the list should still show it.
      setGone((s) => { const next = new Set(s); next.delete(id); return next; });
    });
  };

  if (shown.length === 0) return null;

  return (
    <ul className="divide-y divide-green-900/8 overflow-hidden rounded-lg border border-green-900/10 bg-white/60">
      {shown.map((n) => {
        const body = (
          <>
            <div className="flex items-baseline gap-2">
              <span className="shrink-0 rounded-full bg-cream-200 px-2 py-0.5 text-[0.6rem] font-semibold uppercase tracking-tracked text-green-800/70">
                {kindLabel(n.kind)}
              </span>
              <span className="min-w-0 flex-1 text-[0.86rem] font-semibold text-green-900">
                {n.title}
              </span>
              <span className="shrink-0 text-[0.7rem] text-green-800/45">
                {ageLabel(hoursSince(n.created_at))}
              </span>
            </div>
            {n.body && (
              <p className="mt-1 text-[0.78rem] leading-snug text-green-800/60">{n.body}</p>
            )}
          </>
        );

        return (
          <li key={n.id} className="flex items-start gap-1 px-3.5 py-2.5 transition-colors duration-320 ease-glide hover:bg-cream-100/60">
            {n.link
              ? (
                <Link
                  to={n.link}
                  onClick={() => { markNotificationRead(n.id).catch(() => {}); onDone(); }}
                  className="min-w-0 flex-1 focus-ring"
                >
                  {body}
                </Link>
              )
              : <div className="min-w-0 flex-1">{body}</div>}
            <button
              type="button"
              onClick={() => dismiss(n.id)}
              aria-label={`Dismiss: ${n.title}`}
              className="mt-0.5 shrink-0 rounded-full p-1 text-green-800/35 transition-colors duration-320 ease-glide hover:bg-green-900/8 hover:text-green-900 focus-ring"
            >
              <X size={13} aria-hidden="true" />
            </button>
          </li>
        );
      })}
    </ul>
  );
}
