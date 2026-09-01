import { useEffect, useMemo, useRef, useState } from 'react';
import {  } from 'lucide-react';
import { Modal } from '../../components/ops/kit/Modal';
import { useFormDraft } from '../../lib/formState';
import { toErrorMessage } from '../../lib/ops/errors';
import { fetchOfferings } from '../../lib/api';
import type { Offering } from '../../lib/types';
import { listLessonClients, listScheduleHorses } from '../../lib/ops/api-lessons';
import type { LessonClientOption, ScheduleHorseOption } from '../../lib/ops/api-lessons';
import { BookingItemSwap } from '../../components/app/BookingItemSwap';
import { FeeChooser } from '../../components/app/FeeChooser';
import { SessionActivityForm } from './ops/lessons/SessionActivityForm';
import {
  fetchLocations, addMyLocation,
  fetchClientPurchases,
  fetchInstructorOptions,
  saveCalendarItem,
  deleteCalendarItem,
  confirmBooking,
  bookingAwaitsPayment,
  fetchOpenChangeRequests,
  decideBookingChange,
  requestHorseIntake,
  notifyAppointmentClient,
  fetchClientMonthlyPlans,
  setRecurringPlanEnd,
  setRecurringDays,
  generateMonthlyLessons,
  fetchBookingFeeCharges,
  type CalendarItem,
  type CalendarLocation,
  type ClientPurchaseOption,
  type InstructorOption,
  type MonthlyPlan,
  type BookingFeeCharge,
} from '../../lib/ops/api-calendar';
import { adminSendInvitation } from '../../lib/admin';

/*
 * The staff/admin calendar config panel (Phase 6, Slice 3). Right-side on
 * desktop, full-screen on mobile. Create or edit a calendar item: an
 * unavailable block, a flexible-open block, or a real offering booking assigned
 * to a client/horse/purchase — single or recurring. Submit commits; "Save draft"
 * keeps it as a draft on the calendar; Delete removes it (series-scoped).
 */

type ItemType = 'unavailable' | 'offering' | 'appointment';

function toLocalInput(iso: string): string {
  const d = new Date(iso);
  const off = d.getTimezoneOffset();
  return new Date(d.getTime() - off * 60_000).toISOString().slice(0, 16);
}
function fromLocalInput(local: string): string {
  return new Date(local).toISOString();
}

export function CalendarItemPanel({
  item,
  defaultStart,
  onClose,
  onSaved,
}: {
  item: CalendarItem | null;
  defaultStart?: Date;
  onClose: () => void;
  onSaved: () => void;
}) {
  const editing = !!item?.id;
  const [offerings, setOfferings] = useState<Offering[]>([]);
  const [clients, setClients] = useState<LessonClientOption[]>([]);
  const [horses, setHorses] = useState<ScheduleHorseOption[]>([]);
  const [locations, setLocations] = useState<CalendarLocation[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const done = useRef(false); // submitted/deleted → don't autosave a draft on close
  const [intakeSent, setIntakeSent] = useState(false); // A4 — horse-intake request sent to client

  // FEECHOICE F3 — staff can charge a no-show/late-start fee on a booking with
  // no reschedule request at all. Same chooser F1 uses on REVIEWQ's decision
  // surface, just without a computed amount (nothing computed outside a
  // reschedule ask).
  const [showFeeChooser, setShowFeeChooser] = useState(false);
  const [feeCharges, setFeeCharges] = useState<BookingFeeCharge[]>([]);
  const loadFeeCharges = () => {
    if (!item?.id) return;
    fetchBookingFeeCharges(item.id).then(setFeeCharges).catch(() => setFeeCharges([]));
  };
  useEffect(loadFeeCharges, [item?.id]);

  const initialStart = item?.starts_at ?? defaultStart?.toISOString() ?? new Date().toISOString();
  const initialEnd =
    item?.ends_at ?? new Date(new Date(initialStart).getTime() + 3_600_000).toISOString();

  const [type, setType] = useState<ItemType>(
    item?.kind === 'block' && (item.client_id || item.horse_id) ? 'appointment'
      : item && (item.status === 'unavailable' || item.kind === 'block') ? 'unavailable'
        : item ? 'offering' : 'unavailable',
  );
  const [start, setStart] = useState(toLocalInput(initialStart));
  const [end, setEnd] = useState(toLocalInput(initialEnd));
  const [offeringId, setOfferingId] = useState(item?.offering_id ?? '');
  const [clientId, setClientId] = useState(item?.client_id ?? '');
  const [purchaseId, setPurchaseId] = useState(item?.purchase_id ?? '');
  const [purchases, setPurchases] = useState<ClientPurchaseOption[]>([]);
  const [horseId, setHorseId] = useState(item?.horse_id ?? '');
  const [instructorId, setInstructorId] = useState(item?.instructor_user_id ?? '');
  const [instructors, setInstructors] = useState<InstructorOption[]>([]);
  const [isFlexible, setIsFlexible] = useState(item?.is_flexible ?? false);
  const [locationId, setLocationId] = useState(item?.location_id ?? '');
  const [address, setAddress] = useState(item?.address ?? '');
  const [travelBefore, setTravelBefore] = useState(String(item?.travel_before_minutes ?? 0));
  const [travelAfter, setTravelAfter] = useState(String(item?.travel_after_minutes ?? 0));
  const [price, setPrice] = useState(item?.price_amount != null ? String(item.price_amount) : '');
  const [notes, setNotes] = useState(item?.notes ?? '');
  const [weeks, setWeeks] = useState('1');
  const [scope, setScope] = useState<'one' | 'future' | 'all'>('one');

  // BOOKLINK B1 — inline "create the client" escape when a lesson needs one.
  const [newClientOpen, setNewClientOpen] = useState(false);
  const [newClientFirst, setNewClientFirst] = useState('');
  const [newClientLast, setNewClientLast] = useState('');
  const [newClientEmail, setNewClientEmail] = useState('');
  const [newClientBusy, setNewClientBusy] = useState(false);
  const [newClientError, setNewClientError] = useState<string | null>(null);

  // BOOKLINK B2 — payment disposition, consulted only if this save ends up
  // creating a brand-new order (nothing existed to debit).
  const [paymentMethod, setPaymentMethod] = useState<'zelle' | 'cash'>('zelle');
  const [paymentState, setPaymentState] = useState<'needs_payment' | 'paid'>('needs_payment');

  // BOOKLINK B4 — the monthly-plan assignment for this client + offering, once
  // one exists (it's created the first time this booking is saved).
  const [monthlyPlan, setMonthlyPlan] = useState<MonthlyPlan | null>(null);
  // CAREPLANS §P3: staff pick the DAYS (plural) and how long the plan runs. The
  // days decide how many sessions the month holds; they are not a rule the client
  // is then held to — any of those sessions can move to any date.
  const [planDays, setPlanDays] = useState<string[]>([]);
  const [planWeeks, setPlanWeeks] = useState<string>('');
  const [planIndefinite, setPlanIndefinite] = useState(true);
  const [monthlyBusy, setMonthlyBusy] = useState(false);
  const [monthlyError, setMonthlyError] = useState<string | null>(null);
  const [monthlyResult, setMonthlyResult] = useState<string | null>(null);

  useEffect(() => {
    fetchOfferings()
      .then((all) => setOfferings(all.filter((o) => o.segment === 'rider' || o.segment === 'horse')))
      .catch(() => setOfferings([]));
    listLessonClients().then(setClients).catch(() => setClients([]));
    listScheduleHorses().then(setHorses).catch(() => setHorses([]));
    fetchInstructorOptions().then(setInstructors).catch(() => setInstructors([]));
    fetchLocations().then((locs) => {
      setLocations(locs);
      // No hardcoded placeholder anymore — default to the barn default (or the
      // first location) when this is a new item with none chosen.
      if (!item?.location_id && locs.length) {
        setLocationId((locs.find((l) => l.is_default) ?? locs[0]).id);
      }
    }).catch(() => setLocations([]));
  }, []);

  /** TASK-FIX2 §1: the stamp's name, once `calendar_free_busy` has handed it back
   *  (staff branch only). Falls through to "Recorded" when the stamped user is not
   *  on the instructor roster — a fact we hold but cannot name is still a fact. */
  const instructorName = item?.instructor_user_id
    ? (instructors.find((s) => s.user_id === item.instructor_user_id)?.name ?? null)
    : null;

  async function addLocation() {
    const name = window.prompt('New location name');
    if (!name?.trim()) return;
    const addr = window.prompt('Address (optional)') ?? undefined;
    try {
      const newId = await addMyLocation(name.trim(), addr?.trim() || undefined);
      const locs = await fetchLocations();
      setLocations(locs);
      setLocationId(newId);
    } catch { /* keep current selection on failure */ }
  }

  // purchases for the chosen client (assign-purchase picker)
  useEffect(() => {
    if (!clientId) { setPurchases([]); return; }
    fetchClientPurchases(clientId).then(setPurchases).catch(() => setPurchases([]));
  }, [clientId]);

  const selectedOffering = offerings.find((o) => o.id === offeringId);
  const isRecurringOffering = selectedOffering?.config_kind === 'recurring';

  // BOOKLINK B4 — the monthly-plan assignment, once one exists for this
  // client + this recurring offering (created by the first save).
  useEffect(() => {
    setMonthlyPlan(null);
    setMonthlyResult(null);
    if (!clientId || !isRecurringOffering) return;
    // CREDITALIGN: a client can hold several plans (prod PUR-000059 carries two);
    // this panel is about the one matching the offering on screen.
    fetchClientMonthlyPlans(clientId)
      .then((plans) => {
        const plan = plans.find((p) => p.offering_id === offeringId) ?? null;
        setMonthlyPlan(plan);
        setPlanDays(plan?.recurring_days?.length
          ? plan.recurring_days
          : (plan?.recurring_day ? [plan.recurring_day] : []));
        setPlanWeeks(plan?.plan_weeks != null ? String(plan.plan_weeks) : '');
        setPlanIndefinite(plan ? plan.indefinite : true);
      })
      .catch(() => setMonthlyPlan(null));
  }, [clientId, offeringId, isRecurringOffering]);

  async function createNewClient() {
    if (!newClientFirst.trim() || !newClientEmail.trim()) {
      setNewClientError('First name and email are required.');
      return;
    }
    setNewClientBusy(true);
    setNewClientError(null);
    try {
      // BOOKLINK B1: reuse the canonical provisioning spine
      // (ProvisionClientForm → adminSendInvitation → provision_client_invitation)
      // rather than a second client-creation path.
      await adminSendInvitation({
        email: newClientEmail.trim(),
        firstName: newClientFirst.trim(),
        lastName: newClientLast.trim() || undefined,
        categories: ['GUEST'],
      });
      const refreshed = await listLessonClients();
      setClients(refreshed);
      const created = refreshed.find(
        (c) => (c.email ?? '').toLowerCase() === newClientEmail.trim().toLowerCase(),
      );
      if (created) setClientId(created.id);
      setNewClientOpen(false);
      setNewClientFirst(''); setNewClientLast(''); setNewClientEmail('');
    } catch (e) {
      setNewClientError(toErrorMessage(e, 'Could not create the client.'));
    } finally {
      setNewClientBusy(false);
    }
  }

  async function savePlanDays() {
    if (!monthlyPlan || planDays.length === 0) return;
    setMonthlyBusy(true); setMonthlyError(null); setMonthlyResult(null);
    try {
      const weeks = Number(planWeeks);
      const res = await setRecurringDays(
        monthlyPlan.purchase_item_id, planDays,
        planIndefinite ? { indefinite: true }
          : Number.isFinite(weeks) && weeks > 0 ? { weeks } : {});
      setMonthlyResult(
        `${res.entitled_this_month ?? 0} session${res.entitled_this_month === 1 ? '' : 's'} this month`
        + ` from ${planDays.length} day${planDays.length === 1 ? '' : 's'} a week`
        + (res.indefinite ? ', running until cancelled.' : `, ending ${res.plan_ends_on}.`)
        + (res.quantity_locked
            ? ' The order is already paid, so its quantity was left alone — change it on the order if the price should move.'
            : ` The order now bills ${res.quantity} × the weekly rate.`));
      const refreshed = await fetchClientMonthlyPlans(clientId);
      setMonthlyPlan(refreshed.find((p) => p.offering_id === offeringId) ?? null);
    } catch (e) {
      setMonthlyError(toErrorMessage(e, 'Could not set the plan’s days.'));
    } finally {
      setMonthlyBusy(false);
    }
  }

  async function generateThisMonth() {
    if (!monthlyPlan) return;
    setMonthlyBusy(true); setMonthlyError(null); setMonthlyResult(null);
    try {
      const res = await generateMonthlyLessons({
        clientId, purchaseItemId: monthlyPlan.purchase_item_id,
        startTime: start.slice(11, 16) || '15:00',
        horseId: horseId || null, locationId: locationId || null,
      });
      // CREDITALIGN: generating SPENDS the allotment, so the honest report includes
      // the dates it had to leave alone because the month was used up.
      setMonthlyResult(
        `${res.created} session${res.created === 1 ? '' : 's'} added, `
        + `${res.skipped_existing} already on the calendar`
        + (res.skipped_no_entitlement > 0
            ? `, ${res.skipped_no_entitlement} skipped — this month's allotment is used up.`
            : '.'));
      const refreshed = await fetchClientMonthlyPlans(clientId);
      setMonthlyPlan(refreshed.find((p) => p.offering_id === offeringId) ?? null);
    } catch (e) {
      setMonthlyError(toErrorMessage(e, 'Could not generate this month’s sessions.'));
    } finally {
      setMonthlyBusy(false);
    }
  }
  /** D13 — stopping a plan is a button here, not a migration. The month already
   *  bought stands; this only stops it rolling into the next one. */
  async function stopPlan() {
    if (!monthlyPlan) return;
    setMonthlyBusy(true); setMonthlyError(null); setMonthlyResult(null);
    try {
      const ending = monthlyPlan.plan_ends_on ? null : new Date().toISOString().slice(0, 10);
      await setRecurringPlanEnd(monthlyPlan.purchase_item_id, ending);
      const refreshed = await fetchClientMonthlyPlans(clientId);
      setMonthlyPlan(refreshed.find((p) => p.offering_id === offeringId) ?? null);
      setMonthlyResult(ending ? 'Plan stopped — it will not roll into next month.' : 'Plan resumed.');
    } catch (e) {
      setMonthlyError(toErrorMessage(e, 'Could not change the plan end.'));
    } finally {
      setMonthlyBusy(false);
    }
  }

  const selectedLocation = locations.find((l) => l.id === locationId);
  const offsite = selectedLocation?.is_offsite ?? false;

  // price auto-fills from the offering when empty
  useEffect(() => {
    if (type === 'offering' && selectedOffering && price === '') {
      if (selectedOffering.price_amount != null) setPrice(String(selectedOffering.price_amount));
    }
  }, [offeringId]); // eslint-disable-line react-hooks/exhaustive-deps

  const isSeries = !!item?.series_id;

  function buildPayload(asDraft: boolean) {
    const kind =
      type === 'unavailable' || type === 'appointment'
        ? 'block'
        : isFlexible
          ? 'block'
          : selectedOffering?.segment === 'horse'
            ? 'care'
            : 'lesson';
    const status = asDraft
      ? 'draft'
      : type === 'unavailable' || type === 'appointment'
        ? 'unavailable'
        : isFlexible
          ? 'available'
          : 'scheduled';
    return {
      id: item?.id ?? null,
      kind: kind as 'block' | 'lesson' | 'care',
      status,
      starts_at: fromLocalInput(start),
      ends_at: fromLocalInput(end),
      is_flexible: type === 'offering' ? isFlexible : false,
      client_id: type === 'offering' || type === 'appointment' ? clientId || null : null,
      purchase_id: type === 'offering' ? purchaseId || null : null,
      horse_id: type === 'offering' || type === 'appointment' ? horseId || null : null,
      offering_id: type === 'offering' ? offeringId || null : null,
      // BOOKWRITE: who delivers it. Left blank on a client-bound lesson/care
      // item, the RPC records the acting staff member; an open availability
      // slot is nobody's yet and stays unassigned.
      /* ⚠️ TASK-FIX2 §1: on an EDIT the panel has nothing truer to say than what is
         already stored, so it says nothing. `save_calendar_item` reads a NULL here
         as "unchanged" (it coalesces onto the stored stamp) rather than as "make
         it mine", but sending the key at all on an edit is the shape that caused
         the overwrite, so it is not sent. */
      instructor_user_id: editing ? null
        : (type === 'offering' && !isFlexible ? instructorId || null : null),
      location_id: locationId || null,
      address: offsite ? address || selectedLocation?.address || null : null,
      travel_before_minutes: offsite ? Number(travelBefore) || 0 : 0,
      travel_after_minutes: offsite ? Number(travelAfter) || 0 : 0,
      price_amount: type === 'offering' && price !== '' ? Number(price) : null,
      notes: notes.trim() || null,
      recurrence_weeks: !editing ? Number(weeks) || 1 : 1,
      scope: editing && isSeries ? scope : 'one',
      // BOOKLINK B2: only consulted when this save creates a brand-new order.
      payment_method: type === 'offering' && !isFlexible ? paymentMethod : null,
      payment_state: type === 'offering' && !isFlexible ? paymentState : undefined,
    };
  }

  // BOOKLINK B1: a committed (non-draft) lesson needs a client — the same
  // rule the DB enforces (bookings_lesson_requires_client), checked here so
  // the panel can say so instead of surfacing a raw constraint error. Horse
  // (kind='care') bookings are outside B1's scope per the spec's own words.
  const needsClientToCommit =
    type === 'offering' && !isFlexible && selectedOffering?.segment !== 'horse' && !clientId;

  async function submit(asDraft: boolean) {
    if (!asDraft && needsClientToCommit) {
      setError('Pick the client this lesson is for — or create one — before booking it.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const saved = await saveCalendarItem(buildPayload(asDraft));
      draft.clear();
      // C5 — a committed appointment linked to a client/horse notifies them.
      if (!asDraft && type === 'appointment' && (clientId || horseId) && saved?.id) {
        try { await notifyAppointmentClient(saved.id); } catch { /* the appointment saved; notice is best-effort */ }
      }
      done.current = true;
      onSaved();
    } catch (e) {
      setError(toErrorMessage(e, 'Could not save.'));
    } finally {
      setBusy(false);
    }
  }

  /* `hasContent` used to decide whether closing should INSERT a draft row. It has
     no reader now that closing writes nothing — `useFormDraft` keeps the contents
     whether they amount to "enough" or not, which is the better answer anyway. */

  /* ⚠️ TASK-FIX4 §1 — CLOSING NO LONGER WRITES ANYTHING, AND THIS IS A DELIBERATE
     BEHAVIOUR CHANGE. This function used to call `saveCalendarItem(…, draft)` on
     every exit, so leaving the panel INSERTED a row. It is the same shape as
     `ContactDossierModal`'s commit-on-close and it is what the owner ruled out:
     *"no user would input data and click close and expect the form submitted."*

     What replaces it is strictly better for the case it was protecting against:
     the panel's contents are persisted to browser storage after every input
     (`draft` below), so an accidental close, a reload or a browser-back loses
     nothing — WITHOUT a row appearing on anybody's calendar. `Save draft` is
     still there, and pressing it is still the affirmative act that commits one. */
  function handleClose() {
    onClose();
  }

  /** ⚠️ TASK-LIFECYCLE / D19 — the same act as the queue's Confirm, and it says
   *  the same thing first: on an unpaid order this APPROVES and asks for the
   *  money, it does not schedule. */
  async function confirm() {
    if (!item?.id) return;
    let owes = false;
    try { owes = await bookingAwaitsPayment(item.id); } catch { owes = false; }
    if (owes && !window.confirm(
      'This order is not paid yet.\n\nApproving it will mark the session APPROVED and send the client a payment request. It is not scheduled until the payment is confirmed.\n\nSend the payment request?'
    )) return;
    setBusy(true); setError(null);
    try {
      const res = await confirmBooking(item.id);
      if (res.payment_requested) {
        window.alert('Approved — the payment request has been sent. The session schedules itself once you confirm the money arrived.');
      }
      done.current = true;
      onSaved();
    } catch (e) {
      setError(toErrorMessage(e, 'Could not confirm.'));
    } finally { setBusy(false); }
  }

  /** REVIEWQ R3 — a decline needs the open request row's id, not just the
   *  booking's; the panel only has the booking, so it looks its own request
   *  up the same way the queue (RequestsBar) does. */
  async function decline() {
    if (!item?.id) return;
    const reason = window.prompt('Reason for declining (shown to the client)?') ?? undefined;
    setBusy(true); setError(null);
    try {
      const reqs = await fetchOpenChangeRequests();
      const cr = reqs.find((r) => r.booking_id === item.id && r.kind === 'new' && !r.awaiting_client);
      if (!cr) throw new Error('No open request found for this booking.');
      await decideBookingChange(cr.id, false, false, reason);
      done.current = true;
      onSaved();
    } catch (e) {
      setError(toErrorMessage(e, 'Could not decline.'));
    } finally { setBusy(false); }
  }

  async function sendHorseIntake() {
    if (!item?.id) return;
    setBusy(true); setError(null);
    try {
      await requestHorseIntake(item.id);
      setIntakeSent(true);
    } catch (e) {
      setError(toErrorMessage(e, 'Could not send the horse-intake request.'));
    } finally { setBusy(false); }
  }

  async function remove() {
    if (!item?.id) return;
    setBusy(true);
    setError(null);
    try {
      await deleteCalendarItem(item.id, isSeries ? scope : 'one');
      done.current = true;
      onSaved();
    } catch (e) {
      setError(toErrorMessage(e, 'Could not delete.'));
    } finally {
      setBusy(false);
    }
  }

  /* TASK-FIX4 §6 — everything typed into this panel, in browser storage, keyed on
     the item being edited (or `new` for a fresh one). ⚠️ A DRAFT, NOT A ROW. */
  const draftShape = {
    type, start, end, offeringId, clientId, purchaseId, horseId, instructorId,
    isFlexible, locationId, address, travelBefore, travelAfter, price, notes, weeks,
  };
  const draft = useFormDraft(
    `calendar.item.${item?.id ?? 'new'}`,
    draftShape,
    (d) => {
      if (d.type) setType(d.type as ItemType);
      if (typeof d.start === 'string') setStart(d.start);
      if (typeof d.end === 'string') setEnd(d.end);
      if (typeof d.offeringId === 'string') setOfferingId(d.offeringId);
      if (typeof d.clientId === 'string') setClientId(d.clientId);
      if (typeof d.purchaseId === 'string') setPurchaseId(d.purchaseId);
      if (typeof d.horseId === 'string') setHorseId(d.horseId);
      if (typeof d.instructorId === 'string') setInstructorId(d.instructorId);
      if (typeof d.isFlexible === 'boolean') setIsFlexible(d.isFlexible);
      if (typeof d.locationId === 'string') setLocationId(d.locationId);
      if (typeof d.address === 'string') setAddress(d.address);
      if (typeof d.travelBefore === 'string') setTravelBefore(d.travelBefore);
      if (typeof d.travelAfter === 'string') setTravelAfter(d.travelAfter);
      if (typeof d.price === 'string') setPrice(d.price);
      if (typeof d.notes === 'string') setNotes(d.notes);
      if (typeof d.weeks === 'string') setWeeks(d.weeks);
    },
  );

  function clearForm() {
    setOfferingId(''); setClientId(''); setPurchaseId(''); setHorseId('');
    setInstructorId(''); setLocationId(''); setAddress('');
    setTravelBefore('0'); setTravelAfter('0'); setPrice(''); setNotes('');
    setWeeks('1'); setIsFlexible(false); setError(null);
    draft.clear();
  }

  const mapsHref = useMemo(
    () =>
      address.trim()
        ? `https://maps.apple.com/?daddr=${encodeURIComponent(address.trim())}`
        : null,
    [address],
  );

  return (
    /* ⚠️ TASK-FIX4 §3 — converged on the shared dialog's `drawer` variant. */
    <Modal open onClose={handleClose} size="sm" panelClassName="bg-cream"
      title={`${editing ? 'Edit' : 'New'} calendar item`}
      onClear={clearForm} saveStatus={draft.status} error={error}>
        <div className="flex flex-col gap-4 flex-1">
          {/* type */}
          <div className="inline-flex rounded-full bg-green-800/10 p-0.5 self-start">
            {(['offering', 'appointment', 'unavailable'] as ItemType[]).map((t) => (
              <button
                key={t}
                type="button"
                aria-pressed={type === t}
                onClick={() => setType(t)}
                className={`px-3 py-1 rounded-full text-sm ${type === t ? 'bg-green-800 text-white' : 'text-green-800'}`}
              >
                {/* D25 (SLOTREACH §4) — "booking" is internal taxonomy and must not
                    appear in staff-facing copy either. What this tab creates is a
                    session against something the client bought. */}
                {t === 'offering' ? 'Session' : t === 'appointment' ? 'Appointment' : 'Unavailable'}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <label className="text-sm">
              <span className="form-label">Start</span>
              <input type="datetime-local" className="form-input" value={start} onChange={(e) => setStart(e.target.value)} />
            </label>
            <label className="text-sm">
              <span className="form-label">End</span>
              <input type="datetime-local" className="form-input" value={end} onChange={(e) => setEnd(e.target.value)} />
            </label>
          </div>

          {type === 'offering' && (
            <>
              <label className="text-sm">
                <span className="form-label">Offering</span>
                <select className="form-input" value={offeringId} onChange={(e) => setOfferingId(e.target.value)}>
                  <option value="">Select…</option>
                  {offerings.map((o) => (
                    <option key={o.id} value={o.id}>{o.name}</option>
                  ))}
                </select>
              </label>
              <label className="inline-flex items-center gap-2 text-sm text-green-900">
                <input type="checkbox" checked={isFlexible} onChange={(e) => setIsFlexible(e.target.checked)} />
                Flexible — open for clients to book
              </label>
              {!isFlexible && (
                <label className="text-sm">
                  <span className="form-label">
                    Client{selectedOffering?.segment !== 'horse' ? ' (required to book)' : ''}
                  </span>
                  <select className="form-input" value={clientId} onChange={(e) => { setClientId(e.target.value); setPurchaseId(''); }}>
                    <option value="">Unassigned</option>
                    {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                  {!newClientOpen ? (
                    <button type="button" className="text-xs text-green-800 underline underline-offset-2 mt-1" onClick={() => setNewClientOpen(true)}>
                      + New client
                    </button>
                  ) : (
                    <div className="mt-2 p-3 bg-green-800/5 rounded-md flex flex-col gap-2">
                      <div className="grid grid-cols-2 gap-2">
                        <input className="form-input" placeholder="First name" value={newClientFirst} onChange={(e) => setNewClientFirst(e.target.value)} />
                        <input className="form-input" placeholder="Last name" value={newClientLast} onChange={(e) => setNewClientLast(e.target.value)} />
                      </div>
                      <input className="form-input" type="email" placeholder="Email" value={newClientEmail} onChange={(e) => setNewClientEmail(e.target.value)} />
                      <div className="flex items-center gap-2">
                        <button type="button" className="btn-primary text-xs px-3 py-1.5" disabled={newClientBusy} onClick={() => void createNewClient()}>
                          {newClientBusy ? 'Creating…' : 'Invite & select'}
                        </button>
                        <button type="button" className="text-xs text-green-800/70" onClick={() => { setNewClientOpen(false); setNewClientError(null); }}>
                          Cancel
                        </button>
                      </div>
                      {newClientError && <p role="alert" className="form-error">{newClientError}</p>}
                    </div>
                  )}
                </label>
              )}
              {!isFlexible && clientId && purchases.length > 0 && (
                <label className="text-sm">
                  <span className="form-label">Assign to purchase</span>
                  <select className="form-input" value={purchaseId} onChange={(e) => setPurchaseId(e.target.value)}>
                    <option value="">None — let the system debit or create one</option>
                    {purchases.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.label}{p.amount != null ? ` — $${p.amount}` : ''}
                      </option>
                    ))}
                  </select>
                </label>
              )}
              {!isFlexible && clientId && offeringId && (!editing || !item?.purchase_id) && (
                <div className="p-3 bg-green-800/5 rounded-md flex flex-col gap-2">
                  <p className="text-xs text-green-800/70">
                    Only used if booking this creates a brand-new order — if the client
                    already has a credit or package covering it, that's simply used.
                  </p>
                  <div className="grid grid-cols-2 gap-3">
                    <label className="text-sm">
                      <span className="form-label">Payment method</span>
                      <select className="form-input" value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value as 'zelle' | 'cash')}>
                        <option value="zelle">Zelle</option>
                        <option value="cash">Cash</option>
                      </select>
                    </label>
                    <label className="text-sm">
                      <span className="form-label">Payment status</span>
                      <select className="form-input" value={paymentState} onChange={(e) => setPaymentState(e.target.value as 'needs_payment' | 'paid')}>
                        <option value="needs_payment">Needs to be paid</option>
                        <option value="paid">Already paid</option>
                      </select>
                    </label>
                  </div>
                </div>
              )}
              {!isFlexible && clientId && isRecurringOffering && (
                <div className="p-3 bg-green-800/5 rounded-md flex flex-col gap-2">
                  <p className="form-label mb-0">Monthly plan</p>
                  {!monthlyPlan ? (
                    <p className="text-xs text-green-800/70">
                      Save this session once to assign the plan, then choose the days it runs on.
                      To set the standing weekly time itself — day AND time, materialised for
                      the next three months — open their record and use “Their standing
                      weekly time”.
                      
                    </p>
                  ) : (
                    <>
                      <p className="text-xs text-green-800/70">
                        {monthlyPlan.month_label}: {monthlyPlan.remaining_this_month} of{' '}
                        {monthlyPlan.entitled_this_month} left this month — the allotment
                        expires {new Date(monthlyPlan.expires_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} and
                        does not carry over.
                        {monthlyPlan.plan_ends_on
                          ? ` Plan ends ${monthlyPlan.plan_ends_on}.`
                          : ' The plan runs until it is cancelled.'}
                        {monthlyPlan.recurring_days.length > 0 && (
                          ` Set up on ${monthlyPlan.recurring_days.join(', ')} — that is how many sessions`
                          + ' the month holds, not where they have to sit.')}
                      </p>
                      {/* CAREPLANS §P3 — which days, and for how long. The day
                          count IS the frequency and the quantity; the client is
                          free to move any session to any date afterwards. */}
                      <div>
                        <p className="text-xs text-green-800/70 mb-1">Which days of the week</p>
                        <div className="flex flex-wrap gap-1">
                          {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d) => {
                            const on = planDays.includes(d);
                            return (
                              <button
                                key={d} type="button" aria-pressed={on}
                                className={`text-xs px-2.5 py-1.5 border rounded-md ${on
                                  ? 'bg-green-800 text-white border-green-800'
                                  : 'bg-white text-green-900 border-green-800/20 hover:border-green-800/50'}`}
                                onClick={() => setPlanDays((prev) => (
                                  prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d]))}
                              >{d}</button>
                            );
                          })}
                        </div>
                        {planDays.length > 0 && monthlyPlan.weekly_frequency != null
                          && monthlyPlan.weekly_frequency !== planDays.length && (
                          <p className="text-xs text-gold-ink mt-1">
                            {monthlyPlan.offering_name} normally runs {monthlyPlan.weekly_frequency}{' '}
                            day{monthlyPlan.weekly_frequency === 1 ? '' : 's'} a week and you have
                            chosen {planDays.length}. That is allowed — the days you pick are what
                            this client gets.
                          </p>
                        )}
                      </div>
                      <div className="flex flex-wrap items-center gap-3">
                        <label className="inline-flex items-center gap-2 text-xs text-green-900">
                          <input type="checkbox" className="accent-green-700" checked={planIndefinite}
                            onChange={(e) => setPlanIndefinite(e.target.checked)} />
                          Until they cancel
                        </label>
                        {!planIndefinite && (
                          <label className="inline-flex items-center gap-2 text-xs text-green-900">
                            for
                            <input type="number" min="1" step="1" className="form-input w-20 py-1"
                              value={planWeeks} onChange={(e) => setPlanWeeks(e.target.value)} />
                            weeks
                          </label>
                        )}
                        <button type="button" className="btn-secondary text-xs px-3 py-1.5 whitespace-nowrap"
                          disabled={monthlyBusy || planDays.length === 0 || (!planIndefinite && !planWeeks)}
                          onClick={() => void savePlanDays()}>
                          Set days
                        </button>
                      </div>
                      <button type="button" className="btn-primary text-xs px-3 py-1.5 self-start" disabled={monthlyBusy || !monthlyPlan.recurring_day} onClick={() => void generateThisMonth()}>
                        {monthlyBusy ? 'Working…' : 'Generate this month’s sessions'}
                      </button>
                      <button type="button" className="text-xs text-red-700 self-start py-1 hover:underline"
                        disabled={monthlyBusy} onClick={() => void stopPlan()}>
                        {monthlyPlan.plan_ends_on ? 'Resume this plan' : 'Stop this plan after this month'}
                      </button>
                      {monthlyResult && <p className="text-xs text-green-700">{monthlyResult}</p>}
                      {monthlyError && <p role="alert" className="form-error">{monthlyError}</p>}
                    </>
                  )}
                </div>
              )}
              {/* ⚠️ TASK-FIX2 §1 — WHO IS DELIVERING IT, AND WHY THIS IS NOT A PICKER
                  ON AN EXISTING SESSION.

                  The select below used to render on every session, initialised from
                  `item?.instructor_user_id` — a key `calendar_free_busy` did not
                  return, so it ALWAYS read "You (whoever books it)" and ALWAYS sent
                  NULL. `save_calendar_item` then defaulted NULL to `auth.uid()` and
                  wrote it unconditionally, so opening a lesson to fix a typo moved it
                  to whoever pressed Submit. 45 of 47 stamps are hello@ and 2 are
                  admin@; those 2 are the damage.

                  Both halves are fixed: the RPC now returns the stamp (staff branch
                  only), and an edit preserves it. Owner ruling 2026-08-31 — *"This is
                  only one instructor, the head trainer/owner, Claire, this means we
                  dont need a selection method for this until we add another instructor
                  in the future."* — so on an EXISTING session this states the stamp
                  and does not offer to change it. On a NEW one the picker stays,
                  because that is a create-time default, not an overwrite. */}
              {!isFlexible && editing && (
                <div className="text-sm">
                  <span className="form-label">Instructor</span>
                  <p className="text-green-900">
                    {instructorName ?? (item?.instructor_user_id ? 'Recorded' : 'Not recorded')}
                  </p>
                  <span className="text-xs text-green-800/70 mt-1 block">
                    Who is delivering this. Saving this session does not change it.
                  </span>
                </div>
              )}
              {!isFlexible && !editing && instructors.length > 0 && (
                <label className="text-sm">
                  <span className="form-label">Instructor</span>
                  <select className="form-input" value={instructorId} onChange={(e) => setInstructorId(e.target.value)}>
                    <option value="">You (whoever books it)</option>
                    {instructors.map((s) => (
                      <option key={s.user_id} value={s.user_id}>{s.name}</option>
                    ))}
                  </select>
                  <span className="text-xs text-green-800/70 mt-1 block">
                    Who is delivering this. Left as-is, the booking records whoever saved it.
                  </span>
                </label>
              )}
              <label className="text-sm">
                <span className="form-label">Horse</span>
                <select className="form-input" value={horseId} onChange={(e) => setHorseId(e.target.value)}>
                  <option value="">No horse</option>
                  {horses.map((h) => <option key={h.id} value={h.id}>{h.name}</option>)}
                </select>
                {/* A4 — ask the client to provide their own horse (attaches on submit) */}
                {editing && item?.id && clientId && !horseId && (
                  intakeSent ? (
                    <p className="text-xs text-green-700 mt-1">Horse-intake request sent to the client.</p>
                  ) : (
                    <button type="button" className="text-xs text-green-800 underline underline-offset-2 mt-1" disabled={busy} onClick={() => void sendHorseIntake()}>
                      Ask the client to add their horse
                    </button>
                  )
                )}
              </label>
              <label className="text-sm">
                <span className="form-label">Price</span>
                <input type="number" step="0.01" className="form-input" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="Inherited from offering" />
              </label>
            </>
          )}

          {/* C5 — external appointment (vet, farrier, offsite): a labeled block
              optionally tied to a client and/or horse, who's notified + sees it. */}
          {type === 'appointment' && (
            <>
              <label className="text-sm">
                <span className="form-label">For client (optional)</span>
                <select className="form-input" value={clientId} onChange={(e) => setClientId(e.target.value)}>
                  <option value="">No one specific</option>
                  {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </label>
              <label className="text-sm">
                <span className="form-label">About horse (optional)</span>
                <select className="form-input" value={horseId} onChange={(e) => setHorseId(e.target.value)}>
                  <option value="">No horse</option>
                  {horses.map((h) => <option key={h.id} value={h.id}>{h.name}</option>)}
                </select>
              </label>
              <p className="form-hint">
                If you link a client (or a horse — we’ll find its owner), they’re notified and it shows on their calendar. It always blocks availability and adds any travel time.
              </p>
            </>
          )}

          <label className="text-sm">
            <span className="form-label">Location</span>
            <select className="form-input" value={locationId}
              onChange={(e) => { if (e.target.value === '__add') { void addLocation(); } else setLocationId(e.target.value); }}>
              {/* only real locations — the default is just the first/only one */}
              {locations.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}{l.is_offsite ? ' (offsite)' : ''}{l.is_mine ? ' (mine)' : ''}
                </option>
              ))}
              <option value="__add">+ Add a location…</option>
            </select>
          </label>

          {offsite && (
            <>
              <label className="text-sm">
                <span className="form-label">Address</span>
                <input className="form-input" value={address} onChange={(e) => setAddress(e.target.value)} placeholder={selectedLocation?.address ?? ''} />
                {mapsHref && (
                  <a href={mapsHref} target="_blank" rel="noreferrer" className="text-xs text-green-800 underline mt-1 inline-block">
                    Open in Apple Maps
                  </a>
                )}
              </label>
              <div className="grid grid-cols-2 gap-3">
                <label className="text-sm">
                  <span className="form-label">Travel before (min)</span>
                  <input type="number" className="form-input" value={travelBefore} onChange={(e) => setTravelBefore(e.target.value)} />
                </label>
                <label className="text-sm">
                  <span className="form-label">Travel after (min)</span>
                  <input type="number" className="form-input" value={travelAfter} onChange={(e) => setTravelAfter(e.target.value)} />
                </label>
              </div>
            </>
          )}

          {!editing && (
            <label className="text-sm">
              <span className="form-label">Repeat weekly for</span>
              <select className="form-input" value={weeks} onChange={(e) => setWeeks(e.target.value)}>
                {['1', '2', '3', '4', '6', '8', '12'].map((w) => (
                  <option key={w} value={w}>{w === '1' ? 'Just once' : `${w} weeks`}</option>
                ))}
              </select>
            </label>
          )}
          {editing && isSeries && (
            <label className="text-sm">
              <span className="form-label">Apply to</span>
              <select className="form-input" value={scope} onChange={(e) => setScope(e.target.value as 'one' | 'future' | 'all')}>
                <option value="one">This one</option>
                <option value="future">This &amp; future</option>
                <option value="all">All in series</option>
              </select>
            </label>
          )}

          <label className="text-sm">
            <span className="form-label">{type === 'appointment' ? 'Title / details' : 'Notes'}</span>
            {type === 'appointment' && <span className="form-hint">Shown as the appointment’s title on the client’s calendar (e.g. “Vet — spring shots”).</span>}
            <textarea rows={2} className="form-input resize-none" value={notes} onChange={(e) => setNotes(e.target.value)} />
          </label>

          {/* CREDITALIGN A2 — staff may re-charge a booking to a different purchased
              item at any time, including after it is confirmed. Same component and
              same server rules the member's own panel uses. */}
          {editing && item?.id && clientId && (item.kind === 'lesson' || item.kind === 'care') && (
            <div className="pt-1">
              <BookingItemSwap bookingId={item.id} onChanged={onSaved} />
            </div>
          )}

          {/* A1 — log + report for a real serviced booking (lesson or horse-care) */}
          {editing && item?.id && (item.kind === 'lesson' || item.kind === 'care') && (
            <div className="pt-1">
              <SessionActivityForm bookingId={item.id} />
            </div>
          )}

          {/* FEECHOICE F3 — a no-show or late-start fee, applied directly to
              this booking, no reschedule request required. */}
          {editing && item?.id && (item.kind === 'lesson' || item.kind === 'care') && (
            <div className="pt-1 flex flex-col gap-2">
              {feeCharges.filter((c) => !c.superseded_by).length > 0 && (
                <ul className="text-xs text-green-800/70 flex flex-col gap-0.5">
                  {feeCharges.filter((c) => !c.superseded_by).map((c) => (
                    <li key={c.id}>
                      {c.policy_wording} — ${c.amount.toFixed(2)}
                      {c.reason ? ` — ${c.reason}` : ''}
                    </li>
                  ))}
                </ul>
              )}
              {!showFeeChooser ? (
                <button type="button" className="btn-secondary text-xs px-3 py-1.5 self-start" onClick={() => setShowFeeChooser(true)}>
                  Apply a fee
                </button>
              ) : (
                <FeeChooser
                  bookingId={item.id}
                  onCancel={() => setShowFeeChooser(false)}
                  onApplied={() => {
                    setShowFeeChooser(false);
                    loadFeeCharges();
                  }}
                />
              )}
            </div>
          )}

          {error && <p role="alert" className="form-error">{error}</p>}
        </div>

        {/* actions */}
        <div className="p-4 border-t border-green-800/10 flex items-center gap-2 sticky bottom-0 bg-cream">
          {item?.status === 'pending' && (
            <>
              <button type="button" className="btn-primary justify-center" disabled={busy} onClick={() => void confirm()}>
                Confirm request
              </button>
              <button type="button" className="text-sm text-red-700 px-3 py-2 hover:bg-red-50 rounded-md" disabled={busy} onClick={() => void decline()}>
                Decline
              </button>
            </>
          )}
          <button type="button" className="btn-primary flex-1 justify-center" disabled={busy} onClick={() => void submit(false)}>
            {busy ? 'Saving…' : 'Submit'}
          </button>
          <button type="button" className="btn-secondary" disabled={busy} onClick={() => void submit(true)}>
            Save draft
          </button>
          {editing && (
            <button type="button" className="text-sm text-red-700 px-3 py-2 hover:bg-red-50 rounded-md" disabled={busy} onClick={() => void remove()}>
              Delete
            </button>
          )}
        </div>
    </Modal>
  );
}

export default CalendarItemPanel;
