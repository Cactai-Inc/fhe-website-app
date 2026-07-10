/* My Stable + shared vendors — CLIENT DATA CONTRACT (UI workstream).
 * These are the client-side functions the Account UI calls. The tables, columns,
 * RLS, and any RPCs behind them are owned by Claude Code (backend lane); the names
 * here describe what the UI expects to exist. If the backend uses different
 * names/shapes, reconcile here so the UI keeps calling a stable surface. Member reads/
 * writes are RLS-scoped server-side; this file assumes that enforcement, it does not
 * implement it. */
import { supabase } from './supabase';

async function uid(): Promise<string> {
  const { data } = await supabase.auth.getUser();
  const id = data?.user?.id;
  if (!id) throw new Error('not signed in');
  return id;
}
async function orgId(): Promise<string | null> {
  const { data } = await supabase.rpc('current_org');
  return (data as string) ?? null;
}

export type StableOwnership = 'owned' | 'leased';
export type StableItemKind = 'gear' | 'supply';

export interface StableHorse {
  id: string;
  name: string;
  barn_name: string | null;
  breed: string | null;
  sex: string | null;
  height_hh: string | null;
  age_or_foaling: string | null;
  color: string | null;
  discipline: string | null;
  markings: string | null;
  photo_url: string | null;
  ownership: StableOwnership;
  location: string;
}

export interface Vendor {
  id: string;
  name: string;
  category: string | null;
  url: string | null;
  phone: string | null;
  email: string | null;
  note: string | null;
  shared: boolean;
}

export interface StableItem {
  id: string;
  kind: StableItemKind;
  name: string;
  detail: string | null;
  vendor_id: string | null;
  vendor?: Vendor | null;
}

// ── Horses ─────────────────────────────────────────────────────
// REPOINTED (HANDOFF-horse-records.md): horses live on the EXISTING horse-records
// table (`horses` + `horse_parties`), owned by the agreements thread. These functions
// keep the UI's stable surface but resolve to member-scoped SECURITY DEFINER RPCs
// (my_stable_horses / my_stable_add_horse / …). "My stable" = horses where the member
// is the current owner contact or holds an active party row. Fields the record
// doesn't carry yet (discipline/markings/photo) map to null until Update A extends it.

/** Raw row shape returned by the my_stable_horses() RPC (the real record columns). */
interface StableHorseRow {
  id: string;
  registered_name: string | null;
  barn_name: string | null;
  breed: string | null;
  sex: string | null;
  height: string | null;
  date_of_birth: string | null;
  color: string | null;
  current_location: string | null;
  is_owner: boolean;
}

function toStableHorse(r: StableHorseRow): StableHorse {
  return {
    id: r.id,
    name: r.barn_name || r.registered_name || 'Horse',
    barn_name: r.barn_name,
    breed: r.breed,
    sex: r.sex,
    height_hh: r.height,
    age_or_foaling: r.date_of_birth,
    color: r.color,
    discipline: null,   // not on the record yet (Update A extends the schema)
    markings: null,
    photo_url: null,
    ownership: r.is_owner ? 'owned' : 'leased',
    location: r.current_location ?? 'Carmel Creek Ranch',
  };
}

export async function listStableHorses(): Promise<StableHorse[]> {
  const { data, error } = await supabase.rpc('my_stable_horses');
  if (error) throw error;
  return ((data ?? []) as StableHorseRow[]).map(toStableHorse);
}

export async function addStableHorse(input: Partial<StableHorse> & { name: string }): Promise<string> {
  const { data, error } = await supabase.rpc('my_stable_add_horse', {
    p_name: input.name,
    p_barn_name: input.barn_name ?? null,
    p_breed: input.breed ?? null,
    p_sex: input.sex ?? null,
    p_height: input.height_hh ?? null,
    p_dob: input.age_or_foaling ?? null,   // date string or null
    p_color: input.color ?? null,
    p_location: input.location ?? null,
    p_notes: [input.discipline, input.markings].filter(Boolean).join(' · ') || null,
  });
  if (error) throw error;
  return data as string;
}

export async function updateStableHorse(id: string, patch: Partial<StableHorse>): Promise<void> {
  const { error } = await supabase.rpc('my_stable_update_horse', {
    p_id: id,
    p_barn_name: patch.barn_name ?? null,
    p_breed: patch.breed ?? null,
    p_sex: patch.sex ?? null,
    p_height: patch.height_hh ?? null,
    p_color: patch.color ?? null,
    p_location: patch.location ?? null,
  });
  if (error) throw error;
}
export async function deleteStableHorse(id: string): Promise<void> {
  const { error } = await supabase.rpc('my_stable_delete_horse', { p_id: id });
  if (error) throw error;
}

// ── Vendors (shared directory) ─────────────────────────────────
export async function listVendors(sharedOnly = false): Promise<Vendor[]> {
  let q = supabase.from('vendors').select('*').order('name', { ascending: true });
  if (sharedOnly) q = q.eq('shared', true);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as Vendor[];
}

/** Add a vendor. `share=true` lists it in the community Resources directory. */
export async function addVendor(input: Partial<Vendor> & { name: string; share?: boolean }): Promise<string> {
  const [created_by, org_id] = await Promise.all([uid(), orgId()]);
  const { data, error } = await supabase
    .from('vendors')
    .insert({
      created_by, org_id,
      name: input.name,
      category: input.category ?? null,
      url: input.url ?? null,
      phone: input.phone ?? null,
      email: input.email ?? null,
      note: input.note ?? null,
      shared: input.share ?? false,
    })
    .select('id').single();
  if (error) throw error;
  return data.id as string;
}

// ── Gear + supplies ────────────────────────────────────────────
export async function listStableItems(kind: StableItemKind): Promise<StableItem[]> {
  const { data, error } = await supabase
    .from('stable_items')
    .select('*, vendor:vendors(*)')
    .eq('kind', kind)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return (data ?? []) as StableItem[];
}

export async function addStableItem(
  kind: StableItemKind,
  input: { name: string; detail?: string | null; vendor_id?: string | null },
): Promise<string> {
  const [user_id, org_id] = await Promise.all([uid(), orgId()]);
  const { data, error } = await supabase
    .from('stable_items')
    .insert({ user_id, org_id, kind, name: input.name, detail: input.detail ?? null, vendor_id: input.vendor_id ?? null })
    .select('id').single();
  if (error) throw error;
  return data.id as string;
}

export async function deleteStableItem(id: string): Promise<void> {
  const { error } = await supabase.from('stable_items').delete().eq('id', id);
  if (error) throw error;
}
