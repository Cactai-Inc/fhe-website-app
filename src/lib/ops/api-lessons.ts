/* Lane-5 data wrappers — Lessons module (mod.lessons).
 *
 * Thin, typed seams over supabase for the two mod.lessons tables
 * (supabase/migrations/20260630070000_mod_lessons.sql):
 *   lesson_packages — purchasable packs: (package_key, name, price_value_key,
 *                     credits, active). price_value_key is a config_value()
 *                     registry key (ns 'PRICING'), NEVER a literal price.
 *   lesson_credits  — per-client balances: (client_id → clients.id, package_key,
 *                     credits_total, credits_remaining, purchased_at).
 *
 * RLS is the authoritative fence (org boundary + has_module('mod.lessons') +
 * staff access); these wrappers stay thin and throw on error. NOTE: the schema
 * has NO bookings⇄credits linkage and no consume RPC — consumption is a staff
 * decrement of credits_remaining (optimistic-concurrency-guarded below).
 */
import { supabase } from '../supabase';

// ─── Types (real columns of the mod.lessons tables) ─────────────────────────

export interface LessonPackage {
  id: string;
  org_id: string;
  package_key: string;
  name: string;
  /** config_value() registry key (e.g. PRICING/PKG_10_PRICE) — never a literal. */
  price_value_key: string | null;
  credits: number;
  active: boolean;
  created_at: string;
  updated_at: string;
}

export interface LessonPackageInput {
  package_key: string;
  name: string;
  price_value_key?: string | null;
  credits?: number;
}

export interface LessonCredit {
  id: string;
  org_id: string;
  client_id: string;
  package_key: string | null;
  credits_total: number;
  credits_remaining: number;
  purchased_at: string;
  created_at: string;
  updated_at: string;
}

export interface LessonCreditInput {
  client_id: string;
  package_key?: string | null;
  credits_total: number;
  /** Defaults to credits_total (a fresh grant starts unspent). */
  credits_remaining?: number;
}

/** A client option for the grant form / ledger display: the clients row with
 *  its contact's name flattened (clients.contact_id → contacts). */
export interface LessonClientOption {
  id: string;
  display_code: string | null;
  full_name: string;
  email: string | null;
}

/** Hub KPIs computed from the two module tables. */
export interface LessonsSummary {
  activePackages: number;
  creditsOutstanding: number;
  clientsWithCredits: number;
}

// ─── lesson_packages ─────────────────────────────────────────────────────────

/** All in-tenant lesson packages (RLS: org + module gate), soft-deleted excluded. */
export async function listLessonPackages(): Promise<LessonPackage[]> {
  const { data, error } = await supabase
    .from('lesson_packages')
    .select('*')
    .is('deleted_at', null)
    .order('name');
  if (error) throw error;
  return (data ?? []) as LessonPackage[];
}

export async function createLessonPackage(input: LessonPackageInput): Promise<LessonPackage> {
  const { data, error } = await supabase
    .from('lesson_packages')
    .insert({
      package_key: input.package_key,
      name: input.name,
      price_value_key: input.price_value_key ?? null,
      credits: input.credits ?? 0,
    })
    .select('*')
    .single();
  if (error) throw error;
  return data as LessonPackage;
}

export async function updateLessonPackage(
  id: string,
  patch: Partial<LessonPackageInput> & { active?: boolean },
): Promise<LessonPackage> {
  const { data, error } = await supabase
    .from('lesson_packages')
    .update(patch)
    .eq('id', id)
    .select('*')
    .single();
  if (error) throw error;
  return data as LessonPackage;
}

/** Resolve a package's price THROUGH the registry (config_value on
 *  price_value_key, ns 'PRICING') — the one pricing seam; never a literal. */
export async function lessonPackagePrice(priceValueKey: string): Promise<number | null> {
  const { data, error } = await supabase.rpc('config_value', {
    p_ns: 'PRICING',
    p_key: priceValueKey,
  });
  if (error) throw error;
  const num = data === null || data === undefined ? NaN : Number(data);
  return Number.isFinite(num) ? num : null;
}

// ─── lesson_credits ──────────────────────────────────────────────────────────

/** The credits ledger (newest purchase first), optionally scoped to one client. */
export async function listLessonCredits(clientId?: string): Promise<LessonCredit[]> {
  let query = supabase.from('lesson_credits').select('*').is('deleted_at', null);
  if (clientId) query = query.eq('client_id', clientId);
  const { data, error } = await query.order('purchased_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as LessonCredit[];
}

/** Grant credits (a package purchase landing on the ledger). */
export async function createLessonCredit(input: LessonCreditInput): Promise<LessonCredit> {
  const { data, error } = await supabase
    .from('lesson_credits')
    .insert({
      client_id: input.client_id,
      package_key: input.package_key ?? null,
      credits_total: input.credits_total,
      credits_remaining: input.credits_remaining ?? input.credits_total,
    })
    .select('*')
    .single();
  if (error) throw error;
  return data as LessonCredit;
}

/** Consume `count` credits from a ledger row (a lesson taught). Read-modify-write
 *  with an optimistic guard on the previous remaining value, so two concurrent
 *  consumes cannot double-spend the same credit. The schema has no bookings
 *  linkage/consume RPC — this staff decrement IS the real consumption path. */
export async function consumeLessonCredit(id: string, count = 1): Promise<LessonCredit> {
  const { data: row, error: readError } = await supabase
    .from('lesson_credits')
    .select('*')
    .eq('id', id)
    .single();
  if (readError) throw readError;
  const current = (row as LessonCredit).credits_remaining;
  if (current < count) throw new Error('No credits remaining on this grant.');

  const { data, error } = await supabase
    .from('lesson_credits')
    .update({ credits_remaining: current - count })
    .eq('id', id)
    .eq('credits_remaining', current) // optimistic guard: fail (0 rows) on a race
    .select('*')
    .single();
  if (error) throw error;
  return data as LessonCredit;
}

// ─── Clients (for the grant form / ledger names) ─────────────────────────────

/** In-tenant clients with their contact name flattened (clients.contact_id →
 *  contacts), for the grant-credits picker and ledger display. */
export async function listLessonClients(): Promise<LessonClientOption[]> {
  const { data, error } = await supabase
    .from('clients')
    .select('id, display_code, contact:contacts(full_name, email)')
    .is('deleted_at', null)
    .order('created_at', { ascending: false });
  if (error) throw error;
  type Row = {
    id: string;
    display_code: string | null;
    contact: { full_name: string; email: string | null } | null;
  };
  return ((data ?? []) as unknown as Row[]).map((r) => ({
    id: r.id,
    display_code: r.display_code,
    full_name: r.contact?.full_name ?? r.display_code ?? r.id.slice(0, 8),
    email: r.contact?.email ?? null,
  }));
}

// ─── Hub summary ─────────────────────────────────────────────────────────────

/** Credits-outstanding KPI + package/client counts for the Lessons hub. */
export async function lessonsSummary(): Promise<LessonsSummary> {
  const [pkgRes, creditRes] = await Promise.all([
    supabase.from('lesson_packages').select('id, active').is('deleted_at', null),
    supabase.from('lesson_credits').select('client_id, credits_remaining').is('deleted_at', null),
  ]);
  if (pkgRes.error) throw pkgRes.error;
  if (creditRes.error) throw creditRes.error;

  const packages = (pkgRes.data ?? []) as { id: string; active: boolean }[];
  const credits = (creditRes.data ?? []) as { client_id: string; credits_remaining: number }[];
  return {
    activePackages: packages.filter((p) => p.active).length,
    creditsOutstanding: credits.reduce((sum, c) => sum + (Number(c.credits_remaining) || 0), 0),
    clientsWithCredits: new Set(credits.filter((c) => c.credits_remaining > 0).map((c) => c.client_id)).size,
  };
}
