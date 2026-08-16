/**
 * LANE-PUBLIC data seams — the anonymous visitor surface (no session).
 *
 * Two public flows, both fenced by RLS/RPC server-side (this file only shapes
 * the calls; policies are the authority):
 *
 *  intake    — the unified public form (contact/inquiry/booking) writes ONE
 *              requests row through submit_public_request (see lib/api). The
 *              only thing read here is which fields a channel requires
 *              (intake_requirements RPC) so the form can enforce the owner's
 *              per-channel configuration.
 *
 *  /release  — the release kiosk: anon previews any of the four RELEASE_*
 *              documents (release_preview RPC — merged org identity + dates,
 *              truncated BEFORE the signature area) plus the FACILITY_RULES
 *              gate document, then signs through the sign_release RPC
 *              (20260702050000) — the ONLY anon-executable mutation RPC.
 */
import { supabase } from '../supabase';

// ---------------------------------------------------------------------------
// unified intake — per-channel required-field config (owner-set, read by anon)
// ---------------------------------------------------------------------------

/** The required-field map for a channel, e.g. { phone: true, message: false }.
 *  Base fields (first/last/email) are always required and not in this map. */
export async function fetchIntakeRequirements(channel: string): Promise<Record<string, boolean>> {
  const { data, error } = await supabase.rpc('intake_requirements', { p_channel: channel });
  if (error) throw error;
  return (data ?? {}) as Record<string, boolean>;
}

// ---------------------------------------------------------------------------
// /release — the release kiosk (all four releases + the rules gate)
// ---------------------------------------------------------------------------

/** The kiosk-signable documents (sign_release validates the same set,
 *  migration 20260703140000). The releases plus the standalone acknowledgment
 *  documents (stable rules + business policies + medical) — all carry a CLIENT
 *  signature block and are signed the same way. Horse-care unified under
 *  RELEASE_HORSE_CARE — RELEASE_HORSE_EXERCISE retired 2026-07-05 (matches the
 *  live DB, where it is inactive and HORSE_EXERCISE requires RELEASE_HORSE_CARE). */
export type ReleaseTemplateKey =
  | 'RELEASE_GENERAL'
  | 'RELEASE_PARTICIPANT'
  | 'RELEASE_HORSE_CARE'
  | 'FACILITY_RULES'
  | 'COMPANY_POLICIES'
  | 'HUMAN_EMERGENCY_MEDICAL';

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
  /** Optional medical-auth fields (participant flow, migration 20260707180000).
   *  All optional — written fill-blank onto the signer contact so the medical
   *  authorization document merges them. */
  dob?: string | null;                 // ISO YYYY-MM-DD
  address_line1?: string | null;
  address_line2?: string | null;
  city?: string | null;
  state?: string | null;
  postal_code?: string | null;
  emergency_contact_1_name?: string | null;
  emergency_contact_1_relationship?: string | null;
  emergency_contact_1_phone?: string | null;
  emergency_contact_2_name?: string | null;
  emergency_contact_2_relationship?: string | null;
  emergency_contact_2_phone?: string | null;
  /** Optional explicit tenant (multi-tenant kiosks); defaults server-side. */
  org_id?: string;
  /** ONBOARD §4: this signature is one step of a MULTI-document run. The endpoint
   *  opens a delivery hold and skips its per-document email, so the run ends in
   *  ONE email carrying every signed PDF instead of one email per document.
   *  Set by /docs/release-participant; the single-document kiosk leaves it off. */
  hold_set?: boolean;
}

export interface SignReleaseResult {
  document_id: string;
  document_code: string;
  contact_id: string;
  /** 'EXECUTED' — releases are unilateral (single signature executes). */
  status: string;
  /** The executed document: applicable signer section only, completed
   *  signature, DOB merged (minor flow), dated rules acknowledgment. */
  merged_body: string;
}

/** The kiosk sign call. Routed through POST /api/sign-release (H2 hardening,
 *  2026-08-02) rather than calling the sign_release RPC directly: the kiosk
 *  has no session, so the endpoint itself now performs the post-signature
 *  delivery email server-side, in-process, instead of the browser firing a
 *  second, unauthenticated request to /api/deliver-document. The RPC's
 *  validation and signing behavior are unchanged — only where the delivery
 *  call happens has moved. */
export async function signRelease(input: SignReleaseInput): Promise<SignReleaseResult> {
  const body: Record<string, unknown> = {
    template_key: input.template_key,
    first_name: input.first_name,
    last_name: input.last_name,
    email: input.email,
    phone: input.phone,
    typed_name: input.typed_name,
    is_minor: input.is_minor,
    minor_first_name: input.minor_first_name ?? null,
    minor_last_name: input.minor_last_name ?? null,
    minor_dob: input.minor_dob ?? null,
    guardian_relationship: input.guardian_relationship ?? null,
    rules_acknowledged: input.rules_acknowledged,
    esign_consent: input.esign_consent ?? false,
    dob: input.dob ?? null,
    address_line1: input.address_line1 ?? null,
    address_line2: input.address_line2 ?? null,
    city: input.city ?? null,
    state: input.state ?? null,
    postal_code: input.postal_code ?? null,
    emergency_contact_1_name: input.emergency_contact_1_name ?? null,
    emergency_contact_1_relationship: input.emergency_contact_1_relationship ?? null,
    emergency_contact_1_phone: input.emergency_contact_1_phone ?? null,
    emergency_contact_2_name: input.emergency_contact_2_name ?? null,
    emergency_contact_2_relationship: input.emergency_contact_2_relationship ?? null,
    emergency_contact_2_phone: input.emergency_contact_2_phone ?? null,
  };
  if (input.org_id) body.org_id = input.org_id;
  if (input.hold_set) body.hold_set = true;
  const res = await fetch('/api/sign-release', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json?.error ?? `sign-release failed (HTTP ${res.status})`);
  return json as SignReleaseResult;
}
