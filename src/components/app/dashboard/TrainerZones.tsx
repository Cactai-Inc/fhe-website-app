import { useState } from 'react';
import { Link } from 'react-router-dom';
import { confirmPaymentClaim } from '../../../lib/ops/api-payments';
import { markBookingNoteSeen } from '../../../lib/ops/api-dashboard';
import { markRequestContacted, appendRequestNote } from '../../../lib/ops/api-intake';
import type {
  TodayRow, WeekDay, MoneyRow, PersonWaitingRow, NotesRow, StableRow,
  DocRow, CommunityRow, EvalRow, GiftRow, StableReason,
} from '../../../lib/ops/api-dashboard';
import {
  serviceWording, bookingHref, contactHref, documentHref, horseHref, messageHref,
} from '../../../lib/dashboard/registry';
import { formatTime } from '../../../lib/formatDateTime';
import { toErrorMessage } from '../../../lib/ops/errors';
import { Cards, Card } from './DashboardChrome';
import { usd, ageLabel } from '../../../lib/dashboard/format';

/**
 * CLAIRE'S ZONES — the day sheet.
 *
 * Every renderer takes the items its reader returned and nothing else: no
 * fetching, no counting, no deriving. A zone that needed a number the reader did
 * not give it would be dashboard-local recomputation, which is exactly what D18
 * forbids — the fix is to add it to the reader, so every other surface showing
 * that number gets it too.
 *
 * D25 throughout: `serviceWording()` turns the reader's service CODE into the
 * words Claire would use out loud. The word "booking" appears in this file only
 * inside `bookingHref` and `booking_id`, which are the table's name.
 */

const CAP = 9;

/** "+4 more" — every capped list says so, and says where the rest live. */
function More({ count, shown, to }: { count: number; shown: number; to: string }) {
  if (count <= shown) return null;
  return (
    <Link to={to} className="dash-card grid place-items-center px-3.5 py-3 text-[0.78rem] font-medium text-green-800/70 focus-ring">
      +{count - shown} more &rarr;
    </Link>
  );
}

/* ── C1 · TODAY ─────────────────────────────────────────────────────────── */
export function TodayZone({ items }: { items: TodayRow[] }) {
  return (
    <div className="grid gap-1.5">
      {items.map((r) => {
        const w = serviceWording(r.service_type);
        return (
          <Link
            key={r.booking_id}
            to={bookingHref(r.booking_id, r.starts_at)}
            className="dash-card grid grid-cols-[4.6rem_1fr_auto] items-center gap-3 px-3.5 py-2.5 focus-ring"
          >
            <span className="font-serif text-[0.98rem] text-green-700">{formatTime(r.starts_at)}</span>
            <span className="min-w-0">
              <span className="block truncate text-[0.86rem] font-semibold text-green-900">
                {r.client_name ?? 'Unassigned'} · {w.label}
                {r.horse_name ? ` · ${r.horse_name}` : ''}
              </span>
              <span className="block truncate text-[0.74rem] text-green-800/60">
                {r.has_plan ? (r.focus ? `Plan v${r.plan_version}: ${r.focus}` : 'Plan ready') : 'No plan yet'}
                {r.next_up ? ` · next up ${r.next_up}` : ''}
                {r.client_note ? ' · they left a note' : ''}
              </span>
            </span>
            <span className={`shrink-0 rounded-full px-2 py-0.5 text-[0.6rem] font-semibold uppercase tracking-tracked ${
              r.has_plan ? 'bg-green-50 text-green-700' : 'bg-gold-100 text-gold-800'}`}
            >
              {r.has_plan ? 'Plan ready' : 'Plan now'}
            </span>
          </Link>
        );
      })}
    </div>
  );
}

/* ── C2 · THIS WEEK ─────────────────────────────────────────────────────── */
export function WeekZone({ items }: { items: WeekDay[] }) {
  return (
    <div className="grid grid-cols-4 gap-1.5 sm:grid-cols-7">
      {items.map((d) => {
        const day = new Date(`${d.day}T12:00:00`);
        return (
          /* ⚠️ TASK-FIX2 §4 — THE SESSION IS THE THING BEING POINTED AT.
             This whole card was one `Link` to `?on=<day>`, so clicking a named
             session landed on that day's grid and left Claire to find it again.
             Its sibling `TodayZone` has always used `bookingHref` (`?item=`),
             which `CalendarPage` reads and opens the panel from — the helper is
             imported two lines above. The card is now a div: the DAY header keeps
             `?on=`, and each session is its own link to itself. */
          <div
            key={d.day}
            className={`dash-card min-h-[5.4rem] px-2 py-2 ${
              d.is_today ? 'border-gold-600/70 bg-gold-50' : ''}`}
          >
            <Link
              to={`/app/calendar?on=${d.day}`}
              className="block text-[0.62rem] font-semibold uppercase tracking-wide text-green-800/55 focus-ring hover:text-green-800"
            >
              {day.toLocaleDateString(undefined, { weekday: 'short' })}
              {d.is_today ? ' · today' : ''}
            </Link>
            {d.items.slice(0, 3).map((it) => (
              <Link
                key={it.booking_id}
                to={bookingHref(it.booking_id, it.starts_at)}
                className="mt-1 block truncate rounded border-l-[3px] border-green-400 bg-green-50 px-1.5 py-0.5 text-[0.68rem] leading-tight text-green-900 focus-ring hover:bg-green-100"
              >
                {formatTime(it.starts_at)} {it.client_name ?? serviceWording(it.service_type).label}
              </Link>
            ))}
            {d.booked > 3 && (
              <span className="mt-1 block text-[0.66rem] text-green-800/50">+{d.booked - 3} more</span>
            )}
            {(d.care_due > 0 || d.lease_ends > 0) && (
              <span className="mt-1 block text-[0.66rem] font-medium text-gold-800">
                {d.care_due > 0 ? `${d.care_due} vet/farrier` : ''}
                {d.care_due > 0 && d.lease_ends > 0 ? ' · ' : ''}
                {d.lease_ends > 0 ? `${d.lease_ends} lease ends` : ''}
              </span>
            )}
            {d.booked === 0 && d.open > 0 && (
              <span className="mt-1 block text-[0.66rem] text-green-800/40">{d.open} open</span>
            )}
          </div>
        );
      })}
    </div>
  );
}

/* ── C3 · MONEY WAITING ─────────────────────────────────────────────────── */
/**
 * D19 governs the confirm button. *"A value-moving action states itself, records
 * itself, and can be undone."* So confirming is TWO clicks, not one: the button
 * turns into a sentence naming the amount and the person before anything moves.
 * The write itself is `confirmPaymentClaim`, which settles through
 * `confirm_payment_claim` -> `mark_purchase_paid` — the same spine the Payment
 * review page uses, never a second one (D18).
 */
export function MoneyZone({ items, onDone }: { items: MoneyRow[]; onDone: () => void }) {
  const [arming, setArming] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [failed, setFailed] = useState<{ id: string; msg: string } | null>(null);

  async function confirm(r: MoneyRow) {
    setBusy(r.purchase_id);
    setFailed(null);
    try {
      await confirmPaymentClaim(r.purchase_id);
      onDone();
    } catch (e) {
      setFailed({ id: r.purchase_id, msg: toErrorMessage(e, 'Could not confirm that payment.') });
    } finally {
      setBusy(null);
      setArming(null);
    }
  }

  return (
    <Cards>
      {items.slice(0, CAP).map((r) => (
        <Card
          key={r.purchase_id}
          title={`${r.buyer_name ?? 'Someone'} · ${usd(r.amount)}`}
          tag={r.kind === 'claim' ? 'Confirm' : 'Awaiting payment'}
          tagTone={r.kind === 'claim' ? 'today' : 'new'}
          detail={
            <>
              {r.display_code ?? 'Order'}
              {r.items.length ? ` · ${r.items.join(', ')}` : ''}
              {r.method ? ` · declared ${r.method}` : ''}
              {r.reference ? ` · ref ${r.reference}` : ''}
              {r.age_days > 0 ? ` · ${r.age_days} day${r.age_days === 1 ? '' : 's'} old` : ''}
            </>
          }
        >
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            {r.kind === 'claim' && arming !== r.purchase_id && (
              <button
                type="button"
                onClick={() => setArming(r.purchase_id)}
                className="rounded-lg bg-green-800 px-2.5 py-1 text-[0.72rem] font-semibold text-gold-100 focus-ring"
              >
                Mark confirmed
              </button>
            )}
            {r.kind === 'claim' && arming === r.purchase_id && (
              <span className="flex flex-wrap items-center gap-1.5 text-[0.72rem] text-green-800/70">
                Confirm {usd(r.amount)} received from {r.buyer_name ?? 'this client'}?
                <button
                  type="button"
                  disabled={busy === r.purchase_id}
                  onClick={() => void confirm(r)}
                  className="rounded-lg bg-green-800 px-2.5 py-1 font-semibold text-gold-100 disabled:opacity-60 focus-ring"
                >
                  {busy === r.purchase_id ? 'Confirming…' : 'Yes, confirm'}
                </button>
                <button
                  type="button"
                  onClick={() => setArming(null)}
                  className="rounded-lg border border-green-900/12 px-2.5 py-1 text-green-800/70 focus-ring"
                >
                  Cancel
                </button>
              </span>
            )}
            <Link
              to="/app/ops/payments/review"
              className="rounded-lg border border-green-600 px-2.5 py-1 text-[0.72rem] font-semibold text-green-700 focus-ring"
            >
              Open order
            </Link>
          </div>
          {failed?.id === r.purchase_id && (
            <p role="alert" className="mt-1.5 text-[0.72rem] text-red-700">{failed.msg}</p>
          )}
        </Card>
      ))}
      <More count={items.length} shown={CAP} to="/app/ops/payments/review" />
    </Cards>
  );
}

/* ── C4 · PEOPLE WAITING ────────────────────────────────────────────────── */
const WAIT_LABEL: Record<PersonWaitingRow['kind'], string> = {
  inquiry: 'Inquiry',
  reschedule: 'Reschedule',
  message: 'Message',
  contract_note: 'Contract',
};

function waitingHref(r: PersonWaitingRow): string {
  switch (r.kind) {
    case 'message': return messageHref(r.sender_id);
    case 'contract_note': return documentHref(r.document_id);
    case 'reschedule': return r.booking_id ? bookingHref(r.booking_id) : '/app/calendar';
    default: return r.contact_id ? contactHref(r.contact_id) : '/app/records/leads';
  }
}

/** Owner, 2026-08-23: "We need to make this follow up system much simpler.
 *  a single button to confirm they have been contacted is sufficient. a
 *  place for notes and a contact log is helpful if Claire will use it, im
 *  not sure she will so its optional and should be a single click away."
 *  markRequestContacted / appendRequestNote already existed
 *  (src/lib/ops/api-intake.ts) — built for the retired IntakePage's
 *  LeadWorkDrawer and unreachable since. Reused here, not rebuilt (D18). */
export function PeopleZone({ items, onDone }: { items: PersonWaitingRow[]; onDone: () => void }) {
  const [busy, setBusy] = useState<string | null>(null);
  const [noting, setNoting] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const [failed, setFailed] = useState<{ id: string; msg: string } | null>(null);

  async function contacted(id: string) {
    setBusy(id);
    setFailed(null);
    try {
      await markRequestContacted(id);
      if (noting === id && note.trim()) await appendRequestNote(id, note.trim());
      setNoting(null);
      setNote('');
      onDone();
    } catch (e) {
      setFailed({ id, msg: toErrorMessage(e, 'Could not mark that as contacted.') });
    } finally {
      setBusy(null);
    }
  }

  return (
    <Cards>
      {items.slice(0, CAP).map((r) => (
        <Card
          key={`${r.kind}-${r.id}`}
          to={r.kind === 'inquiry' ? undefined : waitingHref(r)}
          title={r.who ?? 'Someone'}
          tag={r.age_hours > 24 ? `${WAIT_LABEL[r.kind]} · ${ageLabel(r.age_hours)}` : WAIT_LABEL[r.kind]}
          tagTone={r.age_hours > 24 ? 'urgent' : 'new'}
          detail={<>{r.subject}{r.detail ? ` — ${r.detail}` : ''}</>}
        >
          {r.kind === 'inquiry' && (
            <div className="mt-2">
              <div className="flex flex-wrap items-center gap-1.5">
                <button
                  type="button"
                  disabled={busy === r.id}
                  onClick={() => void contacted(r.id)}
                  className="rounded-lg bg-green-800 px-2.5 py-1 text-[0.72rem] font-semibold text-gold-100 disabled:opacity-60 focus-ring"
                >
                  {busy === r.id ? 'Marking…' : 'Mark contacted'}
                </button>
                {noting !== r.id && (
                  <button
                    type="button"
                    onClick={() => setNoting(r.id)}
                    className="text-[0.7rem] font-medium text-green-800/60 underline underline-offset-2 focus-ring"
                  >
                    + note
                  </button>
                )}
                <Link
                  to={r.contact_id ? contactHref(r.contact_id) : '/app/records/leads'}
                  className="text-[0.7rem] font-medium text-green-800/60 underline underline-offset-2 focus-ring"
                >
                  Open
                </Link>
              </div>
              {noting === r.id && (
                <textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="What did you say? (optional — attaches when you mark contacted)"
                  rows={2}
                  className="mt-1.5 w-full rounded-lg border border-green-800/20 px-2.5 py-1.5 text-[0.78rem] focus-ring"
                />
              )}
              {failed?.id === r.id && (
                <p role="alert" className="mt-1.5 text-[0.72rem] text-red-700">{failed.msg}</p>
              )}
            </div>
          )}
        </Card>
      ))}
      <More count={items.length} shown={CAP} to="/app/records/leads" />
    </Cards>
  );
}

/* ── C6 · NOTES LOOP ────────────────────────────────────────────────────── */
export function NotesZone({ items, onDone }: { items: NotesRow[]; onDone: () => void }) {
  const [busy, setBusy] = useState<string | null>(null);

  async function markSeen(noteId: string) {
    setBusy(noteId);
    try { await markBookingNoteSeen(noteId); onDone(); }
    finally { setBusy(null); }
  }

  return (
    <Cards>
      {items.slice(0, CAP).map((r) => (
        <Card
          key={`${r.kind}-${r.id}`}
          to={r.kind === 'write_up' && r.booking_id ? bookingHref(r.booking_id, r.starts_at) : undefined}
          title={r.kind === 'write_up'
            ? `${r.client_name ?? 'Session'} · ${serviceWording(r.service_type).label}`
            : `${r.author_name ?? 'A client'} wrote a note`}
          tag={r.kind === 'write_up' ? 'Write it up' : 'Unread'}
          tagTone={r.age_days >= 3 ? 'urgent' : 'today'}
          detail={r.kind === 'write_up'
            ? `${r.age_days === 0 ? 'earlier today' : `${r.age_days} day${r.age_days === 1 ? '' : 's'} ago`} · no notes yet`
            : r.body}
        >
          {r.kind === 'unread_note' && r.note_id && (
            <button
              type="button"
              disabled={busy === r.note_id}
              onClick={() => void markSeen(r.note_id as string)}
              className="mt-2 rounded-lg border border-green-600 px-2.5 py-1 text-[0.72rem] font-semibold text-green-700 disabled:opacity-60 focus-ring"
            >
              {busy === r.note_id ? 'Marking…' : 'Mark read'}
            </button>
          )}
        </Card>
      ))}
      <More count={items.length} shown={CAP} to="/app/records/lessons" />
    </Cards>
  );
}

/* ── C7 · THE STABLE ────────────────────────────────────────────────────── */
/** Each reason reads as a sentence about the horse, not as a field dump. The
 *  first draft concatenated label + a fixed word and produced "Adeqon on" and
 *  "Lease ends lease ends Sep 1" — the shape differs per reason, so the phrase
 *  is built per reason. */
function reasonPhrase(x: StableReason): string {
  const on = x.due
    ? ` ${new Date(`${x.due}T12:00:00`).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`
    : '';
  switch (x.kind) {
    case 'health_overdue': return `${x.label ?? 'care'} overdue${on ? ` since${on}` : ''}`;
    case 'health_due':     return `${x.label ?? 'care'} due${on}`;
    case 'lease_ending':   return `lease ends${on}`;
    case 'medication':     return `on ${x.label ?? 'medication'}`;
    default:               return x.label ?? '';
  }
}

export function StableZone({ items }: { items: StableRow[] }) {
  return (
    <Cards>
      {items.slice(0, CAP).map((h) => (
        <Card
          key={h.horse_id}
          to={horseHref(h.horse_id)}
          title={h.name}
          tag={h.urgency === 1 ? 'Overdue' : h.urgency === 2 ? 'This fortnight' : undefined}
          tagTone={h.urgency === 1 ? 'urgent' : 'today'}
          detail={
            <>
              {h.reasons.map(reasonPhrase).join(' · ')}
              {h.rides_this_week > 0
                ? ` · ridden ${h.rides_this_week}× this week`
                : ' · not used this week'}
            </>
          }
        />
      ))}
      <More count={items.length} shown={CAP} to="/app/records/horses" />
    </Cards>
  );
}

/* ── C9 · DOCUMENTS & ONBOARDING ────────────────────────────────────────── */
export function DocumentsZone({ items }: { items: DocRow[] }) {
  return (
    <Cards>
      {items.slice(0, CAP).map((r) => (
        <Card
          key={`${r.kind}-${r.id}`}
          to={contactHref(r.contact_id)}
          title={r.who ?? 'Someone'}
          tag={r.kind === 'invitation_expiring' ? 'Invite expiring' : r.blocks_at ? 'Blocks a session' : 'Unsigned'}
          tagTone={r.blocks_at || r.kind === 'invitation_expiring' ? 'urgent' : 'neutral'}
          detail={r.kind === 'invitation_expiring'
            ? `Invitation expires ${r.expires_at ? new Date(r.expires_at).toLocaleDateString() : 'soon'}`
            : (
              <>
                {(r.templates ?? []).length} unsigned
                {r.blocks_at ? ` · next session ${new Date(r.blocks_at).toLocaleDateString(undefined, { weekday: 'long' })}` : ''}
              </>
            )}
        />
      ))}
      <More count={items.length} shown={CAP} to="/app/records/documents" />
    </Cards>
  );
}

/* ── C11 · COMMUNITY ────────────────────────────────────────────────────── */
export function CommunityZone({ items }: { items: CommunityRow[] }) {
  return (
    <Cards>
      {items.slice(0, CAP).map((r) => (
        <Card
          key={`${r.kind}-${r.id}`}
          to={r.kind === 'event_upcoming' ? '/app' : '/app/ops/moderation'}
          title={r.kind === 'event_upcoming' ? (r.title ?? 'Event') : 'Post needs a look'}
          tag={r.kind === 'event_upcoming' ? 'Event' : r.kind === 'reported' ? 'Reported' : 'Moderation'}
          tagTone={r.kind === 'event_upcoming' ? 'new' : 'urgent'}
          detail={r.kind === 'event_upcoming'
            ? `${r.rsvps ?? 0} going${r.capacity ? ` of ${r.capacity}` : ''} · ${r.starts_at ? new Date(r.starts_at).toLocaleDateString() : ''}`
            : (r.reason ?? r.body)}
        />
      ))}
      <More count={items.length} shown={CAP} to="/app/ops/moderation" />
    </Cards>
  );
}

/* ── C12 · EVALUATIONS DUE ──────────────────────────────────────────────── */
export function EvaluationsZone({ items }: { items: EvalRow[] }) {
  return (
    <Cards>
      {items.slice(0, CAP).map((r) => (
        <Card
          key={`${r.kind}-${r.id}`}
          to={r.kind === 'horse' && r.horse_id ? horseHref(r.horse_id) : contactHref(r.contact_id)}
          title={r.who ?? 'Unnamed'}
          tag={r.kind === 'rider' ? 'Rider' : 'Horse'}
          detail={`No initial evaluation on record · since ${new Date(r.since).toLocaleDateString()}`}
        />
      ))}
      <More count={items.length} shown={CAP} to="/app/ops/evaluations" />
    </Cards>
  );
}

/* ── C13 · GIFTS ────────────────────────────────────────────────────────── */
export function GiftsZone({ items }: { items: GiftRow[] }) {
  return (
    <Cards>
      {items.slice(0, CAP).map((g) => (
        <Card
          key={g.gift_id}
          title={`${g.item_label ?? 'Gift'}${g.amount ? ` · ${usd(g.amount)}` : ''}`}
          tag={g.opened_at ? 'Opened' : 'Not opened'}
          tagTone={g.opened_at ? 'new' : 'neutral'}
          detail={`${g.buyer ?? 'Someone'} → ${g.recipient ?? 'a recipient'}${g.deliver_on ? ` · delivers ${new Date(`${g.deliver_on}T12:00:00`).toLocaleDateString()}` : ''}`}
        />
      ))}
      <More count={items.length} shown={CAP} to="/app/records/clients" />
    </Cards>
  );
}
