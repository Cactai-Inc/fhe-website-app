import { supabase } from './supabase';

/**
 * DEALS — the top-level envelope a transaction lives in.
 *
 * A deal owns one contract spine row; documents attach to that spine exactly as
 * they always have. Configuration order is fixed and enforced server-side:
 *   1. deal type   — chosen FIRST, because it labels the two sides
 *   2. members     — one or more people per side, SELECTED from existing contacts
 *   3. consideration — what each side gives; at least one entry per side
 *
 * Nothing is created from a deal surface: people and horses must already exist
 * in the system and are picked, never typed.
 */

export type DealType = 'SALE' | 'LEASE';
export type DealStatus = 'pending' | 'complete' | 'void';
export type ConsiderationKind = 'PAYMENT' | 'GOODS' | 'SERVICES' | 'HORSE';

/** The party designations each deal type uses — [side A, side B]. */
export const DEAL_ROLES: Record<DealType, [string, string]> = {
  SALE: ['SELLER', 'BUYER'],
  LEASE: ['LESSOR', 'LESSEE'],
};

export const DEAL_TYPE_LABEL: Record<DealType, string> = {
  SALE: 'Sale',
  LEASE: 'Lease',
};

export const ROLE_LABEL: Record<string, string> = {
  SELLER: 'Seller', BUYER: 'Buyer', LESSOR: 'Lessor', LESSEE: 'Lessee',
};

export const CONSIDERATION_LABEL: Record<ConsiderationKind, string> = {
  PAYMENT: 'Payment', GOODS: 'Goods', SERVICES: 'Services', HORSE: 'Horse',
};

export interface DealParty {
  party_role: string;
  contact_id: string;
  name: string | null;
  email: string | null;
  display_code: string | null;
}

export interface DealConsideration {
  id: string;
  party_role: string;
  kind: ConsiderationKind;
  horse_id: string | null;
  horse_name: string | null;
  amount: number | null;
  detail: string | null;
}

export interface DealDocument {
  document_id: string;
  title: string | null;
  display_code: string | null;
  template_key: string;
  status: string;
  workflow_state: string | null;
  created_at: string;
}

export interface DealDetail {
  id: string;
  display_code: string | null;
  deal_type: DealType;
  status: DealStatus;
  completed_at: string | null;
  notes: string | null;
  contract_id: string;
  created_at: string;
  roles: [string, string];
  parties: DealParty[];
  consideration: DealConsideration[];
  documents: DealDocument[];
}

export interface DealRow {
  id: string;
  display_code: string | null;
  deal_type: DealType;
  status: DealStatus;
  created_at: string;
  party_summary: string | null;
  horse_summary: string | null;
  document_count: number;
}

/** Create a deal. Type first — it labels the parties. Members optional here;
 *  they can also be added afterwards from the deal page. */
export async function createDeal(
  dealType: DealType, partyAContactIds: string[], partyBContactIds: string[], notes?: string,
): Promise<{ deal_id: string; contract_id: string; deal_type: DealType; roles: string[]; members_added: number }> {
  const { data, error } = await supabase.rpc('create_deal', {
    p_deal_type: dealType,
    p_party_a_contact_ids: partyAContactIds,
    p_party_b_contact_ids: partyBContactIds,
    p_notes: notes ?? null,
  });
  if (error) throw error;
  return data as { deal_id: string; contract_id: string; deal_type: DealType; roles: string[]; members_added: number };
}

export async function dealDetail(dealId: string): Promise<DealDetail> {
  const { data, error } = await supabase.rpc('deal_detail', { p_deal_id: dealId });
  if (error) throw error;
  return data as DealDetail;
}

export async function listDeals(): Promise<DealRow[]> {
  const { data, error } = await supabase.rpc('list_deals');
  if (error) throw error;
  return (data ?? []) as DealRow[];
}

/** The deals a horse appears in — the reciprocal link from a horse record. */
export async function horseDeals(horseId: string): Promise<Omit<DealRow, 'party_summary' | 'horse_summary' | 'document_count'>[]> {
  const { data, error } = await supabase.rpc('horse_deals', { p_horse_id: horseId });
  if (error) throw error;
  return (data ?? []) as Omit<DealRow, 'party_summary' | 'horse_summary' | 'document_count'>[];
}

export async function addDealMember(dealId: string, partyRole: string, contactId: string): Promise<void> {
  const { error } = await supabase.rpc('add_deal_member', {
    p_deal_id: dealId, p_party_role: partyRole, p_contact_id: contactId,
  });
  if (error) throw error;
}

export async function removeDealMember(dealId: string, partyRole: string, contactId: string): Promise<void> {
  const { error } = await supabase.rpc('remove_deal_member', {
    p_deal_id: dealId, p_party_role: partyRole, p_contact_id: contactId,
  });
  if (error) throw error;
}

/** Add one consideration entry for a side. HORSE names an existing horse
 *  record; every other kind carries the providing party's own amount/description. */
export async function addDealConsideration(
  dealId: string, partyRole: string, kind: ConsiderationKind,
  p: { horseId?: string; amount?: number; detail?: string } = {},
): Promise<string> {
  const { data, error } = await supabase.rpc('add_deal_consideration', {
    p_deal_id: dealId, p_party_role: partyRole, p_kind: kind,
    p_horse_id: p.horseId ?? null,
    p_amount: p.amount ?? null,
    p_detail: p.detail ?? null,
  });
  if (error) throw error;
  return data as string;
}

export async function removeDealConsideration(id: string): Promise<void> {
  const { error } = await supabase.rpc('remove_deal_consideration', { p_id: id });
  if (error) throw error;
}

export async function updateDeal(dealId: string, p: { dealType?: DealType; notes?: string }): Promise<void> {
  const { error } = await supabase.rpc('update_deal', {
    p_deal_id: dealId, p_deal_type: p.dealType ?? null, p_notes: p.notes ?? null,
  });
  if (error) throw error;
}

export async function voidDeal(dealId: string): Promise<void> {
  const { error } = await supabase.rpc('void_deal', { p_deal_id: dealId });
  if (error) throw error;
}

/** Does the deal meet the minimum threshold to author documents?
 *  One member per side and one consideration entry per side (deal plan L3). */
export function dealIsConfigured(d: DealDetail): boolean {
  const [a, b] = d.roles;
  const has = (role: string) => d.parties.some((p) => p.party_role === role);
  const gives = (role: string) => d.consideration.some((c) => c.party_role === role);
  return has(a) && has(b) && gives(a) && gives(b);
}
