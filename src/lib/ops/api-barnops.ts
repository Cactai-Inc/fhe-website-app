/**
 * LANE-4 data wrappers — Barn ops / inventory (mod.barnops).
 *
 * Thin, RLS-trusting wrappers over the real tables/RPC created by migration
 * 20260630100000_mod_barnops.sql:
 *   resources, resource_lots, consumption_events (APPEND-ONLY — no update/
 *   delete wrapper exists here BY DESIGN; the DB REVOKEs UPDATE/DELETE),
 *   cost_allocation_rules, and the deterministic resolver RPC
 *   resolve_consumption_billing(p_period tstzrange) → integer (lines emitted).
 *
 * The resolver writes billable_lines (source_kind='consumption'); the UI shows
 * what a run produced via listConsumptionBillableLines(period).
 *
 * Org scoping + the mod.barnops module gate are enforced server-side (RLS
 * seams 1–3); these wrappers never filter by org.
 */
import { supabase } from '../supabase';
import type { BillableLine } from './types';

// ─── Row / input shapes (mirror the migration exactly) ─────────────────────

export type ResourceCategory = 'feed' | 'med' | 'bedding' | 'supply' | 'equipment';

export const RESOURCE_CATEGORIES: ResourceCategory[] = [
  'feed',
  'med',
  'bedding',
  'supply',
  'equipment',
];

export interface Resource {
  id: string;
  org_id: string;
  resource_key: string;
  name: string;
  category: ResourceCategory;
  unit_of_measure: string;
  is_consumable: boolean;
  created_at: string;
  updated_at: string;
}

export interface ResourceInput {
  resource_key: string;
  name: string;
  category: ResourceCategory;
  unit_of_measure?: string;
  is_consumable?: boolean;
}

export interface ResourceLot {
  id: string;
  org_id: string;
  resource_id: string;
  vendor_contact_id: string | null;
  qty_purchased: number;
  unit_cost: number;
  on_hand: number;
  purchased_at: string;
  created_at: string;
  updated_at: string;
}

export interface ResourceLotInput {
  resource_id: string;
  vendor_contact_id?: string | null;
  qty_purchased: number;
  unit_cost: number;
  /** Defaults to qty_purchased (a fresh lot is fully on hand). */
  on_hand?: number;
}

export interface ConsumptionEvent {
  id: string;
  org_id: string;
  resource_id: string;
  resource_lot_id: string | null;
  horse_id: string | null;
  qty: number;
  administered_by: string | null;
  occurred_at: string;
  notes: string | null;
  created_at: string;
}

export interface ConsumptionEventInput {
  resource_id: string;
  resource_lot_id?: string | null;
  horse_id?: string | null;
  qty: number;
  /** ISO timestamp; the DB defaults to now() when omitted. */
  occurred_at?: string;
  notes?: string | null;
}

export type AllocationScope = 'horse' | 'lease' | 'board' | 'default';

export const ALLOCATION_SCOPES: AllocationScope[] = ['horse', 'lease', 'board', 'default'];

export interface CostAllocationRule {
  id: string;
  org_id: string;
  scope: AllocationScope;
  scope_id: string | null;
  payer_contact_id: string;
  share_pct: number;
  effective_from: string | null;
  effective_to: string | null;
  created_at: string;
  updated_at: string;
}

export interface CostAllocationRuleInput {
  scope: AllocationScope;
  scope_id?: string | null;
  payer_contact_id: string;
  share_pct?: number;
  effective_from?: string | null;
  effective_to?: string | null;
}

/** Slim contact option for payer/vendor selects (contacts is a core table). */
export interface ContactOption {
  id: string;
  display_code: string | null;
  first_name: string | null;
  last_name: string | null;
}

/** Slim horse option for horse selects (horses is a core table). */
export interface HorseOption {
  id: string;
  display_code: string | null;
  barn_name: string | null;
  registered_name: string | null;
}

// ─── resources ──────────────────────────────────────────────────────────────

export async function listResources(): Promise<Resource[]> {
  const { data, error } = await supabase
    .from('resources')
    .select('*')
    .is('deleted_at', null)
    .order('name');
  if (error) throw error;
  return (data ?? []) as Resource[];
}

export async function createResource(input: ResourceInput): Promise<Resource> {
  const { data, error } = await supabase
    .from('resources')
    .insert({
      resource_key: input.resource_key,
      name: input.name,
      category: input.category,
      unit_of_measure: input.unit_of_measure ?? 'unit',
      is_consumable: input.is_consumable ?? true,
    })
    .select('*')
    .single();
  if (error) throw error;
  return data as Resource;
}

export async function updateResource(
  id: string,
  input: Partial<ResourceInput>,
): Promise<Resource> {
  const { data, error } = await supabase
    .from('resources')
    .update(input)
    .eq('id', id)
    .select('*')
    .single();
  if (error) throw error;
  return data as Resource;
}

// ─── resource_lots ──────────────────────────────────────────────────────────

export async function listResourceLots(resourceId?: string): Promise<ResourceLot[]> {
  let query = supabase.from('resource_lots').select('*').is('deleted_at', null);
  if (resourceId) query = query.eq('resource_id', resourceId);
  const { data, error } = await query.order('purchased_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as ResourceLot[];
}

export async function createResourceLot(input: ResourceLotInput): Promise<ResourceLot> {
  const { data, error } = await supabase
    .from('resource_lots')
    .insert({
      resource_id: input.resource_id,
      vendor_contact_id: input.vendor_contact_id ?? null,
      qty_purchased: input.qty_purchased,
      unit_cost: input.unit_cost,
      on_hand: input.on_hand ?? input.qty_purchased,
    })
    .select('*')
    .single();
  if (error) throw error;
  return data as ResourceLot;
}

export async function updateResourceLot(
  id: string,
  input: Partial<Pick<ResourceLot, 'on_hand' | 'unit_cost' | 'vendor_contact_id'>>,
): Promise<ResourceLot> {
  const { data, error } = await supabase
    .from('resource_lots')
    .update(input)
    .eq('id', id)
    .select('*')
    .single();
  if (error) throw error;
  return data as ResourceLot;
}

// ─── consumption_events — APPEND-ONLY ───────────────────────────────────────
// The DB REVOKEs UPDATE/DELETE for everyone: a logged fact is immutable and
// corrections are new offsetting events. Deliberately NO update/delete wrapper.

export async function listConsumptionEvents(limit = 50): Promise<ConsumptionEvent[]> {
  const { data, error } = await supabase
    .from('consumption_events')
    .select('*')
    .is('deleted_at', null)
    .order('occurred_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as ConsumptionEvent[];
}

export async function createConsumptionEvent(
  input: ConsumptionEventInput,
): Promise<ConsumptionEvent> {
  const row: Record<string, unknown> = {
    resource_id: input.resource_id,
    resource_lot_id: input.resource_lot_id ?? null,
    horse_id: input.horse_id ?? null,
    qty: input.qty,
    notes: input.notes ?? null,
  };
  if (input.occurred_at) row.occurred_at = input.occurred_at;
  const { data, error } = await supabase
    .from('consumption_events')
    .insert(row)
    .select('*')
    .single();
  if (error) throw error;
  return data as ConsumptionEvent;
}

// ─── cost_allocation_rules ──────────────────────────────────────────────────

export async function listCostAllocationRules(): Promise<CostAllocationRule[]> {
  const { data, error } = await supabase
    .from('cost_allocation_rules')
    .select('*')
    .is('deleted_at', null)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as CostAllocationRule[];
}

export async function createCostAllocationRule(
  input: CostAllocationRuleInput,
): Promise<CostAllocationRule> {
  const { data, error } = await supabase
    .from('cost_allocation_rules')
    .insert({
      scope: input.scope,
      scope_id: input.scope_id ?? null,
      payer_contact_id: input.payer_contact_id,
      share_pct: input.share_pct ?? 100,
      effective_from: input.effective_from ?? null,
      effective_to: input.effective_to ?? null,
    })
    .select('*')
    .single();
  if (error) throw error;
  return data as CostAllocationRule;
}

export async function updateCostAllocationRule(
  id: string,
  input: Partial<CostAllocationRuleInput>,
): Promise<CostAllocationRule> {
  const { data, error } = await supabase
    .from('cost_allocation_rules')
    .update(input)
    .eq('id', id)
    .select('*')
    .single();
  if (error) throw error;
  return data as CostAllocationRule;
}

/** Soft-delete (deleted_at) — the migration's delete discipline for rules. */
export async function deleteCostAllocationRule(id: string): Promise<void> {
  const { error } = await supabase
    .from('cost_allocation_rules')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id);
  if (error) throw error;
}

// ─── resolve_consumption_billing — the deterministic resolver RPC ──────────

/**
 * Calls the SECURITY-DEFINER resolver: (events × allocation) → billable_lines
 * for the period. Idempotent server-side (re-run replaces its own OPEN
 * consumption lines for the period). Returns the number of lines emitted.
 * @param period a tstzrange literal, e.g. `[2026-06-01 00:00:00+00,2026-07-01 00:00:00+00)`
 */
export async function resolveConsumptionBilling(period: string): Promise<number> {
  const { data, error } = await supabase.rpc('resolve_consumption_billing', {
    p_period: period,
  });
  if (error) throw error;
  return (data as number | null) ?? 0;
}

/** The billable_lines a resolver run produced for the period (range equality). */
export async function listConsumptionBillableLines(period: string): Promise<BillableLine[]> {
  const { data, error } = await supabase
    .from('billable_lines')
    .select('*')
    .eq('source_kind', 'consumption')
    .eq('period', period)
    .is('deleted_at', null)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return (data ?? []) as BillableLine[];
}

// ─── shared select options (core tables, RLS-scoped) ───────────────────────

export async function listContactOptions(): Promise<ContactOption[]> {
  const { data, error } = await supabase
    .from('contacts')
    .select('id, display_code, first_name, last_name')
    .is('deleted_at', null)
    .order('first_name')
    .order('last_name');
  if (error) throw error;
  return (data ?? []) as ContactOption[];
}

export async function listHorseOptions(): Promise<HorseOption[]> {
  const { data, error } = await supabase
    .from('horses')
    .select('id, display_code, barn_name, registered_name')
    .is('deleted_at', null)
    .order('barn_name', { nullsFirst: false });
  if (error) throw error;
  return (data ?? []) as HorseOption[];
}

// ─── period helper ──────────────────────────────────────────────────────────

/**
 * 'YYYY-MM' (an <input type="month"> value) → the month's tstzrange literal,
 * `[YYYY-MM-01 00:00:00+00,<next month>-01 00:00:00+00)` — the exact shape the
 * resolver's p_period expects (and the db tests use).
 */
export function monthToPeriod(yearMonth: string): string {
  const match = /^(\d{4})-(\d{2})$/.exec(yearMonth);
  if (!match) throw new Error(`Invalid month value: ${yearMonth}`);
  const year = Number(match[1]);
  const month = Number(match[2]);
  if (month < 1 || month > 12) throw new Error(`Invalid month value: ${yearMonth}`);
  const nextYear = month === 12 ? year + 1 : year;
  const nextMonth = month === 12 ? 1 : month + 1;
  const pad = (n: number) => String(n).padStart(2, '0');
  return `[${year}-${pad(month)}-01 00:00:00+00,${nextYear}-${pad(nextMonth)}-01 00:00:00+00)`;
}
