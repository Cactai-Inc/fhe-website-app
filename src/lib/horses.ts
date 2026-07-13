/* Horse records (Update A spec H) — client seams for the four creation paths,
 * the onboarding append, and the staff records surface. create_horse_record is
 * the ONE creation path (microchip dedup server-side). */
import { supabase } from './supabase';

/** The standardized intake payload (matched pair to the record; every field maps
 *  to a column — supabase/horse_record/horse_intake_form.md). All optional except
 *  a name; blanks stay blank. */
export interface HorseIntakePayload {
  microchip_id?: string;
  registered_name?: string;
  barn_name?: string;
  breed?: string;
  registration_number?: string;
  registration_org?: string;
  passport_number?: string;
  passport_country?: string;
  color?: string;
  markings?: string;
  sex?: string;
  date_of_birth?: string;
  height?: string;
  fair_market_value?: string;
  current_location?: string;
  my_relationship?: 'OWNER' | 'LESSEE';
  owner_name_text?: string;
  owner_email?: string;
  is_leased?: 'yes' | 'no';
  lessee_name_text?: string;
  lessee_email?: string;
  lease_start?: string;
  lease_end?: string;
  sublease_allowed?: 'yes' | 'no';
  vet_name?: string;
  vet_phone?: string;
  farrier_name?: string;
  farrier_phone?: string;
  medical_history?: string;
  behavioral_history?: string;
  medication_current?: string;
  known_conditions?: string;
  training_history?: string;
  competition_history?: string;
  claim_note?: string;
}

export type HorseRecordOutcome =
  | { outcome: 'created'; horse_id: string }
  | { outcome: 'match_found'; horse_id: string }
  | { outcome: 'match_pending_review' };

export async function createHorseRecord(p: HorseIntakePayload): Promise<HorseRecordOutcome> {
  const { data, error } = await supabase.rpc('create_horse_record', { p });
  if (error) throw error;
  return data as HorseRecordOutcome;
}

// ── onboarding append (spec H.7) ─────────────────────────────────────────────

export async function onboardingHorseStep(engagementId: string): Promise<{ needed: boolean; horse_id: string | null }> {
  const { data, error } = await supabase.rpc('my_onboarding_horse_step', { p_engagement_id: engagementId });
  if (error) throw error;
  return data as { needed: boolean; horse_id: string | null };
}

export async function attachOnboardingHorse(engagementId: string, horseId: string): Promise<void> {
  const { error } = await supabase.rpc('my_onboarding_attach_horse', {
    p_engagement_id: engagementId, p_horse_id: horseId,
  });
  if (error) throw error;
}

// ── staff records surface (spec H.8) ─────────────────────────────────────────

export interface StaffHorseRecord {
  id: string;
  registered_name: string | null;
  barn_name: string | null;
  breed: string | null;
  color: string | null;
  markings: string | null;
  sex: string | null;
  date_of_birth: string | null;
  height: string | null;
  registration_number: string | null;
  registration_org: string | null;
  microchip_id: string | null;
  current_location: string | null;
  fair_market_value: number | null;
  vet_name: string | null;
  vet_phone: string | null;
  farrier_name: string | null;
  farrier_phone: string | null;
  owner_contact_id: string | null;
  owner_name: string | null;
  owner_name_text: string | null;
  lessee_contact_id: string | null;
  lessee_name: string | null;
  lessee_name_text: string | null;
  lease_start: string | null;
  lease_end: string | null;
  sublease_allowed: boolean;
  document_count: number;
  created_at: string;
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

export async function staffContactOptions(): Promise<ContactOption[]> {
  const { data, error } = await supabase.rpc('staff_contact_options');
  if (error) throw error;
  return (data ?? []) as ContactOption[];
}

/** Staff: create a horse record OWNED BY a specific contact (e.g. recording a
 *  client's horse from the ops side so a contract can reference it). Same
 *  microchip-dedup discipline as the client intake. */
export async function staffCreateHorseForContact(
  ownerContactId: string,
  payload: Record<string, string>,
): Promise<{ horse_id: string; outcome: 'created' | 'match_found' }> {
  const { data, error } = await supabase.rpc('staff_create_horse_for_contact', {
    p_owner_contact_id: ownerContactId, p: payload,
  });
  if (error) throw error;
  return data as { horse_id: string; outcome: 'created' | 'match_found' };
}

/** The org's canonical company contact id (creates it once if needed). */
export async function companyContactId(): Promise<string | null> {
  const { data, error } = await supabase.rpc('company_contact_id');
  if (error) throw error;
  return (data as string) ?? null;
}
