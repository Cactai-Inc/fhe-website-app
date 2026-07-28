/* LANE-RECORDS data wrappers (module mod.horserecords).
 *
 * Thin, typed Supabase calls for the horse-records UI slices:
 *   - horse_relationships  (Stage 1i survivor, 20260728060000) — ownership/
 *     rights ledger: owner/lessee/trainer/caretaker/boarder + share_pct +
 *     term dates. NEVER hard-deleted (DB REVOKEs DELETE) — rows END
 *     (active=false, ended_at) via the staff RPCs; writes go through
 *     staff_assign_horse_party / staff_end_horse_relationship, never direct
 *     table access.
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

/** UI view of a horse_relationships row (lowercase role, effective_* naming
 *  kept so the ledger page reads unchanged; mapped from relationship /
 *  term_start / term_end / ended_at). */
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
    .order('nickname', { nullsFirst: false });
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

// ─── horse_relationships — ownership/rights ledger (Stage 1i survivor) ───────

interface HorseRelationshipRow {
  id: string;
  org_id: string;
  horse_id: string;
  relationship: string;
  party_contact_id: string | null;
  term_start: string | null;
  term_end: string | null;
  share_pct: number | null;
  notes: string | null;
  active: boolean;
  created_at: string;
  ended_at: string | null;
}

function toHorseParty(r: HorseRelationshipRow): HorseParty {
  return {
    id: r.id,
    org_id: r.org_id,
    horse_id: r.horse_id,
    contact_id: r.party_contact_id ?? '',
    role: r.relationship.toLowerCase() as HorsePartyRole,
    share_pct: r.share_pct,
    effective_from: r.term_start,
    effective_to: r.term_end,
    notes: r.notes,
    created_at: r.created_at,
    updated_at: r.created_at,
    deleted_at: r.ended_at,
  };
}

/** Active relationship rows for one horse, oldest term first (RLS-read). */
export async function listHorseParties(horseId: string): Promise<HorseParty[]> {
  const { data, error } = await supabase
    .from('horse_relationships')
    .select('*')
    .eq('horse_id', horseId)
    .eq('active', true)
    .order('term_start', { ascending: true, nullsFirst: true })
    .order('created_at', { ascending: true });
  if (error) throw error;
  return ((data ?? []) as HorseRelationshipRow[]).map(toHorseParty);
}

/** Writes go through the staff RPC — never direct table access. */
export async function createHorseParty(input: HorsePartyInput): Promise<void> {
  const { error } = await supabase.rpc('staff_assign_horse_party', {
    p_horse_id: input.horse_id,
    p_role: input.role.toUpperCase(),
    p_contact_id: input.contact_id,
    p_term_start: input.effective_from ?? null,
    p_term_end: input.effective_to ?? null,
    p_share_pct: input.share_pct ?? null,
    p_notes: input.notes ?? null,
  });
  if (error) throw error;
}

/** Ledger edit = end the old row, record the new one (history preserved). */
export async function updateHorseParty(id: string, patch: HorsePartyInput): Promise<void> {
  await archiveHorseParty(id);
  await createHorseParty(patch);
}

/** The ledger is NEVER hard-deleted — rows END (active=false, ended_at). */
export async function archiveHorseParty(id: string): Promise<void> {
  const { error } = await supabase.rpc('staff_end_horse_relationship', { p_id: id });
  if (error) throw error;
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
