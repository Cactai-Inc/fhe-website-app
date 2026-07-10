/* Zelle billing schedules (Slice 5). A schedule is the recurring charge for a
 * subscription-style engagement. Zelle-only: no auto-charge, we remind. Admins
 * create/manage; members see their own + toggle reminders. RLS is the authority. */
import { supabase } from './supabase';

export type BillingMode = 'request' | 'self_recurring';
export type BillingCadence = 'weekly' | 'monthly';

export interface BillingSchedule {
  id: string;
  engagement_id: string | null;
  client_id: string;
  mode: BillingMode;
  cadence: BillingCadence;
  amount: number;
  start_date: string;           // date
  two_months_upfront: boolean;
  reminders_on: boolean;
  active: boolean;
  created_at: string;
}

export interface CreateBillingScheduleInput {
  client_id: string;
  mode: BillingMode;
  amount: number;
  start_date: string;
  cadence?: BillingCadence;
  engagement_id?: string | null;
  two_months_upfront?: boolean;
  reminders_on?: boolean;
}

/** Admin creates a billing schedule. Returns the new id. */
export async function createBillingSchedule(input: CreateBillingScheduleInput): Promise<string> {
  const { data, error } = await supabase.rpc('create_billing_schedule', {
    p_client_id: input.client_id,
    p_mode: input.mode,
    p_amount: input.amount,
    p_start_date: input.start_date,
    p_cadence: input.cadence ?? 'monthly',
    p_engagement_id: input.engagement_id ?? null,
    p_two_months_upfront: input.two_months_upfront ?? false,
    p_reminders_on: input.reminders_on ?? true,
  });
  if (error) throw error;
  return data as string;
}

/** Admin list (all in-org) or member list (own) — RLS scopes it. */
export async function listBillingSchedules(): Promise<BillingSchedule[]> {
  const { data, error } = await supabase
    .from('billing_schedules')
    .select('id, engagement_id, client_id, mode, cadence, amount, start_date, two_months_upfront, reminders_on, active, created_at')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as BillingSchedule[];
}

/** Toggle reminders on a schedule (member on their own, or admin). */
export async function setBillingReminders(id: string, on: boolean): Promise<void> {
  const { error } = await supabase.rpc('set_billing_reminders', { p_id: id, p_on: on });
  if (error) throw error;
}

/** The next due date for a schedule (client-side mirror of billing_next_due for
 *  display; the server function is the authority for reminders). */
export function nextDue(startDate: string, cadence: BillingCadence, after = new Date()): Date {
  const due = new Date(startDate + 'T00:00:00');
  const afterMidnight = new Date(after.getFullYear(), after.getMonth(), after.getDate());
  let guard = 0;
  while (due < afterMidnight && guard < 600) {
    if (cadence === 'weekly') due.setDate(due.getDate() + 7);
    else due.setMonth(due.getMonth() + 1);
    guard++;
  }
  return due;
}
