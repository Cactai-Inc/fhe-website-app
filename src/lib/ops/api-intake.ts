/**
 * OPS-INTAKE data seams (lane-owned; src/lib/api.ts is integrator-owned).
 *
 * Thin, typed wrappers over supabase.from('intake_submissions') — the staff
 * intake queue created by migration 20260701020000_intake_submissions.sql —
 * and over supabase.from('requests') — the public booking-request inbox
 * (BOOKING_FLOWS_PLAN §2 Flow A step 2; migration 20260703080000).
 * RLS (org_boundary + has_staff_access) is the authoritative fence; these
 * seams only shape the calls. Engagement creation on CONVERT goes through the
 * existing brokerage RPC wrappers in src/lib/api.ts (createPurchaseEngagement /
 * createSearchEngagement / createLeaseEngagement) — imported by the page, not
 * re-wrapped here.
 */
import { supabase } from '../supabase';
import type { ProposedTime } from '../types';

export type IntakeSubmissionStatus = 'NEW' | 'REVIEWED' | 'CONVERTED' | 'DISMISSED';

export interface IntakeSubmission {
  id: string;
  form_key: string;
  payload: Record<string, unknown>;
  contact_email: string | null;
  contact_name: string | null;
  status: IntakeSubmissionStatus;
  converted_engagement_id: string | null;
  created_at: string;
  reviewed_at: string | null;
  reviewed_by: string | null;
}

/** The staff intake queue, newest first; optionally filtered to one status. */
export async function listIntakeSubmissions(
  status?: IntakeSubmissionStatus,
): Promise<IntakeSubmission[]> {
  let query = supabase
    .from('intake_submissions')
    .select('*')
    .order('created_at', { ascending: false });
  if (status) {
    query = query.eq('status', status);
  }
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as IntakeSubmission[];
}

/** Mark a submission REVIEWED or DISMISSED, stamping reviewed_at + reviewed_by. */
export async function markSubmissionStatus(
  id: string,
  status: 'REVIEWED' | 'DISMISSED',
): Promise<IntakeSubmission> {
  const { data: auth } = await supabase.auth.getUser();
  const { data, error } = await supabase
    .from('intake_submissions')
    .update({
      status,
      reviewed_at: new Date().toISOString(),
      reviewed_by: auth?.user?.id ?? null,
    })
    .eq('id', id)
    .select('*')
    .single();
  if (error) throw error;
  return data as IntakeSubmission;
}

/** Stamp a submission CONVERTED with the engagement the conversion opened. */
export async function markSubmissionConverted(
  id: string,
  engagementId: string,
): Promise<IntakeSubmission> {
  const { data: auth } = await supabase.auth.getUser();
  const { data, error } = await supabase
    .from('intake_submissions')
    .update({
      status: 'CONVERTED',
      converted_engagement_id: engagementId,
      reviewed_at: new Date().toISOString(),
      reviewed_by: auth?.user?.id ?? null,
    })
    .eq('id', id)
    .select('*')
    .single();
  if (error) throw error;
  return data as IntakeSubmission;
}

// ─── Booking requests (the Request Inbox) ────────────────────────────────────

export type BookingRequestStatus = 'new' | 'contacted' | 'invited' | 'expired' | 'converted';

/** One append_request_note timeline entry (requests.staff_notes element). */
export interface RequestStaffNote {
  at: string; // timestamptz serialized by jsonb_build_object(now())
  by_name: string;
  note: string;
}

/** request_selections row embedded on the request (what the visitor asked for). */
export interface BookingRequestSelection {
  id: string;
  offering_id: string | null;
  offering_slug: string | null;
  tier_id: string | null;
  label: string | null;
}

export interface BookingRequest {
  id: string;
  created_at: string;
  status: BookingRequestStatus;
  contact_name: string;
  contact_email: string;
  contact_phone: string | null;
  contact_method: 'text' | 'call' | 'email' | null;
  /** Structured availability (src/lib/availability.ts) — legacy {date,time} entries may coexist. */
  proposed_times: ProposedTime[];
  notes: string | null;
  staff_notes: RequestStaffNote[];
  /** Flat object of checklist-item key → boolean; null until staff start it. */
  checklist: Record<string, boolean> | null;
  request_selections: BookingRequestSelection[];
}

/** The Request Inbox, newest first, selections embedded; optionally one status. */
export async function listBookingRequests(
  status?: BookingRequestStatus,
): Promise<BookingRequest[]> {
  let query = supabase
    .from('requests')
    .select('*, request_selections(*)')
    .order('created_at', { ascending: false });
  if (status) {
    query = query.eq('status', status);
  }
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as BookingRequest[];
}

/** Flip a request to 'contacted' (staff UPDATE policy is the fence). */
export async function markRequestContacted(id: string): Promise<BookingRequest> {
  const { data, error } = await supabase
    .from('requests')
    .update({ status: 'contacted' })
    .eq('id', id)
    .select('*, request_selections(*)')
    .single();
  if (error) throw error;
  return data as BookingRequest;
}

/** Append a staff call note via the staff-gated RPC; returns the updated timeline. */
export async function appendRequestNote(
  id: string,
  note: string,
): Promise<RequestStaffNote[]> {
  const { data, error } = await supabase.rpc('append_request_note', {
    p_request_id: id,
    p_note: note,
  });
  if (error) throw error;
  return (data ?? []) as RequestStaffNote[];
}

/** Persist the lesson-fit checklist state (flat key → boolean object). */
export async function setRequestChecklist(
  id: string,
  checklist: Record<string, boolean>,
): Promise<void> {
  const { error } = await supabase.rpc('set_request_checklist', {
    p_request_id: id,
    p_checklist: checklist,
  });
  if (error) throw error;
}

/**
 * Resolve the submission's contact to a CRM contact id: match on email when
 * present (soft-deleted excluded), otherwise create the contact. The brokerage
 * engagement RPCs take a contact id, so CONVERT needs this seam first.
 */
export async function findOrCreateContactByEmail(
  fullName: string,
  email: string | null,
): Promise<string> {
  if (email) {
    const { data, error } = await supabase
      .from('contacts')
      .select('id')
      .eq('email', email)
      .is('deleted_at', null)
      .limit(1)
      .maybeSingle();
    if (error) throw error;
    if (data) return (data as { id: string }).id;
  }
  // contacts carry first/last only (full_name removed 20260702090000): split the
  // freeform intake name on the FIRST space; a single-token name is first-only.
  const trimmed = fullName.trim();
  const spaceAt = trimmed.indexOf(' ');
  const firstName = spaceAt > 0 ? trimmed.slice(0, spaceAt) : trimmed;
  const lastName = spaceAt > 0 ? trimmed.slice(spaceAt + 1).trim() || null : null;
  const { data, error } = await supabase
    .from('contacts')
    .insert({ first_name: firstName, last_name: lastName, email })
    .select('id')
    .single();
  if (error) throw error;
  return (data as { id: string }).id;
}
