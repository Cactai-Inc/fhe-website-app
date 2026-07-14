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
  status:
    | 'draft'
    | 'available'
    | 'unavailable'
    | 'pending'
    | 'pending_slot'
    | 'pending_payment'
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
}

export async function fetchLocations(): Promise<CalendarLocation[]> {
  const { data, error } = await supabase
    .from('locations')
    .select('id, name, address, is_offsite, is_default, sort_order')
    .eq('active', true)
    .order('sort_order');
  if (error) throw error;
  return (data ?? []) as CalendarLocation[];
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
  location_id?: string | null;
  address?: string | null;
  travel_before_minutes?: number;
  travel_after_minutes?: number;
  price_amount?: number | null;
  notes?: string | null;
  recurrence_weeks?: number;
  /** Series edit/delete reach: 'one' | 'future' | 'all'. */
  scope?: 'one' | 'future' | 'all';
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

export interface CalendarRevenue {
  total: number;
  count: number;
}
export async function fetchRevenue(fromISO: string, toISO: string): Promise<CalendarRevenue> {
  const { data, error } = await supabase.rpc('calendar_revenue', { p_from: fromISO, p_to: toISO });
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
 *  needs a credit the client doesn't have (the UI then prompts to purchase). */
export async function bookOpenSlot(bookingId: string, horseId?: string | null): Promise<{ status: string; kind: string }> {
  const { data, error } = await supabase.rpc('book_open_slot', { p_booking_id: bookingId, p_horse_id: horseId ?? null });
  if (error) throw error;
  return data as { status: string; kind: string };
}

export type ChangeKind = 'reschedule' | 'cancel' | 'defer';

export interface ChangeResult {
  change_id: string;
  fee_amount: number | null;
  phone_required: boolean;
  kind: ChangeKind;
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
}): Promise<ChangeResult> {
  const { data, error } = await supabase.rpc('request_booking_change', {
    p_booking_id: input.bookingId,
    p_kind: input.kind,
    p_new_start: input.newStart ?? null,
    p_new_end: input.newEnd ?? null,
    p_scope: input.scope ?? 'one',
    p_note: input.note ?? null,
  });
  if (error) throw error;
  return data as ChangeResult;
}

export interface OpenChangeRequest {
  id: string;
  booking_id: string;
  kind: ChangeKind;
  proposed_starts_at: string | null;
  proposed_ends_at: string | null;
  fee_amount: number | null;
  fee_paid: boolean;
  phone_required: boolean;
  note: string | null;
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
  kind: ChangeKind;
  status: string;
  proposed_starts_at: string | null;
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

export async function decideBookingChange(changeId: string, approve: boolean, waiveFee = false): Promise<void> {
  const { error } = await supabase.rpc('decide_booking_change', { p_change_id: changeId, p_approve: approve, p_waive_fee: waiveFee });
  if (error) throw error;
}

export async function markChangeFeePaid(changeId: string, paid = true): Promise<void> {
  const { error } = await supabase.rpc('mark_change_fee_paid', { p_change_id: changeId, p_paid: paid });
  if (error) throw error;
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

/** Staff confirm a pending booking (a requested time). */
export async function confirmBooking(bookingId: string): Promise<void> {
  const { error } = await supabase.rpc('confirm_booking', { p_booking_id: bookingId });
  if (error) throw error;
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
