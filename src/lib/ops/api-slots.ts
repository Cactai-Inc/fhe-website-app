/**
 * INT-API-SLOTS — admin data wrappers for `availability_slots` (the bookable
 * calendar the public booking step consumes via fetchOpenSlots/hold_slot).
 *
 * Table (supabase/migrations/20260623010000_platform_data_model.sql):
 *   availability_slots(id, start_at, end_at, slot_type, capacity,
 *                      location_mode, status, created_by, created_at, org_id)
 *   CHECKs: slot_type IN ('consultation','onsite_visit','lesson','training','other')
 *           location_mode IN ('onsite','mobile')
 *           status IN ('open','held','booked','blocked')
 *
 * RLS: `slots_admin_write` (FOR ALL TO authenticated, is_admin()) already grants
 * staff INSERT/UPDATE/DELETE; the org retrofit (…30030000) stamps org_id
 * DEFAULT current_org() + a restrictive org boundary. No client widening needed.
 *
 * `held`/`booked` are lifecycle states owned by the hold/confirm RPCs
 * (hold_slot / confirm_booking_for_purchase / release_expired_holds) — these
 * wrappers only ever move a slot between the admin states `open` ⇄ `blocked`,
 * and refuse to delete a slot a bookings row still references.
 */
import { supabase } from '../supabase';

// ─── Row shapes (mirror the migration; the booking join is the embed) ────────

export type SlotType = 'consultation' | 'onsite_visit' | 'lesson' | 'training' | 'other';
export type LocationMode = 'onsite' | 'mobile';
export type SlotStatus = 'open' | 'held' | 'booked' | 'blocked';

export const SLOT_TYPES: SlotType[] = ['consultation', 'onsite_visit', 'lesson', 'training', 'other'];
export const LOCATION_MODES: LocationMode[] = ['onsite', 'mobile'];

export interface SlotBooking {
  id: string;
  order_id: string;
  user_id: string;
  status: string;
}

export interface AvailabilitySlot {
  id: string;
  start_at: string;
  end_at: string;
  slot_type: SlotType;
  capacity: number;
  location_mode: LocationMode;
  status: SlotStatus;
  created_by: string | null;
  created_at: string;
  /** bookings rows pointing at this slot (reverse FK embed). */
  bookings?: SlotBooking[];
}

export interface SlotInput {
  start_at: string;
  end_at: string;
  slot_type: SlotType;
  location_mode: LocationMode;
  capacity?: number;
}

export interface RecurringSlotsInput {
  /** Local weekdays to generate on: 0=Sunday … 6=Saturday (Date#getDay). */
  weekdays: number[];
  /** Local wall-clock times, 'HH:MM' (e.g. '16:00' – '17:00'). */
  startTime: string;
  endTime: string;
  /** Inclusive local date range, 'YYYY-MM-DD'. */
  fromDate: string;
  toDate: string;
  slot_type: SlotType;
  location_mode: LocationMode;
  capacity?: number;
}

// The booking columns are aliased (order_id←purchase_id, user_id←account_user_id)
// so the read model keeps its shape after the bookings_v2 → bookings rename.
const SLOT_SELECT = '*, bookings(id, order_id:purchase_id, user_id:account_user_id, status)';

// ─── Reads ────────────────────────────────────────────────────────────────────

/** Slots starting in [startISO, endISO) — one week for the availability grid. */
export async function listSlots(startISO: string, endISO: string): Promise<AvailabilitySlot[]> {
  const { data, error } = await supabase
    .from('availability_slots')
    .select(SLOT_SELECT)
    .gte('start_at', startISO)
    .lt('start_at', endISO)
    .order('start_at');
  if (error) throw error;
  return (data ?? []) as AvailabilitySlot[];
}

// ─── Writes ───────────────────────────────────────────────────────────────────

export async function createSlot(input: SlotInput): Promise<AvailabilitySlot> {
  const { data, error } = await supabase
    .from('availability_slots')
    .insert({
      start_at: input.start_at,
      end_at: input.end_at,
      slot_type: input.slot_type,
      location_mode: input.location_mode,
      capacity: input.capacity ?? 1,
      status: 'open',
    })
    .select(SLOT_SELECT)
    .single();
  if (error) throw error;
  return data as AvailabilitySlot;
}

/**
 * Expand a weekday × time × date-range recurrence into concrete slot rows
 * (LOCAL wall-clock times → ISO instants). Pure + exported so the page test
 * proves the exact row count/dates the modal generates.
 */
export function generateRecurringSlotRows(
  input: RecurringSlotsInput,
): Array<Pick<AvailabilitySlot, 'start_at' | 'end_at' | 'slot_type' | 'location_mode' | 'capacity'> & { status: 'open' }> {
  const rows: Array<Pick<AvailabilitySlot, 'start_at' | 'end_at' | 'slot_type' | 'location_mode' | 'capacity'> & { status: 'open' }> = [];
  const from = new Date(`${input.fromDate}T00:00:00`);
  const to = new Date(`${input.toDate}T00:00:00`);
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) return rows;
  const wanted = new Set(input.weekdays);
  for (let d = new Date(from); d.getTime() <= to.getTime(); d.setDate(d.getDate() + 1)) {
    if (!wanted.has(d.getDay())) continue;
    const day = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const start = new Date(`${day}T${input.startTime}`);
    const end = new Date(`${day}T${input.endTime}`);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) continue;
    rows.push({
      start_at: start.toISOString(),
      end_at: end.toISOString(),
      slot_type: input.slot_type,
      location_mode: input.location_mode,
      capacity: input.capacity ?? 1,
      status: 'open',
    });
  }
  return rows;
}

/** Generate the recurrence client-side and bulk-insert it. Returns the rows created. */
export async function createRecurringSlots(input: RecurringSlotsInput): Promise<AvailabilitySlot[]> {
  const rows = generateRecurringSlotRows(input);
  if (rows.length === 0) {
    throw new Error('The recurrence produced no slots — check the weekdays, times, and date range.');
  }
  const { data, error } = await supabase
    .from('availability_slots')
    .insert(rows)
    .select(SLOT_SELECT);
  if (error) throw error;
  return (data ?? []) as AvailabilitySlot[];
}

/**
 * Admin block/reopen. Only `open` ⇄ `blocked` — a `held`/`booked` slot belongs
 * to the booking lifecycle RPCs and is refused with a clear error.
 */
export async function updateSlotStatus(id: string, status: 'open' | 'blocked'): Promise<AvailabilitySlot> {
  const { data, error } = await supabase
    .from('availability_slots')
    .update({ status })
    .eq('id', id)
    .in('status', ['open', 'blocked'])
    .select(SLOT_SELECT)
    .maybeSingle();
  if (error) throw error;
  if (!data) {
    throw new Error('Slot is held or booked — release/cancel the booking first.');
  }
  return data as AvailabilitySlot;
}

/**
 * Delete a slot, but only when NO bookings row references it (held, booked,
 * or even a cancelled booking's history). Surfaces a clear error otherwise —
 * block the slot instead if you just want it off the calendar.
 */
export async function deleteSlot(id: string): Promise<void> {
  const { count, error: countError } = await supabase
    .from('bookings')
    .select('id', { count: 'exact', head: true })
    .eq('slot_id', id);
  if (countError) throw countError;
  if ((count ?? 0) > 0) {
    throw new Error('This slot is referenced by a booking and cannot be deleted. Block it instead.');
  }
  const { error } = await supabase.from('availability_slots').delete().eq('id', id);
  if (error) throw error;
}
