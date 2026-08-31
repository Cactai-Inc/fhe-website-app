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


/* ─── Oversight (Slice 5) — REMOVED 2026-08-31 (owner, TASK-FIX3) ────────────
 *
 * `adminOversight()` and its three types were read by exactly one file,
 * `OversightPage.tsx`, and that page is gone. The client wrapper goes with it
 * rather than sitting here with zero call sites.
 *
 * ⚠️ THE DATABASE FUNCTION `admin_oversight()` IS NOT DROPPED (D32) and is now
 * unreachable from the app — which incidentally closes the finding TASK-AR6
 * filed against it: its activity block reads `audit_logs` with NO WHERE clause
 * under SECURITY DEFINER, and `audit_logs` has no `org_id` column to filter by,
 * so it would have become a cross-tenant read on the tenant admin's own page
 * the moment a second organization existed. That is a schema fix, not a query
 * fix, and it belongs to whoever resurfaces an activity log — see
 * docs/reference/ACTIVITY-LOG-why-it-has-no-surface.md.
 */

// ─── Document integrity (CONTRACTORPHAN) ─────────────────────────────────────

/** A broken document, as one integrity check found it. */
export interface IntegrityItem {
  id: string;
  display_code: string | null;
  title: string | null;
  horse: string | null;
  status: string | null;
  current_status: string | null;
  detail: string;
  /** Staff may remove it from the panel. False for anything signed or terminal. */
  can_cleanup: boolean;
}

/** One check. It renders at zero too — a check that vanishes when it passes is
 *  a check the owner cannot trust. */
export interface IntegrityCheck {
  key: string;
  label: string;
  why: string;
  count: number;
  items: IntegrityItem[];
}

/** The contact-orphan set: reported, explained, and never actionable. Note the
 *  absence of `can_cleanup` — these carry no action control by design. */
export interface IntegrityKnown {
  key: string;
  label: string;
  note: string;
  count: number;
  items: {
    id: string;
    display_code: string | null;
    title: string | null;
    horse: string | null;
    status: string | null;
    current_status: string | null;
    signatures: number;
  }[];
}

export interface DocumentIntegrity {
  checked_at: string;
  item_limit: number;
  checks: IntegrityCheck[];
  known: IntegrityKnown;
}

/** Staff-only integrity sweep over live documents. */
export async function documentIntegrity(): Promise<DocumentIntegrity> {
  const { data, error } = await supabase.rpc('document_integrity');
  if (error) throw error;
  return data as DocumentIntegrity;
}

export interface CleanupResult {
  id: string;
  display_code: string | null;
  title: string | null;
  horse: string | null;
  removed_at: string;
}

/**
 * Remove ONE broken document, with a reason that is written to `status_events`.
 * The database re-checks `can_cleanup_document` itself, so a document carrying
 * any signature is refused here regardless of what the UI offered. There is
 * deliberately no bulk form of this call.
 */
export async function cleanupDocument(documentId: string, reason: string): Promise<CleanupResult> {
  const { data, error } = await supabase.rpc('cleanup_document', {
    p_document_id: documentId,
    p_reason: reason,
  });
  if (error) throw error;
  return data as CleanupResult;
}
