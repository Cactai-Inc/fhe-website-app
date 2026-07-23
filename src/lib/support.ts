/* Support intake (Slice 5). Members submit a support request from Account; admins
 * triage from /app/ops/support. RLS is the authority; these wrap the calls. */
import { supabase } from './supabase';

export type SupportStatus = 'open' | 'in_progress' | 'resolved';

export interface SupportRequest {
  id: string;
  user_id: string;
  subject: string;
  body: string;
  status: SupportStatus;
  resolved_at: string | null;
  created_at: string;
}

/** Member submits a support request. Returns the new id. */
export async function submitSupportRequest(subject: string, body: string): Promise<string> {
  const { data, error } = await supabase.rpc('submit_support_request', {
    p_subject: subject,
    p_body: body,
  });
  if (error) throw error;
  return data as string;
}

/** Admin triage list — all in-org requests, newest first (RLS restricts to admins). */
export async function listSupportRequests(status?: SupportStatus): Promise<SupportRequest[]> {
  let q = supabase
    .from('support_requests')
    .select('id, user_id, subject, body, status, resolved_at, created_at')
    .order('created_at', { ascending: false });
  if (status) q = q.eq('status', status);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as SupportRequest[];
}

/** Admin progresses/resolves a request. */
export async function setSupportStatus(id: string, status: SupportStatus): Promise<void> {
  const { error } = await supabase.rpc('set_support_status', { p_id: id, p_status: status });
  if (error) throw error;
}


// ─── Oversight (Slice 5) ─────────────────────────────────────────────────────

export interface OversightUsage {
  members: number;
  open_engagements: number;
  open_support: number;
  feed_posts: number;
  flagged_posts: number;
}

export interface OversightActivity {
  occurred_at: string;
  action: string;
  table_name: string | null;
  actor_user_id: string | null;
}

export interface Oversight {
  usage: OversightUsage;
  activity: OversightActivity[];
}

/** Admin oversight snapshot — usage numbers + recent activity from audit_logs. */
export async function adminOversight(): Promise<Oversight> {
  const { data, error } = await supabase.rpc('admin_oversight');
  if (error) throw error;
  return data as Oversight;
}
