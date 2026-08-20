/* Negotiated-contract client seams (Update A). Thin wrappers over the contract-
 * workflow engine RPCs — the engine (RLS + ownership matrix + state machine) is
 * the authority; these shape the calls for /app/contracts/:id. */
import { supabase } from './supabase';

export type FieldInputKind =
  | 'text' | 'longtext' | 'select' | 'buttons' | 'responsibility'
  | 'week_grid' | 'contact' | 'currency' | 'date' | 'percent' | 'prose' | 'checkbox';

export interface FieldOption {
  value: string; label: string;
  /** Option-level availability gate (e.g. "Riding Lesson Participants" is only
   *  offered while lessons are permitted). Evaluated by the UI against sibling
   *  field values via clauseConditionMet; an already-SELECTED option stays
   *  visible so it can be unselected. */
  when?: FieldConditional | null;
}
/** A clause/field reveal gate: shown when the controlling field equals one of
 *  `equals`, or (for a multi-select control) contains one of `contains`. */
export interface FieldConditional {
  field_key?: string; equals?: string[]; contains?: string[];
  /** numeric gate — met when the field's parsed numeric value (digits/decimal
   *  stripped from e.g. "$2,500" or "40%") is >= this threshold. Unparseable
   *  values (empty, "N/A") never meet it. */
  gte?: number;
  /** composite AND — every sub-condition must hold (mirrors clause_condition_met). */
  all?: FieldConditional[];
  /** composite OR — any sub-condition holding is enough. */
  any?: FieldConditional[];
}

export interface ContractField {
  field_key: string;
  label: string | null;
  section: string | null;
  clause_key?: string | null;  // which clause this field belongs to (Section›Clause›Field)
  owner_role: string;          // 'LESSEE' | 'LESSOR' | 'DEAL' | ...
  // For a party/responsibility field: 'financial' (Owner/Lessee/Shared) vs
  // 'care' (Owner/Lessee/FHE/Shared). Drives the party picker's option set.
  responsibility_kind?: 'financial' | 'care' | null;
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
  /** Gate-0: a CLOSED option set — the UI appends no synthetic Other. */
  closed?: boolean;
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
  // ── author-added content (R11) ──
  /** What an author-added row IS. NULL for template fields and for legacy custom
   *  fields created by the pre-R11 add surface (still shown as "Label: value").
   *   section → a whole new section (label = its title)
   *   header  → a numbered header inside a section
   *   line    → one content line; `body` is its prose, `clause_key` names the
   *             header it sits under, `conditional_on` is its gate and
   *             `guidance` the gold caption shown when that gate is unmet
   *   element → an inline control placed by a {{token}} in some line's body */
  custom_kind?: 'section' | 'header' | 'line' | 'element' | null;
  /** Prose of a `line` row — same {{TOKEN}} convention as a template clause body. */
  body?: string | null;
  /** Who authored this row (any custom_kind) — only they, or staff, may edit/remove it. */
  added_by_contact_id?: string | null;
  /** Server-computed: added_by_contact_id resolves to the current viewer. */
  added_by_me?: boolean;
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
  // share_amount composite: which unit `amount` is in — 'USD' or 'PCT'. Stored, never
  // inferred: a fixed contribution and a proportion are different agreements.
  unit?: string;
  // person / provider / contact-block
  name?: string; company?: string; phone?: string; email?: string; website?: string;
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
  // fee_schedule (§3.1 lease-fee builder)
  initial_due?: string;
  options?: { amount?: string; notes?: string }[];
  selected?: number | null;
  // med_schedule (§11 medications & supplements builder)
  medItems?: {
    name?: string; dose?: string; schedule?: string;
    // per-item responsible party, now split three ways (each with its own OTHER
    // note). `party`/`party_note` are the legacy single-party fields, kept for
    // back-compat with items created before the split.
    party?: string; party_note?: string;
    administer_party?: string; administer_note?: string;
    order_party?: string; order_note?: string;
    cost_party?: string; cost_note?: string;
  }[];
  // contacts_list (§7 co-owners: repeatable first/last/phone/email rows)
  coOwners?: { first?: string; last?: string; phone?: string; email?: string }[];
  // reveal_text (§11.6 tack yes/no → input)
  enabled?: boolean;
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

export interface ContractDetail {
  party_controls?: PartyControls[];
  document: {
    document_id: string;
    template_key?: string | null;   // for clause-model documents (Section›Clause›Field)
    title: string;
    status: string;
    workflow_state: 'editable' | 'editing' | 'in_review' | 'locked' | 'executed' | 'void' | 'terminated';
    recipient_editing: boolean;
    execution_hash: string | null;
    merged_body: string | null;
    is_originator: boolean;
    horse_section_confirmed_at: string | null;
    horse_section_confirmed_by: string | null;
    sent_at: string | null;
    archived_at: string | null;
    // void lifecycle (party OR staff-initiated; per-party keep-or-remove)
    voided_at?: string | null;
    void_reason?: string | null;
    voided_by_me?: boolean | null;
    /** Set when the CALLER has removed this document from their own view. The
     *  document itself is never destroyed — see document_party_hidden. */
    my_hidden_at?: string | null;
    /** True while the caller may still void: a party who has not yet signed.
     *  Stays true after the OTHER party signs; false once the caller signs. */
    can_void?: boolean | null;
    horse_id: string | null;
    // termination lifecycle (executed → termination requested → terminated)
    terminated_at?: string | null;
    termination_requested_at?: string | null;
    termination_requested_by?: string | null;
    termination_request_reason?: string | null;
    effective_date?: string | null;
    /** A8B: when the all-parties executed-copy email fired. NULL = not sent yet. */
    executed_email_sent_at?: string | null;
  };
  my_roles: string[];
  /** TASK COSIGN: party roles a staff caller may sign because the role's
   *  signer contact is the org's own company contact — mirrors
   *  record_signature's company branch. */
  company_signable_roles: string[];
  /** The company contact's display name, for the "Sign as <name>" label. */
  company_contact_name: string | null;
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

/** NO LONGER A LIST READER (COUNTFIX 1.4). `/app/deal` was its only consumer and
 *  now reads `my_documents()` filtered to `is_contract`, so a member's documents
 *  have exactly one definition. Kept — not deleted — because the RPC carries
 *  per-party fields (`my_roles`, `is_originator`, `open_change_requests`,
 *  `my_archived_at`) that no other reader exposes, and a future
 *  contracts-specific surface may want them. Two cautions if it is ever wired up
 *  again: it has NO void filter (it returned two VOIDED leases as agreements
 *  needing signature), and its staff branch returns the whole org, not "mine". */
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

// ─── Section › Clause › Field structure (authoring engine) ───────────────────
export interface ClauseDef {
  clause_key: string;
  heading: string | null;
  body: string | null;         // the clause's legal prose (tokens rendered inline)
  clause_type: 'input' | 'prose' | 'choice';
  sort_order: number;
  is_optional: boolean;
  conditional_on: FieldConditional | null;
  guidance: string | null;
}
export interface SectionDef {
  section_key: string;
  heading: string;
  sort_order: number;
  is_optional: boolean;
  guidance: string | null;
  clauses: ClauseDef[];
}
/**
 * TASK ONEAUTHOR — per-document-type behaviour, carried as DATA on
 * `contract_templates` (alongside `contract_kind` / `service_type` /
 * `wall_gating` / `party_namespaces`, which are the same thing).
 *
 * The ONE authoring page reads this to decide which surfaces a document can
 * actually have. It is never a conditional on `template_key`: 26 templates
 * behind a conditional is 26 special cases, and this codebase already deleted
 * two hardcoded shadow catalogs for exactly that reason.
 *
 * Every surface flag defaults TRUE server-side — including for a template_key
 * with no row — so an unconfigured document never silently loses a drawer.
 */
export interface TemplateConfig {
  title: string | null;
  /** Short name for a signing-set step / picker chip; falls back to `title`. */
  short_label: string | null;
  contract_kind: string | null;
  /** Comments drawer. */
  show_comments: boolean;
  /** Change-requests drawer. FALSE for standard-form documents nobody negotiates. */
  show_change_requests: boolean;
  /** Change-history drawer. */
  show_history: boolean;
  /** The per-party can_fill / can_edit_deal / can_suggest card. */
  show_party_controls: boolean;
  /** The co-buyer capture card (the sale family). */
  allows_co_buyer: boolean;
  /** A document this one can generate alongside itself (sale → bill of sale). */
  companion_template_key: string | null;
  companion_label: string | null;
}

/** The permissive fallback: exactly how the page behaved before any of this was
 *  configurable. Used when a document carries no template_key at all, and when
 *  the structure fetch fails — a failed lookup must never take a surface away. */
export const DEFAULT_TEMPLATE_CONFIG: TemplateConfig = {
  title: null,
  short_label: null,
  contract_kind: null,
  show_comments: true,
  show_change_requests: true,
  show_history: true,
  show_party_controls: true,
  allows_co_buyer: false,
  companion_template_key: null,
  companion_label: null,
};

export interface TemplateStructure {
  template_key: string;
  sections: SectionDef[];
  /** Optional so a cached/legacy payload without it still type-checks; readers
   *  fall back to DEFAULT_TEMPLATE_CONFIG. */
  config?: TemplateConfig;
}

/** The clause structure for a template — sections › clauses, ordered — PLUS the
 *  template's surface configuration. Powers the numbered Section›Clause›Field
 *  rendering; `sections: []` is what makes a document flat, and the config is
 *  returned on BOTH branches because the flat one is where it decides the most.
 *  Cached per template. */
const _structureCache = new Map<string, TemplateStructure>();
export async function contractTemplateStructure(templateKey: string): Promise<TemplateStructure> {
  const cached = _structureCache.get(templateKey);
  if (cached) return cached;
  const { data, error } = await supabase.rpc('contract_template_structure', { p_template_key: templateKey });
  if (error) throw error;
  const s = data as TemplateStructure;
  _structureCache.set(templateKey, s);
  return s;
}

/** Shared clause/field reveal-gate evaluator — mirrors the SQL clause_condition_met
 *  so the authoring UI shows/hides clauses in real time exactly as the composed
 *  document will. `fieldValues` maps field_key → current value (multi-select values
 *  are comma-joined, matching the engine). */
export function clauseConditionMet(
  cond: FieldConditional | null | undefined,
  fieldValues: Record<string, string>,
): boolean {
  if (!cond) return true;
  // composite AND: every sub-condition must hold
  if (cond.all) return cond.all.every((c) => clauseConditionMet(c, fieldValues));
  // composite OR: any sub-condition holding is enough
  if (cond.any) return cond.any.some((c) => clauseConditionMet(c, fieldValues));
  if (!cond.field_key) return true;
  const raw = fieldValues[cond.field_key] ?? '';
  if (cond.equals && cond.equals.includes(raw)) return true;
  if (cond.contains) {
    const have = raw.split(',').map((s) => s.trim()).filter(Boolean);
    if (cond.contains.some((v) => have.includes(v))) return true;
  }
  if (cond.gte !== undefined) {
    const n = parseFloat(raw.replace(/[^0-9.]/g, ''));
    if (!Number.isNaN(n) && n >= cond.gte) return true;
  }
  // if only one operator was given and it didn't match, it's not met; if NO
  // operator is present, treat as ungated (shown)
  if (!cond.equals && !cond.contains && cond.gte === undefined) return true;
  return false;
}

/** One document in a contract's ordered signing set (lease → vet → care). */
export interface SigningSetDoc {
  document_id: string;
  title: string | null;
  template_key: string;
  /** TASK ONEAUTHOR: the step's display name, carried with the row. Replaces the
   *  page's hardcoded template_key→label map, which knew 5 of 26 templates and
   *  called every other document "Document". Falls back to the template title. */
  short_label?: string | null;
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

/** One named lock blocker from the shared precondition evaluator. */
export interface LockBlocker { code: string; message: string }
/** A non-staff signing party approves the reviewed contract. The approval is
 *  ALWAYS recorded (status_event); when every non-staff signing party has
 *  approved and the lock preconditions pass, the document auto-advances to
 *  locked (signature rows seeded). Otherwise the named blockers come back. */
export async function approveContractReview(
  documentId: string,
): Promise<{ approved: boolean; locked: boolean; blockers: LockBlocker[] }> {
  const { data, error } = await supabase.rpc('approve_contract_review', { p_document_id: documentId });
  if (error) throw error;
  return data as { approved: boolean; locked: boolean; blockers: LockBlocker[] };
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
  documentId: string, partyRole: string, email?: string,
): Promise<{ emailed: boolean; reason?: string; refused?: boolean }> {
  const { data: sess } = await supabase.auth.getSession();
  const bearer = sess?.session?.access_token;
  if (!bearer) throw new Error('You need to be signed in.');
  const res = await fetch('/api/contract-invite', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${bearer}` },
    // email is optional — the server derives it from the assigned party contact.
    body: JSON.stringify(email ? { documentId, partyRole, email } : { documentId, partyRole }),
  });
  const json = (await res.json().catch(() => ({}))) as {
    error?: string; emailed?: boolean; reason?: string; code?: string;
  };
  // SENDGUARD §1: "they already signed" is a refusal, not a failure. Return it as
  // data so the caller can name it — throwing would make it indistinguishable from
  // "no email on file", which is what the send-for-review summary would then say.
  if (res.status === 409 && json.code === 'ALREADY_SIGNED') {
    return { emailed: false, refused: true, reason: json.error };
  }
  if (!res.ok) throw new Error(json.error || 'Could not send the invitation.');
  return { emailed: json.emailed !== false, reason: json.reason };
}

/** Send for review: advance the workflow (in-app notifications fire server-side
 *  for parties with an app account) AND email each party role (email derived from
 *  the assigned contact). Returns a summary of how many were emailed vs skipped, so
 *  the caller can surface delivery problems instead of failing silently. Email
 *  errors don't block the workflow advance.
 *
 *  A LOCKED document is frozen FOR SIGNING, and `locked → in_review` is an illegal
 *  transition in advance_document_workflow — so this used to throw before reaching
 *  the invitations and no email went out at all. Sending a locked document is a
 *  legitimate and necessary action: it is how the parties are asked to SIGN. The
 *  state is read here rather than passed in, so no caller can get it wrong. */
export async function sendForReview(
  documentId: string, partyRoles: string[],
): Promise<{ emailed: number; skipped: number; refused: string[] }> {
  const { data: doc, error: stateErr } = await supabase
    .from('documents').select('workflow_state').eq('id', documentId).single();
  if (stateErr) throw stateErr;
  if (doc?.workflow_state !== 'locked') {
    await advanceWorkflow(documentId, 'in_review');
  }
  const results = await Promise.allSettled(partyRoles.map((r) => inviteCounterparty(documentId, r)));
  let emailed = 0; let skipped = 0;
  // A party who already signed is REFUSED, not skipped — reported separately so the
  // summary never files them under "no email on file".
  const refused: string[] = [];
  results.forEach((r, i) => {
    if (r.status === 'fulfilled' && r.value.refused) { refused.push(partyRoles[i]); return; }
    if (r.status === 'fulfilled' && r.value.emailed) emailed += 1; else skipped += 1;
  });
  return { emailed, skipped, refused };
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
/** A suggest-tier party's proposed "Add item" — `spec` is the same
 *  `CompositionSpec` shape `add_contract_composition`/`proposeContractComposition`
 *  take. `status` is `'open'` (awaiting review) or `'rejected'` (grayed-out,
 *  stays visible) — an accepted one becomes an ordinary contract_fields row
 *  and drops out of this list. */
export interface RedlinePendingComposition {
  id: string; spec: CompositionSpec; status: 'open' | 'rejected';
  proposed_by_role: string | null; proposed_by: string | null; mine: boolean; created_at: string;
}
export interface RedlineState {
  field_proposals: RedlineFieldProposal[];
  addenda: RedlineAddendum[];
  pending_compositions: RedlinePendingComposition[];
  can_suggest: boolean;
  can_add_clause: boolean;
  can_edit_deal: boolean;
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
/** Edit-tier callers apply immediately (`applied: true`); suggest-tier stages
 *  as an open addendum for the counterparty to resolve — the server decides
 *  which, from the caller's own party controls. */
export async function proposeClause(documentId: string, body: string): Promise<{
  addendumId: string; itemNumber: number; applied: boolean;
}> {
  const { data, error } = await supabase.rpc('propose_clause', { p_document_id: documentId, p_body: body });
  if (error) throw error;
  const d = data as { addendum_id: string; item_number: number; applied: boolean };
  return { addendumId: d.addendum_id, itemNumber: d.item_number, applied: d.applied };
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

/** Staff: reassign a contract party (Lessee/Lessor) to a different contact. */
export async function reassignDocumentParty(documentId: string, partyRole: string, contactId: string): Promise<void> {
  const { error } = await supabase.rpc('reassign_document_party', {
    p_document_id: documentId, p_party_role: partyRole, p_contact_id: contactId,
  });
  if (error) throw error;
}

/** The required contact fields a lease party must have (owner directive 2026-07-22). */
export type PartyField = 'name' | 'address' | 'email' | 'phone';

export interface PartySummary {
  party_role: string;
  contact_id: string | null;
  name: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  // address components (for the capture modal to edit in parts)
  address_line1: string | null;
  address_line2: string | null;
  city: string | null;
  state: string | null;
  postal_code: string | null;
  first_name: string | null;
  last_name: string | null;
  /** required fields (name/address/email/phone) this party is still missing */
  missing: PartyField[];
}
export interface PartiesHorseSummary {
  parties: PartySummary[];
  horse_id: string | null;
  horse_name: string | null;
  /** ['horse'] if no horse attached, ['identity'] if attached but unnamed, else [] */
  horse_missing: string[];
}
/** The parties + horse summary for the editable "Parties & Horse" card. */
export async function documentPartiesSummary(documentId: string): Promise<PartiesHorseSummary> {
  const { data, error } = await supabase.rpc('document_parties_summary', { p_document_id: documentId });
  if (error) throw error;
  return data as PartiesHorseSummary;
}

/**
 * Write missing/updated contact fields to the CENTRAL contact record, then refill
 * the document's party auto-fill tokens and re-merge so the change shows in the
 * contract immediately. This is the reusable "capture once, reuse everywhere"
 * path: the value lands on the contact (reused by every document), not just here.
 * Address is written as components; the contract composes it from those.
 */
export async function captureContactInfo(
  documentId: string,
  contactId: string,
  patch: {
    first_name?: string; last_name?: string; email?: string; phone?: string;
    address_line1?: string; address_line2?: string; city?: string; state?: string; postal_code?: string;
  },
): Promise<void> {
  // NOTE: contacts.address_composed is a GENERATED column
  // (compose_address(line1,line2,city,state,postal)) — never write it; it
  // recomputes automatically from the components we set here.
  const { error: upErr } = await supabase.from('contacts').update(patch).eq('id', contactId);
  if (upErr) throw upErr;
  // refill the doc's party tokens from the now-updated contact, then re-merge
  const { error: fillErr } = await supabase.rpc('fill_party_fields_from_contacts', { p_document_id: documentId });
  if (fillErr) throw fillErr;
  const { error: mergeErr } = await supabase.rpc('remerge_contract_from_clauses', { p_document_id: documentId });
  if (mergeErr) throw mergeErr;
}

/**
 * Write missing/updated farrier & vet details to the HORSE record from within the
 * contract, then re-materialize the HORSE.* tokens and re-merge so the change shows
 * immediately. Same "capture once, reuse everywhere" pattern as captureContactInfo:
 * the value lands on the horse record (reused by every document), not just here.
 * A non-owner party may write; owner confirmation of such edits happens at review.
 */
export async function captureHorseRecord(
  documentId: string,
  patch: {
    farrier_name?: string; farrier_phone?: string;
    vet_name?: string; vet_phone?: string; vet_business_name?: string;
    vet_address_line1?: string; vet_city?: string; vet_state?: string; vet_postal?: string;
  },
): Promise<void> {
  const { error: capErr } = await supabase.rpc('capture_horse_record_info', {
    p_document_id: documentId, p_patch: patch,
  });
  if (capErr) throw capErr;
  const { error: mergeErr } = await supabase.rpc('remerge_contract_from_clauses', { p_document_id: documentId });
  if (mergeErr) throw mergeErr;
}

/** Explicit save: re-compose the document from its clauses/fields and persist the
 *  merged body. Fields already autosave on blur; this is the reassuring "Save"
 *  action that re-persists the current composed state on demand. */
export async function saveContract(documentId: string): Promise<void> {
  const { error } = await supabase.rpc('remerge_contract_from_clauses', { p_document_id: documentId });
  if (error) throw error;
}

/** Send the document to a party = notify them + confirm access. */
export async function sendContractToParty(documentId: string, partyRole: string): Promise<void> {
  const { error } = await supabase.rpc('send_contract_to_party', { p_document_id: documentId, p_party_role: partyRole });
  if (error) throw error;
}

/* Staff and parties share ONE destructive pre-execution path: the void flow
 * (voidDocument + setDocumentPartyHidden). */

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

/** Staff: hard-delete a non-executed document, but first email a PDF copy to any
 *  party who has already seen it (so a reviewer keeps a record), then remove it for
 *  everyone. Returns how many copies were sent. */
export async function deleteContractWithCopy(documentId: string): Promise<{ copiesSent: number }> {
  const { data: sess } = await supabase.auth.getSession();
  const bearer = sess?.session?.access_token;
  if (!bearer) throw new Error('You need to be signed in.');
  const res = await fetch('/api/delete-document-with-copy', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${bearer}` },
    body: JSON.stringify({ documentId }),
  });
  const json = (await res.json().catch(() => ({}))) as { error?: string; copiesSent?: number };
  if (!res.ok) throw new Error(json.error || 'Could not delete the document.');
  return { copiesSent: json.copiesSent ?? 0 };
}

/** Propose terminating an executed contract. A party's request goes to the other
 *  party for approval; staff's request goes to both parties. Contract stays in
 *  force ('executed') with a pending-request flag until approved. */
export async function requestContractTermination(documentId: string, reason?: string): Promise<void> {
  const { error } = await supabase.rpc('request_contract_termination', { p_document_id: documentId, p_reason: reason ?? null });
  if (error) throw error;
}
/** Agree to a pending termination request — the contract becomes 'terminated'. */
export async function approveContractTermination(documentId: string): Promise<void> {
  const { error } = await supabase.rpc('approve_contract_termination', { p_document_id: documentId });
  if (error) throw error;
}
/** Decline a pending termination request — the contract remains in force. */
export async function declineContractTermination(documentId: string): Promise<void> {
  const { error } = await supabase.rpc('decline_contract_termination', { p_document_id: documentId });
  if (error) throw error;
}
/** Per-party archive: hide/unhide the document from THIS party's own list only
 *  (the global staff archive is separate). */
export async function setDocumentPartyArchived(documentId: string, archive = true): Promise<void> {
  const { error } = await supabase.rpc('set_document_party_archived', { p_document_id: documentId, p_archive: archive });
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

// ─── Authored ADDITIONS (R11 add-item) ───────────────────────────────────────
/** One inline element in an authored line. `id` is a LOCAL id used only inside
 *  the spec: a line's prose references it as `{{CUSTOM.@id}}` and a gate as
 *  `field_key: '@id'`. The RPC mints the real CUSTOM key and rewrites both, so
 *  the client never has to predict a key. */
export interface CompositionElement {
  id: string;
  kind: 'select' | 'buttons' | 'text';
  label: string;
  placeholder?: string | null;
  required?: boolean;
  options?: { value: string; label: string }[];
}
/** One content line. A line produced inside a CONDITION SEPARATOR carries that
 *  separator's gate + caption; a top-level line carries neither. */
export interface CompositionLine {
  body: string;
  conditional_on?: FieldConditional | null;
  caption?: string | null;
}
export interface CompositionSpec {
  /** section_key of an existing section, or the TITLE of a new one. */
  section: string;
  section_new?: boolean;
  /** 1-based position among the document's sections; only when section_new. */
  section_position?: number | null;
  header: {
    clause_key?: string | null;
    text?: string | null;
    /** 1-based position among the section's HEADERS; only when naming a new one. */
    position?: number | null;
    /** TASK ADDITEM — 1-based position among the lines the author has ALREADY
     *  added under `clause_key`; null / out of range = after all of them. The
     *  RPC renumbers that header's authored lines as one ordered run, which is
     *  also what stops a second addition colliding with the first (both used to
     *  start at sort_order 10). Ignored when a new header is being created —
     *  there is nothing there yet to sit among. */
    line_position?: number | null;
  };
  elements: CompositionElement[];
  lines: CompositionLine[];
}
/** Write one authored addition — section (optional), header, elements and lines —
 *  in a single transaction, then re-merge. Returns the keys it minted. */
export async function addContractComposition(documentId: string, spec: CompositionSpec): Promise<{
  section: string; header_key: string; element_keys: Record<string, string>; created: string[];
}> {
  const { data, error } = await supabase.rpc('add_contract_composition', {
    p_document_id: documentId, p_spec: spec as unknown as Record<string, unknown>,
  });
  if (error) throw error;
  return data as { section: string; header_key: string; element_keys: Record<string, string>; created: string[] };
}
/** Remove an authored item. A header takes its lines and elements with it; a
 *  section takes everything the author added to it. Author or staff only. */
export async function removeContractComposition(documentId: string, fieldKey: string): Promise<number> {
  const { data, error } = await supabase.rpc('remove_contract_composition', {
    p_document_id: documentId, p_field_key: fieldKey,
  });
  if (error) throw error;
  return (data ?? 0) as number;
}
/** Reopen an already-added item and replace it with a new spec. Author or
 *  staff only — mints a new field_key, the old one stops existing. */
export async function updateContractComposition(documentId: string, fieldKey: string, spec: CompositionSpec): Promise<{
  section: string; header_key: string; element_keys: Record<string, string>; created: string[];
}> {
  const { data, error } = await supabase.rpc('update_contract_composition', {
    p_document_id: documentId, p_field_key: fieldKey, p_spec: spec as unknown as Record<string, unknown>,
  });
  if (error) throw error;
  return data as { section: string; header_key: string; element_keys: Record<string, string>; created: string[] };
}
/** Suggest-tier's staged path — must target an existing section+header, no
 *  new elements (the server enforces and explains this). */
export async function proposeContractComposition(documentId: string, spec: CompositionSpec): Promise<{ pendingId: string }> {
  const { data, error } = await supabase.rpc('propose_contract_composition', {
    p_document_id: documentId, p_spec: spec as unknown as Record<string, unknown>,
  });
  if (error) throw error;
  return { pendingId: (data as { pending_id: string }).pending_id };
}
/** Include or reject a pending item — the actual counterparty (or staff),
 *  never the proposer themselves. */
export async function resolvePendingComposition(pendingId: string, decision: 'include' | 'reject'): Promise<void> {
  const { error } = await supabase.rpc('resolve_pending_composition', { p_pending_id: pendingId, p_decision: decision });
  if (error) throw error;
}
export async function withdrawPendingComposition(pendingId: string): Promise<void> {
  const { error } = await supabase.rpc('withdraw_pending_composition', { p_pending_id: pendingId });
  if (error) throw error;
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
  /* SECTION ATTRIBUTION — resolved SERVER-SIDE by contract_change_log_list, which
   * walks contract_fields → contract_field_defs → the SECTION.FIELD key
   * convention → retired_field_section, then numbers the result from
   * contract_section_tree. The client never parses field keys, so the numbers
   * here always match the composed document. */
  section_key: string | null;
  clause_key: string | null;
  /** The section's live number, e.g. "13". Changes BUNDLE under this. */
  section_number: string | null;
  section_title: string | null;
  /** The finer subsection number where the row resolves that far, e.g. "13.4". */
  clause_number: string | null;
  clause_title: string | null;
}
export async function contractChangeLog(documentId: string, limit = 200): Promise<ContractChange[]> {
  const { data, error } = await supabase.rpc('contract_change_log_list', {
    p_document_id: documentId, p_limit: limit,
  });
  if (error) throw error;
  return (data ?? []) as ContractChange[];
}

// ─── The section tree (contract_section_tree) ────────────────────────────────
/** One numbered subsection ("12.3 Lessons"). The number is DERIVED live from the
 *  document by the same rules the composer uses, so it always matches the prose. */
export interface SectionTreeSub {
  clause_key: string;
  /** "<section>.<n>", e.g. "12.3". */
  number: string;
  title: string;
  guidance: string | null;
}
/** One numbered section ("12 Permitted Use(s) & Restrictions") plus its
 *  subsections. Sections that compose to nothing are absent and consume no
 *  number — exactly as `remerge_contract_from_clauses` behaves. */
export interface SectionTreeNode {
  section_key: string;
  number: string;
  title: string;
  guidance: string | null;
  subsections: SectionTreeSub[];
}
/** The live, correctly-numbered section/subsection tree for THIS document.
 *  Never hardcode section numbers — inserting a section shifts them all. */
export async function contractSectionTree(documentId: string): Promise<SectionTreeNode[]> {
  const { data, error } = await supabase.rpc('contract_section_tree', { p_document_id: documentId });
  if (error) throw error;
  return (data ?? []) as SectionTreeNode[];
}

// ─── Change requests (contract_change_requests) ──────────────────────────────
/* THE SINGLE CHANGE-REQUEST SURFACE. `contract_comments` was renamed to
 * `contract_change_requests` and `document_change_requests` was retired into it,
 * so comments and change requests are one threaded model:
 *
 *   ROOT row (parent_request_id === null) = a change request against a section.
 *     submitted_at === null → a private DRAFT. Autosaved on blur. Does NOT block
 *                             locking (it isn't a request yet).
 *     submitted_at !== null → NOTIFIED. Blocks locking until it is resolved.
 *   CHILD rows = thread entries either party may add, each stamped with
 *     author_role / author_label / created_at.
 *   resolved_at / agreed_at = the close — but a SOFT one: either party may
 *     reopen (reopened_at / reopened_by_contact_id), which returns the request to
 *     the open set and blocks locking again.
 *
 * NOTIFYING DOES NOT FREEZE ANYTHING. An entry stays editable by its author until
 * the OTHER PARTY SEES IT (seen_by / is_frozen / can_edit, written by
 * markChangeRequestSeen on a row click). Document CHANGES freeze on a different
 * trigger entirely — the counterparty OPENING the document (markDocumentOpened).
 */
export interface ContractChangeRequestEntry {
  id: string;
  parent_request_id: string | null;
  anchor_kind: 'field' | 'span' | 'document';
  anchor_ref: string | null;
  target_section: string | null;
  /** Resolved section heading for display ("Lease Fee"), or "The whole document". */
  section_heading: string | null;
  /** Sequential per-document number, assigned at submit. Null while a draft. */
  annotation_number: number | null;
  /** Money/term/liability weight — see change_request_impact_rank in the DB. */
  impact_rank: number;
  is_stale: boolean;
  needs_review: boolean;
  body: string;
  author_label: string | null;
  author_role: string | null;
  author_contact_id: string | null;
  submitted_at: string | null;
  agreed_at: string | null;
  resolved_at: string | null;
  edited_at: string | null;
  created_at: string;
  /** Set when a resolved request was REOPENED — resolution is a soft close. */
  reopened_at?: string | null;
  reopened_by_contact_id?: string | null;
  /** Everyone OTHER than the author who has genuinely viewed this entry. Rendered
   *  as the "Seen" stamp beside the author stamp. */
  seen_by?: { contact_id: string; seen_at: string; role: string | null; label: string | null }[];
  /** True once somebody other than the author has seen it — it is then read-only. */
  is_frozen?: boolean;
  /** True when the CALLER authored this entry and it has not yet been seen. */
  can_edit?: boolean;
}

export async function contractChangeRequestsList(documentId: string): Promise<ContractChangeRequestEntry[]> {
  const { data, error } = await supabase.rpc('contract_change_requests_list', { p_document_id: documentId });
  if (error) throw error;
  return (data ?? []) as ContractChangeRequestEntry[];
}

/** AUTOSAVE (on blur). One draft per (document, author, section). An empty body
 *  removes the draft (only while it is still an un-notified draft).
 *
 *  Throws once the OTHER PARTY HAS SEEN the request — being seen is what freezes
 *  an entry, not notifying it. Also throws if the document is locked/executed/void. */
export async function upsertChangeRequest(
  documentId: string, targetSection: string | null, body: string,
): Promise<{ id: string | null; removed: boolean }> {
  const { data, error } = await supabase.rpc('upsert_change_request', {
    p_document_id: documentId, p_target_section: targetSection, p_body: body,
  });
  if (error) throw error;
  return data as { id: string | null; removed: boolean };
}

/** NOTIFY — numbers every draft this caller wrote and notifies the other party
 *  with the five highest-impact requests.
 *
 *  NOTIFYING FREEZES NOTHING. Requests stay editable by their author until the
 *  other party SEES them (see markChangeRequestSeen); document CHANGES stay
 *  editable until the other party OPENS the document (see markDocumentOpened). */
export async function submitChangeRequests(documentId: string): Promise<{
  submitted: number;
  top?: { annotation_number: number; target_section: string | null; heading: string; impact_rank: number; body: string }[];
}> {
  const { data, error } = await supabase.rpc('submit_change_requests', { p_document_id: documentId });
  if (error) throw error;
  return data as { submitted: number; top?: [] };
}

/** Email the other party about just-submitted requests, listing the same five
 *  highest-impact ones the dashboard notification shows. The DB already created
 *  the in-app notification, so a failure here is non-fatal — never lose a
 *  submission because email is misconfigured. */
export async function emailSubmittedChangeRequests(documentId: string): Promise<{ emailed: number }> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) return { emailed: 0 };
  const r = await fetch('/api/contract-change-requests-submitted', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ documentId }),
  });
  if (!r.ok) return { emailed: 0 };
  return (await r.json()) as { emailed: number };
}

// ─── THE TWO FREEZE TRIGGERS (the Notify model) ──────────────────────────────
/* Notifying freezes nothing. Two DISTINCT genuine-view actions freeze:
 *
 *   REQUESTS freeze one at a time, when the counterparty CLICKS THE ROW to
 *     expand that request's contents  → markChangeRequestSeen([id])
 *   CHANGES  freeze in bulk, when the counterparty OPENS THE DOCUMENT
 *                                     → markDocumentOpened(documentId)
 *
 * Neither ever fires for your own authorship: the DB skips self-authored entries
 * and excludes the author's own open. Both are idempotent — first view wins, and
 * repeat calls are cheap no-ops that never error.
 *
 * There is deliberately NO viewport/intersection observation on either path. A
 * collapsed row and a document you have not opened record nothing. */

/** Record a GENUINE VIEW of one or more change-request entries — call this when
 *  the reader CLICKS A ROW to expand it, never on collapsed render. Self-authored
 *  entries are skipped by the DB, so an author can never freeze their own work. */
export async function markChangeRequestSeen(requestIds: string[]): Promise<{ seen: number }> {
  if (requestIds.length === 0) return { seen: 0 };
  const { data, error } = await supabase.rpc('mark_change_request_seen', {
    p_request_ids: requestIds,
  });
  if (error) throw error;
  return (data ?? { seen: 0 }) as { seen: number };
}

/** Record that the caller OPENED this document. Freezes the OTHER party's pending
 *  changes (never the caller's own). Idempotent: first open wins. */
export async function markDocumentOpened(documentId: string): Promise<{ opened: number }> {
  const { data, error } = await supabase.rpc('mark_document_opened', { p_document_id: documentId });
  if (error) throw error;
  return (data ?? { opened: 0 }) as { opened: number };
}

/** What a Notify would announce right now — the SINGLE SOURCE OF TRUTH shared by
 *  the confirmation-modal copy and the enforcement rules, so the two cannot drift.
 *  `changes_frozen` / `requests_frozen` are the very predicates the DB tests. */
export interface PendingNotifySummary {
  document_id: string;
  /** The counterparty's party_role, e.g. "LESSEE". Derived from the document. */
  other_party_role: string | null;
  /** Display form of that role, e.g. "Lessee". Never hardcoded. */
  other_party_name: string;
  changes: number;
  requests: number;
  has_changes: boolean;
  has_requests: boolean;
  anything: boolean;
  changes_frozen: boolean;
  requests_frozen: boolean;
}
export async function pendingNotifySummary(documentId: string): Promise<PendingNotifySummary> {
  const { data, error } = await supabase.rpc('pending_notify_summary', { p_document_id: documentId });
  if (error) throw error;
  return data as PendingNotifySummary;
}

/** Edit any of MY entries (root or thread reply) that the other party has not yet
 *  seen. Refused once seen — the same rule the Notify copy promises. */
export async function editChangeRequestEntry(requestId: string, body: string): Promise<{ id: string }> {
  const { data, error } = await supabase.rpc('edit_change_request_entry', {
    p_request_id: requestId, p_body: body,
  });
  if (error) throw error;
  return data as { id: string };
}

/** Resolve a request — a SOFT close. Either party may reopen it afterwards. */
export async function resolveChangeRequestThread(requestId: string): Promise<{ id: string }> {
  const { data, error } = await supabase.rpc('resolve_change_request_thread', { p_request_id: requestId });
  if (error) throw error;
  return data as { id: string };
}

/** Reopen a resolved request — either party. It re-enters the open set and
 *  therefore blocks locking again via contract_lock_blockers. */
export async function reopenChangeRequest(requestId: string): Promise<{ id: string }> {
  const { data, error } = await supabase.rpc('reopen_change_request', { p_request_id: requestId });
  if (error) throw error;
  return data as { id: string };
}

/** Add an entry to a submitted thread (either party, until it closes). */
export async function replyToChangeRequest(requestId: string, body: string): Promise<{ id: string }> {
  const { data, error } = await supabase.rpc('reply_to_change_request', {
    p_request_id: requestId, p_body: body,
  });
  if (error) throw error;
  return data as { id: string };
}

/** The explicit Agreed/Accepted action that CLOSES a thread (and unblocks lock). */
export async function agreeChangeRequest(requestId: string, agreed = true): Promise<void> {
  const { error } = await supabase.rpc('agree_change_request', {
    p_request_id: requestId, p_agreed: agreed,
  });
  if (error) throw error;
}

// ─── Void flow ───────────────────────────────────────────────────────────────
/** Void the contract with a note explaining why. Available to a party until THEY
 *  sign (and still available after the OTHER party signs). Notifies the
 *  counterparty, note included. */
export async function voidDocument(documentId: string, note: string | null): Promise<{
  voided: boolean; notified: number; note: string | null;
}> {
  const { data, error } = await supabase.rpc('void_document', {
    p_document_id: documentId, p_note: note,
  });
  if (error) throw error;
  return data as { voided: boolean; notified: number; note: string | null };
}

/** Email the counterparty about a void, note included. The DB already made the
 *  in-app notification, so a failure here is non-fatal. */
export async function emailVoidNotice(documentId: string): Promise<{ emailed: number }> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) return { emailed: 0 };
  const r = await fetch('/api/contract-voided', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ documentId }),
  });
  if (!r.ok) return { emailed: 0 };
  return (await r.json()) as { emailed: number };
}

/** Keep-or-remove, PER PARTY. `hidden = true` removes the document from THIS
 *  party's documents page only — the document is never destroyed and stays
 *  visible to the other party and to staff/ops. */
export async function setDocumentPartyHidden(documentId: string, hidden = true): Promise<{
  hidden: boolean; document_still_exists: boolean;
}> {
  const { data, error } = await supabase.rpc('set_document_party_hidden', {
    p_document_id: documentId, p_hidden: hidden,
  });
  if (error) throw error;
  return data as { hidden: boolean; document_still_exists: boolean };
}

// ─── Pinned comments (legacy view onto contract_change_requests) ─────────────
/** A comment on a contract. `anchor_kind`:
 *   'field'    → anchor_ref is a field_key (stable),
 *   'span'     → anchor_ref is a clause/section id + `quote` is the selected text
 *                (relocated by quote-match after re-merge; `is_stale` when lost),
 *   'document' → whole-document comment (and all replies).
 *  Threaded: a reply carries `parent_comment_id`; resolving the root closes the
 *  thread to further replies.
 *
 *  NOTE: this now reads the SAME rows as ContractChangeRequestEntry — the tables
 *  merged. `parent_comment_id` is mapped from `parent_request_id` below. */
export interface ContractComment {
  id: string;
  parent_comment_id: string | null;
  anchor_kind: 'field' | 'span' | 'document';
  anchor_ref: string | null;
  quote: string | null;
  quote_prefix: string | null;
  is_stale: boolean;
  needs_review: boolean;
  body: string;
  author_label: string | null;
  author_role: string | null;
  author_contact_id: string | null;
  resolved_at: string | null;
  edited_at: string | null;
  created_at: string;
}
export async function contractCommentsList(documentId: string): Promise<ContractComment[]> {
  const { data, error } = await supabase.rpc('contract_comments_list', { p_document_id: documentId });
  if (error) throw error;
  // the merged table names the thread column `parent_request_id`; keep the
  // comment-era shape for callers that still speak it.
  type Row = ContractChangeRequestEntry & {
    parent_comment_id?: string | null; quote?: string | null; quote_prefix?: string | null;
  };
  return ((data ?? []) as Row[]).map((r): ContractComment => ({
    ...r,
    quote: r.quote ?? null,
    quote_prefix: r.quote_prefix ?? null,
    parent_comment_id: r.parent_comment_id ?? r.parent_request_id ?? null,
  }));
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
export async function editContractComment(commentId: string, body: string): Promise<void> {
  const { error } = await supabase.rpc('edit_contract_comment', { p_comment_id: commentId, p_body: body });
  if (error) throw error;
}
export async function deleteContractComment(commentId: string): Promise<void> {
  const { error } = await supabase.rpc('delete_contract_comment', { p_comment_id: commentId });
  if (error) throw error;
}
export async function markCommentReview(commentId: string, on = true): Promise<void> {
  const { error } = await supabase.rpc('mark_comment_review', { p_comment_id: commentId, p_on: on });
  if (error) throw error;
}
/** The current caller's contact id for this document (to tell "my" comments apart). */
export async function myCommentIdentity(documentId: string): Promise<string | null> {
  const { data, error } = await supabase.rpc('comment_author_identity', { p_document_id: documentId });
  if (error) return null;
  const row = Array.isArray(data) ? data[0] : data;
  return (row?.contact_id as string) ?? null;
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

// ─── Contract notes (the third drawer) ──────────────────────────────────────
/** A titled conversation thread on a contract. Distinct from a change request:
 *  a note proposes no edit and has no resolution lifecycle — it is a contained
 *  space for the parties to talk. */
export interface ContractNoteMessage {
  id: string;
  body: string;
  created_at: string;
  author: string;
  mine: boolean;
}
export interface ContractNote {
  id: string;
  title: string;
  created_at: string;
  mine: boolean;
  messages: ContractNoteMessage[];
}

export async function contractNotes(documentId: string): Promise<ContractNote[]> {
  const { data, error } = await supabase.rpc('contract_notes_for_document', {
    p_document_id: documentId,
  });
  if (error) throw error;
  return (data ?? []) as ContractNote[];
}

/** Create a thread. Omit the title and the DB assigns "Note N", N incrementing
 *  per document (counting deleted ones, so a default title is never reused). */
export async function createContractNote(documentId: string, title?: string): Promise<string> {
  const { data, error } = await supabase.rpc('create_contract_note', {
    p_document_id: documentId, p_title: title ?? null,
  });
  if (error) throw error;
  return data as string;
}

export async function renameContractNote(noteId: string, title: string): Promise<void> {
  const { error } = await supabase.rpc('rename_contract_note', {
    p_note_id: noteId, p_title: title,
  });
  if (error) throw error;
}

export async function postContractNoteMessage(noteId: string, body: string): Promise<void> {
  const { error } = await supabase.rpc('post_contract_note_message', {
    p_note_id: noteId, p_body: body,
  });
  if (error) throw error;
}

// ─── Signature / edit rules (deal plan L9) ───────────────────────────────────
// A document signed by EITHER party is read-only. To change it, the signing
// party removes their signature. Edits no longer void signatures silently —
// they are refused, and a signature comes off only when its signer takes it off.

export interface DocumentSignatureState {
  signed_count: number;
  locked_by_signature: boolean;
  i_have_signed: boolean;
  signers: { contact_id: string; party_role: string; name: string | null; signed_at: string }[];
}

/** Who has signed, and therefore whether the document is locked to edits. */
export async function documentSignatureState(documentId: string): Promise<DocumentSignatureState> {
  const { data, error } = await supabase.rpc('document_signature_state', { p_document_id: documentId });
  if (error) throw error;
  return data as DocumentSignatureState;
}

/** The signer withdraws their own signature, which is what unlocks editing.
 *  Staff may act on a party's behalf. The attested state is archived first —
 *  the record of a signature having been given is never destroyed. */
export async function removeMySignature(
  documentId: string, contactId?: string,
): Promise<{ removed: number; roles?: string[]; message?: string }> {
  const { data, error } = await supabase.rpc('remove_my_signature', {
    p_document_id: documentId, p_contact_id: contactId ?? null,
  });
  if (error) throw error;
  return data as { removed: number; roles?: string[]; message?: string };
}

/** Ask the signer(s) to remove their signature so the document can be changed. */
export async function requestPermissionToEdit(
  documentId: string, message?: string,
): Promise<{ notified: number }> {
  const { data, error } = await supabase.rpc('request_permission_to_edit', {
    p_document_id: documentId, p_message: message ?? null,
  });
  if (error) throw error;
  return data as { notified: number };
}

/** Tell the other parties there are changes to review. */
export async function notifyReviewChanges(
  documentId: string, message?: string,
): Promise<{ notified: number }> {
  const { data, error } = await supabase.rpc('notify_review_changes', {
    p_document_id: documentId, p_message: message ?? null,
  });
  if (error) throw error;
  return data as { notified: number };
}

export interface ChangeSinceSignature {
  id: string;
  change_kind: string;
  field_key: string | null;
  field_label: string | null;
  old_value: string | null;
  new_value: string | null;
  actor: string | null;
  at: string;
}

/** What changed after this party's signature came off — the review list. */
export async function changesSinceSignature(
  documentId: string, contactId?: string,
): Promise<ChangeSinceSignature[]> {
  const { data, error } = await supabase.rpc('document_changes_since_signature', {
    p_document_id: documentId, p_contact_id: contactId ?? null,
  });
  if (error) throw error;
  return (data ?? []) as ChangeSinceSignature[];
}

export interface ContractEventLogRow {
  occurred_at: string;
  kind: 'STATUS' | 'SENT' | 'DELIVERED' | 'SIGNED' | 'EDITS' | 'OPENED';
  actor: string;
  detail: string;
}

/** Staff-only unified event feed for a document: status, sends, signatures, opens, edit summaries. */
export async function contractEventLog(documentId: string): Promise<ContractEventLogRow[]> {
  const { data, error } = await supabase.rpc('contract_event_log', {
    p_document_id: documentId,
  });
  if (error) throw error;
  return (data ?? []) as ContractEventLogRow[];
}

/** One resolved notification from the permanent notification log (CLOSEOUT
 *  §1.8, owner ruling 2026-08-18: "the log is our source of truth"). A row is
 *  written the moment a notification is resolved — before its delete, in the
 *  same transaction — and is never swept. Staff-only read. */
export interface ContractNotificationLogRow {
  kind: string;
  category: string | null;
  title: string | null;
  author: string;
  reason: string | null;
  recipient: string | null;
  raised_at: string;
  emailed_at: string | null;
  locations: string[];
  outcome: string;
  outcome_at: string;
}

export async function contractNotificationLog(
  documentId: string,
): Promise<ContractNotificationLogRow[]> {
  const { data, error } = await supabase.rpc('contract_notification_log', {
    p_document_id: documentId,
  });
  if (error) throw error;
  return (data ?? []) as ContractNotificationLogRow[];
}
