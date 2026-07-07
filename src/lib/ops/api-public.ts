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
 *  /release  — the release kiosk: anon previews any of the four RELEASE_*
 *              documents (release_preview RPC — merged org identity + dates,
 *              truncated BEFORE the signature area) plus the FACILITY_RULES
 *              gate document, then signs through the sign_release RPC
 *              (20260702050000) — the ONLY anon-executable mutation RPC.
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
// /release — the release kiosk (all four releases + the rules gate)
// ---------------------------------------------------------------------------

/** The kiosk-signable documents (sign_release validates the same set,
 *  migration 20260703140000). The four releases plus the two standalone
 *  acknowledgment documents (stable rules + business policies) — all carry a
 *  CLIENT signature block and are signed the same way. */
export type ReleaseTemplateKey =
  | 'RELEASE_GENERAL'
  | 'RELEASE_PARTICIPANT'
  | 'RELEASE_HORSE_EXERCISE'
  | 'RELEASE_HORSE_CARE'
  | 'FACILITY_RULES'
  | 'COMPANY_POLICIES';

export interface ReleasePreview {
  title: string;
  /** Merged preview body: org identity + dates resolved server-side and the
   *  body TRUNCATED before the signature area — nothing signature-ish is shown
   *  pre-signing; the signer's details land on the SIGNED document. */
  body: string;
}

/** A release preview (or 'FACILITY_RULES' for the rules gate) for display
 *  before signing — the anon-executable release_preview RPC, so visitors see
 *  the real company identity and today's date, never raw {{TOKENS}}. */
export async function fetchReleasePreview(
  templateKey: ReleaseTemplateKey | 'FACILITY_RULES',
  orgId?: string,
): Promise<ReleasePreview> {
  const { data, error } = await supabase.rpc('release_preview', {
    p_template_key: templateKey,
    p_org: orgId ?? null,
  });
  if (error) throw error;
  const row = Array.isArray(data) ? data[0] : data;
  if (!row) throw new Error('release template unavailable');
  return row as ReleasePreview;
}

export interface SignReleaseInput {
  template_key: ReleaseTemplateKey;
  /** The SIGNER: the adult, or the parent/guardian when is_minor. The server
   *  concatenates first + last for the official/printed name; the typed
   *  signature must match that concatenation. */
  first_name: string;
  last_name: string;
  email: string | null;
  phone: string | null;
  typed_name: string;
  /** Minor flow: the guardian signs; minor fields required. */
  is_minor: boolean;
  minor_first_name?: string | null;
  minor_last_name?: string | null;
  /** ISO date (YYYY-MM-DD). */
  minor_dob?: string | null;
  guardian_relationship?: string | null;
  /** The rules gate — the RPC rejects unless true. */
  rules_acknowledged: boolean;
  /** E-sign consent (20260703110000): the kiosk's required "sign
   *  electronically" checkbox — the RPC rejects unless true. */
  esign_consent?: boolean;
  /** Optional explicit tenant (multi-tenant kiosks); defaults server-side. */
  org_id?: string;
}

export interface SignReleaseResult {
  document_id: string;
  document_code: string;
  engagement_id: string;
  contact_id: string;
  /** 'EXECUTED' — releases are unilateral (single signature executes). */
  status: string;
  /** The executed document: applicable signer section only, completed
   *  signature, DOB merged (minor flow), dated rules acknowledgment. */
  merged_body: string;
}

/** The kiosk sign call — the real engagement + document + sealed signature. */
export async function signRelease(input: SignReleaseInput): Promise<SignReleaseResult> {
  const params: Record<string, unknown> = {
    p_template_key: input.template_key,
    p_first_name: input.first_name,
    p_last_name: input.last_name,
    p_email: input.email,
    p_phone: input.phone,
    p_typed_name: input.typed_name,
    p_is_minor: input.is_minor,
    p_minor_first_name: input.minor_first_name ?? null,
    p_minor_last_name: input.minor_last_name ?? null,
    p_minor_dob: input.minor_dob ?? null,
    p_guardian_relationship: input.guardian_relationship ?? null,
    p_rules_acknowledged: input.rules_acknowledged,
    p_esign_consent: input.esign_consent ?? false,
  };
  if (input.org_id) params.p_org = input.org_id;
  const { data, error } = await supabase.rpc('sign_release', params);
  if (error) throw error;
  return data as SignReleaseResult;
}
