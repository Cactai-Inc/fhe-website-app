/**
 * INT-API-BOARDING — data wrappers for mod.boarding (U10).
 *
 * Tables (supabase/migrations/20260630090000_mod_boarding.sql):
 *   facilities / stalls / board_agreements / board_charges
 * plus the billable_lines emission (source_kind='board',
 * 20260630040000_products_billing.sql §7.2/§7.11): a board charge is
 * deterministic (rate × period) and EMITS one billable_line so board billing
 * flows through the one universal charge primitive and settles via
 * settle_billable_lines → an INVOICE transaction (/app/ops/transactions/:id).
 *
 * RLS enforces org boundary + module gate (mod.boarding) + staff access
 * server-side; these wrappers only shape the calls.
 */
import { supabase } from '../supabase';

// ─── Row shapes (mirror the migration; joins are the embedded selects) ───────

export interface Facility {
  id: string;
  org_id: string;
  name: string;
  /** Registry key (CONTACT/ADDRESS.*) resolving the facility address. */
  address_value_key: string | null;
  created_at: string;
  updated_at: string;
}

export interface FacilityInput {
  name: string;
  address_value_key?: string | null;
}

export interface Stall {
  id: string;
  org_id: string;
  facility_id: string;
  code: string;
  stall_type: string | null;
  active: boolean;
  created_at: string;
  updated_at: string;
  /** Joined parent facility (listStalls). */
  facility?: Pick<Facility, 'id' | 'name'> | null;
}

export interface StallInput {
  facility_id: string;
  code: string;
  stall_type?: string | null;
  active?: boolean;
}

export type BoardAgreementStatus = 'ACTIVE' | 'ENDED' | 'SUSPENDED' | 'CANCELLED';

export interface BoardAgreement {
  id: string;
  org_id: string;
  horse_id: string;
  stall_id: string | null;
  boarder_contact_id: string;
  /** NULL when neither an explicit rate nor the tenant's registry default exists. */
  board_rate: number | null;
  board_type: string | null;
  start_date: string | null;
  end_date: string | null;
  status: BoardAgreementStatus;
  created_at: string;
  updated_at: string;
  /** Joined children (listBoardAgreements / create / status updates). */
  horse?: { id: string; barn_name: string | null; registered_name: string | null } | null;
  boarder?: { id: string; full_name: string } | null;
  stall?: { id: string; code: string } | null;
}

export interface BoardAgreementInput {
  horse_id: string;
  boarder_contact_id: string;
  stall_id?: string | null;
  /**
   * Monthly rate. Pass null/undefined to OMIT the column so the DB default
   * config_value('BOARDING','DEFAULT_BOARD_RATE') applies (§7.5 —
   * global-value-changes-rule-the-day).
   */
  board_rate?: number | null;
  board_type?: string | null;
  start_date?: string | null;
  end_date?: string | null;
}

export interface BoardChargeLine {
  id: string;
  status: 'OPEN' | 'SETTLED' | 'VOID';
  transaction_id: string | null;
}

export interface BoardCharge {
  id: string;
  org_id: string;
  board_agreement_id: string;
  period_start: string;
  period_end: string;
  amount: number;
  billable_line_id: string | null;
  created_at: string;
  updated_at: string;
  /** Joined owning agreement (listBoardCharges). */
  agreement?: {
    id: string;
    boarder_contact_id: string;
    horse_id: string;
    horse?: { id: string; barn_name: string | null; registered_name: string | null } | null;
    boarder?: { id: string; full_name: string } | null;
  } | null;
  /** Joined emitted billable_line — settlement state lives here. */
  billable_line?: BoardChargeLine | null;
}

export interface BoardChargeInput {
  board_agreement_id: string;
  /** The agreement's boarder — the payer the billable_line lands on. */
  payer_contact_id: string;
  horse_id: string | null;
  period_start: string;
  period_end: string;
  amount: number;
}

export interface BoardingKpis {
  /** Active (non-deleted, active=true) stalls. */
  totalStalls: number;
  /** Distinct stalls held by an ACTIVE agreement. */
  occupiedStalls: number;
  activeAgreements: number;
  /** OPEN board billable_lines: count + amount total awaiting settlement. */
  openChargeCount: number;
  openChargeTotal: number;
}

const AGREEMENT_SELECT =
  '*, horse:horses(id, barn_name, registered_name), boarder:contacts(id, full_name), stall:stalls(id, code)';

const CHARGE_SELECT =
  '*, agreement:board_agreements(id, boarder_contact_id, horse_id, horse:horses(id, barn_name, registered_name), boarder:contacts(id, full_name)), billable_line:billable_lines(id, status, transaction_id)';

// ─── Facilities ──────────────────────────────────────────────────────────────

export async function listFacilities(): Promise<Facility[]> {
  const { data, error } = await supabase
    .from('facilities')
    .select('*')
    .is('deleted_at', null)
    .order('name');
  if (error) throw error;
  return (data ?? []) as Facility[];
}

export async function createFacility(input: FacilityInput): Promise<Facility> {
  const { data, error } = await supabase
    .from('facilities')
    .insert({ name: input.name, address_value_key: input.address_value_key ?? null })
    .select('*')
    .single();
  if (error) throw error;
  return data as Facility;
}

export async function updateFacility(id: string, input: FacilityInput): Promise<Facility> {
  const { data, error } = await supabase
    .from('facilities')
    .update({ name: input.name, address_value_key: input.address_value_key ?? null })
    .eq('id', id)
    .select('*')
    .single();
  if (error) throw error;
  return data as Facility;
}

// ─── Stalls ──────────────────────────────────────────────────────────────────

export async function listStalls(): Promise<Stall[]> {
  const { data, error } = await supabase
    .from('stalls')
    .select('*, facility:facilities(id, name)')
    .is('deleted_at', null)
    .order('code');
  if (error) throw error;
  return (data ?? []) as Stall[];
}

export async function createStall(input: StallInput): Promise<Stall> {
  const { data, error } = await supabase
    .from('stalls')
    .insert({
      facility_id: input.facility_id,
      code: input.code,
      stall_type: input.stall_type ?? null,
      active: input.active ?? true,
    })
    .select('*, facility:facilities(id, name)')
    .single();
  if (error) throw error;
  return data as Stall;
}

export async function updateStall(id: string, input: StallInput): Promise<Stall> {
  const { data, error } = await supabase
    .from('stalls')
    .update({
      facility_id: input.facility_id,
      code: input.code,
      stall_type: input.stall_type ?? null,
      active: input.active ?? true,
    })
    .eq('id', id)
    .select('*, facility:facilities(id, name)')
    .single();
  if (error) throw error;
  return data as Stall;
}

// ─── Board agreements ────────────────────────────────────────────────────────

export async function listBoardAgreements(): Promise<BoardAgreement[]> {
  const { data, error } = await supabase
    .from('board_agreements')
    .select(AGREEMENT_SELECT)
    .is('deleted_at', null)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as BoardAgreement[];
}

export async function createBoardAgreement(
  input: BoardAgreementInput,
): Promise<BoardAgreement> {
  const payload: Record<string, unknown> = {
    horse_id: input.horse_id,
    boarder_contact_id: input.boarder_contact_id,
    stall_id: input.stall_id ?? null,
    board_type: input.board_type ?? null,
    start_date: input.start_date ?? null,
    end_date: input.end_date ?? null,
  };
  // Only send board_rate when explicitly set — omitting the column lets the DB
  // default (registry DEFAULT_BOARD_RATE) resolve for this tenant.
  if (input.board_rate !== null && input.board_rate !== undefined) {
    payload.board_rate = input.board_rate;
  }
  const { data, error } = await supabase
    .from('board_agreements')
    .insert(payload)
    .select(AGREEMENT_SELECT)
    .single();
  if (error) throw error;
  return data as BoardAgreement;
}

/** Status transition (ACTIVE / SUSPENDED / ENDED / CANCELLED). Hard delete is
 *  revoked in the DB — status + soft-delete are the only removal mechanisms. */
export async function updateBoardAgreementStatus(
  id: string,
  status: BoardAgreementStatus,
): Promise<BoardAgreement> {
  const { data, error } = await supabase
    .from('board_agreements')
    .update({ status })
    .eq('id', id)
    .select(AGREEMENT_SELECT)
    .single();
  if (error) throw error;
  return data as BoardAgreement;
}

// ─── Board charges (emit into billable_lines) ────────────────────────────────

export async function listBoardCharges(): Promise<BoardCharge[]> {
  const { data, error } = await supabase
    .from('board_charges')
    .select(CHARGE_SELECT)
    .is('deleted_at', null)
    .order('period_start', { ascending: false });
  if (error) throw error;
  return (data ?? []) as BoardCharge[];
}

/**
 * Emit an existing (un-billed) charge into billable_lines: inserts the
 * source_kind='board' line for the agreement's boarder, then stamps
 * board_charges.billable_line_id. Used by createBoardCharge and as the retry
 * for a charge whose emission previously failed.
 */
export async function emitBoardCharge(
  charge: Pick<BoardCharge, 'id' | 'period_start' | 'period_end' | 'amount'>,
  payerContactId: string,
  horseId: string | null,
): Promise<BoardCharge> {
  const { data: line, error: lineError } = await supabase
    .from('billable_lines')
    .insert({
      payer_contact_id: payerContactId,
      source_kind: 'board',
      source_id: charge.id,
      horse_id: horseId,
      qty: 1,
      unit_amount: charge.amount,
      amount: charge.amount,
      period: `[${charge.period_start},${charge.period_end}]`,
    })
    .select('id, status, transaction_id')
    .single();
  if (lineError) throw lineError;

  const { data, error } = await supabase
    .from('board_charges')
    .update({ billable_line_id: (line as BoardChargeLine).id })
    .eq('id', charge.id)
    .select(CHARGE_SELECT)
    .single();
  if (error) throw error;
  return data as BoardCharge;
}

/**
 * Generate a period charge for an agreement (rate × period), then emit it into
 * billable_lines so it can settle via settle_billable_lines → an INVOICE
 * transaction on /app/ops/transactions.
 */
export async function createBoardCharge(input: BoardChargeInput): Promise<BoardCharge> {
  const { data: charge, error } = await supabase
    .from('board_charges')
    .insert({
      board_agreement_id: input.board_agreement_id,
      period_start: input.period_start,
      period_end: input.period_end,
      amount: input.amount,
    })
    .select('*')
    .single();
  if (error) throw error;
  return emitBoardCharge(
    charge as BoardCharge,
    input.payer_contact_id,
    input.horse_id,
  );
}

// ─── Hub KPIs ────────────────────────────────────────────────────────────────

export async function getBoardingKpis(): Promise<BoardingKpis> {
  const [stallsRes, agreementsRes, linesRes] = await Promise.all([
    supabase.from('stalls').select('id').eq('active', true).is('deleted_at', null),
    supabase
      .from('board_agreements')
      .select('id, stall_id, status')
      .is('deleted_at', null),
    supabase
      .from('billable_lines')
      .select('amount')
      .eq('source_kind', 'board')
      .eq('status', 'OPEN')
      .is('deleted_at', null),
  ]);
  if (stallsRes.error) throw stallsRes.error;
  if (agreementsRes.error) throw agreementsRes.error;
  if (linesRes.error) throw linesRes.error;

  const agreements = (agreementsRes.data ?? []) as {
    id: string;
    stall_id: string | null;
    status: BoardAgreementStatus;
  }[];
  const active = agreements.filter((a) => a.status === 'ACTIVE');
  const occupied = new Set(
    active.map((a) => a.stall_id).filter((s): s is string => s !== null),
  );
  const lines = (linesRes.data ?? []) as { amount: number }[];

  return {
    totalStalls: (stallsRes.data ?? []).length,
    occupiedStalls: occupied.size,
    activeAgreements: active.length,
    openChargeCount: lines.length,
    openChargeTotal: lines.reduce((sum, l) => sum + (Number(l.amount) || 0), 0),
  };
}
