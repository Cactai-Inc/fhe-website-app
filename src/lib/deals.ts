import { supabase } from './supabase';

/**
 * DEALS — a blank, named container.
 *
 * A deal knows almost nothing on its own: a name the user gives it, its type,
 * its parties, its horse, and the documents inside it. Everything it REPORTS —
 * status, completion, activity — is derived from those documents. (The first
 * build captured "what each side gives" on the deal itself; that was wrong and
 * has been removed.)
 *
 * Creating one is a single modal: name, type, the people on each side, the
 * horse, and for a sale whether the bill of sale stands alone or is accompanied
 * by a purchase and sale agreement. Everything else happens inside documents.
 */

export type DealType = 'SALE' | 'LEASE';
/** Row status. The user-facing badge is derived separately — see DealBadge. */
export type DealStatus = 'pending' | 'complete' | 'void';

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

/** The derived badge. "Sent" is deliberately not a status — notifying someone
 *  is an activity, and it belongs in the activity log. */
export interface DealBadge {
  code: 'created' | 'editable' | 'signed' | 'complete' | 'void';
  label: string;
  signed?: number;
  required?: number;
}

export interface DealParty {
  party_role: string;
  contact_id: string;
  name: string | null;
  email: string | null;
  display_code: string | null;
}

export interface DealDocument {
  document_id: string;
  title: string | null;
  display_code: string | null;
  template_key: string;
  status: string;
  workflow_state: string | null;
  created_at: string;
  /** The document that decides the deal's status and completion. */
  governing: boolean;
  signed: number;
  signers: number;
}

export interface DealDetail {
  id: string;
  display_code: string | null;
  title: string | null;
  deal_type: DealType;
  status: DealStatus;
  badge: DealBadge;
  completed_at: string | null;
  notes: string | null;
  contract_id: string;
  created_at: string;
  roles: [string, string];
  horse: { id: string; name: string | null } | null;
  parties: DealParty[];
  documents: DealDocument[];
}

export interface DealRow {
  id: string;
  display_code: string | null;
  title: string | null;
  deal_type: DealType;
  status: DealStatus;
  badge: DealBadge;
  created_at: string;
  completed_at: string | null;
  party_summary: string | null;
  horse_summary: string | null;
  document_count: number;
}

export interface DealActivityEntry {
  at: string;
  who: string;
  what: string;
  detail: string | null;
  document_id: string | null;
}

/** Create a deal. Everything here comes from the creation modal. */
export async function createDeal(p: {
  dealType: DealType;
  title?: string;
  partyA: string[];
  partyB: string[];
  horseId?: string;
  notes?: string;
}): Promise<{ deal_id: string; contract_id: string; deal_type: DealType; roles: string[]; members_added: number }> {
  const { data, error } = await supabase.rpc('create_deal', {
    p_deal_type: p.dealType,
    p_party_a_contact_ids: p.partyA,
    p_party_b_contact_ids: p.partyB,
    p_notes: p.notes ?? null,
    p_title: p.title ?? null,
    p_horse_id: p.horseId ?? null,
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
export async function horseDeals(horseId: string): Promise<Pick<DealRow,
  'id' | 'display_code' | 'title' | 'deal_type' | 'status' | 'badge' | 'created_at'>[]> {
  const { data, error } = await supabase.rpc('horse_deals', { p_horse_id: horseId });
  if (error) throw error;
  return (data ?? []) as Pick<DealRow, 'id' | 'display_code' | 'title' | 'deal_type' | 'status' | 'badge' | 'created_at'>[];
}

/** Who did what, when, and to what outcome — composed from records the system
 *  already keeps (document lifecycle, change log, signatures). */
export async function dealActivity(dealId: string): Promise<DealActivityEntry[]> {
  const { data, error } = await supabase.rpc('deal_activity', { p_deal_id: dealId });
  if (error) throw error;
  return (data ?? []) as DealActivityEntry[];
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

/** Rename a deal, or change its notes. The title is always editable. */
export async function updateDeal(
  dealId: string, p: { title?: string; dealType?: DealType; notes?: string },
): Promise<void> {
  const { error } = await supabase.rpc('update_deal', {
    p_deal_id: dealId,
    p_deal_type: p.dealType ?? null,
    p_notes: p.notes ?? null,
    p_title: p.title ?? null,
  });
  if (error) throw error;
}

export async function voidDeal(dealId: string): Promise<void> {
  const { error } = await supabase.rpc('void_deal', { p_deal_id: dealId });
  if (error) throw error;
}

export interface DealDocumentStatus {
  template_key: string;
  title: string;
  required: boolean;
  present: boolean;
  executed: boolean;
}

/** Which documents this deal's type can carry, and which it has. */
export async function dealDocumentStatus(dealId: string): Promise<DealDocumentStatus[]> {
  const { data, error } = await supabase.rpc('deal_document_status', { p_deal_id: dealId });
  if (error) throw error;
  return (data ?? []) as DealDocumentStatus[];
}

/** Add a document to the deal. This is the same generation path the contract
 *  creation flow uses; it returns the new document so the caller can open it.
 *  For the bill of sale, hasSaleAgreement sets its posture. */
export async function addDealDocument(
  dealId: string, templateKey: string, hasSaleAgreement?: 'YES' | 'NO',
): Promise<{ document_id: string; template_key: string; fields_seeded: number }> {
  const { data, error } = await supabase.rpc('add_deal_document', {
    p_deal_id: dealId,
    p_template_key: templateKey,
    p_has_sale_agreement: hasSaleAgreement ?? null,
  });
  if (error) throw error;
  return data as { document_id: string; template_key: string; fields_seeded: number };
}

/** The deal record: a generated summary, not a document anyone fills in. */
export async function dealRecordExport(dealId: string): Promise<string> {
  const { data, error } = await supabase.rpc('deal_record_export', { p_deal_id: dealId });
  if (error) throw error;
  return (data ?? '') as string;
}

export interface DealCompletionState {
  deal_id: string;
  status: DealStatus;
  completed_at: string | null;
  can_complete: boolean;
  outstanding: string[];
}

export async function dealCompletionState(dealId: string): Promise<DealCompletionState> {
  const { data, error } = await supabase.rpc('deal_completion_state', { p_deal_id: dealId });
  if (error) throw error;
  return data as DealCompletionState;
}

export async function completeDeal(
  dealId: string,
): Promise<{ completed: boolean; completed_at?: string; message?: string }> {
  const { data, error } = await supabase.rpc('complete_deal', { p_deal_id: dealId });
  if (error) throw error;
  return data as { completed: boolean; completed_at?: string; message?: string };
}

/** What a deal is called when the user has not named it. */
export function dealLabel(d: { title: string | null; deal_type: DealType; horse_summary?: string | null }): string {
  if (d.title?.trim()) return d.title;
  const kind = DEAL_TYPE_LABEL[d.deal_type];
  return d.horse_summary ? `${kind} — ${d.horse_summary}` : `${kind} deal`;
}
