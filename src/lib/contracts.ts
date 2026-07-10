/* Negotiated-contract client seams (Update A). Thin wrappers over the contract-
 * workflow engine RPCs — the engine (RLS + ownership matrix + state machine) is
 * the authority; these shape the calls for /app/contracts/:id. */
import { supabase } from './supabase';

export interface ContractField {
  field_key: string;
  label: string | null;
  section: string | null;
  owner_role: string;          // 'LESSEE' | 'LESSOR' | 'DEAL' | ...
  value: string | null;
  value_type: string;          // text | longtext | currency | date | select | checkbox
  required: boolean;
  sort_order: number;
  can_edit: boolean;
}

export interface ContractChangeRequest {
  id: string;
  annotation_number: number;
  target_field_key: string | null;
  target_section: string | null;
  current_value: string | null;
  requested_change: string;
  status: string;
}

export interface ContractSignature {
  party_role: string;
  typed_name: string | null;
  signed_at: string | null;
}

export interface ContractDetail {
  document: {
    document_id: string;
    title: string;
    status: string;
    workflow_state: 'editable' | 'editing' | 'in_review' | 'locked' | 'executed' | 'void';
    recipient_editing: boolean;
    execution_hash: string | null;
    merged_body: string | null;
    is_originator: boolean;
    horse_section_confirmed_at: string | null;
    horse_section_confirmed_by: string | null;
  };
  my_roles: string[];
  fields: ContractField[];
  open_change_requests: ContractChangeRequest[];
  shares: { shared_with_contact_id: string; recipient_editing: boolean; notified_at: string | null }[];
  signatures: ContractSignature[];
}

export interface MyContractRow {
  document_id: string;
  title: string;
  workflow_state: string;
  status: string;
  created_at?: string;
}

export async function myContractDocuments(): Promise<MyContractRow[]> {
  const { data, error } = await supabase.rpc('my_contract_documents');
  if (error) throw error;
  return (data ?? []) as MyContractRow[];
}

export async function contractDocumentDetail(documentId: string): Promise<ContractDetail> {
  const { data, error } = await supabase.rpc('contract_document_detail', { p_document_id: documentId });
  if (error) throw error;
  return data as ContractDetail;
}

export async function setContractField(documentId: string, fieldKey: string, value: string): Promise<void> {
  const { error } = await supabase.rpc('set_contract_field', {
    p_document_id: documentId, p_field_key: fieldKey, p_value: value,
  });
  if (error) throw error;
}

export async function requestDocumentChange(
  documentId: string, targetFieldKey: string | null, requestedChange: string,
  targetSection: string | null = null,
): Promise<void> {
  const { error } = await supabase.rpc('request_document_change', {
    p_document_id: documentId,
    p_field_key: targetFieldKey,
    p_target_section: targetSection,
    p_requested_change: requestedChange,
  });
  if (error) throw error;
}

export async function resolveChangeRequest(
  changeId: string, accept: boolean, newValue: string | null = null,
): Promise<void> {
  const { error } = await supabase.rpc('resolve_change_request', {
    p_change_id: changeId, p_accept: accept, p_new_value: newValue,
  });
  if (error) throw error;
}

export async function shareDocument(
  documentId: string, withContactId: string, recipientEditing = false,
): Promise<void> {
  const { error } = await supabase.rpc('share_document', {
    p_document_id: documentId,
    p_with_contact_id: withContactId,
    p_recipient_editing: recipientEditing,
  });
  if (error) throw error;
}

export async function advanceWorkflow(documentId: string, to: string): Promise<string> {
  const { data, error } = await supabase.rpc('advance_document_workflow', {
    p_document_id: documentId, p_to: to,
  });
  if (error) throw error;
  return data as string;
}

export async function lockAndSign(
  documentId: string, partyRole: string, typedName: string,
): Promise<string> {
  const { data, error } = await supabase.rpc('lock_and_sign_contract', {
    p_document_id: documentId, p_party_role: partyRole,
    p_typed_name: typedName, p_esign_consent: true,
  });
  if (error) throw error;
  return data as string;
}

export async function confirmHorseSection(documentId: string): Promise<void> {
  const { error } = await supabase.rpc('confirm_horse_section', { p_document_id: documentId });
  if (error) throw error;
}
export async function reopenHorseSection(documentId: string): Promise<void> {
  const { error } = await supabase.rpc('reopen_horse_section', { p_document_id: documentId });
  if (error) throw error;
}

export async function setRecipientEditing(documentId: string, on: boolean): Promise<void> {
  const { error } = await supabase.rpc('set_recipient_editing', { p_document_id: documentId, p_on: on });
  if (error) throw error;
}

/** Redeem a contract invitation (post-auth) → the document to open. */
export async function redeemContractInvitation(token: string): Promise<string> {
  const { data, error } = await supabase.rpc('redeem_contract_invitation', { p_token: token });
  if (error) throw error;
  return (data as { document_id: string }).document_id;
}

/** Staff: invite the counterparty by email. The server resolves the engagement
 *  party contact for the given role (LESSOR/LESSEE/BUYER/SELLER), issues the
 *  token, and sends the branded email. */
export async function inviteCounterparty(
  documentId: string, partyRole: string, email: string,
): Promise<void> {
  const { data: sess } = await supabase.auth.getSession();
  const bearer = sess?.session?.access_token;
  if (!bearer) throw new Error('You need to be signed in.');
  const res = await fetch('/api/contract-invite', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${bearer}` },
    body: JSON.stringify({ documentId, partyRole, email }),
  });
  const json = (await res.json().catch(() => ({}))) as { error?: string };
  if (!res.ok) throw new Error(json.error || 'Could not send the invitation.');
}

/** The cost-composition rule (spec E.3): responsibility + optional split percent →
 *  the stored phrase. 'Lessee'/'Lessor' 100% → "Lessee 100%"; split → both. */
export function composeCostPhrase(
  responsibility: 'Lessor' | 'Lessee' | 'Split' | '',
  lessorPct?: number,
): string {
  if (!responsibility) return '';
  if (responsibility === 'Lessee') return 'Lessee 100%';
  if (responsibility === 'Lessor') return 'Lessor 100%';
  const lp = Math.max(0, Math.min(100, lessorPct ?? 50));
  return `Lessor ${lp}% / Lessee ${100 - lp}%`;
}
