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

/** The business-hours frame for the current org (staff-editable in Slice 3). */
export async function fetchBusinessHours(): Promise<BusinessHour[]> {
  const { data, error } = await supabase.rpc('business_hours');
  if (error) throw error;
  return (data ?? []) as BusinessHour[];
}
