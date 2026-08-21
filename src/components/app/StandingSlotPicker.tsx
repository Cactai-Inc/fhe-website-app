/**
 * THE STANDING WEEKLY SLOT — THE ONE PLACE IT IS CHOSEN.
 *
 * D23: a `recurring` SKU is not a credit balance, it is a RESERVED WEEKLY TIME that
 * is theirs — chosen once, recurring until cancelled. `weekly_frequency` is how many
 * slots a week, so a member on two lessons a week answers TWICE: two days, and a
 * time for each.
 *
 * ⚠️ ONE COMPONENT, FOUR SURFACES, ONE WRITER (D18). This was inline JSX inside
 * `Onboarding.tsx` and reachable from precisely nowhere else — `TASK-WALK2`'s finding
 * was that a weekly membership could not be sold at all, because the only door to it
 * was a wizard step that a signed client is short-circuited past. It now mounts on:
 *
 *   • the onboarding wizard's `slots` step (where a new buyer meets it),
 *   • the member's own Calendar, permanently, so it is reachable forever after,
 *   • the staff contact dossier, so Claire can set or change it without the client,
 *   • the order page, via a link that lands on the wizard's slot step.
 *
 * Every one of those calls `setMyStandingSchedule`, which is a thin front door onto
 * `set_recurring_days` + `_ensure_plan_horizon` — the same pair staff's
 * `CalendarItemPanel` has always used. There is no second scheduler here and this
 * component holds no scheduling arithmetic of its own; it collects the answer.
 *
 * ⚠️ AND IT NEVER SAYS "BOOKING" (D25). The word is internal taxonomy. A rider is
 * told about their Riding Lesson — never about 1x/2x weekly, an evaluation or a SKU
 * name — and a horse-care client about turnout or a hair clipping. `serviceLabel`
 * decides that, once, for the whole app.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { CalendarClock, Check, Pencil } from 'lucide-react';
import {
  fetchClientStandingSlots,
  setMyStandingSchedule,
  type StandingSlot,
  type StandingSlotChoice,
} from '../../lib/ops/api-calendar';
import {
  WEEKDAYS,
  WEEKDAY_PLURAL,
  clockLabel,
  serviceLabel,
  standingSlotSummary,
} from '../../lib/standingSlots';
import { toErrorMessage } from '../../lib/ops/errors';

/** How many weekly sessions this plan is, never fewer than one. */
function frequency(slot: StandingSlot): number {
  return Math.max(slot.weekly_frequency ?? 1, 1);
}

/** The choices to start a plan's form with — its current days/times when it has
 *  them (so "change" opens on what they have today, not on empty boxes). */
function initialChoices(slot: StandingSlot): StandingSlotChoice[] {
  const n = frequency(slot);
  const days = slot.recurring_days ?? [];
  return Array.from({ length: n }, (_, i) => ({
    day: days[i] ?? '',
    time: days[i] ? (slot.recurring_times?.[days[i]] ?? '') : '',
  }));
}

export interface StandingSlotPickerProps {
  /** The plans to choose for. Read by the caller so each surface owns its own
   *  reload; this component never fetches. */
  slots: StandingSlot[];
  /** Re-read the plans after a successful write. */
  onSaved: () => void;
  /** 'staff' changes the words only — the write and the authorisation are
   *  identical, because `set_my_standing_schedule` already admits staff. */
  audience?: 'client' | 'staff';
  /** Client name, for the staff wording ("Set Mary's weekly time"). */
  personName?: string | null;
}

export function StandingSlotPicker({
  slots, onSaved, audience = 'client', personName,
}: StandingSlotPickerProps) {
  const staff = audience === 'staff';
  const [editing, setEditing] = useState<string | null>(null);
  const [choices, setChoices] = useState<StandingSlotChoice[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);

  const unchosen = useMemo(() => slots.filter((s) => !s.chosen), [slots]);
  const chosen = useMemo(() => slots.filter((s) => s.chosen), [slots]);

  // An unchosen plan is the question in front of them, so it opens by itself.
  // A chosen one waits behind "Change" — it is already true and nothing is owed.
  useEffect(() => {
    setEditing((cur) => {
      if (cur && slots.some((s) => s.purchase_item_id === cur)) return cur;
      return unchosen[0]?.purchase_item_id ?? null;
    });
  }, [slots, unchosen]);

  const open = slots.find((s) => s.purchase_item_id === editing) ?? null;

  useEffect(() => {
    setChoices(open ? initialChoices(open) : []);
    setError(null);
    setNote(null);
  }, [open?.purchase_item_id]); // eslint-disable-line react-hooks/exhaustive-deps

  const ready =
    choices.length > 0 &&
    choices.every((c) => c.day && c.time) &&
    new Set(choices.map((c) => c.day)).size === choices.length;

  const save = useCallback(async () => {
    if (!open || !ready) return;
    setBusy(true); setError(null); setNote(null);
    try {
      const res = await setMyStandingSchedule({
        purchaseItemId: open.purchase_item_id,
        slots: choices,
        durationMinutes: open.duration_minutes || 60,
      });
      // The days are recorded either way, but the sessions only reach the calendar
      // once the order has left draft. Saying "that is yours" when nothing was
      // written is the kind of promise this whole task exists to stop making.
      if (!res.horizon?.ok) {
        setNote(res.horizon?.reason === 'draft'
          ? (staff
              ? 'The time is recorded. Nothing reaches the calendar until the order is placed.'
              : 'We have noted your time. It goes on the calendar as soon as your order is placed — '
                + 'tell us how you are paying and it is yours.')
          : 'The time is recorded, but nothing could be put on the calendar yet.');
      }
      setEditing(null);
      onSaved();
    } catch (e) {
      setError(toErrorMessage(e, staff
        ? 'Could not set the weekly time.'
        : 'Could not set your weekly time. Please try again.'));
    } finally { setBusy(false); }
  }, [open, ready, choices, onSaved, staff]);

  function setChoice(i: number, patch: Partial<StandingSlotChoice>) {
    setChoices((prev) => prev.map((c, n) => (n === i ? { ...c, ...patch } : c)));
  }

  if (slots.length === 0) {
    return (
      <p className="body-text text-sm text-muted">
        {staff
          ? 'No weekly plan on this account — a standing time belongs to a weekly purchase.'
          : 'You have no weekly plan, so there is no standing time to choose.'}
      </p>
    );
  }

  const who = staff ? (personName?.trim() ? `${personName.trim()}’s` : 'their') : 'your';

  return (
    <div className="flex flex-col gap-4" data-testid="standing-slot-picker">
      {/* ── What is already theirs ─────────────────────────────────────────── */}
      {chosen.map((s) => {
        const summary = standingSlotSummary(s);
        const label = serviceLabel(s, frequency(s));
        return (
          <div key={s.purchase_item_id}
            className="bg-green-50 border border-green-200 p-4 flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-sm font-sans text-green-900">
                <span className="font-medium">{label}</span>
                {summary && (
                  <>
                    {' — '}{summary}{' '}
                    {s.indefinite
                      ? (staff ? 'every week until cancelled.' : 'are yours, every week until you tell us otherwise.')
                      : `until ${s.plan_ends_on}.`}
                  </>
                )}
              </p>
              <p className="text-xs font-sans text-muted mt-1">
                {s.booked_ahead > 0
                  ? `${s.booked_ahead} session${s.booked_ahead === 1 ? '' : 's'} already on the calendar`
                  : 'Nothing on the calendar yet'}
                {s.horizon_through ? ` · held through ${s.horizon_through}` : ''}
              </p>
            </div>
            {editing !== s.purchase_item_id && (
              <button type="button" className="btn-outline-gold text-sm inline-flex items-center gap-1.5"
                onClick={() => setEditing(s.purchase_item_id)}>
                <Pencil size={14} aria-hidden="true" /> Change {staff ? 'the' : 'my'} day and time
              </button>
            )}
          </div>
        );
      })}

      {/* ── The question ───────────────────────────────────────────────────── */}
      {open && (
        <div className="border border-green-800/15 p-4">
          <h3 className="form-label mb-1 flex items-center gap-2">
            <CalendarClock size={16} aria-hidden="true" />
            {/* D25 — "Select the day and time for your weekly Riding Lesson(s)". */}
            {open.chosen ? 'Change the day and time' : 'Select the day and time'} for {who}{' '}
            weekly {serviceLabel(open, frequency(open))}
            {frequency(open) > 1 && !serviceLabel(open, 2).endsWith('s') ? 's' : ''}
          </h3>
          <p className="text-sm text-muted mb-4">
            {frequency(open) === 1
              ? `This is a standing weekly time${staff ? '' : ' that is yours'} — one day and one time, held every week${
                  open.indefinite ? ' until it is cancelled' : ` until ${open.plan_ends_on}`}.`
              : `This is ${frequency(open)} standing weekly times — pick ${frequency(open)} days and a time for each, held every week${
                  open.indefinite ? ' until they are cancelled' : ` until ${open.plan_ends_on}`}.`}
          </p>

          {error && <p role="alert" className="form-error mb-3">{error}</p>}

          <div className="flex flex-col gap-4 mb-4">
            {choices.map((c, i) => (
              <div key={i} className="flex flex-wrap gap-3 items-end">
                <label className="flex-1 min-w-[9rem]">
                  <span className="form-label">
                    {choices.length === 1 ? 'Day' : `Session ${i + 1} — day`}
                  </span>
                  <select className="form-input" value={c.day}
                    onChange={(e) => setChoice(i, { day: e.target.value })}>
                    <option value="">Choose a day…</option>
                    {WEEKDAYS.map((d) => (
                      <option key={d} value={d}
                        disabled={choices.some((o, n) => n !== i && o.day === d)}>
                        {WEEKDAY_PLURAL[d]}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="flex-1 min-w-[9rem]">
                  <span className="form-label">Time</span>
                  <input type="time" className="form-input" value={c.time}
                    onChange={(e) => setChoice(i, { time: e.target.value.slice(0, 5) })} />
                </label>
              </div>
            ))}
          </div>

          {/* What they are about to agree to, in their own words, before they press
              anything (D19 — a value-moving action states itself first). */}
          {ready && (
            <p className="text-sm text-green-900 bg-cream-100/60 border border-green-800/10 p-3 mb-4">
              {choices.map((c) => `${WEEKDAY_PLURAL[c.day] ?? c.day} at ${clockLabel(c.time)}`)
                .join(' and ')}
              {staff ? ' — held every week from now on.' : ' — held for you every week from now on.'}
            </p>
          )}

          <div className="flex flex-wrap gap-3">
            <button type="button" className="btn-primary inline-flex items-center gap-1.5"
              disabled={busy || !ready} onClick={() => void save()}>
              {busy ? 'Setting the time…'
                : open.chosen
                  ? <>Change it <Check size={16} aria-hidden="true" /></>
                  : (staff ? 'Set this weekly time' : 'That is my weekly time')}
            </button>
            {open.chosen && (
              <button type="button" className="btn-outline-gold text-sm"
                disabled={busy} onClick={() => setEditing(null)}>
                Leave it as it is
              </button>
            )}
          </div>
        </div>
      )}

      {note && <p role="status" className="text-sm text-green-900">{note}</p>}
    </div>
  );
}

export default StandingSlotPicker;

/**
 * SLOTREACH §2 — THE STAFF DOOR ONTO THE SAME PICKER.
 *
 * Owner (D26): Claire runs her day from her own surface, and she must be able to set
 * or change a client's standing weekly time WITHOUT the client — the phone call
 * decides it, and until now the only place it could be answered was inside the
 * client's own onboarding wizard.
 *
 * ⚠️ THIS IS NOT A SECOND WAY TO SET A STANDING TIME (D18). It reads through
 * `client_standing_slots` — a staff-gated READ added for exactly this — and writes
 * through `setMyStandingSchedule`, the identical RPC the member's own picker calls,
 * which has always authorised `has_staff_access() OR the plan's own client`. Same
 * component, same writer, same `_ensure_plan_horizon` materialisation.
 *
 * ⚠️ AND IT IS NOT `AgreedLessonPanel`, WHICH IS WHY IT SITS NEXT TO IT.
 * `provision_client_invitation(p_agreed_lesson => …)` books ONE session — the first
 * lesson agreed on a phone call, a `bookings` row. A standing weekly slot is a
 * different fact with a different home (`purchase_items.config`) and a different
 * lifetime (it recurs until cancelled). Routing the weekly plan through the agreed
 * lesson would book one lesson and leave the membership with no slot at all. The two
 * controls are deliberately adjacent and deliberately distinct: "the lesson we agreed
 * on the call" and "the weekly time that is theirs".
 */
export function StaffStandingSlotSection({ contactId, personName, title }: {
  contactId: string;
  personName?: string | null;
  /** Omit for the default heading. */
  title?: string;
}) {
  const [slots, setSlots] = useState<StandingSlot[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    fetchClientStandingSlots(contactId)
      .then((r) => { setSlots(r); setError(null); })
      .catch((e) => { setSlots([]); setError(toErrorMessage(e, 'Could not read their weekly plan.')); });
  }, [contactId]);
  useEffect(() => { load(); }, [load]);

  // A client with no weekly purchase has no standing time to set, and an empty
  // panel on every contact would be noise on every contact.
  if (slots !== null && slots.length === 0 && !error) return null;

  return (
    <section aria-label="Standing weekly time"
      className="border border-green-800/15 rounded-lg p-4 mb-6">
      <h3 className="form-label mb-1 flex items-center gap-2">
        <CalendarClock size={16} aria-hidden="true" />
        {title ?? 'Their standing weekly time'}
      </h3>
      <p className="text-sm text-muted mb-4">
        A weekly plan is a reserved time, not a pool of credits — set it here and every
        week is put on the calendar for the next three months, rolling forward as it is
        read. Changing it re-materialises from today; weeks already past are untouched.
      </p>
      {error && <p role="alert" className="form-error mb-3">{error}</p>}
      {slots === null
        ? <p className="body-text text-sm text-muted">Loading their plan…</p>
        : <StandingSlotPicker slots={slots} onSaved={load} audience="staff" personName={personName} />}
    </section>
  );
}
