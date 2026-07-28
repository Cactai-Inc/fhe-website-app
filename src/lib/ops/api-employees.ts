/**
 * INT-API-EMPLOYEES — data wrappers for mod.employees (U12).
 *
 * Tables: profiles (employment columns title / pay_type / staff_active,
 * merged from the old staff table in Stage 1j) / shifts / time_entries.
 *
 * Shifts are scheduled work windows keyed by staff_user_id (the profile);
 * time_entries are clock in/out rows (a shift's entries are tied back via the
 * generic source_kind='shift' + source_id columns). The staff member's CRM
 * contact link is profiles.contact_id — the identity bridge owned by the
 * account spine, shown read-only here and never edited from this module.
 *
 * RLS enforces org boundary + module gate (mod.employees) + access (admin
 * RCUD, employee reads own rows) server-side; these wrappers only shape calls.
 */
import { supabase } from '../supabase';

// ─── Row shapes (mirror the migration; joins are the embedded selects) ───────

export interface ProfileOption {
  user_id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
}

export interface ContactOption {
  id: string;
  first_name: string | null;
  last_name: string | null;
}

/** A staff member = a profiles row with employment columns (Stage 1j). The
 *  legacy `id`/`profile_user_id` fields both carry user_id so the pages keep
 *  their row-key/edit plumbing unchanged. */
export interface StaffProfile {
  id: string;               // = user_id
  profile_user_id: string;  // = user_id
  contact_id: string | null;
  title: string | null;
  pay_type: string | null;
  active: boolean;          // = staff_active
  /** Identity fields off the same profiles row. */
  profile?: ProfileOption | null;
  /** The identity-bridge contact (read-only in this module). */
  contact?: ContactOption | null;
}

export interface StaffProfileInput {
  profile_user_id: string;
  title?: string | null;
  pay_type?: string | null;
  active?: boolean;
}

export interface Shift {
  id: string;
  org_id: string;
  staff_user_id: string;
  starts_at: string;
  ends_at: string | null;
  role: string | null;
  created_at: string;
  updated_at: string;
  /** Joined owning staff profile (identity + title on one row). */
  staff?: {
    user_id: string;
    title: string | null;
    first_name: string | null;
    last_name: string | null;
  } | null;
}

export interface ShiftInput {
  staff_user_id: string;
  starts_at: string;
  ends_at?: string | null;
  role?: string | null;
}

export interface TimeEntry {
  id: string;
  org_id: string;
  staff_user_id: string;
  clock_in: string;
  clock_out: string | null;
  minutes: number | null;
  source_kind: string | null;
  source_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface TimeEntryInput {
  staff_user_id: string;
  clock_in: string;
  clock_out?: string | null;
  minutes?: number | null;
  /** The shift this entry clocks against (stored as source_kind='shift'). */
  shift_id: string;
}

export interface EmployeesKpis {
  /** Profiles with staff_active = true. */
  activeStaff: number;
  /** Shifts starting inside the current Monday-anchored week. */
  shiftsThisWeek: number;
}

const STAFF_SELECT =
  'user_id, contact_id, title, pay_type, staff_active, first_name, last_name, email, contact:contacts(id, first_name, last_name)';

const SHIFT_SELECT =
  '*, staff:profiles!shifts_staff_user_id_fkey(user_id, title, first_name, last_name)';

interface StaffRow {
  user_id: string;
  contact_id: string | null;
  title: string | null;
  pay_type: string | null;
  staff_active: boolean;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  contact?: ContactOption | null;
}

function toStaffProfile(r: StaffRow): StaffProfile {
  return {
    id: r.user_id,
    profile_user_id: r.user_id,
    contact_id: r.contact_id,
    title: r.title,
    pay_type: r.pay_type,
    active: r.staff_active,
    profile: { user_id: r.user_id, first_name: r.first_name, last_name: r.last_name, email: r.email },
    contact: r.contact ?? null,
  };
}

// ─── Week helper (shared by SchedulePage + the hub KPIs + their tests) ────────

/**
 * Monday-anchored local week containing `anchor`, as [start, end) instants.
 * Pure + exported so the page and its test compute the SAME query bounds.
 */
export function weekRange(anchor: Date): { start: Date; end: Date; startISO: string; endISO: string } {
  const start = new Date(anchor);
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - ((start.getDay() + 6) % 7));
  const end = new Date(start);
  end.setDate(end.getDate() + 7);
  return { start, end, startISO: start.toISOString(), endISO: end.toISOString() };
}

// ─── Pickers (option lists for the forms) ────────────────────────────────────

/** Profiles the caller may see (admin: all) — the staff-link picker. */
export async function listProfileOptions(): Promise<ProfileOption[]> {
  const { data, error } = await supabase
    .from('profiles')
    .select('user_id, first_name, last_name, email')
    .order('last_name');
  if (error) throw error;
  return (data ?? []) as ProfileOption[];
}

export async function listContactOptions(): Promise<ContactOption[]> {
  const { data, error } = await supabase
    .from('contacts')
    .select('id, first_name, last_name')
    .is('deleted_at', null)
    .order('first_name')
    .order('last_name');
  if (error) throw error;
  return (data ?? []) as ContactOption[];
}

// ─── Staff profiles ──────────────────────────────────────────────────────────

export async function listStaffProfiles(): Promise<StaffProfile[]> {
  // Staff = profiles marked staff_active (plus deactivated rows that still
  // carry employment data, mirroring the old inactive-but-visible rows).
  const { data, error } = await supabase
    .from('profiles')
    .select(STAFF_SELECT)
    .or('staff_active.eq.true,title.not.is.null,pay_type.not.is.null')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return ((data ?? []) as unknown as StaffRow[]).map(toStaffProfile);
}

/** "Create" = stamp employment fields onto the chosen profile (Stage 1j). */
export async function createStaffProfile(input: StaffProfileInput): Promise<void> {
  const { error } = await supabase
    .from('profiles')
    .update({
      title: input.title ?? null,
      pay_type: input.pay_type ?? null,
      staff_active: input.active ?? true,
    })
    .eq('user_id', input.profile_user_id);
  if (error) throw error;
}

export async function updateStaffProfile(
  id: string,
  input: StaffProfileInput,
): Promise<void> {
  const { error } = await supabase
    .from('profiles')
    .update({
      title: input.title ?? null,
      pay_type: input.pay_type ?? null,
      staff_active: input.active ?? true,
    })
    .eq('user_id', id);
  if (error) throw error;
}

// ─── Shifts ──────────────────────────────────────────────────────────────────

/** Shifts starting in [startISO, endISO) — one week for the schedule grid. */
export async function listShifts(startISO: string, endISO: string): Promise<Shift[]> {
  const { data, error } = await supabase
    .from('shifts')
    .select(SHIFT_SELECT)
    .is('deleted_at', null)
    .gte('starts_at', startISO)
    .lt('starts_at', endISO)
    .order('starts_at');
  if (error) throw error;
  return (data ?? []) as Shift[];
}

export async function createShift(input: ShiftInput): Promise<Shift> {
  const { data, error } = await supabase
    .from('shifts')
    .insert({
      staff_user_id: input.staff_user_id,
      starts_at: input.starts_at,
      ends_at: input.ends_at ?? null,
      role: input.role ?? null,
    })
    .select(SHIFT_SELECT)
    .single();
  if (error) throw error;
  return data as Shift;
}

export async function updateShift(id: string, input: ShiftInput): Promise<Shift> {
  const { data, error } = await supabase
    .from('shifts')
    .update({
      staff_user_id: input.staff_user_id,
      starts_at: input.starts_at,
      ends_at: input.ends_at ?? null,
      role: input.role ?? null,
    })
    .eq('id', id)
    .select(SHIFT_SELECT)
    .single();
  if (error) throw error;
  return data as Shift;
}

// ─── Time entries (per shift: source_kind='shift', source_id=<shift id>) ─────

export async function listTimeEntriesForShift(shiftId: string): Promise<TimeEntry[]> {
  const { data, error } = await supabase
    .from('time_entries')
    .select('*')
    .is('deleted_at', null)
    .eq('source_kind', 'shift')
    .eq('source_id', shiftId)
    .order('clock_in');
  if (error) throw error;
  return (data ?? []) as TimeEntry[];
}

export async function createTimeEntry(input: TimeEntryInput): Promise<TimeEntry> {
  // Derive minutes from the clock window when the caller did not supply them.
  let minutes = input.minutes ?? null;
  if (minutes === null && input.clock_out) {
    const ms = new Date(input.clock_out).getTime() - new Date(input.clock_in).getTime();
    if (Number.isFinite(ms) && ms >= 0) minutes = Math.round(ms / 60000);
  }
  const { data, error } = await supabase
    .from('time_entries')
    .insert({
      staff_user_id: input.staff_user_id,
      clock_in: input.clock_in,
      clock_out: input.clock_out ?? null,
      minutes,
      source_kind: 'shift',
      source_id: input.shift_id,
    })
    .select('*')
    .single();
  if (error) throw error;
  return data as TimeEntry;
}

// ─── Hub KPIs ────────────────────────────────────────────────────────────────

export async function getEmployeesKpis(): Promise<EmployeesKpis> {
  const { startISO, endISO } = weekRange(new Date());
  const [staffRes, shiftsRes] = await Promise.all([
    supabase
      .from('profiles')
      .select('user_id')
      .eq('staff_active', true),
    supabase
      .from('shifts')
      .select('id')
      .is('deleted_at', null)
      .gte('starts_at', startISO)
      .lt('starts_at', endISO),
  ]);
  if (staffRes.error) throw staffRes.error;
  if (shiftsRes.error) throw shiftsRes.error;

  return {
    activeStaff: (staffRes.data ?? []).length,
    shiftsThisWeek: (shiftsRes.data ?? []).length,
  };
}

// ─── Display helpers ─────────────────────────────────────────────────────────

/** "First Last" (falling back to email / a short id) for a joined profile. */
export function staffDisplayName(
  profile?: (Pick<ProfileOption, 'first_name' | 'last_name'> & { email?: string | null }) | null,
  fallback = 'Unknown staff',
): string {
  if (!profile) return fallback;
  const name = [profile.first_name, profile.last_name].filter(Boolean).join(' ').trim();
  return name || profile.email || fallback;
}
