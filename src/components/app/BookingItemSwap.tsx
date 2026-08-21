/**
 * CREDITALIGN A2 — "make the booked and pending-booking item swap." (owner)
 *
 * One component, both surfaces. The member sees it on their own booking while it is
 * still a request; staff see it on any live booking, including a confirmed one. Which
 * of those applies is NOT decided here — `booking_item_options` answers it server-side
 * for the caller who asked, so the member's panel and the staff panel cannot drift into
 * two different opinions of what is swappable.
 *
 * The swap itself is a refund plus a debit in one transaction (`swap_booking_item`), so
 * there is nothing to coordinate on this side: submit, and either it moved or it did
 * not and the server said why.
 */
import { useEffect, useState } from 'react';
import { ArrowLeftRight } from 'lucide-react';
import {
  fetchBookingItemOptions, swapBookingItem, type BookingItemOptions,
} from '../../lib/ops/api-calendar';
import { toErrorMessage } from '../../lib/ops/errors';

/** The server prefixes its refusals with a machine code; the member should read the
 *  sentence, not the code. */
function readableRefusal(e: unknown): string {
  // BUYANDBOOK §5 — same trap as the calendar's book(): a Supabase refusal is not an
  // Error instance, so `instanceof` left `raw` empty and every code below went
  // unstripped, showing the member the machine token.
  const raw = toErrorMessage(e, '');
  const stripped = raw.replace(/^.*?(NO_ENTITLEMENT|ITEM_EXPIRED|WRONG_SERVICE|NOT_PENDING|NO_SUCH_ITEM|ALREADY_ON_THAT_ITEM|BOOKING_CLOSED):\s*/s, '');
  return stripped && stripped !== raw
    ? stripped.charAt(0).toUpperCase() + stripped.slice(1)
    : toErrorMessage(e, 'Could not move this booking to that item.');
}

export function BookingItemSwap({
  bookingId, onChanged,
}: {
  bookingId: string;
  /** Refresh the calendar — the booking's order and offering may both have changed. */
  onChanged: () => void;
}) {
  const [state, setState] = useState<BookingItemOptions | null>(null);
  const [open, setOpen] = useState(false);
  const [target, setTarget] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    fetchBookingItemOptions(bookingId)
      .then((s) => { if (live) setState(s); })
      .catch(() => { if (live) setState(null); });
    return () => { live = false; };
  }, [bookingId]);

  async function submit() {
    if (!target) return;
    setBusy(true); setError(null);
    try {
      const r = await swapBookingItem(bookingId, target);
      setDone(`Now booked against ${r.to_label}.`);
      setOpen(false);
      setTarget('');
      setState(await fetchBookingItemOptions(bookingId));
      onChanged();
    } catch (e) {
      setError(readableRefusal(e));
    } finally { setBusy(false); }
  }

  if (!state) return null;
  // Nothing bought, nothing to move it to — say nothing rather than show a dead control.
  if (!state.current && state.options.length === 0) return null;

  return (
    <div className="bg-white border border-green-800/10 rounded p-3 text-sm flex flex-col gap-2">
      <p className="text-xs uppercase tracking-wide text-muted">Booked against</p>
      <p className="text-green-900">{state.current?.label ?? 'Nothing yet'}</p>
      {done && <p className="text-xs text-green-700">{done}</p>}

      {!state.can_swap ? (
        state.reason && <p className="text-xs text-muted">{state.reason}</p>
      ) : !open ? (
        <button type="button" className="btn-secondary text-xs px-3 py-1.5 self-start inline-flex items-center gap-1.5"
          disabled={state.options.length === 0} onClick={() => setOpen(true)}>
          <ArrowLeftRight size={13} aria-hidden="true" />
          {state.options.length === 0 ? 'Nothing else to book this against' : 'Change what this is booked against'}
        </button>
      ) : (
        <>
          <label className="text-sm">
            <span className="form-label">Charge it to</span>
            <select className="form-input" value={target} onChange={(e) => setTarget(e.target.value)}>
              <option value="">Choose an item…</option>
              {state.options.map((o) => (
                <option key={o.credit_id} value={o.credit_id}>
                  {o.label} — {o.remaining} left
                  {o.expires_at ? ` (until ${new Date(o.expires_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })})` : ''}
                </option>
              ))}
            </select>
          </label>
          <p className="form-hint">
            The item it is on now gets its session back, and the one you pick is used instead.
          </p>
          <div className="flex gap-2">
            <button type="button" className="btn-primary flex-1 justify-center text-xs px-3 py-1.5"
              disabled={busy || !target} onClick={() => void submit()}>
              {busy ? 'Moving…' : 'Move it'}
            </button>
            <button type="button" className="btn-secondary text-xs px-3 py-1.5"
              onClick={() => { setOpen(false); setError(null); }}>Back</button>
          </div>
        </>
      )}
      {error && <p role="alert" className="form-error">{error}</p>}
    </div>
  );
}
