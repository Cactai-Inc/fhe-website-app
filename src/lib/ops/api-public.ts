/**
 * LANE-PUBLIC data seams — the anonymous visitor surface (no session).
 *
 * Two public flows, both fenced by RLS/RPC server-side (this file only shapes
 * the calls; policies are the authority):
 *
 *  /inquire  — form_definitions-driven intake: anon reads ACTIVE CLIENT forms
 *              (form_definitions_public_read, 20260702010000) and INSERTs a
 *              NEW row into intake_submissions (intake_submissions_public_insert;
 *              org stamped by the addressed-org/sole-org default). Staff review
 *              at /app/ops/intake — nothing else is readable from here.
 *
 *  /release  — the visitor general-release kiosk: anon reads the RELEASE_GENERAL
 *              template body (contract_templates_read_active) to display it,
 *              then signs through the sign_general_release RPC
 *              (20260702020000) — the ONLY anon-executable mutation RPC.
 */
import { supabase } from '../supabase';

// ---------------------------------------------------------------------------
// /inquire — public intake
// ---------------------------------------------------------------------------

/** A field of a form_definitions schema (types inferred by the form generator). */
export interface PublicFormField {
  key: string;
  label: string;
  type: 'text' | 'email' | 'phone' | 'date' | 'currency' | 'checkbox' | 'signature' | 'system';
  options?: string[];
  note?: string;
  token?: string;
}

export interface PublicFormSection {
  heading: string;
  fields: PublicFormField[];
}

export interface PublicIntakeForm {
  form_key: string;
  title: string;
  purpose: string | null;
  schema: { sections: PublicFormSection[] };
}

/** The ACTIVE CLIENT-audience intake forms the public page may render. */
export async function listPublicIntakeForms(): Promise<PublicIntakeForm[]> {
  const { data, error } = await supabase
    .from('form_definitions')
    .select('form_key, title, purpose, schema')
    .eq('audience', 'CLIENT')
    .eq('active', true)
    .order('title');
  if (error) throw error;
  return (data ?? []) as PublicIntakeForm[];
}

export interface IntakeSubmissionInput {
  form_key: string;
  /** Flat answers keyed by field key (checkbox groups are string arrays). */
  payload: Record<string, string | string[]>;
  contact_name: string | null;
  contact_email: string | null;
  /** Optional explicit tenant (multi-tenant addressing); defaults server-side. */
  org_id?: string;
}

/**
 * Anonymous submit into the staff intake queue. Insert-only — anon has no
 * SELECT on intake_submissions, so no `.select()` after the insert.
 */
export async function submitIntakeSubmission(input: IntakeSubmissionInput): Promise<void> {
  const row: Record<string, unknown> = {
    form_key: input.form_key,
    payload: input.payload,
    contact_name: input.contact_name,
    contact_email: input.contact_email,
  };
  if (input.org_id) row.org_id = input.org_id;
  const { error } = await supabase.from('intake_submissions').insert(row);
  if (error) throw error;
}

// ---------------------------------------------------------------------------
// /release — visitor general-release kiosk
// ---------------------------------------------------------------------------

export interface GeneralReleaseTemplate {
  title: string;
  /** Merged preview body: org identity + dates resolved server-side; person
   *  and signature tokens render as fill-in lines (the visitor's details land
   *  on the SIGNED document via sign_general_release). */
  body: string;
}

/** The RELEASE_GENERAL preview for display before signing — the anon-executable
 *  general_release_preview RPC, so visitors see the real company identity and
 *  today's date, never raw {{TOKENS}}. */
export async function fetchGeneralRelease(orgId?: string): Promise<GeneralReleaseTemplate> {
  const { data, error } = await supabase.rpc('general_release_preview', {
    p_org: orgId ?? null,
  });
  if (error) throw error;
  const row = Array.isArray(data) ? data[0] : data;
  if (!row) throw new Error('general release template unavailable');
  return row as GeneralReleaseTemplate;
}

export interface SignGeneralReleaseInput {
  full_name: string;
  email: string | null;
  phone: string | null;
  typed_name: string;
  /** Optional explicit tenant (multi-tenant kiosks); defaults server-side. */
  org_id?: string;
}

export interface SignGeneralReleaseResult {
  document_id: string;
  document_code: string;
  engagement_id: string;
  contact_id: string;
  /** 'EXECUTED', or 'AWAITING_SIGNATURE' when the company countersigns later. */
  status: string;
  merged_body: string;
}

/** The kiosk sign call — the real engagement + document + sealed signature. */
export async function signGeneralRelease(
  input: SignGeneralReleaseInput,
): Promise<SignGeneralReleaseResult> {
  const params: Record<string, unknown> = {
    p_full_name: input.full_name,
    p_email: input.email,
    p_phone: input.phone,
    p_typed_name: input.typed_name,
  };
  if (input.org_id) params.p_org = input.org_id;
  const { data, error } = await supabase.rpc('sign_general_release', params);
  if (error) throw error;
  return data as SignGeneralReleaseResult;
}
