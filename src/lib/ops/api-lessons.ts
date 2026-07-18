/* Lane-5 data wrappers — Lessons module (mod.lessons).
 *
 * Thin, typed seams over supabase for the two mod.lessons tables
 * (supabase/migrations/20260630070000_mod_lessons.sql):
 *   lesson_packages — purchasable packs: (package_key, name, price_value_key,
 *                     credits, active). price_value_key is a config_value()
 *                     registry key (ns 'PRICING'), NEVER a literal price.
 *   lesson_credits  — per-client balances: (client_id → clients.id, package_key,
 *                     credits_total, credits_remaining, purchased_at).
 *
 * RLS is the authoritative fence (org boundary + has_module('mod.lessons') +
 * staff access); these wrappers stay thin and throw on error. NOTE: the schema
 * has NO bookings⇄credits linkage and no consume RPC — consumption is a staff
 * decrement of credits_remaining (optimistic-concurrency-guarded below).
 */
import { supabase } from '../supabase';
import { contactName } from './types';

// ─── Types (real columns of the mod.lessons tables) ─────────────────────────

export interface LessonPackage {
  id: string;
  org_id: string;
  package_key: string;
  name: string;
  /** config_value() registry key (e.g. PRICING/PKG_10_PRICE) — never a literal. */
  price_value_key: string | null;
  credits: number;
  active: boolean;
  created_at: string;
  updated_at: string;
}

export interface LessonPackageInput {
  package_key: string;
  name: string;
  price_value_key?: string | null;
  credits?: number;
}

export interface LessonCredit {
  id: string;
  org_id: string;
  client_id: string;
  package_key: string | null;
  credits_total: number;
  credits_remaining: number;
  purchased_at: string;
  created_at: string;
  updated_at: string;
}

export interface LessonCreditInput {
  client_id: string;
  package_key?: string | null;
  credits_total: number;
  /** Defaults to credits_total (a fresh grant starts unspent). */
  credits_remaining?: number;
}

/** A client option for the grant form / ledger display: the clients row with
 *  its contact's name flattened (clients.contact_id → contacts). */
export interface LessonClientOption {
  id: string;
  display_code: string | null;
  name: string;
  email: string | null;
}

/** Hub KPIs computed from the two module tables. */
export interface LessonsSummary {
  activePackages: number;
  creditsOutstanding: number;
  clientsWithCredits: number;
}

// ─── lesson_sessions (20260703120000) ────────────────────────────────────────

export type LessonSessionStatus = 'SCHEDULED' | 'COMPLETED' | 'CANCELLED' | 'NO_SHOW';

export interface LessonSession {
  id: string;
  org_id: string;
  client_id: string;
  /** Always null on the spine (lessons no longer hang off engagements). */
  engagement_id: string | null;
  request_id: string | null;
  starts_at: string;
  ends_at: string;
  status: LessonSessionStatus;
  location: string | null;
  notes: string | null;
  credit_id: string | null;
  /** The horse this lesson concerns — internal tracking; never shown to clients
   *  on a barn-horse lesson. */
  horse_id: string | null;
  created_at: string;
}

/** A lesson booking row (bookings.kind='lesson') mapped to the LessonSession
 *  shape the UI already speaks — status surfaced UPPER, engagement_id null. */
type LessonBookingRow = {
  id: string;
  org_id: string;
  client_id: string | null;
  request_id: string | null;
  starts_at: string | null;
  ends_at: string | null;
  status: string;
  location: string | null;
  notes: string | null;
  credit_id: string | null;
  horse_id: string | null;
  created_at: string;
};
function lessonSessionFromBooking(r: LessonBookingRow): LessonSession {
  return {
    id: r.id,
    org_id: r.org_id,
    client_id: r.client_id ?? '',
    engagement_id: null,
    request_id: r.request_id,
    starts_at: r.starts_at ?? '',
    ends_at: r.ends_at ?? '',
    status: r.status.toUpperCase() as LessonSessionStatus,
    location: r.location,
    notes: r.notes,
    credit_id: r.credit_id,
    horse_id: r.horse_id,
    created_at: r.created_at,
  };
}
const LESSON_BOOKING_COLS =
  'id, org_id, client_id, request_id, starts_at, ends_at, status, location, notes, credit_id, horse_id, created_at';

export interface ScheduleSessionInput {
  client_id: string;
  /** ISO timestamps. */
  starts_at: string;
  ends_at: string;
  engagement_id?: string | null;
  request_id?: string | null;
  location?: string | null;
  notes?: string | null;
  /** The horse the lesson uses (barn horse or the rider's own). Optional at
   *  booking time — staff can attach/correct it later via setBookingHorse. */
  horse_id?: string | null;
}

/** schedule_lesson_session RPC result (the freshly booked session). */
export interface ScheduledSessionResult {
  session_id: string;
  client_id: string;
  starts_at: string;
  ends_at: string;
  status: LessonSessionStatus;
  location: string | null;
  horse_id: string | null;
  engagement_id: string | null;
  request_id: string | null;
}

/** complete_lesson_session RPC result — the debit outcome the UI reports. */
export interface CompleteSessionResult {
  session_id: string;
  status: 'COMPLETED';
  debited: boolean;
  credit_id: string | null;
  /** Live sum across the client's ledger after the debit; null when no debit was attempted. */
  credits_remaining: number | null;
}

// ─── lesson_packages ─────────────────────────────────────────────────────────

/** All in-tenant lesson packages (RLS: org + module gate), soft-deleted excluded. */
export async function listLessonPackages(): Promise<LessonPackage[]> {
  const { data, error } = await supabase
    .from('lesson_packages')
    .select('*')
    .is('deleted_at', null)
    .order('name');
  if (error) throw error;
  return (data ?? []) as LessonPackage[];
}

export async function createLessonPackage(input: LessonPackageInput): Promise<LessonPackage> {
  const { data, error } = await supabase
    .from('lesson_packages')
    .insert({
      package_key: input.package_key,
      name: input.name,
      price_value_key: input.price_value_key ?? null,
      credits: input.credits ?? 0,
    })
    .select('*')
    .single();
  if (error) throw error;
  return data as LessonPackage;
}

export async function updateLessonPackage(
  id: string,
  patch: Partial<LessonPackageInput> & { active?: boolean },
): Promise<LessonPackage> {
  const { data, error } = await supabase
    .from('lesson_packages')
    .update(patch)
    .eq('id', id)
    .select('*')
    .single();
  if (error) throw error;
  return data as LessonPackage;
}

/** Resolve a package's price THROUGH the registry (config_value on
 *  price_value_key, ns 'PRICING') — the one pricing seam; never a literal. */
export async function lessonPackagePrice(priceValueKey: string): Promise<number | null> {
  const { data, error } = await supabase.rpc('config_value', {
    p_ns: 'PRICING',
    p_key: priceValueKey,
  });
  if (error) throw error;
  const num = data === null || data === undefined ? NaN : Number(data);
  return Number.isFinite(num) ? num : null;
}

// ─── lesson_credits ──────────────────────────────────────────────────────────

/** The credits ledger (newest purchase first), optionally scoped to one client. */
export async function listLessonCredits(clientId?: string): Promise<LessonCredit[]> {
  let query = supabase.from('lesson_credits').select('*').is('deleted_at', null);
  if (clientId) query = query.eq('client_id', clientId);
  const { data, error } = await query.order('purchased_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as LessonCredit[];
}

/** Grant credits (a package purchase landing on the ledger). */
export async function createLessonCredit(input: LessonCreditInput): Promise<LessonCredit> {
  const { data, error } = await supabase
    .from('lesson_credits')
    .insert({
      client_id: input.client_id,
      package_key: input.package_key ?? null,
      credits_total: input.credits_total,
      credits_remaining: input.credits_remaining ?? input.credits_total,
    })
    .select('*')
    .single();
  if (error) throw error;
  return data as LessonCredit;
}

/** Consume `count` credits from a ledger row (a lesson taught). Read-modify-write
 *  with an optimistic guard on the previous remaining value, so two concurrent
 *  consumes cannot double-spend the same credit. The schema has no bookings
 *  linkage/consume RPC — this staff decrement IS the real consumption path. */
export async function consumeLessonCredit(id: string, count = 1): Promise<LessonCredit> {
  const { data: row, error: readError } = await supabase
    .from('lesson_credits')
    .select('*')
    .eq('id', id)
    .single();
  if (readError) throw readError;
  const current = (row as LessonCredit).credits_remaining;
  if (current < count) throw new Error('No credits remaining on this grant.');

  const { data, error } = await supabase
    .from('lesson_credits')
    .update({ credits_remaining: current - count })
    .eq('id', id)
    .eq('credits_remaining', current) // optimistic guard: fail (0 rows) on a race
    .select('*')
    .single();
  if (error) throw error;
  return data as LessonCredit;
}

// ─── lesson_sessions — the confirmed-booking spine ───────────────────────────

/** The sessions board (staff RLS), soonest first. Lessons live on the spine
 *  bookings table now (kind='lesson'); mapped to the LessonSession shape. */
export async function listLessonSessions(): Promise<LessonSession[]> {
  const { data, error } = await supabase
    .from('bookings')
    .select(LESSON_BOOKING_COLS)
    .eq('kind', 'lesson')
    .order('starts_at', { ascending: true });
  if (error) throw error;
  return ((data ?? []) as unknown as LessonBookingRow[]).map(lessonSessionFromBooking);
}

/** Sessions booked from one booking request (the IntakePage drawer inline list). */
export async function listLessonSessionsForRequest(requestId: string): Promise<LessonSession[]> {
  const { data, error } = await supabase
    .from('bookings')
    .select(LESSON_BOOKING_COLS)
    .eq('kind', 'lesson')
    .eq('request_id', requestId)
    .order('starts_at', { ascending: true });
  if (error) throw error;
  return ((data ?? []) as unknown as LessonBookingRow[]).map(lessonSessionFromBooking);
}

/** Book a confirmed lesson (staff-gated RPC; overlaps rejected server-side). */
export async function scheduleLessonSession(
  input: ScheduleSessionInput,
): Promise<ScheduledSessionResult> {
  const { data, error } = await supabase.rpc('schedule_lesson_session', {
    p_client_id: input.client_id,
    p_starts_at: input.starts_at,
    p_ends_at: input.ends_at,
    p_engagement_id: input.engagement_id ?? null,
    p_request_id: input.request_id ?? null,
    p_location: input.location ?? null,
    p_notes: input.notes ?? null,
    p_horse_id: input.horse_id ?? null,
  });
  if (error) throw error;
  return data as ScheduledSessionResult;
}

/** Attach or correct the horse on a lesson booking (staff-gated). Passing null
 *  clears it. This is the mechanism the "wrong-lesson-type" fix rides on. */
export async function setBookingHorse(bookingId: string, horseId: string | null): Promise<void> {
  const { error } = await supabase.rpc('set_booking_horse', {
    p_booking_id: bookingId,
    p_horse_id: horseId,
  });
  if (error) throw error;
}

// ─── Lesson log + report (Phase 4) ───────────────────────────────────────────

/** One authored, uneditable note on a booking (pre-lesson or post). */
export interface BookingNote {
  id?: string;
  author_role: 'rider' | 'instructor' | 'staff' | 'admin';
  author_name: string | null;
  phase: 'pre' | 'post';
  body: string;
  created_at?: string;
}

/** The assembled report for one booking: the LOG (checked activities + raw
 *  text), the rider-visible REPORT text, and the authored notes thread. */
export interface BookingReport {
  booking_id: string;
  kind: string;
  starts_at: string | null;
  ends_at: string | null;
  status: string;
  location: string | null;
  horse_id: string | null;
  service_type: string | null;
  /** The configurable activity checklist for this booking's category. */
  checklist: string[];
  activity_log: { activities: string[]; text: string | null } | null;
  report: string | null;
  notes: BookingNote[];
}

/** The active activity checklist for a service category (e.g. RIDING_LESSON). */
export async function activityChecklist(serviceType: string): Promise<string[]> {
  const { data, error } = await supabase.rpc('activity_checklist', { p_service_type: serviceType });
  if (error) throw error;
  return (data ?? []) as string[];
}

/** Write the LOG on a booking: the checked activities + the raw log text. */
export async function setBookingLog(
  bookingId: string,
  activities: string[],
  text: string | null,
): Promise<void> {
  const { error } = await supabase.rpc('set_booking_log', {
    p_booking_id: bookingId,
    p_activities: activities,
    p_text: text,
  });
  if (error) throw error;
}

/** Add an authored (uneditable) note to a booking — pre-lesson or post. */
export async function addBookingNote(
  bookingId: string,
  phase: 'pre' | 'post',
  body: string,
): Promise<BookingNote> {
  const { data, error } = await supabase.rpc('add_booking_note', {
    p_booking_id: bookingId,
    p_phase: phase,
    p_body: body,
  });
  if (error) throw error;
  return data as BookingNote;
}

/** The assembled report for one booking (staff in-org or the booking's client). */
export async function getBookingReport(bookingId: string): Promise<BookingReport> {
  const { data, error } = await supabase.rpc('booking_report', { p_booking_id: bookingId });
  if (error) throw error;
  return data as BookingReport;
}

/** Mark a lesson taught; by default debits the oldest credit row with balance. */
export async function completeLessonSession(
  sessionId: string,
  debitCredit = true,
): Promise<CompleteSessionResult> {
  const { data, error } = await supabase.rpc('complete_lesson_session', {
    p_session_id: sessionId,
    p_debit_credit: debitCredit,
  });
  if (error) throw error;
  return data as CompleteSessionResult;
}

/** Compose the RPC's timestamptz window from the scheduling form's local
 *  date ('2026-07-10') + start time ('14:00') + duration (minutes). */
export function sessionWindow(
  date: string,
  startTime: string,
  durationMinutes: number,
): { starts_at: string; ends_at: string } {
  const start = new Date(`${date}T${startTime}`);
  const end = new Date(start.getTime() + durationMinutes * 60_000);
  return { starts_at: start.toISOString(), ends_at: end.toISOString() };
}

/** Write/update the rider-visible progress note on one session (Slice 5). Any
 *  operator (trainer or admin) may do this — the servicing subset. Passing an
 *  empty string clears the note. */
export async function setLessonProgressNote(sessionId: string, note: string): Promise<void> {
  const { error } = await supabase.rpc('set_lesson_progress_note', {
    p_session_id: sessionId,
    p_note: note,
  });
  if (error) throw error;
}

/** Cancel a SCHEDULED lesson (member notified) or record a no-show. */
export async function cancelLessonSession(
  sessionId: string,
  noShow = false,
): Promise<{ session_id: string; status: LessonSessionStatus }> {
  const { data, error } = await supabase.rpc('cancel_lesson_session', {
    p_session_id: sessionId,
    p_no_show: noShow,
  });
  if (error) throw error;
  return data as { session_id: string; status: LessonSessionStatus };
}

// ─── Clients (for the grant form / ledger names) ─────────────────────────────

/** In-tenant clients with their contact name flattened (clients.contact_id →
 *  contacts), for the grant-credits picker and ledger display. */
export async function listLessonClients(): Promise<LessonClientOption[]> {
  const { data, error } = await supabase
    .from('clients')
    .select('id, display_code, contact:contacts(first_name, last_name, email)')
    .is('deleted_at', null)
    .order('created_at', { ascending: false });
  if (error) throw error;
  type Row = {
    id: string;
    display_code: string | null;
    contact: { first_name: string | null; last_name: string | null; email: string | null } | null;
  };
  return ((data ?? []) as unknown as Row[]).map((r) => ({
    id: r.id,
    display_code: r.display_code,
    name: contactName(r.contact) || (r.display_code ?? r.id.slice(0, 8)),
    email: r.contact?.email ?? null,
  }));
}

// ─── Horses (for the internal booking picker) ────────────────────────────────

/** A horse option for the scheduling form's internal horse picker. */
export interface ScheduleHorseOption {
  id: string;
  name: string;
}

/** In-tenant horse roster (RLS: org boundary), for the lesson-booking horse
 *  picker — barn horses and clients' own horses alike. Label prefers the barn
 *  name, then the registered name, then the display code. */
export async function listScheduleHorses(): Promise<ScheduleHorseOption[]> {
  const { data, error } = await supabase
    .from('horses')
    .select('id, nickname, registered_name, display_code')
    .is('deleted_at', null)
    .order('nickname', { nullsFirst: false });
  if (error) throw error;
  type Row = {
    id: string;
    nickname: string | null;
    registered_name: string | null;
    display_code: string | null;
  };
  return ((data ?? []) as Row[]).map((h) => ({
    id: h.id,
    name: h.nickname || h.registered_name || h.display_code || h.id.slice(0, 8),
  }));
}

// ─── Hub summary ─────────────────────────────────────────────────────────────

/** Credits-outstanding KPI + package/client counts for the Lessons hub. */
export async function lessonsSummary(): Promise<LessonsSummary> {
  const [pkgRes, creditRes] = await Promise.all([
    supabase.from('lesson_packages').select('id, active').is('deleted_at', null),
    supabase.from('lesson_credits').select('client_id, credits_remaining').is('deleted_at', null),
  ]);
  if (pkgRes.error) throw pkgRes.error;
  if (creditRes.error) throw creditRes.error;

  const packages = (pkgRes.data ?? []) as { id: string; active: boolean }[];
  const credits = (creditRes.data ?? []) as { client_id: string; credits_remaining: number }[];
  return {
    activePackages: packages.filter((p) => p.active).length,
    creditsOutstanding: credits.reduce((sum, c) => sum + (Number(c.credits_remaining) || 0), 0),
    clientsWithCredits: new Set(credits.filter((c) => c.credits_remaining > 0).map((c) => c.client_id)).size,
  };
}
