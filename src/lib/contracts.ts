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

export interface PartyControls {
  party_role: string;
  can_fill: boolean;
  can_edit_deal: boolean;
  can_suggest: boolean;
  can_add_clause?: boolean;
}

export interface ContractMessage {
  id: string;
  sender_label: string;
  sender_user_id: string | null;
  body: string;
  created_at: string;
}

export interface ContractDetail {
  party_controls?: PartyControls[];
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
    sent_at: string | null;
    archived_at: string | null;
    cancelled_at: string | null;
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

/** One document in a contract's ordered signing set (lease → vet → care). */
export interface SigningSetDoc {
  document_id: string;
  title: string | null;
  template_key: string;
  sign_sequence: number;
  status: string;
  executed: boolean;
}
/** The ordered set of documents to sign for this document's contract; [] when the
 *  document isn't part of a multi-doc sequenced set. */
export async function contractSigningSet(documentId: string): Promise<SigningSetDoc[]> {
  const { data, error } = await supabase.rpc('contract_signing_set', { p_document_id: documentId });
  if (error) throw error;
  return (data ?? []) as SigningSetDoc[];
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

// ─── Per-party document controls + company origination + messages ────────────
/** Set one party's controls: can they add their information, edit deal terms,
 *  suggest changes. The invitation language derives from these. */
export async function setPartyControls(
  documentId: string, role: string,
  controls: { can_fill: boolean; can_edit_deal: boolean; can_suggest: boolean; can_add_clause?: boolean },
): Promise<void> {
  const { error } = await supabase.rpc('set_party_controls', {
    p_document_id: documentId, p_role: role,
    p_can_fill: controls.can_fill,
    p_can_edit_deal: controls.can_edit_deal,
    p_can_suggest: controls.can_suggest,
    p_can_add_clause: controls.can_add_clause ?? false,
  });
  if (error) throw error;
}

// ── Redlining: propose/resolve edits + clauses, and the read model ──
export interface RedlineFieldProposal {
  field_key: string; label: string | null;
  current_value: string | null; proposed_value: string | null;
  proposed_by: string | null; mine: boolean; proposed_at: string;
}
export interface RedlineAddendum {
  id: string; item_number: number; body: string; status: string;
  proposed_by_role: string | null; proposed_by: string | null; mine: boolean; created_at: string;
}
export interface RedlineState {
  field_proposals: RedlineFieldProposal[];
  addenda: RedlineAddendum[];
  can_suggest: boolean;
  can_add_clause: boolean;
}
export async function contractRedlineState(documentId: string): Promise<RedlineState> {
  const { data, error } = await supabase.rpc('contract_redline_state', { p_document_id: documentId });
  if (error) throw error;
  return data as RedlineState;
}
export async function proposeFieldEdit(documentId: string, fieldKey: string, proposedValue: string): Promise<void> {
  const { error } = await supabase.rpc('propose_field_edit', { p_document_id: documentId, p_field_key: fieldKey, p_proposed_value: proposedValue });
  if (error) throw error;
}
export async function resolveFieldEdit(documentId: string, fieldKey: string, accept: boolean): Promise<void> {
  const { error } = await supabase.rpc('resolve_field_edit', { p_document_id: documentId, p_field_key: fieldKey, p_accept: accept });
  if (error) throw error;
}
export async function withdrawFieldEdit(documentId: string, fieldKey: string): Promise<void> {
  const { error } = await supabase.rpc('withdraw_field_edit', { p_document_id: documentId, p_field_key: fieldKey });
  if (error) throw error;
}
export async function proposeClause(documentId: string, body: string): Promise<void> {
  const { error } = await supabase.rpc('propose_clause', { p_document_id: documentId, p_body: body });
  if (error) throw error;
}
export async function resolveClause(addendumId: string, accept: boolean): Promise<void> {
  const { error } = await supabase.rpc('resolve_clause', { p_addendum_id: addendumId, p_accept: accept });
  if (error) throw error;
}
export async function withdrawClause(addendumId: string): Promise<void> {
  const { error } = await supabase.rpc('withdraw_clause', { p_addendum_id: addendumId });
  if (error) throw error;
}

/** The company originates every contract — stamp the staff creator. */
export async function claimDocumentOrigination(documentId: string): Promise<void> {
  const { error } = await supabase.rpc('claim_document_origination', { p_document_id: documentId });
  if (error) throw error;
}

/** Hand the HORSE.* section to one of the parties to fill in. */
export async function assignHorseSection(documentId: string, role: string): Promise<number> {
  const { data, error } = await supabase.rpc('assign_horse_section', {
    p_document_id: documentId, p_role: role,
  });
  if (error) throw error;
  return data as number;
}

/** Send the document to a party = notify them + confirm access. */
export async function sendContractToParty(documentId: string, partyRole: string): Promise<void> {
  const { error } = await supabase.rpc('send_contract_to_party', { p_document_id: documentId, p_party_role: partyRole });
  if (error) throw error;
}

/** A party cancels the document — notifies all other parties + staff, who then archive or delete. */
export async function cancelContract(documentId: string): Promise<void> {
  const { error } = await supabase.rpc('cancel_contract', { p_document_id: documentId });
  if (error) throw error;
}

/** Staff: archive (findable + resumable) or unarchive the document. */
export async function archiveContract(documentId: string, archive = true): Promise<void> {
  const { error } = await supabase.rpc('archive_contract', { p_document_id: documentId, p_archive: archive });
  if (error) throw error;
}

/** Staff: hard-delete the document, as if it never existed (not for executed docs). */
export async function hardDeleteContract(documentId: string): Promise<void> {
  const { error } = await supabase.rpc('hard_delete_contract', { p_document_id: documentId });
  if (error) throw error;
}

/** Attach a horse RECORD to this contract and fill the HORSE.* fields from it.
 *  Used by the "which horse is this contract for?" gate — the owner picks one of
 *  their horses (or adds a new record first), then attaches it here. */
export async function attachHorseToDocument(documentId: string, horseId: string): Promise<void> {
  const { error } = await supabase.rpc('attach_horse_to_document', {
    p_document_id: documentId, p_horse_id: horseId,
  });
  if (error) throw error;
}

export async function contractMessagesList(documentId: string): Promise<ContractMessage[]> {
  const { data, error } = await supabase.rpc('contract_messages_list', { p_document_id: documentId });
  if (error) throw error;
  return (data ?? []) as ContractMessage[];
}

export async function contractMessagePost(documentId: string, body: string): Promise<void> {
  const { error } = await supabase.rpc('contract_message_post', {
    p_document_id: documentId, p_body: body,
  });
  if (error) throw error;
}
