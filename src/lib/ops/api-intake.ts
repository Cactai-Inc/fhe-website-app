/**
 * OPS-INTAKE data seams (lane-owned; src/lib/api.ts is integrator-owned).
 *
 * Thin, typed wrappers over supabase.from('intake_submissions') — the staff
 * intake queue created by migration 20260701020000_intake_submissions.sql.
 * RLS (org_boundary + has_staff_access) is the authoritative fence; these
 * seams only shape the calls. Engagement creation on CONVERT goes through the
 * existing brokerage RPC wrappers in src/lib/api.ts (createPurchaseEngagement /
 * createSearchEngagement / createLeaseEngagement) — imported by the page, not
 * re-wrapped here.
 */
import { supabase } from '../supabase';

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
  const { data, error } = await supabase
    .from('contacts')
    .insert({ full_name: fullName, email })
    .select('id')
    .single();
  if (error) throw error;
  return (data as { id: string }).id;
}
