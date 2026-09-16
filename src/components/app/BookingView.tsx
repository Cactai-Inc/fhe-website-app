import { useEffect, useState } from 'react';
import { CalendarClock, MapPin, User, Repeat } from 'lucide-react';
import { toErrorMessage } from '../../lib/ops/errors';
import {
  fetchBookingPurchaseCard, adminCancelBooking,
  type CalendarItem, type BookingPurchaseCard,
} from '../../lib/ops/api-calendar';
import { SessionActivityForm } from '../../pages/app/ops/lessons/SessionActivityForm';

/**
 * BOOKING VIEW — the read-only surface for a scheduled calendar item, used
 * everywhere a booking is shown without being edited: the calendar item modal's
 * view mode (week/month), the Day-view workspace pane (desktop right / mobile
 * modal), and the dashboard's compact day rundown. It is one implementation so
 * every surface shows the same thing.
 *
 * Two halves, as the owner described them:
 *   TOP    — what this session is: who, what, when, where, and the Purchase card
 *            (a usage counter for a series purchase; nothing for a single item).
 *   BOTTOM — the interactive workspace: the activity record (notes, checklist,
 *            lesson plan/progress, mark complete). That is SessionActivityForm,
 *            the one writer behind booking_forms — reused here, not re-built.
 *
 * Cancel / reschedule live here (not in edit mode), because this is the surface a
 * person opens a scheduled booking to. `onEdit` enters the editor; `onReschedule`
 * enters the editor focused on the time; `onChanged` re-loads the calendar after a
 * cancel. `compact` trims the chrome for the dashboard rundown.
 */
export function BookingView({
  item, onEdit, onReschedule, onChanged, compact = false,
}: {
  item: CalendarItem;
  onEdit?: () => void;
  onReschedule?: () => void;
  onChanged?: () => void;
  compact?: boolean;
}) {
  const [card, setCard] = useState<BookingPurchaseCard | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const isBooking = item.kind === 'lesson' || item.kind === 'care';
  const isSeries = !!item.series_id;

  useEffect(() => {
    if (!isBooking || !item.id) { setCard(null); return; }
    fetchBookingPurchaseCard(item.id).then(setCard).catch(() => setCard(null));
  }, [item.id, isBooking]);

  const start = new Date(item.starts_at);
  const end = item.ends_at ? new Date(item.ends_at) : null;
  const when = start.toLocaleString(undefined, {
    weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
  }) + (end ? `–${end.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}` : '');

  async function cancel() {
    if (!item.id) return;
    const scope = isSeries
      ? (window.prompt(
          'Cancel this booking. Type: one · future · all\n\n'
          + '· one = just this session\n· future = this and all future in the series\n· all = the whole series',
          'one',
        ) ?? '').trim().toLowerCase()
      : 'one';
    if (!['one', 'future', 'all'].includes(scope)) return;
    const reason = window.prompt('Reason for cancelling (shown to the client)?') ?? undefined;
    if (!window.confirm(
      scope === 'one' ? 'Cancel this session? The slot/credit is released to the client.'
      : scope === 'future' ? 'Cancel this and every future session in the series?'
      : 'Cancel the entire series?',
    )) return;
    setBusy(true); setErr(null);
    try {
      await adminCancelBooking(item.id, scope as 'one' | 'future' | 'all', reason);
      onChanged?.();
    } catch (e) {
      setErr(toErrorMessage(e, 'Could not cancel.'));
    } finally { setBusy(false); }
  }

  return (
    <div className="flex flex-col gap-4">
      {/* ── TOP: what this session is ───────────────────────────────────── */}
      <div className="flex flex-col gap-2">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="font-serif text-lg text-green-900 leading-tight">
              {item.offering_name || 'Session'}
            </p>
            {item.client_name && (
              <p className="text-sm text-green-800/80 inline-flex items-center gap-1.5 mt-0.5">
                <User size={13} aria-hidden="true" /> {item.client_name}
              </p>
            )}
          </div>
          {onEdit && (
            <button type="button" className="btn-secondary text-xs px-3 py-1.5 shrink-0" onClick={onEdit}>
              Edit
            </button>
          )}
        </div>

        <p className="text-sm text-green-900 inline-flex items-center gap-1.5">
          <CalendarClock size={14} aria-hidden="true" /> {when}
          {isSeries && <span className="inline-flex items-center gap-1 text-green-800/70 text-xs"><Repeat size={12} /> series</span>}
        </p>
        {item.address && (
          <p className="text-sm text-green-800/80 inline-flex items-center gap-1.5">
            <MapPin size={13} aria-hidden="true" /> {item.address}
          </p>
        )}
        {item.notes && <p className="text-sm text-green-900/90 whitespace-pre-line">{item.notes}</p>}

        {/* Purchase card — usage counter for a series, plain label for a single item. */}
        {card?.has_purchase && (
          <div className="rounded-lg bg-green-800/5 border border-green-800/10 px-3 py-2">
            <p className="text-[11px] uppercase tracking-wide text-muted">Purchase</p>
            <p className="text-sm text-green-900">{card.offering}{card.label ? ` · ${card.label}` : ''}</p>
            {card.is_series && card.total != null && (
              <p className="text-sm font-medium text-green-800 mt-0.5">
                {card.kind === 'punch_card' ? 'Lesson' : 'Session'} {card.position ?? card.used} of {card.total}
                {' · '}{card.remaining} remaining
              </p>
            )}
          </div>
        )}

        {/* Cancel / reschedule — clearly on the view surface. */}
        {isBooking && item.id && (
          <div className="flex flex-wrap items-center gap-2 pt-1">
            {onReschedule && (
              <button type="button" className="btn-secondary text-xs px-3 py-1.5" disabled={busy} onClick={onReschedule}>
                Reschedule
              </button>
            )}
            <button type="button" className="text-xs text-red-700 px-3 py-1.5 hover:bg-red-50 rounded-md"
              disabled={busy} onClick={() => void cancel()}>
              Cancel{isSeries ? ' / cancel plan' : ''}
            </button>
          </div>
        )}
        {err && <p role="alert" className="form-error text-xs">{err}</p>}
      </div>

      {/* ── BOTTOM: the activity workspace (notes, checklist, plan, mark done). ─ */}
      {isBooking && item.id && !compact && (
        <div className="border-t border-green-800/10 pt-3">
          <SessionActivityForm bookingId={item.id} onChanged={onChanged} />
        </div>
      )}
    </div>
  );
}

export default BookingView;
