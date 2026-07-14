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
