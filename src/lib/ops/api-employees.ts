/**
 * INT-API-EMPLOYEES — data wrappers for mod.employees (U12).
 *
 * Tables (supabase/migrations/20260630110000_mod_employees.sql):
 *   staff_profiles / shifts / time_entries / service_assignments
 *
 * staff_profiles is the employment record on a profiles(user_id) row (+ an
 * optional CRM contact link); shifts are scheduled work windows; time_entries
 * are clock in/out rows (a shift's entries are tied back via the generic
 * source_kind='shift' + source_id columns); service_assignments put staff on
 * an engagement / service occurrence.
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
  full_name: string;
}

export interface EngagementOption {
  id: string;
  display_code: string | null;
  service_type: string;
}

export interface ServiceTypeOption {
  code: string;
  display_name: string;
}

export interface StaffProfile {
  id: string;
  org_id: string;
  profile_user_id: string;
  contact_id: string | null;
  title: string | null;
  pay_type: string | null;
  active: boolean;
  created_at: string;
  updated_at: string;
  /** Joined identity row (listStaffProfiles). */
  profile?: ProfileOption | null;
  /** Joined optional CRM contact link. */
  contact?: ContactOption | null;
}

export interface StaffProfileInput {
  profile_user_id: string;
  contact_id?: string | null;
  title?: string | null;
  pay_type?: string | null;
  active?: boolean;
}

export interface Shift {
  id: string;
  org_id: string;
  staff_profile_id: string;
  starts_at: string;
  ends_at: string | null;
  role: string | null;
  created_at: string;
  updated_at: string;
  /** Joined owning staff profile (+ its identity row). */
  staff?: {
    id: string;
    title: string | null;
    profile?: Pick<ProfileOption, 'user_id' | 'first_name' | 'last_name'> | null;
  } | null;
}

export interface ShiftInput {
  staff_profile_id: string;
  starts_at: string;
  ends_at?: string | null;
  role?: string | null;
}

export interface TimeEntry {
  id: string;
  org_id: string;
  staff_profile_id: string;
  clock_in: string;
  clock_out: string | null;
  minutes: number | null;
  source_kind: string | null;
  source_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface TimeEntryInput {
  staff_profile_id: string;
  clock_in: string;
  clock_out?: string | null;
  minutes?: number | null;
  /** The shift this entry clocks against (stored as source_kind='shift'). */
  shift_id: string;
}

export type ServiceAssignmentStatus = 'SCHEDULED' | 'COMPLETED' | 'CANCELLED';

export interface ServiceAssignment {
  id: string;
  org_id: string;
  engagement_id: string | null;
  staff_profile_id: string;
  service_type: string | null;
  scheduled_at: string | null;
  status: string;
  created_at: string;
  updated_at: string;
  /** Joined children (listServiceAssignments / create / status updates). */
  staff?: {
    id: string;
    title: string | null;
    profile?: Pick<ProfileOption, 'user_id' | 'first_name' | 'last_name'> | null;
  } | null;
  engagement?: EngagementOption | null;
  service?: ServiceTypeOption | null;
}

export interface ServiceAssignmentInput {
  staff_profile_id: string;
  engagement_id?: string | null;
  service_type?: string | null;
  scheduled_at?: string | null;
}

export interface EmployeesKpis {
  /** Active (non-deleted, active=true) staff profiles. */
  activeStaff: number;
  /** Shifts starting inside the current Monday-anchored week. */
  shiftsThisWeek: number;
  /** SCHEDULED (not yet completed/cancelled) service assignments. */
  openAssignments: number;
}

const STAFF_SELECT =
  '*, profile:profiles(user_id, first_name, last_name, email), contact:contacts(id, full_name)';

const SHIFT_SELECT =
  '*, staff:staff_profiles(id, title, profile:profiles(user_id, first_name, last_name))';

const ASSIGNMENT_SELECT =
  '*, staff:staff_profiles(id, title, profile:profiles(user_id, first_name, last_name)), ' +
  'engagement:engagements(id, display_code, service_type), service:service_types(code, display_name)';

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
    .select('id, full_name')
    .is('deleted_at', null)
    .order('full_name');
  if (error) throw error;
  return (data ?? []) as ContactOption[];
}

export async function listEngagementOptions(): Promise<EngagementOption[]> {
  const { data, error } = await supabase
    .from('engagements')
    .select('id, display_code, service_type')
    .is('deleted_at', null)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as EngagementOption[];
}

export async function listServiceTypes(): Promise<ServiceTypeOption[]> {
  const { data, error } = await supabase
    .from('service_types')
    .select('code, display_name')
    .eq('active', true)
    .order('sort_order');
  if (error) throw error;
  return (data ?? []) as ServiceTypeOption[];
}

// ─── Staff profiles ──────────────────────────────────────────────────────────

export async function listStaffProfiles(): Promise<StaffProfile[]> {
  const { data, error } = await supabase
    .from('staff_profiles')
    .select(STAFF_SELECT)
    .is('deleted_at', null)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as StaffProfile[];
}

export async function createStaffProfile(input: StaffProfileInput): Promise<StaffProfile> {
  const { data, error } = await supabase
    .from('staff_profiles')
    .insert({
      profile_user_id: input.profile_user_id,
      contact_id: input.contact_id ?? null,
      title: input.title ?? null,
      pay_type: input.pay_type ?? null,
      active: input.active ?? true,
    })
    .select(STAFF_SELECT)
    .single();
  if (error) throw error;
  return data as StaffProfile;
}

export async function updateStaffProfile(
  id: string,
  input: StaffProfileInput,
): Promise<StaffProfile> {
  const { data, error } = await supabase
    .from('staff_profiles')
    .update({
      profile_user_id: input.profile_user_id,
      contact_id: input.contact_id ?? null,
      title: input.title ?? null,
      pay_type: input.pay_type ?? null,
      active: input.active ?? true,
    })
    .eq('id', id)
    .select(STAFF_SELECT)
    .single();
  if (error) throw error;
  return data as StaffProfile;
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
      staff_profile_id: input.staff_profile_id,
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
      staff_profile_id: input.staff_profile_id,
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
      staff_profile_id: input.staff_profile_id,
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

// ─── Service assignments ─────────────────────────────────────────────────────

export async function listServiceAssignments(): Promise<ServiceAssignment[]> {
  const { data, error } = await supabase
    .from('service_assignments')
    .select(ASSIGNMENT_SELECT)
    .is('deleted_at', null)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as unknown as ServiceAssignment[];
}

export async function createServiceAssignment(
  input: ServiceAssignmentInput,
): Promise<ServiceAssignment> {
  const { data, error } = await supabase
    .from('service_assignments')
    .insert({
      staff_profile_id: input.staff_profile_id,
      engagement_id: input.engagement_id ?? null,
      service_type: input.service_type ?? null,
      scheduled_at: input.scheduled_at ?? null,
    })
    .select(ASSIGNMENT_SELECT)
    .single();
  if (error) throw error;
  return data as unknown as ServiceAssignment;
}

/** Status transition (SCHEDULED / COMPLETED / CANCELLED). Hard delete is
 *  revoked in the DB — status + soft-delete are the only removal mechanisms. */
export async function updateServiceAssignmentStatus(
  id: string,
  status: ServiceAssignmentStatus,
): Promise<ServiceAssignment> {
  const { data, error } = await supabase
    .from('service_assignments')
    .update({ status })
    .eq('id', id)
    .select(ASSIGNMENT_SELECT)
    .single();
  if (error) throw error;
  return data as unknown as ServiceAssignment;
}

// ─── Hub KPIs ────────────────────────────────────────────────────────────────

export async function getEmployeesKpis(): Promise<EmployeesKpis> {
  const { startISO, endISO } = weekRange(new Date());
  const [staffRes, shiftsRes, assignmentsRes] = await Promise.all([
    supabase
      .from('staff_profiles')
      .select('id')
      .eq('active', true)
      .is('deleted_at', null),
    supabase
      .from('shifts')
      .select('id')
      .is('deleted_at', null)
      .gte('starts_at', startISO)
      .lt('starts_at', endISO),
    supabase
      .from('service_assignments')
      .select('id')
      .eq('status', 'SCHEDULED')
      .is('deleted_at', null),
  ]);
  if (staffRes.error) throw staffRes.error;
  if (shiftsRes.error) throw shiftsRes.error;
  if (assignmentsRes.error) throw assignmentsRes.error;

  return {
    activeStaff: (staffRes.data ?? []).length,
    shiftsThisWeek: (shiftsRes.data ?? []).length,
    openAssignments: (assignmentsRes.data ?? []).length,
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
