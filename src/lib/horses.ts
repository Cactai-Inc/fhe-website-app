/* Horse records (Update A spec H) — client seams for the four creation paths,
 * the onboarding append, and the staff records surface. create_horse_record is
 * the ONE creation path (microchip dedup server-side). */
import { supabase } from './supabase';

/* WHY THIS EXISTS (2026-08-10). A new horse owner was blocked in onboarding with
 * "Could not save the horse record." and nobody could say why, because the
 * database's own message never reached the screen.
 *
 * Supabase does NOT return an Error. postgrest-js builds the failure with
 * `error = JSON.parse(body)` (PostgrestBuilder.then, v1.21.4) and hands back that
 * PLAIN OBJECT — a PostgrestError instance is constructed only on the
 * `.throwOnError()` path, which this codebase never uses. So `throw error`
 * throws an object, every `catch (e)` in the app tests `e instanceof Error`,
 * the test is false, and the real message is replaced by a generic string.
 *
 * DbError re-throws it as a real Error carrying all four PostgREST parts
 * (message, details, hint, code), so the existing catch sites surface the truth. */
export class DbError extends Error {
  readonly code: string | null;
  readonly details: string | null;
  readonly hint: string | null;
  constructor(error: unknown, what: string) {
    const e = (error ?? {}) as { message?: unknown; code?: unknown; details?: unknown; hint?: unknown };
    const str = (v: unknown) => (typeof v === 'string' && v.trim() !== '' ? v.trim() : null);
    const message = str(e.message);
    const details = str(e.details);
    const hint = str(e.hint);
    const code = str(e.code);
    super([
      message ?? `${what} failed.`,
      details && details !== message ? `— ${details}` : null,
      hint ? `Hint: ${hint}` : null,
      code ? `[${code}]` : null,
    ].filter(Boolean).join(' '));
    this.name = 'DbError';
    this.code = code;
    this.details = details;
    this.hint = hint;
  }
}

/** The readable text of anything a catch block receives — a real Error, a raw
 *  PostgREST object, or something else entirely. */
export function errorText(e: unknown, fallback: string): string {
  if (e instanceof Error && e.message.trim() !== '') return e.message;
  const msg = (e as { message?: unknown } | null)?.message;
  if (typeof msg === 'string' && msg.trim() !== '') return new DbError(e, fallback).message;
  return fallback;
}

/** The standardized intake payload (matched pair to the record; every field maps
 *  to a column — supabase/horse_record/horse_intake_form.md). All optional except
 *  a name; blanks stay blank. */
export interface HorseIntakePayload {
  owner_name_text?: string;
  owner_email?: string;
  my_relationship?: 'OWNER' | 'LESSEE';
  is_leased?: 'yes' | 'no';
  lessee_name_text?: string;
  lessee_email?: string;
  lease_start?: string;
  lease_end?: string;
  microchip_id?: string;
  nickname?: string;
  registered_name?: string;
  registration_number?: string;
  registration_org?: string;
  passport_number?: string;
  passport_country?: string;
  breed?: string;
  color?: string;
  markings?: string;
  sex?: string;
  date_of_birth?: string;
  height?: string;
  fair_market_value?: string;
  home_location?: string;
  current_location?: string;
  vet_name?: string;
  vet_phone?: string;
  vet_business_name?: string;
  vet_address_line1?: string;
  vet_city?: string;
  vet_state?: string;
  vet_postal?: string;
  farrier_name?: string;
  farrier_phone?: string;
  medical_history?: string;
  behavioral_history?: string;
  known_conditions?: string;
  /** Owner's emergency-euthanasia authorization: 'A' authorize | 'B' do not. */
  euthanasia_authorization?: 'A' | 'B';
  training_history?: string;
  competition_history?: string;
  claim_note?: string;
  /** Staff-only: assign the record to this client account. Honored by the backend
   *  only when the caller is staff; ignored (record binds to caller) otherwise. */
  owner_contact_id?: string;
}

export type HorseRecordOutcome =
  | { outcome: 'created'; horse_id: string }
  | { outcome: 'match_found'; horse_id: string }
  | { outcome: 'match_pending_review' };

/** Resolve/set a horse's Home + Current locations (by name) to real location rows.
 *  Called after the horse form saves so the three-location model is populated. */
/** A findable location: the place (name + structured address) plus THIS horse's
 *  detail there (barn/stall, notes, on-site people). */
export interface HorseLocationDetail {
  name?: string;
  address_line1?: string;
  city?: string;
  state?: string;
  postal?: string;
  /** Composite "Barn A" / "Stable A" (prefix select + typed value); blank when the
   *  property has outdoor stalls only. */
  barn?: string;
  /** Composite "Stall 16" / "Pen 16". */
  stall?: string;
  notes?: string;
  trainer?: string;
  care_giver?: string;
  groom?: string;
  other?: string;
}
/** Persist a horse's home and (optional) current location. `current` null/omitted
 *  means the horse is at its home location. */
export async function setHorseLocations(
  horseId: string, home: HorseLocationDetail, current?: HorseLocationDetail | null,
): Promise<void> {
  const { error } = await supabase.rpc('set_horse_locations', {
    p_horse_id: horseId,
    p_payload: { home, current: current ?? null },
  });
  if (error) throw new DbError(error, 'Saving the horse locations');
}

export async function createHorseRecord(p: HorseIntakePayload): Promise<HorseRecordOutcome> {
  const { data, error } = await supabase.rpc('create_horse_record', { p: scrubHorseSentinels(p) });
  if (error) throw new DbError(error, 'Saving the horse record');
  return data as HorseRecordOutcome;
}

/** The full client horse page: record + documents + schedule + history, one call. */
export interface HorsePageDetail {
  record: Record<string, unknown> & {
    id: string; registered_name: string | null; nickname: string | null;
    breed: string | null; color: string | null; markings: string | null; sex: string | null;
    date_of_birth: string | null; height: string | null;
    registration_number: string | null; registration_org: string | null; microchip_id: string | null;
    passport_number: string | null; passport_country: string | null; fair_market_value: number | null;
    home_location: { name?: string; address_line1?: string; city?: string; state?: string; postal?: string } | null;
    home_barn: string | null; home_stall: string | null; home_notes: string | null;
    home_trainer: string | null; home_care_giver: string | null; home_groom: string | null; home_other: string | null;
    current_location: { name?: string; address_line1?: string; city?: string; state?: string; postal?: string } | null;
    current_barn: string | null; current_stall: string | null;
    vet_name: string | null; vet_phone: string | null; vet_business_name: string | null;
    farrier_name: string | null; farrier_phone: string | null;
    medical_history: string | null; behavioral_history: string | null; known_conditions: string | null;
    training_history: string | null; competition_history: string | null; euthanasia_authorization: string | null;
    owner_name: string | null; lessee_name: string | null; lease_start: string | null; lease_end: string | null;
  };
  /** A11: true only when the signed-in viewer IS the stamped lessee. */
  viewer_is_lessee: boolean;
  /** A12: schedule captured in the currently-active executed lease document, read through at display time. Null when no active lease. */
  lease: {
    lessee_name: string | null; lease_start: string | null; lease_end: string | null;
    lease_type: string | null; days_used: string | null; schedule_terms: string | null;
    source_document_id: string;
  } | null;
  medications: HorseMedication[];
  documents: { id: string; title: string; display_code: string | null; status: string | null; workflow_state: string | null; effective_date: string | null; created_at: string }[];
  schedule: { id: string; kind: string | null; starts_at: string | null; ends_at: string | null; status: string | null; location: string | null; notes: string | null }[];
  /** Session/lesson/training reports: bookings with a logged activity or write-up. */
  sessions: { id: string; kind: string | null; offering: string | null; starts_at: string | null; status: string | null; location: string | null; activities: string[] | null; report: string | null }[];
  purchases: { id: string; display_code: string | null; amount: number | null; status: string | null; payment_status: string | null; notes: string | null; paid_at: string | null; created_at: string }[];
}
export async function horsePageDetail(horseId: string): Promise<HorsePageDetail> {
  const { data, error } = await supabase.rpc('horse_page_detail', { p_horse_id: horseId });
  if (error) throw new DbError(error, 'Loading the horse');
  return data as HorsePageDetail;
}
/** Delete a horse from the caller's stable (owner/staff). */
export async function deleteStableHorse(horseId: string): Promise<void> {
  const { error } = await supabase.rpc('my_stable_delete_horse', { p_id: horseId });
  if (error) throw new DbError(error, 'Deleting the horse');
}
/** Update a horse record (owner/staff). Partial patch — only the keys present change. */
export async function updateHorseRecord(horseId: string, patch: Record<string, string>): Promise<void> {
  const { error } = await supabase.rpc('update_horse_record', { p_id: horseId, p: scrubHorseSentinels(patch) });
  if (error) throw new DbError(error, 'Saving the horse record');
}

/** A repeatable medication or supplement entry with cost, supplier, and order qty.
 *  rx_info applies to medications only. */
export interface HorseMedication {
  id?: string;
  kind: 'MEDICATION' | 'SUPPLEMENT';
  name?: string;
  dosage?: string;
  instructions?: string;
  cost?: string;
  supplier_website?: string;
  supplier_phone?: string;
  rx_info?: string;
  order_units?: string;
  days_supply?: string;
}
/** Replace-all a horse's medications + supplements. */
export async function setHorseMedications(horseId: string, items: HorseMedication[]): Promise<void> {
  const { error } = await supabase.rpc('set_horse_medications', { p_horse_id: horseId, p_items: items });
  if (error) throw new DbError(error, 'Saving the medications and supplements');
}
export async function listHorseMedications(horseId: string): Promise<HorseMedication[]> {
  const { data, error } = await supabase.rpc('horse_medications_list', { p_horse_id: horseId });
  if (error) throw new DbError(error, 'Loading the medications and supplements');
  return (data ?? []) as HorseMedication[];
}

/** A horse document produced/kept by the engine. */
export interface GeneratedHorseDoc { template_key: string; document_id: string }

/** Ensure the horse's Vet Auth (+ Care Release when on file / requested) exist,
 *  signed by the horse's owner. Voids + reissues blank/horse-less copies. */
export async function ensureHorseDocuments(
  horseId: string,
  opts: { contractId?: string | null; includeCare?: boolean | null } = {},
): Promise<{ owner_contact_id: string; generated: GeneratedHorseDoc[]; voided: number }> {
  const { data, error } = await supabase.rpc('ensure_horse_documents', {
    p_horse_id: horseId,
    p_contract_id: opts.contractId ?? null,
    p_include_care: opts.includeCare ?? null,
  });
  if (error) throw new DbError(error, 'Preparing the horse documents');
  return data as { owner_contact_id: string; generated: GeneratedHorseDoc[]; voided: number };
}

export interface HorseOnboardingState {
  pending_horse_docs: { document_id: string; template_key: string; title: string; link: string }[];
  needs_horse: boolean;
  service_blocked: boolean;
}

/** The persistent horse-documents dashboard state (what's outstanding + whether a
 *  purchased horse-care service is blocked on an unsigned release). */
export async function fetchHorseOnboardingState(): Promise<HorseOnboardingState> {
  const { data, error } = await supabase.rpc('my_horse_onboarding_state');
  if (error) throw new DbError(error, 'Loading the horse document state');
  return data as HorseOnboardingState;
}

// ── staff records surface (spec H.8) ─────────────────────────────────────────

export interface StaffHorseRecord {
  owner_contact_id: string | null;
  owner_name: string | null;
  owner_name_text: string | null;
  lessee_contact_id: string | null;
  lessee_name: string | null;
  lessee_name_text: string | null;
  lease_start: string | null;
  lease_end: string | null;
  document_count: number;
  active_lease_doc: { document_id: string; display_code: string | null; effective_date: string | null } | null;
  created_at: string;
  id: string;
  nickname: string | null;
  registered_name: string | null;
  registration_number: string | null;
  registration_org: string | null;
  microchip_id: string | null;
  breed: string | null;
  color: string | null;
  markings: string | null;
  sex: string | null;
  date_of_birth: string | null;
  height: string | null;
  current_location: string | null;
  fair_market_value: number | null;
  vet_name: string | null;
  vet_phone: string | null;
  farrier_name: string | null;
  farrier_phone: string | null;
}

export async function staffHorseRecords(): Promise<StaffHorseRecord[]> {
  const { data, error } = await supabase.rpc('staff_horse_records');
  if (error) throw new DbError(error, 'Loading the horse records');
  return (data ?? []) as StaffHorseRecord[];
}

export async function staffUpdateHorse(id: string, patch: Record<string, string>): Promise<void> {
  const { error } = await supabase.rpc('staff_update_horse', { p_id: id, p: scrubHorseSentinels(patch) });
  if (error) throw new DbError(error, 'Saving the horse');
}

/** Archive a horse (D11: hidden from staff_horse_records, never purged). */
export async function staffArchiveHorse(id: string): Promise<void> {
  const { error } = await supabase.rpc('staff_archive_horse', { p_id: id });
  if (error) throw new DbError(error, 'Archiving the horse');
}

export async function staffAssignHorseParty(
  horseId: string, role: 'OWNER' | 'LESSEE', contactId: string | null,
  termStart?: string | null, termEnd?: string | null,
): Promise<void> {
  const { error } = await supabase.rpc('staff_assign_horse_party', {
    p_horse_id: horseId, p_role: role, p_contact_id: contactId,
    p_term_start: termStart ?? null, p_term_end: termEnd ?? null,
  });
  if (error) throw new DbError(error, 'Assigning the horse party');
}

export interface ContactOption { id: string; name: string; email: string | null }
export interface PartyOption extends ContactOption { is_company: boolean }

export async function staffContactOptions(): Promise<ContactOption[]> {
  const { data, error } = await supabase.rpc('staff_contact_options');
  if (error) throw new DbError(error, 'Loading the contact options');
  return (data ?? []) as ContactOption[];
}

/** Party picker for contracts: the company ("French Heritage Equestrian") plus
 *  real client contacts — excludes personal staff contacts and placeholders.
 *  Company is returned first. */
export async function contractPartyOptions(): Promise<PartyOption[]> {
  const { data, error } = await supabase.rpc('contract_party_options');
  if (error) throw new DbError(error, 'Loading the party options');
  return (data ?? []) as PartyOption[];
}

/** The org's canonical company contact id (creates it once if needed). */
export async function companyContactId(): Promise<string | null> {
  const { data, error } = await supabase.rpc('company_contact_id');
  if (error) throw new DbError(error, 'Loading the company contact');
  return (data as string) ?? null;
}

// ─── Doc-derived required set + completeness (owner spec 2026-07-28) ─────────
// The REQUIRED intake fields are exactly the HORSE.* tokens the two horse
// onboarding documents merge (HORSE_EMERGENCY_VET + RELEASE_HORSE_CARE live
// template bodies; see docs/TOKEN_DICTIONARY.md):
//   REGISTERED_NAME/BARN_NAME (one real name), BREED, COLOR, SEX, AGE_DOB,
//   HEIGHT, MICROCHIP, REGISTRATION_NUMBER, FAIR_MARKET_VALUE,
//   CURRENT_LOCATION, VET_NAME, VET_PHONE, FARRIER_NAME, FARRIER_PHONE,
//   KNOWN_CONDITIONS, EUTHANASIA_A/B. (MEDICATION_* is the repeatable list —
//   an empty list is a valid "none".) "N/A" is a conscious answer, not a blank.
export const HORSE_NA = 'N/A';

/* THE SENTINEL CANNOT GO EVERYWHERE. "N/A" is a text answer, and six of the
 * horses columns cannot hold text:
 *   date_of_birth      date            → 22007 invalid input syntax for type date
 *   fair_market_value  numeric         → 22P02 invalid input syntax for type numeric
 *   sex                CHECK (5 codes) → 23514 horses_sex_check
 *   euthanasia_authorization CHECK A|B → 23514
 *   breed              FK horse_breeds → 23503 horses_breed_fkey
 *   color              FK horse_colors → 23503 horses_color_fkey
 * Each was reproduced against production on 2026-08-10 inside a rolled-back
 * transaction. On those columns the sentinel is persisted as CLEARED (NULL) —
 * the same rule the edit-mode patch has always used, now applied to creation
 * too, which is where a brand-new owner met it. */
export const HORSE_SENTINEL_UNSAFE_KEYS: (keyof HorseIntakePayload)[] = [
  'date_of_birth', 'fair_market_value', 'sex', 'euthanasia_authorization', 'breed', 'color',
];

/** Clear the 'N/A' sentinel from the columns that cannot store it. Applied at
 *  the seam so no caller can send a payload the INSERT will reject. */
export function scrubHorseSentinels<T extends object>(p: T): T {
  const out = { ...p } as Record<string, unknown>;
  for (const k of HORSE_SENTINEL_UNSAFE_KEYS) if (out[k] === HORSE_NA) out[k] = '';
  return out as T;
}

/** Payload keys required because a horse onboarding document merges them. */
export const HORSE_DOC_REQUIRED_KEYS: (keyof HorseIntakePayload)[] = [
  'breed', 'color', 'sex', 'date_of_birth', 'height',
  'microchip_id', 'registration_number', 'fair_market_value',
  'vet_name', 'vet_phone', 'farrier_name', 'farrier_phone',
  'known_conditions',
];

/** Human labels for the completeness "missing" list (ops surface). */
export const HORSE_DOC_REQUIRED_LABELS: Record<string, string> = {
  name: 'Name (registered or barn)',
  breed: 'Breed', color: 'Color', sex: 'Sex', date_of_birth: 'Date of birth',
  height: 'Height', microchip_id: 'Microchip', registration_number: 'Registration number',
  fair_market_value: 'Fair market value', vet_name: 'Vet name', vet_phone: 'Vet phone',
  farrier_name: 'Farrier name', farrier_phone: 'Farrier phone',
  known_conditions: 'Known conditions', euthanasia_authorization: 'Euthanasia authorization',
  location: 'Location',
};

export interface HorseRecordCompleteness {
  state: 'not_started' | 'partial' | 'complete';
  /** Labels of the still-missing required fields. */
  missing: string[];
  answered: number;
  total: number;
}

/** Completeness of a RAW horses row (codes, not display names) against the
 *  doc-derived required set. 'N/A' counts as answered. */
export function horseRecordCompleteness(rec: Record<string, unknown>): HorseRecordCompleteness {
  const answered = (v: unknown) => v != null && String(v).trim() !== '';
  const missing: string[] = [];
  let done = 0;
  const checks: [string, boolean][] = [
    ['name', answered(rec.nickname) || answered(rec.registered_name)],
    ...HORSE_DOC_REQUIRED_KEYS.map((k) =>
      [k as string, answered(rec[k as string])] as [string, boolean]),
    /* ⚠️ EUTHANASIA IS NO LONGER A REQUIRED FIELD (owner, 2026-08-25). The block
       was removed from the intake form the same day and the authorisation is now a
       STATEMENT in the Emergency Vet Authorization, not a choice the client makes.
       Leaving it counted here made every horse permanently "partially complete",
       with staff invited to chase a field the form no longer has. */
    ['location', answered(rec.current_location) || rec.current_location_id != null || rec.home_location_id != null],
  ];
  for (const [key, ok] of checks) {
    if (ok) done += 1;
    else missing.push(HORSE_DOC_REQUIRED_LABELS[key] ?? key);
  }
  // "Name" alone is structural (the record can't exist without one) — a record
  // with nothing else answered reads as not started.
  const state: HorseRecordCompleteness['state'] =
    missing.length === 0 ? 'complete' : done <= 1 ? 'not_started' : 'partial';
  return { state, missing, answered: done, total: checks.length };
}

/** RAW intake columns straight off the horses row (codes, not display names) —
 *  the shape the intake form edits. RLS: owner or staff. */
export const HORSE_INTAKE_COLUMNS =
  'id, nickname, registered_name, registration_number, registration_org, microchip_id, '
  + 'passport_number, passport_country, breed, color, markings, sex, date_of_birth, height, '
  + 'fair_market_value, current_location, current_location_id, home_location_id, '
  + 'vet_name, vet_phone, vet_business_name, vet_address_line1, vet_city, vet_state, vet_postal, '
  + 'farrier_name, farrier_phone, medical_history, behavioral_history, known_conditions, '
  + 'euthanasia_authorization, training_history, competition_history, '
  + 'lessee_name_text, lease_start, lease_end, current_owner_contact_id';

export type HorseIntakeRecord = Record<string, unknown> & { id: string };

/** Load the raw record for edit-mode intake (owner or staff; RLS-guarded). */
export async function getHorseIntakeRecord(horseId: string): Promise<HorseIntakeRecord | null> {
  const { data, error } = await supabase
    .from('horses')
    .select(HORSE_INTAKE_COLUMNS)
    .eq('id', horseId)
    .maybeSingle();
  if (error) throw new DbError(error, 'Loading the horse record');
  return data as unknown as HorseIntakeRecord | null;
}

/** Staff: horses owned by a contact, raw intake columns (for the ops record card). */
export async function contactHorseRecords(contactId: string): Promise<HorseIntakeRecord[]> {
  const { data, error } = await supabase
    .from('horses')
    .select(HORSE_INTAKE_COLUMNS)
    .eq('current_owner_contact_id', contactId)
    .is('deleted_at', null)
    .order('created_at');
  if (error) throw new DbError(error, 'Loading the horse records');
  return (data ?? []) as unknown as HorseIntakeRecord[];
}

/** Staff: assign the finish-the-record task — an in-app notification (dashboard
 *  alert + badge) linking the member to the intake form in edit mode. */
export async function requestHorseRecordCompletion(horseId: string): Promise<void> {
  const { error } = await supabase.rpc('staff_request_horse_record_completion', { p_horse_id: horseId });
  if (error) throw new DbError(error, 'Requesting record completion');
}
