import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Plus } from 'lucide-react';
import {
  requestDocumentsFromContact, DISPOSITION_LABEL, type DocumentDisposition,
  adminAttachOfferings, staffAssignableTemplates, staffAssignDocuments,
  type AssignableTemplate, type AssignDocumentsResult,
} from '../../lib/admin';
import {
  contactHorseRecords, horseRecordCompleteness, requestHorseRecordCompletion,
  staffContactOptions,
  type HorseIntakeRecord, type ContactOption,
} from '../../lib/horses';
import { fetchOfferings } from '../../lib/api';
import { asRecordedDate, barnToday } from '../../lib/recordedDate';
import { RecordedDateField } from './RecordedDateField';
import { Modal } from '../ops/kit/Modal';
import { HorseIntakeForm } from './HorseIntakeForm';
import { toErrorMessage } from '../../lib/ops/errors';
import type { Offering } from '../../lib/types';
import {
  fetchClientStandingSlots, setMyStandingSchedule, type StandingSlotChoice,
} from '../../lib/ops/api-calendar';
import { WEEKDAYS, WEEKDAY_PLURAL } from '../../lib/standingSlots';

/** The small "+ add" button these panels share. */
/**
 * CLIENT-RECORD ACTIONS — the working parts of the old Clients page, extracted
 * so they can live on the contact dossier.
 *
 * These four were the reason the Clients page could not simply be deleted: they
 * existed NOWHERE else. Each was already keyed on `contactId` rather than a
 * user_id, which is what makes this a move rather than a rewrite — and it is why
 * they work unchanged for the 13 of 19 contacts who have no account.
 *
 * Exported from here and rendered by ContactDossierModal; Admin.tsx no longer
 * defines them.
 */

/** 3f: the assignment picker — CONTRACTS (the clause-engine path, unchanged)
 *  and DOCUMENTS (the flat sign-only family). Selected documents APPEND to the
 *  person's pending set; assignment never gates staff operations — the wall
 *  constrains only the person's own session. On-file never blocks selection.
 *
 *  TASK-DOCQUEUE (20260811): `contactId` is now optional and `initialTemplateKey`
 *  lets a caller open this pre-scoped to one flat template — the documents
 *  picker's "assign and generate" act for a flat card, where there is no
 *  contact in context yet. When `contactId` is omitted, a first step asks
 *  who it's for; both existing callers (ContactDossierModal, Admin.tsx)
 *  already know the contact and skip straight past it, unchanged. */
export function AssignDocumentsModal({
  contactId: fixedContactId, initialTemplateKey, initialTemplateTitle, onClose, onAssigned,
}: {
  contactId?: string; initialTemplateKey?: string; initialTemplateTitle?: string;
  onClose: () => void; onAssigned: () => void;
}) {
  const navigate = useNavigate();
  const [contactId, setContactId] = useState(fixedContactId ?? '');
  const [contactOptions, setContactOptions] = useState<ContactOption[]>([]);
  const [templates, setTemplates] = useState<AssignableTemplate[]>([]);
  const [picked, setPicked] = useState<string[]>(initialTemplateKey ? [initialTemplateKey] : []);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  // Explicit confirmation: the modal stays open after a successful assign and
  // states exactly what happened (incl. which signed docs were superseded for
  // re-signature) — no more silent close-and-nothing-changed.
  const [result, setResult] = useState<AssignDocumentsResult | null>(null);
  /* ⚠️ FIX ROUND 2c — ASK THEM TO SIGN, FOLDED IN HERE. The First-login paperwork
     section was the only home of this dispatch (choose a due disposition, then
     email + dashboard-notify the person). That section is gone; assigning and
     asking now happen in one place, so a staff member is not left to discover a
     separate screen to actually send the request. Same single RPC
     (`requestDocumentsFromContact`) the removed section called. */
  const [disposition, setDisposition] = useState<DocumentDisposition>('WHEN_READY');
  const [asking, setAsking] = useState(false);
  const [askNote, setAskNote] = useState<string | null>(null);

  useEffect(() => {
    if (fixedContactId) return;
    staffContactOptions().then(setContactOptions).catch((e) =>
      setErr(toErrorMessage(e, 'Could not load contacts.')));
  }, [fixedContactId]);

  useEffect(() => {
    if (!contactId) return;
    staffAssignableTemplates(contactId).then(setTemplates).catch((e) =>
      setErr(toErrorMessage(e, 'Could not load templates.')));
  }, [contactId]);

  const toggle = (k: string) =>
    setPicked((p) => (p.includes(k) ? p.filter((x) => x !== k) : [...p, k]));

  async function assign() {
    if (picked.length === 0) return;
    setBusy(true); setErr(null);
    try {
      const r = await staffAssignDocuments(contactId, picked);
      setResult(r);
    } catch (e) {
      setErr(toErrorMessage(e, 'Could not assign.'));
    } finally { setBusy(false); }
  }

  /* D19: the request states when the paperwork is due and provably reaches the
     person. It reports which of "asked" and "emailed" actually happened, because
     the requirement and the notification commit before the mailer runs. */
  async function askThem() {
    if (!result) return;
    setAsking(true); setErr(null); setAskNote(null);
    try {
      const r = await requestDocumentsFromContact(contactId, result.assigned, disposition);
      const n = `${r.count} document${r.count === 1 ? '' : 's'}`;
      setAskNote(
        !r.has_account
          ? `Set on their record. They have no login yet, so nothing was sent — `
            + `${r.count === 1 ? 'it' : 'they'} will be waiting when they activate.`
          : r.emailed
            ? `Asked for ${n}. Email sent to ${r.email}, and it's on their dashboard.`
            : `Asked for ${n} — it's on their dashboard, but the email did NOT send`
              + `${r.emailError ? `: ${r.emailError}` : '.'}`);
    } catch (e) {
      setErr(toErrorMessage(e, 'Could not ask them to sign.'));
    } finally { setAsking(false); }
  }

  // No contact in context (opened from the documents picker rather than a
  // dossier): ask who it's for before anything else can load.
  if (!contactId) {
    return (
      /* ⚠️ TASK-FIX4 §3 — converged, all four overlays in this file. */
      <Modal open onClose={onClose} size="sm" title="Who is this for?"
        subtitle={initialTemplateTitle ? `Assigning: ${initialTemplateTitle}` : undefined}
        error={err}>
        <select className="form-input" value="" aria-label="Choose a person"
          onChange={(e) => setContactId(e.target.value)}>
          <option value="">
            {contactOptions.length === 0 && !err ? 'Loading…' : 'Choose…'}
          </option>
          {contactOptions.map((c) => (
            <option key={c.id} value={c.id}>{c.name || c.email || c.id}</option>
          ))}
        </select>
      </Modal>
    );
  }

  if (result) {
    const titleFor = (k: string) => templates.find((t) => t.template_key === k)?.title ?? k;
    return (
      <Modal open onClose={onAssigned} size="md" title="Documents assigned" error={err}
        footer={<button type="button" className="btn-primary" onClick={onAssigned}>Done</button>}>
          <p className="text-sm text-green-900 mb-3">
            {result.assigned.length} document{result.assigned.length === 1 ? '' : 's'} now
            on their record. Below the list you can ask them to sign — and say when it's due.
          </p>
          <ul className="text-sm text-green-900 mb-3 flex flex-col gap-1">
            {result.assigned.map((k) => (
              <li key={k} className="flex items-baseline justify-between gap-3 border border-green-800/10 rounded-lg px-3 py-1.5">
                <span>{titleFor(k)}</span>
                {result.resign.includes(k) && (
                  <span className="text-[11px] text-gold-800 whitespace-nowrap">replaces signed copy</span>
                )}
              </li>
            ))}
          </ul>
          {result.resign.length > 0 && (
            <p className="text-xs text-muted mb-3">
              Their previously signed {result.resign.length === 1 ? 'copy is' : 'copies are'} kept
              on file as superseded evidence.
            </p>
          )}
          {/* ⚠️ FIX ROUND 2c — the ask-them-to-sign dispatch, moved from the removed
              First-login paperwork section. Choosing a disposition and asking are the
              act that actually reaches the person; assigning alone only records the
              requirement. */}
          <div className="rounded-lg border border-gold-600/40 bg-gold-50/50 p-3">
            <p className="text-[13px] text-green-900 mb-2">When do they need to sign?</p>
            <div className="flex flex-wrap items-center gap-2">
              <select className="form-input w-auto text-sm" value={disposition}
                aria-label="When this paperwork is due"
                onChange={(e) => setDisposition(e.target.value as DocumentDisposition)}>
                {(['WHEN_READY', 'AT_LOGIN', 'WITH_CONTRACT'] as DocumentDisposition[]).map((dsp) => (
                  <option key={dsp} value={dsp}>{DISPOSITION_LABEL[dsp]}</option>
                ))}
              </select>
              <button type="button" className="btn-primary text-xs py-1.5 px-3"
                disabled={asking} onClick={() => void askThem()}>
                {asking ? 'Asking…' : 'Ask them to sign'}
              </button>
            </div>
            <p className="text-[11.5px] text-muted mt-1.5">
              {disposition === 'AT_LOGIN'
                ? 'They can’t use the app until these are signed.'
                : disposition === 'WITH_CONTRACT'
                  ? 'Held back until their contract executes, then signed with it.'
                  : 'Shown at every sign-in until signed — they can leave it for later.'}
            </p>
            {askNote && <p role="status" className="text-[12.5px] text-green-800 mt-2">{askNote}</p>}
          </div>
      </Modal>
    );
  }

  const onFile = (t: AssignableTemplate) =>
    t.on_file_status === 'none' ? 'None on file'
    : t.on_file_status === 'superseded' ? 'Superseded on file'
    : `Executed v${t.on_file_version ?? t.version}${t.on_file_date ? ` on ${new Date(t.on_file_date).toLocaleDateString()}` : ''}`;

  return (
    <Modal open onClose={onClose} size="md" title="Assign documents" error={err}
      footer={
        <button type="button" className="btn-primary" disabled={picked.length === 0 || busy} onClick={assign}>
          {busy ? 'Assigning…' : `Assign ${picked.length || ''}`.trim()}
        </button>
      }>
        {/* Opened pre-scoped to one flat template (the documents picker's
            assign-and-generate card): the contract shortcut doesn't apply —
            clause-composed types route to authoring, not here. */}
        {!initialTemplateKey && (
          <>
            <p className="text-[11px] uppercase tracking-wide text-secondary/70 mb-1.5">Contracts</p>
            <button type="button" className="btn-outline-gold w-full justify-center mb-4"
              onClick={() => navigate('/app/ops/contracts/new')}>
              New contract (lease / purchase) →
            </button>
          </>
        )}

        <p className="text-[11px] uppercase tracking-wide text-secondary/70 mb-1.5">Documents</p>
        <div className="flex flex-col gap-1.5 mb-4">
          {templates.map((t) => (
            <label key={t.template_key}
              className="flex items-start gap-2.5 border border-green-800/10 rounded-lg px-3 py-2 cursor-pointer hover:border-green-800/25">
              <input type="checkbox" className="accent-green-700 mt-0.5"
                checked={picked.includes(t.template_key)} onChange={() => toggle(t.template_key)} />
              <span className="min-w-0">
                <span className="block text-sm text-green-900">{t.title}</span>
                <span className="block text-xs text-muted">
                  {onFile(t)}{t.wall_gating ? ' · gates sign-in' : ''}
                </span>
              </span>
            </label>
          ))}
          {templates.length === 0 && !err && <p className="text-sm text-muted">Loading…</p>}
        </div>

    </Modal>
  );
}

/** DOCUMENTS-TAB HORSE CARD — the client's horse records beside their document
 *  list: per horse, a link to the record, its completeness against the
 *  doc-required field set (not started / partially complete / complete, with
 *  what's missing), an admin-editable intake view (staff may contribute), and
 *  a "send task" action that notifies the member to finish the required fields
 *  (existing notifications machinery → their dashboard). */
export function ClientHorseRecordsCard({ contactId }: { contactId: string }) {
  const [horses, setHorses] = useState<HorseIntakeRecord[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [taskSent, setTaskSent] = useState<Record<string, 'sending' | 'sent' | 'error'>>({});
  /** STABILIZE ITEM 3 — adding a horse FOR a client, from the client's own record. */
  const [adding, setAdding] = useState(false);

  /* ⚠️ FIX ROUND 2f — ONE READ PATH. This card had the same
     `contactHorseRecords(contactId)` fetch written twice: a `load` callback for
     the refresh buttons and a separate mount effect. Now there is one reader, and
     mount calls it; a `mounted` ref drops a late resolve so an unmounted card
     never sets state. */
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const load = useCallback(() => {
    setLoadError(null);
    contactHorseRecords(contactId)
      .then((h) => { if (mounted.current) setHorses(h); })
      .catch((e) => { if (mounted.current) setLoadError(e instanceof Error ? e.message : 'Could not load the horse records.'); });
  }, [contactId]);
  useEffect(load, [load]);

  async function sendTask(horseId: string) {
    setTaskSent((p) => ({ ...p, [horseId]: 'sending' }));
    try {
      await requestHorseRecordCompletion(horseId);
      setTaskSent((p) => ({ ...p, [horseId]: 'sent' }));
    } catch {
      setTaskSent((p) => ({ ...p, [horseId]: 'error' }));
    }
  }

  /* STABILIZE ITEM 3 — THE CARD USED TO VANISH WHEN IT WAS MOST NEEDED.
   *
   *     if (horses === null || horses.length === 0) return null;
   *
   * A client with no horse yet is precisely the client staff need to add one
   * for, and this line meant their record showed nothing at all — no list, and
   * no way in. Verified in a browser against production first (STABILIZE rule):
   * Overview, Bookings and Documents on a real client's dossier carry no
   * add-horse control of any kind; the only creation path was the separate
   * Horse Records page, which starts from the horse and not from the person.
   *
   * `null` is still returned while the first fetch is in flight, so the card
   * doesn't flash an empty state over data that is about to arrive.
   *
   * ⚠️ NO NEW FUNCTIONS (D18). The button opens the SAME `HorseIntakeForm` the
   * Horse Records page opens, with `ownerContactId` preset to this client —
   * the one `create_horse_record` intake path, which already honours
   * owner_contact_id for staff. */
  if (loadError) {
    return (
      <div className="mb-4 rounded-lg border border-red-300 bg-red-50 p-4">
        <p className="text-[11px] tracking-wide uppercase text-secondary/70 mb-1">Horse records</p>
        <p className="text-sm text-red-700">{loadError}</p>
      </div>
    );
  }
  if (horses === null) return null;
  return (
    <div className="mb-4 rounded-lg border border-green-800/10 bg-white p-4">
      <div className="flex items-center justify-between gap-3 mb-2">
        <p className="text-[11px] tracking-wide uppercase text-secondary/70">Horse records</p>
        <button type="button" onClick={() => setAdding(true)}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-green-800 text-white text-xs font-medium hover:bg-green-700 focus-ring">
          <Plus size={13} /> Add a horse
        </button>
      </div>
      {horses.length === 0 && (
        <p className="text-sm text-muted">
          No horse on this client's record yet.
        </p>
      )}
      <div className="flex flex-col gap-2">
        {horses.map((h) => {
          const c = horseRecordCompleteness(h);
          const name = String(h.nickname || h.registered_name || 'Horse');
          const badge = c.state === 'complete' ? 'On file' : 'Not started';
          const badgeCls = c.state === 'complete' ? 'bg-green-800 text-white' : 'bg-cream-100 text-secondary';
          const task = taskSent[h.id];
          return (
            <div key={h.id} className="border border-green-800/10 rounded-lg px-3 py-2.5">
              <div className="flex flex-wrap items-center gap-2">
                <Link to={`/app/horses/${h.id}`} className="text-sm font-medium text-green-900 underline underline-offset-2">
                  {name}
                </Link>
                <span className={`text-[10.5px] uppercase tracking-wide px-2 py-0.5 rounded-full ${badgeCls}`}>{badge}</span>
                <span className="flex-1" />
                <Link to={`/app/horse-intake?horse=${h.id}`}
                  className="text-xs text-gold-800 underline underline-offset-2">Open intake form</Link>
                {c.state !== 'complete' && (
                  <button type="button" onClick={() => void sendTask(h.id)}
                    disabled={task === 'sending' || task === 'sent'}
                    className="text-xs text-green-800 border border-green-800/20 rounded-lg px-2.5 py-1 hover:bg-green-50 focus-ring disabled:opacity-60">
                    {task === 'sending' ? 'Sending…' : task === 'sent' ? 'Task sent' : 'Ask them to finish it'}
                  </button>
                )}
              </div>
              {c.state !== 'complete' && c.missing.length > 0 && (
                <p className="text-[11.5px] text-muted mt-1.5">Missing: {c.missing.join(', ')}</p>
              )}
              {task === 'error' && <p className="text-[11.5px] text-red-700 mt-1">Could not send the task.</p>}
            </div>
          );
        })}
      </div>

      {adding && (
        <Modal open onClose={() => setAdding(false)} title="Add a horse for this client" size="lg" panelClassName="bg-cream">
          <HorseIntakeForm submitLabel="Add horse" ownerContactId={contactId}
            onDone={() => { setAdding(false); load(); }} />
        </Modal>
      )}
    </div>
  );
}

/** Orders tab action: attach offering(s) to this existing client account via the
 *  canonical spine (attach_offerings_to_client → _provision_purchase_for_offerings). */
/**
 * ⚠️ TASK-FIX2 §2 — SELLING A WEEKLY PLAN AND PLACING IT ARE ONE ACT.
 *
 * WHAT WAS MEASURED. Six live recurring purchases; FIVE have `config = {}` —
 * no chosen days, no times, no horizon — and one of those five is `PUR-000319`,
 * Madeline Do's `2x Weekly Lessons`, **paid, $880, which placed 0 bookings and
 * minted 0 credits**. The only plan that worked is the only one with a non-empty
 * `config`, and it was configured 98 seconds after provisioning through a modal
 * that closes on page reload.
 *
 * WHY. `attach_offerings_to_client → _provision_purchase_for_offerings` takes no
 * schedule argument and writes no `config`. It writes an order line and stops.
 * Under D23 the chosen days ARE the entitlement for a recurring SKU — a weekly
 * plan is a reserved time, not a credit balance — so an order line with no days
 * is an order that delivered nothing, and it looked identical to one that had.
 *
 * WHAT THIS DOES. When a picked offering is `config_kind = 'recurring'`, the
 * attach act asks the question the plan exists to answer, in the same breath as
 * the sale: one day and time per weekly session (`weekly_frequency`). It then
 * attaches, finds the purchase item the attach just created, and calls
 * `setMyStandingSchedule` — which materialises the month through
 * `set_recurring_days` + `_ensure_plan_horizon`.
 *
 * ⚠️ IT IS NOT A SECOND WRITER (D18). `set_my_standing_schedule` is the same RPC
 * `StandingSlotPicker` calls from the member's Calendar, the onboarding wizard and
 * the staff record. This panel holds no scheduling arithmetic; it collects the
 * answer and hands it to the one engine.
 *
 * ⚠️ TASK-BACKDATE R1 — AND IT CARRIES THE DATE THE ORDER REALLY HAPPENED.
 * `attach_offerings_to_client` had NO date parameter, so the owner's backfill of
 * a year of trading stamped every historical order with the day it was typed:
 * a year collapsed onto one date, every prior month reading zero, and the
 * dashboard ribbon reporting it confidently. The panel now asks for the order's
 * date, defaulted to today (where it changes nothing), and says on screen which
 * month the order is about to land in BEFORE the Attach button is pressed.
 *
 * ⚠️ AND STAFF CAN STILL DECLINE TO ANSWER. Leaving the days blank attaches the
 * plan anyway and says so — a plan awaiting a day is a real state (the client may
 * be picking it on the phone tomorrow). What is no longer possible is doing it
 * SILENTLY: the order line then carries a "no day chosen yet" mark and the
 * standing-slot section opens underneath with the question in it.
 */
export function AttachOfferingPanel({ contactId, onAttached }: { contactId: string; onAttached: () => void }) {
  const [open, setOpen] = useState(false);
  const [offerings, setOfferings] = useState<Offering[]>([]);
  const [picked, setPicked] = useState<string[]>([]);
  const [payStatus, setPayStatus] = useState<'unpaid' | 'partial' | 'paid'>('unpaid');
  const [partial, setPartial] = useState('');
  const [method, setMethod] = useState('Zelle');
  const [working, setWorking] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  /** Day + time per weekly session, keyed by offering id. */
  const [weekly, setWeekly] = useState<Record<string, StandingSlotChoice[]>>({});
  const [note, setNote] = useState<string | null>(null);
  /** TASK-BACKDATE: the date this order is being RECORDED AGAINST. Today by
   *  default, and today is sent as no date at all — so a sale happening now
   *  behaves exactly as it did before this existed. */
  const [occurredOn, setOccurredOn] = useState(barnToday());

  useEffect(() => { if (open) fetchOfferings().then(setOfferings).catch(() => setOfferings([])); }, [open]);

  // 4a: flat SKUs — an offering IS the purchasable item (the tier layer was
  // removed 2026-07-08). Same fix pattern as ProvisionClientForm.
  const purchasable = offerings.filter(
    (o) => o.config_kind !== 'inquire' && o.price_amount != null);
  const total = purchasable
    .filter((o) => picked.includes(o.id))
    .reduce((s, o) => s + (o.price_amount ?? 0), 0);
  const toggle = (id: string) => setPicked((p) => p.includes(id) ? p.filter((x) => x !== id) : [...p, id]);

  /** The picked offerings that are weekly plans, with how many sessions a week
   *  each one is. `weekly_frequency` is the SKU's own answer; never fewer than 1. */
  const recurringPicked = purchasable.filter(
    (o) => picked.includes(o.id) && o.config_kind === 'recurring');
  const freqOf = (o: Offering) => Math.max(o.weekly_frequency ?? 1, 1);
  const choicesFor = (o: Offering): StandingSlotChoice[] =>
    weekly[o.id] ?? Array.from({ length: freqOf(o) }, () => ({ day: '', time: '' }));
  const setChoice = (o: Offering, i: number, patch: Partial<StandingSlotChoice>) =>
    setWeekly((prev) => {
      const cur = prev[o.id] ?? Array.from({ length: freqOf(o) }, () => ({ day: '', time: '' }));
      return { ...prev, [o.id]: cur.map((c, n) => (n === i ? { ...c, ...patch } : c)) };
    });
  /** A plan is placeable when every session has a distinct day and a time. */
  const placeable = (o: Offering) => {
    const cs = choicesFor(o);
    return cs.every((c) => c.day && c.time) && new Set(cs.map((c) => c.day)).size === cs.length;
  };

  async function submit() {
    if (picked.length === 0) return;
    setWorking(true); setErr(null); setNote(null);
    try {
      const recorded = asRecordedDate(occurredOn);
      const { purchaseId } = await adminAttachOfferings(contactId, picked, {
        markPaid: payStatus === 'paid',
        ...(payStatus !== 'unpaid' ? { paymentMethod: method } : {}),
        ...(payStatus === 'partial' ? { partialAmount: Number(partial) || 0 } : {}),
        ...(recorded ? { occurredAt: recorded } : {}),
      });

      /* ⚠️ TASK-FIX2 §2 — PLACE WHAT WAS JUST SOLD. `attach_offerings_to_client`
         returns the purchase; `client_standing_slots` is the staff-gated read that
         resolves it to the purchase ITEM the standing time hangs off. Answered
         plans go through `setMyStandingSchedule`, the one writer; unanswered ones
         are named out loud rather than left as a silent `{}`. */
      const toPlace = recurringPicked.filter(placeable);
      const unplaced = recurringPicked.filter((o) => !placeable(o));
      if (purchaseId && toPlace.length > 0) {
        const slots = await fetchClientStandingSlots(contactId);
        for (const o of toPlace) {
          const slot = slots.find((sl) => sl.purchase_id === purchaseId && sl.offering_id === o.id);
          if (!slot) continue;
          await setMyStandingSchedule({
            purchaseItemId: slot.purchase_item_id,
            slots: choicesFor(o),
            durationMinutes: slot.duration_minutes || 60,
          });
        }
      }
      if (unplaced.length > 0) {
        setNote(`${unplaced.map((o) => o.name).join(' and ')} ${unplaced.length === 1 ? 'has' : 'have'} `
          + 'no day or time yet — set it in "Their standing weekly time" below.');
      }

      /* D19's record-side half: the panel closes, so the fact that this order
         was filed into an earlier month has to survive the close. */
      if (recorded) {
        setNote((n) => [`Recorded as of ${recorded} — it counts in that month, not this one.`, n]
          .filter(Boolean).join(' '));
      }
      setOpen(false); setPicked([]); setPayStatus('unpaid'); setPartial(''); setWeekly({});
      setOccurredOn(barnToday());
      onAttached();
    } catch (e) {
      setErr(toErrorMessage(e, 'Could not attach offering.'));
    } finally { setWorking(false); }
  }

  /* ⚠️ NOT THE FILLED PILL (owner, 2026-08-25): "maybe dont make it a thing dark
     green button, instead make it an outline that holds space for a new line item
     to be added and just show the button with text as an unfilled button on the
     left side of the inside of the box, and make it the size of the text and make
     it square." So: a bordered box the height of a line item, holding a square
     outline button at its left. The filled `TabCreate` pill this replaced turned
     out to have exactly ONE caller — this one — so it went with it rather than
     being left behind as a helper nothing uses. */
  if (!open) {
    return (
      <div className="border border-green-800/15 p-2 mt-1.5">
        <button type="button" onClick={() => setOpen(true)}
          className="inline-flex items-center gap-1.5 border border-green-800/40 text-green-900 text-xs font-medium px-2 py-1 hover:bg-green-50 focus-ring">
          <Plus size={12} /> Add offerings
        </button>
        {note && <p role="status" className="text-[11.5px] text-gold-900 mt-2">{note}</p>}
        {err && <p role="alert" className="form-error text-xs mt-2">{err}</p>}
      </div>
    );
  }
  return (
    <div className="border border-green-800/15 p-4 mt-1.5">
      <p className="text-sm font-medium text-green-900 mb-2">Add offerings</p>
      <div className="space-y-2 max-h-56 overflow-y-auto overscroll-contain mb-3">
        {purchasable.map((o) => (
          <label key={o.id} className="flex items-center gap-2 text-sm text-secondary py-0.5">
            <input type="checkbox" className="accent-green-800" checked={picked.includes(o.id)} onChange={() => toggle(o.id)} />
            <span className="flex-1">{o.name}</span>
            <span>${Number(o.price_amount ?? 0).toFixed(2)}</span>
          </label>
        ))}
      </div>
      {/* ⚠️ TASK-BACKDATE R6 — THE DATE IS SHOWN, NOT SILENT. It sits above the
          money, because which month this lands in is decided here and is not
          visible anywhere else until a dashboard disagrees with itself. */}
      {picked.length > 0 && (
        <div className="mb-3">
          <RecordedDateField value={occurredOn} onChange={setOccurredOn} kind="order" />
        </div>
      )}
      {picked.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 mb-3 text-sm">
          <span className="text-muted">Total ${total.toFixed(2)} ·</span>
          {(['unpaid', 'partial', 'paid'] as const).map((s) => (
            <button type="button" key={s} onClick={() => setPayStatus(s)}
              className={`px-2.5 py-1 rounded border capitalize text-xs ${payStatus === s ? 'border-green-700 bg-green-50 text-green-900' : 'border-green-800/20 text-secondary'}`}>{s}</button>
          ))}
          {payStatus === 'partial' && (
            <input type="number" min={0} max={total} step="0.01" value={partial} onChange={(e) => setPartial(e.target.value)}
              placeholder="paid" className="form-input w-24 py-1 text-sm" />
          )}
          {payStatus !== 'unpaid' && (
            <select value={method} onChange={(e) => setMethod(e.target.value)} className="form-input w-28 py-1 text-sm">
              {[{ v: 'zelle', l: 'Zelle' }, { v: 'cash', l: 'Cash' }].map((m) => <option key={m.v} value={m.v}>{m.l}</option>)}
            </select>
          )}
        </div>
      )}
      {recurringPicked.map((o) => (
        <div key={o.id} className="border border-gold-600/40 bg-gold-50/40 p-3 mb-3">
          <p className="text-sm font-medium text-green-900">
            {/* D25: the rider is told about their Riding Lesson, not about a SKU —
                but this is a STAFF surface picking from the price list, so the
                plan is named as it is sold. */}
            {o.name} — {freqOf(o) === 1 ? 'one session a week' : `${freqOf(o)} sessions a week`}
          </p>
          <p className="text-[11.5px] text-muted mb-2">
            A weekly plan is a reserved time, not a pool of credits (D23). Pick the
            day{freqOf(o) > 1 ? 's' : ''} and time{freqOf(o) > 1 ? 's' : ''} now and the month goes on
            the calendar with the order. Leave it blank and the plan is attached with
            no time yet — it will be marked as awaiting one.
          </p>
          {choicesFor(o).map((c, i) => (
            <div key={i} className="flex flex-wrap items-end gap-2 mb-2">
              <label className="flex-1 min-w-[8rem]">
                <span className="form-label text-[11px]">
                  {freqOf(o) === 1 ? 'Day' : `Session ${i + 1} — day`}
                </span>
                <select className="form-input py-1 text-sm" value={c.day}
                  onChange={(e) => setChoice(o, i, { day: e.target.value })}>
                  <option value="">Not yet</option>
                  {WEEKDAYS.map((dd) => (
                    <option key={dd} value={dd}
                      disabled={choicesFor(o).some((other, n) => n !== i && other.day === dd)}>
                      {WEEKDAY_PLURAL[dd]}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex-1 min-w-[8rem]">
                <span className="form-label text-[11px]">Time</span>
                <input type="time" className="form-input py-1 text-sm" value={c.time}
                  onChange={(e) => setChoice(o, i, { time: e.target.value.slice(0, 5) })} />
              </label>
            </div>
          ))}
          <p className="text-[11.5px] text-green-900">
            {placeable(o)
              ? `${choicesFor(o).map((c) => `${WEEKDAY_PLURAL[c.day] ?? c.day} at ${c.time}`).join(' and ')} — held every week from now on.`
              : 'No day chosen yet — this plan will be attached awaiting a time.'}
          </p>
        </div>
      ))}
      {err && <p className="form-error text-xs mb-2">{err}</p>}
      <div className="flex gap-2">
        <button type="button" disabled={working || picked.length === 0} onClick={submit} className="btn-primary text-xs py-1.5 px-3">
          {working ? 'Attaching…' : 'Attach'}
        </button>
        <button type="button" onClick={() => setOpen(false)} className="text-xs text-muted px-2">Cancel</button>
      </div>
    </div>
  );
}
