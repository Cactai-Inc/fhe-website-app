/* Negotiated-contract client seams (Update A). Thin wrappers over the contract-
 * workflow engine RPCs — the engine (RLS + ownership matrix + state machine) is
 * the authority; these shape the calls for /app/contracts/:id. */
import { supabase } from './supabase';

export type FieldInputKind =
  | 'text' | 'longtext' | 'select' | 'buttons' | 'responsibility'
  | 'week_grid' | 'contact' | 'currency' | 'date' | 'percent' | 'prose' | 'checkbox';

export interface FieldOption { value: string; label: string }
export interface FieldConditional { field_key: string; equals: string[] }

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
  // ── cascading living-document model (nullable on legacy docs) ──
  parent_field_key?: string | null;
  input_kind?: FieldInputKind | null;
  options?: FieldOption[] | null;
  conditional_on?: FieldConditional | null;
  guidance?: string | null;
  is_optional?: boolean | null;
  included?: boolean | null;
  is_na?: boolean | null;
  control_override?: { lock?: boolean; edit?: boolean; suggest?: boolean } | null;
  responsibility?: { party?: string; detail?: string; split?: { owner?: number; lessee?: number } } | null;
  // ── structured-fields model ──
  format_type?: string | null;     // registry key: phone | party | pair | person | currency | …
  structured?: FieldStructured | null;   // canonical structured value (source of truth)
  pair_cost_key?: string | null;   // on a 'pair' manage field → its cost child's field_key
  pair_manage_key?: string | null; // on a cost child → its manage field's field_key (hidden as a row)
}

/** A party choice, with the sub-inputs revealed by CARE_PROVIDER / SHARED. */
export interface PartyChoice {
  party?: string;   // OWNER | LESSOR | LESSEE | BUYER | SELLER | CARE_PROVIDER | SHARED
  provider?: { name?: string; company?: string; phone?: string; email?: string };
  parties?: { party?: string; pct?: string }[];   // when SHARED
  note?: string;
}

/** The canonical structured value; shape depends on format_type. Loosely typed
 *  because it spans every format — the composer (DB) is the authority on prose. */
export interface FieldStructured {
  // scalars
  value?: string; text?: string; amount?: string;
  // person / provider
  name?: string; company?: string; phone?: string; email?: string;
  // address
  line1?: string; line2?: string; city?: string; state?: string; postal?: string;
  // list
  items?: string[];
  // party (flat) — also used by percent_split via `parties`
  party?: string;
  provider?: PartyChoice['provider'];
  parties?: PartyChoice['parties'];
  note?: string;
  // pair
  manage?: PartyChoice;
  cost?: { same_as_manage?: boolean; party?: string; parties?: PartyChoice['parties']; note?: string };
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
    horse_id: string | null;
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

// (composeCostPhrase removed 2026-07-20, audit m-1: superseded — cost prose is
//  composed server-side by set_field_structured/recompose. No client callers.)

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

/** Cascading-field writes (living-document model). */
export async function setFieldResponsibility(documentId: string, fieldKey: string, resp: ContractField['responsibility']): Promise<void> {
  const { error } = await supabase.rpc('set_field_responsibility', { p_document_id: documentId, p_field_key: fieldKey, p_responsibility: resp ?? {} });
  if (error) throw error;
}
export async function setFieldIncluded(documentId: string, fieldKey: string, included: boolean): Promise<void> {
  const { error } = await supabase.rpc('set_field_included', { p_document_id: documentId, p_field_key: fieldKey, p_included: included });
  if (error) throw error;
}
export async function setFieldNa(documentId: string, fieldKey: string, isNa: boolean): Promise<void> {
  const { error } = await supabase.rpc('set_field_na', { p_document_id: documentId, p_field_key: fieldKey, p_is_na: isNa });
  if (error) throw error;
}
export async function setFieldControlOverride(documentId: string, fieldKey: string, override: ContractField['control_override']): Promise<void> {
  const { error } = await supabase.rpc('set_field_control_override', { p_document_id: documentId, p_field_key: fieldKey, p_override: override ?? {} });
  if (error) throw error;
}
/** Persist a field's STRUCTURED value (the source of truth). The DB recomposes the
 *  derived prose (and any pair cost-child) and re-merges the body. */
export async function setFieldStructured(documentId: string, fieldKey: string, structured: FieldStructured | null): Promise<void> {
  const { error } = await supabase.rpc('set_field_structured', { p_document_id: documentId, p_field_key: fieldKey, p_structured: structured ?? {} });
  if (error) throw error;
}

/** Add a new section or field to a live contract, with placement + format.
 *  kind='section' inserts after p.afterSection; kind='field' adds to p.section at
 *  p.position (1-based; null = end) with the chosen format_type. */
export async function addContractElement(documentId: string, p: {
  kind: 'section' | 'field';
  section: string;
  afterSection?: string | null;
  position?: number | null;
  label?: string | null;
  formatType?: string;
  options?: { value: string; label: string }[] | null;
  guidance?: string | null;
}): Promise<{ field_key: string; section: string }> {
  const { data, error } = await supabase.rpc('add_contract_element', {
    p_document_id: documentId, p_kind: p.kind, p_section: p.section,
    p_after_section: p.afterSection ?? null, p_position: p.position ?? null,
    p_label: p.label ?? null, p_format_type: p.formatType ?? 'text',
    p_options: p.options ?? null, p_guidance: p.guidance ?? null,
  });
  if (error) throw error;
  return data as { field_key: string; section: string };
}

/** The format registry (read-only) — powers the add-field modal's type picker and
 *  any format-driven UI. Cached per session. */
export interface ContractFormat {
  format_type: string; label: string; category: string;
  input_kind: string; guidance: string | null; reusable_as: string | null; sort_order: number;
}
let _formatsCache: ContractFormat[] | null = null;
export async function listContractFormats(): Promise<ContractFormat[]> {
  if (_formatsCache) return _formatsCache;
  const { data, error } = await supabase.from('contract_formats').select('*').order('sort_order');
  if (error) throw error;
  _formatsCache = (data ?? []) as ContractFormat[];
  return _formatsCache;
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

// ─── Track changes (contract_change_log) ─────────────────────────────────────
/** One logged change to a contract's content. `change_kind` distinguishes field
 *  value/structured edits from redline/clause/change-request resolutions. Powers
 *  the always-on track-changes panel and the retained audit trail. */
export interface ContractChange {
  id: string;
  change_kind: string;
  field_key: string | null;
  field_label: string | null;
  owner_role: string | null;
  old_value: string | null;
  new_value: string | null;
  detail: Record<string, unknown>;
  actor_label: string | null;
  actor_roles: string[];
  actor_is_staff: boolean;
  created_at: string;
}
export async function contractChangeLog(documentId: string, limit = 200): Promise<ContractChange[]> {
  const { data, error } = await supabase.rpc('contract_change_log_list', {
    p_document_id: documentId, p_limit: limit,
  });
  if (error) throw error;
  return (data ?? []) as ContractChange[];
}

// ─── Pinned comments (contract_comments) ─────────────────────────────────────
/** A comment on a contract. `anchor_kind`:
 *   'field'    → anchor_ref is a field_key (stable),
 *   'span'     → anchor_ref is a clause/section id + `quote` is the selected text
 *                (relocated by quote-match after re-merge; `is_stale` when lost),
 *   'document' → whole-document comment (and all replies).
 *  Threaded: a reply carries `parent_comment_id`; resolving the root closes the
 *  thread to further replies. */
export interface ContractComment {
  id: string;
  parent_comment_id: string | null;
  anchor_kind: 'field' | 'span' | 'document';
  anchor_ref: string | null;
  quote: string | null;
  quote_prefix: string | null;
  is_stale: boolean;
  body: string;
  author_label: string | null;
  author_role: string | null;
  resolved_at: string | null;
  created_at: string;
}
export async function contractCommentsList(documentId: string): Promise<ContractComment[]> {
  const { data, error } = await supabase.rpc('contract_comments_list', { p_document_id: documentId });
  if (error) throw error;
  return (data ?? []) as ContractComment[];
}
export async function postContractComment(documentId: string, p: {
  body: string;
  anchorKind?: 'field' | 'span' | 'document';
  anchorRef?: string | null;
  quote?: string | null;
  quotePrefix?: string | null;
  parentId?: string | null;
}): Promise<{ id: string }> {
  const { data, error } = await supabase.rpc('post_contract_comment', {
    p_document_id: documentId,
    p_body: p.body,
    p_anchor_kind: p.anchorKind ?? 'document',
    p_anchor_ref: p.anchorRef ?? null,
    p_quote: p.quote ?? null,
    p_quote_prefix: p.quotePrefix ?? null,
    p_parent_id: p.parentId ?? null,
  });
  if (error) throw error;
  return data as { id: string };
}
export async function resolveContractComment(commentId: string, resolved = true): Promise<void> {
  const { error } = await supabase.rpc('resolve_contract_comment', {
    p_comment_id: commentId, p_resolved: resolved,
  });
  if (error) throw error;
}
export async function markCommentStale(commentId: string, stale = true): Promise<void> {
  const { error } = await supabase.rpc('mark_comment_stale', {
    p_comment_id: commentId, p_stale: stale,
  });
  if (error) throw error;
}

// ─── Retained execution audit (contract_execution_audit) ─────────────────────
/** The frozen negotiation record captured when a contract executed: the change
 *  log and comment threads as they stood, plus the executed body/hash. Retained
 *  for legal audit; never shown on the clean delivered PDF. Null until executed. */
export interface ContractExecutionAudit {
  document_id: string;
  executed_at: string;
  execution_hash: string | null;
  merged_body: string | null;
  change_log: ContractChange[];
  comments: ContractComment[];
  change_count: number;
  comment_count: number;
}
export async function contractExecutionAudit(documentId: string): Promise<ContractExecutionAudit | null> {
  const { data, error } = await supabase.rpc('contract_execution_audit_get', { p_document_id: documentId });
  if (error) throw error;
  return (data as ContractExecutionAudit | null) ?? null;
}
