/* Horse records (Update A spec H) — client seams for the four creation paths,
 * the onboarding append, and the staff records surface. create_horse_record is
 * the ONE creation path (microchip dedup server-side). */
import { supabase } from './supabase';

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
  if (error) throw error;
}

export async function createHorseRecord(p: HorseIntakePayload): Promise<HorseRecordOutcome> {
  const { data, error } = await supabase.rpc('create_horse_record', { p });
  if (error) throw error;
  return data as HorseRecordOutcome;
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
  if (error) throw error;
}
export async function listHorseMedications(horseId: string): Promise<HorseMedication[]> {
  const { data, error } = await supabase.rpc('horse_medications_list', { p_horse_id: horseId });
  if (error) throw error;
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
  if (error) throw error;
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
  if (error) throw error;
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
  if (error) throw error;
  return (data ?? []) as StaffHorseRecord[];
}

export async function staffUpdateHorse(id: string, patch: Record<string, string>): Promise<void> {
  const { error } = await supabase.rpc('staff_update_horse', { p_id: id, p: patch });
  if (error) throw error;
}

export async function staffAssignHorseParty(
  horseId: string, role: 'OWNER' | 'LESSEE', contactId: string | null,
  termStart?: string | null, termEnd?: string | null,
): Promise<void> {
  const { error } = await supabase.rpc('staff_assign_horse_party', {
    p_horse_id: horseId, p_role: role, p_contact_id: contactId,
    p_term_start: termStart ?? null, p_term_end: termEnd ?? null,
  });
  if (error) throw error;
}

export interface ContactOption { id: string; name: string; email: string | null }
export interface PartyOption extends ContactOption { is_company: boolean }

export async function staffContactOptions(): Promise<ContactOption[]> {
  const { data, error } = await supabase.rpc('staff_contact_options');
  if (error) throw error;
  return (data ?? []) as ContactOption[];
}

/** Party picker for contracts: the company ("French Heritage Equestrian") plus
 *  real client contacts — excludes personal staff contacts and placeholders.
 *  Company is returned first. */
export async function contractPartyOptions(): Promise<PartyOption[]> {
  const { data, error } = await supabase.rpc('contract_party_options');
  if (error) throw error;
  return (data ?? []) as PartyOption[];
}

/** The org's canonical company contact id (creates it once if needed). */
export async function companyContactId(): Promise<string | null> {
  const { data, error } = await supabase.rpc('company_contact_id');
  if (error) throw error;
  return (data as string) ?? null;
}
