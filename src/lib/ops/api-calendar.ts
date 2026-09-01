/* Calendar data seams (Phase 6). The one calendar for client/staff/admin reads
 * from calendar_free_busy — a role-aware free/busy view over the spine bookings
 * table plus the virtual business-hours frame. Staff see every item in full; a
 * client sees their own items in full, flexible-open blocks as bookable, and
 * everyone else's taken time as opaque 'unavailable' (travel folded in).
 *
 * Write RPCs (create/reschedule/book/cancel) land in later slices; this file is
 * the read spine plus the shared types the calendar UI speaks. */
import { supabase } from '../supabase';

/** A weekday open/close row of the business-hours frame (0=Sun … 6=Sat). */
export interface BusinessHour {
  weekday: number;
  open: string; // 'HH:MM:SS'
  close: string;
  closed: boolean;
}

/** One calendar item as the caller is allowed to see it. Opaque foreign items
 *  carry only id/status/starts_at/ends_at; the caller's own + staff views carry
 *  the full detail set. */
export interface CalendarItem {
  id: string;
  /** ⚠️ TASK-LIFECYCLE — the owner's six states, plus the calendar's own
   *  furniture, plus ONE value that is not a booking status at all:
   *  `pending_reschedule` is what `calendar_free_busy` shows an OUTSIDER over a
   *  `moved` booking. The row is held; the label says it may open up. Nothing
   *  ever writes it to `bookings.status`.
   *  `pending_slot` / `pending_payment` were retired: three spellings of one
   *  idea, zero rows carrying either. */
  status:
    | 'draft'
    | 'available'
    | 'unavailable'
    | 'requested'
    | 'approved'
    | 'pending'
    | 'moved'
    | 'pending_reschedule'
    | 'confirmed'
    | 'cancelled'
    | 'expired'
    | 'completed'
    | 'scheduled'
    | 'no_show';
  starts_at: string;
  ends_at: string | null;
  all_day?: boolean;
  kind?: 'purchase' | 'lesson' | 'care' | 'block';
  is_flexible?: boolean;
  is_mine?: boolean;
  mine_role?: 'staff' | 'client';
  client_id?: string | null;
  horse_id?: string | null;
  purchase_id?: string | null;
  offering_id?: string | null;
  instructor_user_id?: string | null;
  location_id?: string | null;
  address?: string | null;
  price_amount?: number | null;
  notes?: string | null;
  travel_before_minutes?: number;
  travel_after_minutes?: number;
  series_id?: string | null;
}

export interface CalendarView {
  from: string;
  to: string;
  role: 'staff' | 'client';
  hours: BusinessHour[];
  items: CalendarItem[];
}

/** The role-aware calendar for a date range (max 62 days). */
export async function fetchCalendar(fromISO: string, toISO: string): Promise<CalendarView> {
  const { data, error } = await supabase.rpc('calendar_free_busy', {
    p_from: fromISO,
    p_to: toISO,
  });
  if (error) throw error;
  return data as CalendarView;
}

/** The business-hours frame for the current org (staff-editable). */
export async function fetchBusinessHours(): Promise<BusinessHour[]> {
  const { data, error } = await supabase.rpc('business_hours');
  if (error) throw error;
  return (data ?? []) as BusinessHour[];
}

// ─── Locations pick-list ─────────────────────────────────────────────────────

export interface CalendarLocation {
  id: string;
  name: string;
  address: string | null;
  is_offsite: boolean;
  is_default: boolean;
  is_mine?: boolean;
}

/** Barn-wide locations + the caller's own personal ones (barn default first). */
export async function fetchLocations(): Promise<CalendarLocation[]> {
  const { data, error } = await supabase.rpc('my_locations');
  if (error) throw error;
  return (data ?? []) as CalendarLocation[];
}

/** Add a personal location for the signed-in member (visible only to them). */
export async function addMyLocation(name: string, address?: string): Promise<string> {
  const { data, error } = await supabase.rpc('add_my_location', {
    p_name: name, p_address: address ?? null,
  });
  if (error) throw error;
  return data as string;
}

/** Staff: locations for a SPECIFIC contact (barn-wide + that client's own). Used
 *  when creating a horse record / capturing a sale destination on their behalf. */
export async function fetchContactLocations(contactId: string): Promise<CalendarLocation[]> {
  const { data, error } = await supabase.rpc('contact_locations', { p_contact_id: contactId });
  if (error) throw error;
  return (data ?? []) as CalendarLocation[];
}

/** Staff: add a personal location on behalf of a client. */
export async function addContactLocation(contactId: string, name: string, address?: string): Promise<string> {
  const { data, error } = await supabase.rpc('add_contact_location', {
    p_contact_id: contactId, p_name: name, p_address: address ?? null,
  });
  if (error) throw error;
  return data as string;
}

// ─── Staff writes (Slice 3) ──────────────────────────────────────────────────

/** The full calendar-item payload the staff config panel submits. save_calendar_item
 *  overwrites every field, so the panel must send the item's COMPLETE state. */
export interface CalendarItemInput {
  id?: string | null;
  kind?: 'block' | 'lesson' | 'care' | 'purchase';
  status?: string;
  starts_at: string;
  ends_at: string;
  all_day?: boolean;
  is_flexible?: boolean;
  client_id?: string | null;
  horse_id?: string | null;
  purchase_id?: string | null;
  offering_id?: string | null;
  /** Who is delivering it. Omitted on a client-bound lesson/care item, the RPC
   *  records the acting staff member; availability slots stay unassigned. */
  instructor_user_id?: string | null;
  location_id?: string | null;
  address?: string | null;
  travel_before_minutes?: number;
  travel_after_minutes?: number;
  price_amount?: number | null;
  notes?: string | null;
  recurrence_weeks?: number;
  /** Series edit/delete reach: 'one' | 'future' | 'all'. */
  scope?: 'one' | 'future' | 'all';
  /** BOOKLINK B2: only consulted when this save ends up creating a brand-new
   *  order (nothing existed to debit) — ignored otherwise. */
  payment_method?: 'zelle' | 'cash' | null;
  payment_state?: 'needs_payment' | 'paid';
}

export async function saveCalendarItem(input: CalendarItemInput): Promise<{ id: string; series_id: string | null }> {
  const { data, error } = await supabase.rpc('save_calendar_item', { p: input });
  if (error) throw error;
  return data as { id: string; series_id: string | null };
}

export async function deleteCalendarItem(id: string, scope: 'one' | 'future' | 'all' = 'one'): Promise<number> {
  const { data, error } = await supabase.rpc('delete_calendar_item', { p_id: id, p_scope: scope });
  if (error) throw error;
  return data as number;
}

export async function closeDay(dateISO: string, reason?: string): Promise<void> {
  const { error } = await supabase.rpc('close_day', { p_date: dateISO, p_reason: reason ?? null });
  if (error) throw error;
}

export async function setBusinessHours(hours: BusinessHour[]): Promise<void> {
  const { error } = await supabase.rpc('set_business_hours', { p: hours });
  if (error) throw error;
}

/**
 * REVENUE — ONE ENGINE, AND THIS IS THE CALL (TASK-DASHBOARDBUILD §5 / D18).
 *
 * This used to call `calendar_revenue`, which sums `bookings.price_amount` over
 * non-cancelled bookings in the window. That is SCHEDULED VALUE, not revenue,
 * and it was wrong four ways — it counted unpaid orders, re-counted sessions a
 * punch card had already paid for, counted standing-slot sessions minted into
 * the future (D23), and recognised at session date instead of payment date.
 *
 * Measured against production on 2026-08-22, the two disagree by an order of
 * magnitude: `calendar_revenue` reported $15,600 for August where $1,510 had
 * actually been paid, and reported $4,550 of "revenue" in the twelve months
 * AHEAD of today, from sessions that have not happened.
 *
 * `revenue_summary` is paid purchases recognised at `purchases.paid_at`, with
 * the prior equal-length window for a delta. The dashboard KPI ribbon calls the
 * same function with the same windows, which is the point: there is no second
 * number for the two owners to disagree about.
 *
 * `calendar_revenue` is NOT dropped — nothing is removed from this database
 * (D32) — but it now has no callers.
 */
export interface CalendarRevenue {
  total: number;
  count: number;
  prior_total: number;
  prior_count: number;
  delta: number;
  delta_pct: number | null;
  /** BOOKS1 (CR-89): what was given away in the window — discounts + comps,
   *  written down against collected revenue. `total` is what was COLLECTED.
   *  Optional in the TYPE only so narrower readers (OwnerDashboard's
   *  RevenueWindow cast) keep compiling; the RPC always returns all four. */
  write_down_total?: number;
  write_down_count?: number;
  prior_write_down_total?: number;
  prior_write_down_count?: number;
}
export async function fetchRevenue(fromISO: string, toISO: string): Promise<CalendarRevenue> {
  const { data, error } = await supabase.rpc('revenue_summary', { p_from: fromISO, p_to: toISO });
  if (error) throw error;
  return data as CalendarRevenue;
}

export interface CreditRosterEntry {
  client_id: string;
  name: string;
  credits_remaining: number;
}
export async function fetchCreditsRoster(): Promise<CreditRosterEntry[]> {
  const { data, error } = await supabase.rpc('credits_roster');
  if (error) throw error;
  return (data ?? []) as CreditRosterEntry[];
}

/** A staff member a booking can name as the person delivering it. */
export interface InstructorOption {
  user_id: string;
  name: string;
  title: string | null;
}
/** The instructor roster (staff-gated RPC; the platform owner is excluded by
 *  org boundary, per D1a). */
export async function fetchInstructorOptions(): Promise<InstructorOption[]> {
  const { data, error } = await supabase.rpc('instructor_options');
  if (error) throw error;
  return (data ?? []) as InstructorOption[];
}

export interface ClientPurchaseOption {
  id: string;
  amount: number | null;
  label: string;
  created_at: string;
}
/** The purchases a booking can be assigned to (staff picker), for one client. */
export async function fetchClientPurchases(clientId: string): Promise<ClientPurchaseOption[]> {
  const { data, error } = await supabase.rpc('client_purchases', { p_client_id: clientId });
  if (error) throw error;
  return (data ?? []) as ClientPurchaseOption[];
}

// ─── Client booking + change flow (Slice 4) ──────────────────────────────────

/** A client claims a flexible-open block. Throws NO_CREDITS when a lesson slot
 *  needs a credit the client doesn't have (the UI then prompts to purchase).
 *
 *  ONBOARD §7 — `creditId` is the purchased item the member picked ("select what
 *  they are requesting that slot for from the items they purchased"). When it is
 *  given, that credit is the one debited and no other; when it is omitted the
 *  server falls back to its existing preference order. FLOWTRACE §9 flagged that
 *  the parameter existed end to end and no client surface ever passed it. */
export async function bookOpenSlot(
  bookingId: string,
  horseId?: string | null,
  creditId?: string | null,
): Promise<{ status: string; kind: string }> {
  const { data, error } = await supabase.rpc('book_open_slot', {
    p_booking_id: bookingId,
    p_horse_id: horseId ?? null,
    p_credit_id: creditId ?? null,
  });
  if (error) throw error;
  return data as { status: string; kind: string };
}

/** ONBOARD §7 — while a booking is still a REQUEST, the member just edits it.
 *  Nothing has been agreed, so there is no fee and no second approval step.
 *  Throws NOT_PENDING once staff have confirmed it (use requestBookingChange). */
export async function updateMyPendingBooking(
  bookingId: string, newStartISO: string, newEndISO: string,
): Promise<{ status: string; starts_at: string; ends_at: string }> {
  const { data, error } = await supabase.rpc('update_my_pending_booking', {
    p_booking_id: bookingId, p_new_start: newStartISO, p_new_end: newEndISO,
  });
  if (error) throw error;
  return data as { status: string; starts_at: string; ends_at: string };
}

/** Withdraw a request that was never confirmed — the credit comes straight back. */
export async function withdrawMyPendingBooking(
  bookingId: string,
): Promise<{ status: string; credit_refunded: boolean }> {
  const { data, error } = await supabase.rpc('withdraw_my_pending_booking', { p_booking_id: bookingId });
  if (error) throw error;
  return data as { status: string; credit_refunded: boolean };
}

/** ONBOARD §7 — the tiered change-fee schedule, as data. Empty until the owner
 *  enters it in the calendar settings panel, in which case the incumbent flat
 *  reschedule fee still applies. */
export interface ChangeFeeTier {
  id: string;
  hours_before: number;
  fee_amount: number;
  label: string | null;
  active: boolean;
}

export async function fetchChangeFeeSchedule(): Promise<ChangeFeeTier[]> {
  const { data, error } = await supabase.rpc('booking_change_fee_schedule');
  if (error) throw error;
  return (data ?? []) as ChangeFeeTier[];
}

export async function setChangeFeeSchedule(rows: Array<{
  hours_before: number; fee_amount: number; label?: string | null;
}>): Promise<number> {
  const { data, error } = await supabase.rpc('set_booking_change_fee_schedule', { p_rows: rows });
  if (error) throw error;
  return Number(data ?? 0);
}

export type ChangeKind = 'reschedule' | 'cancel' | 'defer';

export interface ChangeResult {
  change_id: string;
  fee_amount: number | null;
  phone_required: boolean;
  kind: ChangeKind;
  /** Echoed back when a fee applied, so the confirmation can say which way the
   *  client said they were settling it (ONBOARD §7). */
  fee_method?: 'zelle' | 'cash' | null;
}

/** Request a reschedule / cancel / defer on a booking. Returns the fee owed +
 *  whether a phone call is required so the UI can surface them before/after. */
export async function requestBookingChange(input: {
  bookingId: string;
  kind: ChangeKind;
  newStart?: string;
  newEnd?: string;
  /** 'one' | 'future' | 'all' | 'weeks:N' (recurring series reach). */
  scope?: string;
  note?: string;
  /** ONBOARD §7 — how the client is settling the change fee. The server REFUSES
   *  a chargeable change without it ("the booking doesnt submit to us until they
   *  confirm they made the payment with zelle or say they will pay cash"), so a
   *  missing value throws FEE_CONFIRMATION_REQUIRED rather than creating a row
   *  nobody follows up. A claim, not a payment: fee_paid still only moves via
   *  markChangeFeePaid. */
  feeMethod?: 'zelle' | 'cash' | null;
  feeReference?: string | null;
}): Promise<ChangeResult> {
  const { data, error } = await supabase.rpc('request_booking_change', {
    p_booking_id: input.bookingId,
    p_kind: input.kind,
    p_new_start: input.newStart ?? null,
    p_new_end: input.newEnd ?? null,
    p_scope: input.scope ?? 'one',
    p_note: input.note ?? null,
    p_fee_method: input.feeMethod ?? null,
    p_fee_reference: input.feeReference?.trim() || null,
  });
  if (error) throw error;
  return data as ChangeResult;
}

/** REVIEWQ: 'new' is a fresh client-made booking request (book_open_slot /
 *  requestOpenTime) awaiting the company's first decision — same table, same
 *  decide path as reschedule/cancel/defer, not a new queue. */
export type RequestKind = ChangeKind | 'new';

export interface OpenChangeRequest {
  id: string;
  booking_id: string;
  kind: RequestKind;
  proposed_starts_at: string | null;
  proposed_ends_at: string | null;
  fee_amount: number | null;
  fee_paid: boolean;
  phone_required: boolean;
  note: string | null;
  /** Staff-authored note — a decline reason, or a note on a proposed time. */
  staff_note: string | null;
  /** true when staff already proposed a counter-time and it's the client's
   *  turn to decide — staff has nothing left to do on this row but wait. */
  awaiting_client: boolean;
  created_at: string;
  client_name: string;
  starts_at: string;
}
export async function fetchOpenChangeRequests(): Promise<OpenChangeRequest[]> {
  const { data, error } = await supabase.rpc('open_change_requests');
  if (error) throw error;
  return (data ?? []) as OpenChangeRequest[];
}

export interface MyPendingChange {
  id: string;
  booking_id: string;
  kind: RequestKind;
  status: string;
  proposed_starts_at: string | null;
  proposed_ends_at: string | null;
  awaiting_client: boolean;
  fee_amount: number | null;
  fee_paid: boolean;
  phone_required: boolean;
  created_at: string;
}
export async function fetchMyPendingChanges(): Promise<MyPendingChange[]> {
  const { data, error } = await supabase.rpc('my_pending_changes');
  if (error) throw error;
  return (data ?? []) as MyPendingChange[];
}

/** Decide a request — staff deciding a client's ask (approve/reject), or the
 *  client deciding a staff-proposed counter-time (awaiting_client rows only,
 *  where `reason` has no effect). `reason` is shown to the client on a
 *  genuine decline of a fresh request (REVIEWQ R3). */
export async function decideBookingChange(changeId: string, approve: boolean, waiveFee = false, reason?: string): Promise<void> {
  const { error } = await supabase.rpc('decide_booking_change', {
    p_change_id: changeId, p_approve: approve, p_waive_fee: waiveFee, p_reason: reason ?? null,
  });
  if (error) throw error;
}

/** Staff counters a pending request with a different time (REVIEWQ R2). The
 *  client then accepts/declines it via decideBookingChange on the same
 *  change id — no new table, no new decision path. */
export async function proposeBookingTime(bookingId: string, newStartISO: string, newEndISO: string, note?: string): Promise<{ change_id: string }> {
  const { data, error } = await supabase.rpc('propose_booking_time', {
    p_booking_id: bookingId, p_new_start: newStartISO, p_new_end: newEndISO, p_note: note ?? null,
  });
  if (error) throw error;
  return data as { change_id: string };
}

export async function markChangeFeePaid(changeId: string, paid = true): Promise<void> {
  const { error } = await supabase.rpc('mark_change_fee_paid', { p_change_id: changeId, p_paid: paid });
  if (error) throw error;
}

/** FEECHOICE — the three-way choice staff make on a booking's fee: the
 *  computed reschedule amount, a named policy fee (no-show / late-start), a
 *  staff-entered custom amount, or a waiver. Every choice other than
 *  'computed' requires a reason (server-enforced). */
export type FeeKind = 'computed' | 'no_show' | 'late_start_before' | 'late_start_after' | 'custom' | 'waived';

export interface BookingFeeCharge {
  id: string;
  booking_id: string;
  change_request_id: string | null;
  purchase_id: string | null;
  fee_kind: FeeKind;
  policy_clause: string | null;
  policy_wording: string;
  amount: number;
  reason: string | null;
  decided_by: string;
  decided_at: string;
  superseded_by: string | null;
  created_at: string;
}

/** Prior fee decisions on this booking (newest first) — an active charge has
 *  `superseded_by === null`; a corrected one points at its replacement. */
export async function fetchBookingFeeCharges(bookingId: string): Promise<BookingFeeCharge[]> {
  const { data, error } = await supabase
    .from('booking_fee_charges')
    .select('*')
    .eq('booking_id', bookingId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as BookingFeeCharge[];
}

export interface ApplyBookingFeeResult {
  charge_id: string;
  purchase_id: string;
  amount: number;
  fee_kind: FeeKind;
}

/** Record the fee staff decided on a booking. It settles through the one
 *  payment spine (mark_purchase_paid) — a non-zero amount lands as an ordinary
 *  awaiting-payment order the client can claim (Zelle/cash) exactly like any
 *  other purchase; zero settles immediately. Pass `supersedes` to correct a
 *  prior charge rather than leaving two active charges for the same decision. */
export async function applyBookingFee(input: {
  bookingId: string;
  feeKind: FeeKind;
  changeId?: string | null;
  amount?: number | null;
  reason?: string | null;
  supersedes?: string | null;
}): Promise<ApplyBookingFeeResult> {
  const { data, error } = await supabase.rpc('apply_booking_fee', {
    p_booking_id: input.bookingId,
    p_fee_kind: input.feeKind,
    p_change_id: input.changeId ?? null,
    p_amount: input.amount ?? null,
    p_reason: input.reason?.trim() || null,
    p_supersedes: input.supersedes ?? null,
  });
  if (error) throw error;
  return data as ApplyBookingFeeResult;
}

/** A client requests an arbitrary open time for a new booking (→ pending). */
export async function requestOpenTime(input: {
  startISO: string; endISO: string; offeringId?: string | null; horseId?: string | null; note?: string;
}): Promise<{ booking_id: string; status: string }> {
  const { data, error } = await supabase.rpc('request_open_time', {
    p_starts_at: input.startISO, p_ends_at: input.endISO,
    p_offering_id: input.offeringId ?? null, p_horse_id: input.horseId ?? null, p_note: input.note ?? null,
  });
  if (error) throw error;
  return data as { booking_id: string; status: string };
}

/** Staff approve a requested time.
 *
 *  ⚠️ TASK-LIFECYCLE — this no longer always means "confirmed". On an order that
 *  still owes money the booking lands on `approved` and the payment request goes
 *  out (`request_purchase_payment`), and the caller is told so it can say which
 *  of the two happened. `status` is 'approved' or 'confirmed'. */
export async function confirmBooking(bookingId: string): Promise<{ status: string; payment_requested: boolean }> {
  const { data, error } = await supabase.rpc('confirm_booking', { p_booking_id: bookingId });
  if (error) throw error;
  return (data ?? { status: 'confirmed', payment_requested: false }) as { status: string; payment_requested: boolean };
}

/** Does approving this booking also ask the client for money? Read BEFORE the
 *  act, so the surface can state what is about to happen (D19). It is the same
 *  predicate the two approve paths use, so the screen and the database cannot
 *  disagree. */
export async function bookingAwaitsPayment(bookingId: string): Promise<boolean> {
  // Two plain reads rather than a PostgREST embed: the embed's relationship
  // name is a thing this cannot be tested against from a worktree, and a silent
  // false here would hide the payment request from the person about to send it.
  const { data: bk, error: e1 } = await supabase
    .from('bookings').select('credit_id, purchase_id').eq('id', bookingId).maybeSingle();
  if (e1 || !bk) return false;
  const b = bk as { credit_id: string | null; purchase_id: string | null };
  if (b.credit_id || !b.purchase_id) return false;
  const { data: pu, error: e2 } = await supabase
    .from('purchases').select('payment_status, amount, amount_paid, status, deleted_at')
    .eq('id', b.purchase_id).maybeSingle();
  if (e2 || !pu) return false;
  const p = pu as { payment_status: string | null; amount: number | null; amount_paid: number | null; status: string | null; deleted_at: string | null };
  if (p.deleted_at || p.status === 'void') return false;
  return (p.payment_status ?? '') !== 'paid'
      && Math.max((p.amount ?? 0) - (p.amount_paid ?? 0), 0) > 0;
}

/** Staff ask a booking's client to provide their horse (A4). Notifies the client
 *  with a click-through link that carries the booking id. */
export async function requestHorseIntake(bookingId: string): Promise<void> {
  const { error } = await supabase.rpc('request_horse_intake', { p_booking_id: bookingId });
  if (error) throw error;
}

/** The client attaches a horse they own to a booking they own (A4). */
export async function attachBookingHorse(bookingId: string, horseId: string): Promise<void> {
  const { error } = await supabase.rpc('attach_booking_horse', { p_booking_id: bookingId, p_horse_id: horseId });
  if (error) throw error;
}

/** Notify the client an external appointment is linked to (C5). Resolves the
 *  horse's owner when the appointment is tied only to a horse. */
export async function notifyAppointmentClient(bookingId: string): Promise<{ notified: boolean; reason?: string }> {
  const { data, error } = await supabase.rpc('appointment_notify', { p_booking_id: bookingId });
  if (error) throw error;
  return data as { notified: boolean; reason?: string };
}

/** The org's reschedule fee (0 = none). Read directly (RLS-scoped). */
export async function fetchRescheduleFee(): Promise<number> {
  const { data, error } = await supabase.from('calendar_settings').select('reschedule_fee').maybeSingle();
  if (error) throw error;
  return Number(data?.reschedule_fee ?? 0);
}

export async function setCalendarSettings(rescheduleFee: number): Promise<void> {
  const { error } = await supabase.rpc('set_calendar_settings', { p_reschedule_fee: rescheduleFee });
  if (error) throw error;
}

// ─── Monthly plans (BOOKLINK B4) ──────────────────────────────────────────────

export interface MonthlyPlan {
  /** CREDITALIGN: the allotment row itself. entitled/used/remaining below ARE this
   *  row's numbers — the panel and the booking path can no longer disagree. */
  credit_id: string;
  purchase_id: string;
  purchase_item_id: string;
  offering_id: string;
  offering_name: string;
  segment: string;
  weekly_frequency: number | null;
  /** 'Mon'..'Sun', or null when not yet set. CAREPLANS: kept as the first of
   *  `recurring_days` so surfaces written before the plural existed still read. */
  recurring_day: string | null;
  /** CAREPLANS §P3: the days staff chose. These decide HOW MANY sessions the month
   *  holds — they are not a schedule the client is held to. Empty on a plan set up
   *  before this task, which still computes from `weekly_frequency`. */
  recurring_days: string[];
  /** How many weeks the plan runs, or null when it runs until cancelled. */
  plan_weeks: number | null;
  /** True when the plan runs indefinitely (plan_ends_on is null). */
  indefinite: boolean;
  period_start: string;
  /** The month boundary: after this the allotment is gone and does not carry over. */
  expires_at: string;
  /** Set when staff have stopped the plan; it will not roll into another month. */
  plan_ends_on: string | null;
  month_label: string;
  entitled_this_month: number;
  used_this_month: number;
  remaining_this_month: number;
}

/** Staff: every current-month plan a client holds — lessons AND horse care.
 *  CREDITALIGN: was a single plan or null; a client can hold several (prod: Training
 *  1x Weekly + Exercise 1x Weekly on one order). Empty array when they have none. */
export async function fetchClientMonthlyPlans(clientId: string): Promise<MonthlyPlan[]> {
  const { data, error } = await supabase.rpc('client_monthly_plan', { p_client_id: clientId });
  if (error) throw error;
  return (data ?? []) as MonthlyPlan[];
}

/** The signed-in member's own current-month plans, both segments. */
export async function fetchMyMonthlyPlans(): Promise<MonthlyPlan[]> {
  const { data, error } = await supabase.rpc('my_monthly_plan');
  if (error) throw error;
  return (data ?? []) as MonthlyPlan[];
}

/** Staff or the plan's own client: set the recurring day of the week.
 *  Superseded by `setRecurringDays` — kept because it is still the writer for a
 *  single-day plan and its arithmetic is the one every existing plan computes with. */
export async function setRecurringDay(purchaseItemId: string, day: string): Promise<void> {
  const { error } = await supabase.rpc('set_recurring_day', { p_purchase_item_id: purchaseItemId, p_day: day });
  if (error) throw error;
}

export interface RecurringDaysResult {
  recurring_days: string[];
  plan_ends_on: string | null;
  plan_weeks: number | null;
  indefinite: boolean;
  quantity: number;
  /** True when the order is already paid, so the quantity was left as it was
   *  rather than re-pricing something someone has already settled. */
  quantity_locked: boolean;
  catalog_default: number | null;
  /** The chosen day count differs from the SKU's default. Surfaced, never
   *  corrected — staff may mean it (CAREPLANS §P2c). */
  differs_from_catalog: boolean;
  entitled_this_month: number | null;
}

/** CAREPLANS §P3 — staff choose the DAYS and how long the plan runs; the quantity
 *  follows from the days and the month's entitlement is their occurrences in it.
 *  `weeks` and `indefinite` are exclusive; passing neither leaves the duration alone. */
export async function setRecurringDays(
  purchaseItemId: string, days: string[],
  duration: { weeks: number } | { indefinite: true } | Record<string, never> = {},
): Promise<RecurringDaysResult> {
  const { data, error } = await supabase.rpc('set_recurring_days', {
    p_purchase_item_id: purchaseItemId,
    p_days: days,
    p_weeks: 'weeks' in duration ? duration.weeks : null,
    p_indefinite: 'indefinite' in duration ? true : null,
  });
  if (error) throw error;
  return data as RecurringDaysResult;
}

/** ── THE STANDING WEEKLY SLOT (D23 / BUYANDBOOK §4) ─────────────────────────
 *
 *  A `recurring` SKU is NOT a credit balance. It is a reserved weekly time that is
 *  theirs — chosen once, recurring until cancelled — and `weekly_frequency` is how
 *  many slots a week, not how many credits. A 2x Weekly buyer picks TWO days and a
 *  time for EACH.
 *
 *  ⚠️ THIS IS THE CLIENT'S FRONT DOOR ONTO THE INCUMBENT WRITER, NOT A SECOND ONE.
 *  The server RPC calls `set_recurring_days` (the same function staff's
 *  `CalendarItemPanel` calls) and then materialises the bookings through
 *  `_generate_plan_month`. There is one standing-slot writer and both surfaces
 *  reach it. */
export interface StandingSlotChoice {
  /** 'Mon' … 'Sun' */
  day: string;
  /** 24-hour 'HH:MM' */
  time: string;
}

export interface StandingScheduleResult {
  purchase_item_id: string;
  offering_name: string;
  weekly_frequency: number;
  slots: StandingSlotChoice[];
  /** `ok:false` with a `reason` means the days were recorded but no bookings were
   *  written — 'draft' (the order is still a basket) or 'needs_time'. */
  horizon: { ok: boolean; reason?: string; through?: string; months?: number; created?: number };
}

export async function setMyStandingSchedule(input: {
  purchaseItemId: string;
  slots: StandingSlotChoice[];
  durationMinutes?: number;
  horseId?: string | null;
}): Promise<StandingScheduleResult> {
  const { data, error } = await supabase.rpc('set_my_standing_schedule', {
    p_purchase_item_id: input.purchaseItemId,
    p_slots: input.slots,
    p_duration_minutes: input.durationMinutes ?? 60,
    p_horse_id: input.horseId ?? null,
  });
  if (error) throw error;
  return data as StandingScheduleResult;
}

export interface StandingSlot {
  purchase_id: string;
  purchase_item_id: string;
  /* ⚠️ TASK-FIX2 §2 — WHICH ORDER THIS PLAN IS. Madeline Do holds two live
     `2x Weekly Lessons` plans, one PAID and one not, and both rendered as the
     same sentence with no way to tell which the money is on. Staff-read only;
     `my_standing_slots` (the member's own read) is a different function and is
     unchanged. Optional because that member-side read fills the same type. */
  purchase_code?: string | null;
  purchase_status?: string | null;
  payment_status?: string | null;
  purchase_amount?: number | null;
  purchased_at?: string | null;
  offering_id: string;
  offering_name: string;
  segment: string;
  weekly_frequency: number | null;
  recurring_days: string[];
  recurring_times: Record<string, string>;
  duration_minutes: number;
  /** Day(s) AND time(s) are both set — i.e. the slot actually exists. */
  chosen: boolean;
  indefinite: boolean;
  plan_ends_on: string | null;
  horizon_through: string | null;
  booked_ahead: number;
}

/** The member's own weekly plans and what, if anything, they have chosen. */
export async function fetchMyStandingSlots(purchaseId?: string): Promise<StandingSlot[]> {
  const { data, error } = await supabase.rpc('my_standing_slots', {
    p_purchase_id: purchaseId ?? null,
  });
  if (error) throw error;
  return (data ?? []) as StandingSlot[];
}

/** SLOTREACH §2 — STAFF'S READ OF A CLIENT'S STANDING SLOT.
 *
 *  `my_standing_slots` is caller-scoped (`buyer_user_id = auth.uid()`), so staff had
 *  no way to SEE the weekly time of the client in front of them, let alone change it.
 *  This is the same shape, keyed on the contact, staff-gated in the database.
 *
 *  ⚠️ A READ ONLY. The write stays `setMyStandingSchedule` for both audiences —
 *  `set_my_standing_schedule` already authorises `has_staff_access() OR the plan's
 *  own client`, so staff reach the incumbent writer rather than a second one (D18).
 */
export async function fetchClientStandingSlots(contactId: string): Promise<StandingSlot[]> {
  const { data, error } = await supabase.rpc('client_standing_slots', {
    p_contact_id: contactId,
  });
  if (error) throw error;
  return (data ?? []) as StandingSlot[];
}

/** WHAT REPLACES THE SCHEDULER THAT DOES NOT EXIST.
 *
 *  `pg_cron` is not installed and the Vercel crons were never created, so nothing
 *  wakes up to open next month. A standing slot does not need one: the horizon is
 *  MATERIALISED ON READ. Calling this when a calendar loads rolls every one of the
 *  caller's plans forward to a 90-day window; it is idempotent and costs one index
 *  lookup per plan once the window is already covered. Returns how many sessions it
 *  had to create, so the caller only reloads when something actually changed. */
export async function ensureStandingSlots(clientId?: string): Promise<{ plans: number; created: number }> {
  const { data, error } = await supabase.rpc('ensure_standing_slots', {
    p_client_id: clientId ?? null,
  });
  if (error) throw error;
  return (data ?? { plans: 0, created: 0 }) as { plans: number; created: number };
}

/** Staff: produce this month's remaining weekly sessions on the calendar for
 *  a monthly-plan client (idempotent — re-running skips dates already booked). */
export async function generateMonthlyLessons(input: {
  clientId: string; purchaseItemId: string; startTime: string; durationMinutes?: number;
  horseId?: string | null; locationId?: string | null;
}): Promise<GeneratedMonth> {
  const { data, error } = await supabase.rpc('generate_monthly_lessons', {
    p_client_id: input.clientId, p_purchase_item_id: input.purchaseItemId,
    p_start_time: input.startTime, p_duration_minutes: input.durationMinutes ?? 60,
    p_horse_id: input.horseId ?? null, p_location_id: input.locationId ?? null,
  });
  if (error) throw error;
  return data as GeneratedMonth;
}

export interface GeneratedMonth {
  series_id: string;
  created: number;
  skipped_existing: number;
  /** CREDITALIGN: generating a session SPENDS one allotment credit, so the generator
   *  stops when the month's entitlement is used up rather than writing sessions
   *  nobody paid for. This is how many dates it had to leave alone. */
  skipped_no_entitlement: number;
  recurring_day: string;
  /** Every day the generator laid sessions down on. */
  recurring_days: string[];
  kind: 'lesson' | 'care';
}

/** Staff: stop a recurring plan. The month already bought is untouched — this only
 *  stops it rolling into the next one (D13: no migration to cancel a plan). */
export async function setRecurringPlanEnd(purchaseItemId: string, endsOn: string | null): Promise<void> {
  const { error } = await supabase.rpc('set_recurring_plan_end', {
    p_purchase_item_id: purchaseItemId, p_date: endsOn,
  });
  if (error) throw error;
}

// ─── The item swap (CREDITALIGN A2) ──────────────────────────────────────────

export interface BookingItemOption {
  credit_id: string;
  label: string;
  offering_id: string | null;
  purchase_id: string | null;
  segment: string | null;
  remaining: number;
  period_start: string | null;
  expires_at: string | null;
}

export interface BookingItemOptions {
  booking_id: string;
  kind: string | null;
  status: string;
  /** Whether THIS caller may swap right now (client: only while pending). */
  can_swap: boolean;
  /** Why not, in words the member can read. Null when can_swap is true. */
  reason: string | null;
  current: Omit<BookingItemOption, 'segment' | 'period_start'> | null;
  options: BookingItemOption[];
}

/** What this booking is charged against, and what it could be charged against
 *  instead. Staff and the booking's own client both read the same answer. */
export async function fetchBookingItemOptions(bookingId: string): Promise<BookingItemOptions> {
  const { data, error } = await supabase.rpc('booking_item_options', { p_booking_id: bookingId });
  if (error) throw error;
  return data as BookingItemOptions;
}

/** Re-charge a booking to a different purchased item: the old item gets its credit
 *  back, the new one is debited, in one transaction. Throws with a readable reason
 *  (NO_ENTITLEMENT / ITEM_EXPIRED / WRONG_SERVICE / NOT_PENDING) when refused. */
export async function swapBookingItem(
  bookingId: string, creditId: string,
): Promise<{ to_label: string; from_label: string | null; refunded: boolean; by: string }> {
  const { data, error } = await supabase.rpc('swap_booking_item', {
    p_booking_id: bookingId, p_credit_id: creditId,
  });
  if (error) throw error;
  return data as { to_label: string; from_label: string | null; refunded: boolean; by: string };
}
