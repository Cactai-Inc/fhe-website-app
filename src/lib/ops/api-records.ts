/* LANE-RECORDS data wrappers (module mod.horserecords).
 *
 * Thin, typed Supabase calls for the horse-records UI slices:
 *   - horse_parties        (20260630080000_mod_horserecords.sql) — ownership/
 *     rights ledger: owner/lessee/trainer/caretaker/boarder + share_pct +
 *     effective dates. NEVER hard-deleted (DB REVOKEs DELETE) — archival sets
 *     deleted_at only.
 *   - horse_health_events  (same migration) — vet/farrier/vaccination/
 *     deworming/coggins log with an optional provider contact + next_due.
 *   - horses vet/farrier columns (20260701000000_company_party_and_org_tokens.sql):
 *     vet_name / vet_phone / farrier_name / farrier_phone, editable from the
 *     horse-details care-team section.
 *
 * RLS enforces the org boundary + the mod.horserecords module gate + staff
 * access server-side; these wrappers just read/write and throw on error.
 */
import { supabase } from '../supabase';
import type { Contact, Horse } from './types';

// ─── Types ───────────────────────────────────────────────────────────────────

export type HorsePartyRole = 'owner' | 'lessee' | 'trainer' | 'caretaker' | 'boarder';

export const HORSE_PARTY_ROLES: HorsePartyRole[] = [
  'owner',
  'lessee',
  'trainer',
  'caretaker',
  'boarder',
];

export interface HorseParty {
  id: string;
  org_id: string;
  horse_id: string;
  contact_id: string;
  role: HorsePartyRole;
  share_pct: number | null;
  effective_from: string | null;
  effective_to: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

/** Columns staff writes on a party row (org/id/timestamps are DB-managed). */
export interface HorsePartyInput {
  horse_id: string;
  contact_id: string;
  role: HorsePartyRole;
  share_pct?: number | null;
  effective_from?: string | null;
  effective_to?: string | null;
  notes?: string | null;
}

export interface HorseHealthEvent {
  id: string;
  org_id: string;
  horse_id: string;
  event_type: string;
  occurred_at: string;
  provider_contact_id: string | null;
  next_due: string | null;
  notes: string | null;
  document_id: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface HealthEventInput {
  horse_id: string;
  event_type: string;
  occurred_at?: string;
  provider_contact_id?: string | null;
  next_due?: string | null;
  notes?: string | null;
}

/** horses row including the vet/farrier care-team columns added by migration
 *  20260701000000 (not yet on the shared ops Horse type, which the integrator owns). */
export interface HorseRecord extends Horse {
  vet_name: string | null;
  vet_phone: string | null;
  farrier_name: string | null;
  farrier_phone: string | null;
}

/** The four care-team columns editable from the horse-details section. */
export interface CareTeamInput {
  vet_name: string | null;
  vet_phone: string | null;
  farrier_name: string | null;
  farrier_phone: string | null;
}

// ─── Horses (records view) ───────────────────────────────────────────────────

/** In-tenant roster including the vet/farrier columns (select * picks them up). */
export async function listRecordHorses(): Promise<HorseRecord[]> {
  const { data, error } = await supabase
    .from('horses')
    .select('*')
    .is('deleted_at', null)
    .order('barn_name', { nullsFirst: false });
  if (error) throw error;
  return (data ?? []) as HorseRecord[];
}

/** One horse (with care-team columns); null when missing/out of org. */
export async function getRecordHorse(id: string): Promise<HorseRecord | null> {
  const { data, error } = await supabase
    .from('horses')
    .select('*')
    .eq('id', id)
    .is('deleted_at', null)
    .maybeSingle();
  if (error) throw error;
  return (data as HorseRecord | null) ?? null;
}

/** Patch ONLY the vet/farrier care-team columns on a horse. */
export async function updateHorseCareTeam(
  id: string,
  patch: CareTeamInput,
): Promise<HorseRecord> {
  const { data, error } = await supabase
    .from('horses')
    .update(patch)
    .eq('id', id)
    .select('*')
    .single();
  if (error) throw error;
  return data as HorseRecord;
}

// ─── horse_parties — ownership/rights ledger ─────────────────────────────────

/** Active (non-archived) party rows for one horse, oldest effective first. */
export async function listHorseParties(horseId: string): Promise<HorseParty[]> {
  const { data, error } = await supabase
    .from('horse_parties')
    .select('*')
    .eq('horse_id', horseId)
    .is('deleted_at', null)
    .order('effective_from', { ascending: true, nullsFirst: true })
    .order('created_at', { ascending: true });
  if (error) throw error;
  return (data ?? []) as HorseParty[];
}

export async function createHorseParty(input: HorsePartyInput): Promise<HorseParty> {
  const { data, error } = await supabase
    .from('horse_parties')
    .insert(input)
    .select('*')
    .single();
  if (error) throw error;
  return data as HorseParty;
}

export async function updateHorseParty(
  id: string,
  patch: Partial<HorsePartyInput>,
): Promise<HorseParty> {
  const { data, error } = await supabase
    .from('horse_parties')
    .update(patch)
    .eq('id', id)
    .select('*')
    .single();
  if (error) throw error;
  return data as HorseParty;
}

/** Soft-delete: the ledger is NEVER hard-deleted (DB REVOKEs DELETE). */
export async function archiveHorseParty(id: string): Promise<HorseParty> {
  const { data, error } = await supabase
    .from('horse_parties')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id)
    .select('*')
    .single();
  if (error) throw error;
  return data as HorseParty;
}

// ─── horse_health_events — health log ────────────────────────────────────────

/** Active health events for one horse, newest occurrence first. */
export async function listHealthEvents(horseId: string): Promise<HorseHealthEvent[]> {
  const { data, error } = await supabase
    .from('horse_health_events')
    .select('*')
    .eq('horse_id', horseId)
    .is('deleted_at', null)
    .order('occurred_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as HorseHealthEvent[];
}

export async function createHealthEvent(input: HealthEventInput): Promise<HorseHealthEvent> {
  const { data, error } = await supabase
    .from('horse_health_events')
    .insert(input)
    .select('*')
    .single();
  if (error) throw error;
  return data as HorseHealthEvent;
}

// ─── Contacts (party / provider pickers) ─────────────────────────────────────

/** In-tenant contacts for the party-contact and provider selects. */
export async function listRecordContacts(): Promise<Contact[]> {
  const { data, error } = await supabase
    .from('contacts')
    .select('*')
    .is('deleted_at', null)
    .order('first_name')
    .order('last_name');
  if (error) throw error;
  return (data ?? []) as Contact[];
}
