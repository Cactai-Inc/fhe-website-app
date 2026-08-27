/* Shared ops-layer domain types for the core CRM / contracts / billing wrappers
 * in src/lib/api.ts (INT-API-CORE). These mirror the backbone schema:
 *   - contacts / clients            (20260629010000_crm_identity_backbone.sql)
 *   - horses / horse_breeds/colors  (20260629030000_engagements_horses_backbone.sql)
 *   - engagements / engagement_stages (…backbone + 20260630060000_mod_brokerage.sql)
 *   - contract_templates            (20260629040000_contract_templates_tokens.sql)
 *   - documents / signatures / document_deliveries (20260629050000…)
 *   - transactions                  (20260629150000_transactions.sql)
 *   - billable_lines                (20260630040000_products_billing.sql)
 *   - requests (public intake)      (20260623010000_platform_data_model.sql)
 *
 * Every field is what RLS actually returns to a staff caller; the UI slices in the
 * ops/portal waves import these so the data path stays typed end to end.
 */

// ─── CRM: contacts & clients ─────────────────────────────────────────────────

export interface Contact {
  id: string;
  display_code: string | null;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  phone: string | null;
  address_line1: string | null;
  address_line2: string | null;
  city: string | null;
  state: string | null;
  postal_code: string | null;
  country: string | null;
  address_composed: string | null;
  date_of_birth: string | null;
  tags: string[];
  notes: string | null;
  created_at: string;
  updated_at: string;
}

/** Columns a staff caller may write on a contact (id/codes/timestamps are DB-managed). */
export type ContactInput = Partial<
  Pick<
    Contact,
    | 'first_name' | 'last_name' | 'email' | 'phone'
    | 'address_line1' | 'address_line2' | 'city' | 'state' | 'postal_code'
    | 'country' | 'date_of_birth' | 'tags' | 'notes'
  >
> & { first_name: string };

/**
 * OFFICIAL identification: `first_name + ' ' + last_name`, trimmed to a single
 * space when one part is missing (owner directive 2026-07-02 — contacts carry
 * first/last only; `full_name` no longer exists). Use for ops tables, option
 * dropdowns, signature/party surfaces. Casual surfaces (greetings) use
 * `first_name` directly.
 */
export function contactName(
  c?: { first_name?: string | null; last_name?: string | null } | null,
): string {
  return [c?.first_name, c?.last_name]
    .map((part) => (part ?? '').trim())
    .filter(Boolean)
    .join(' ');
}

export type ClientStatus = 'ACTIVE' | 'INACTIVE' | 'ARCHIVED';

export interface Client {
  id: string;
  display_code: string | null;
  contact_id: string;
  status: ClientStatus;
  source: string | null;
  created_at: string;
  updated_at: string;
}

// ─── Horses & lookups ────────────────────────────────────────────────────────

export type HorseSex = 'MARE' | 'GELDING' | 'STALLION' | 'FILLY' | 'COLT';

export interface Horse {
  id: string;
  display_code: string | null;
  registered_name: string | null;
  nickname: string | null;
  breed: string | null;
  color: string | null;
  sex: HorseSex | null;
  date_of_birth: string | null;
  height: string | null;
  registration_number: string | null;
  microchip_id: string | null;
  current_location: string | null;
  current_owner_contact_id: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export type HorseInput = Partial<
  Pick<
    Horse,
    | 'registered_name' | 'nickname' | 'breed' | 'color' | 'sex'
    | 'date_of_birth' | 'height' | 'registration_number' | 'microchip_id'
    | 'current_location' | 'current_owner_contact_id' | 'notes'
  >
>;

export interface LookupCode {
  code: string;
  display_name: string;
  active: boolean;
  sort_order: number;
}

/** Resolve a horse breed/color CODE to its display name. Shared so every
 *  horse surface resolves the same way — HorseRecordsPage was rendering the
 *  raw code until TASK-PAGEMERGE (DUPECENSUS 2.1: HorsesPage, via HorseTable,
 *  was the only one that did this). */
export function lookupName(list: LookupCode[], code: string | null): string {
  if (!code) return '—';
  return list.find((l) => l.code === code)?.display_name ?? code;
}

// ─── Engagements & stages ────────────────────────────────────────────────────

export interface Engagement {
  id: string;
  display_code: string | null;
  client_id: string;
  assigned_staff_id: string | null;
  /** Canonical service code; NULL for non-service engagements (e.g. the
   *  visitor general-release kiosk, 20260702020000_sign_general_release). */
  service_type: string | null;
  status: string;
  primary_horse_id: string | null;
  start_date: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface EngagementStage {
  id: string;
  engagement_id: string;
  stage: 'SEARCH' | 'EVALUATION' | 'TRANSACTION_REP';
  retained_by: string | null;
  deal_side: 'BUY' | 'SELL' | 'LEASE_IN' | 'LEASE_OUT' | null;
  status: string;
  fee_value_key: string | null;
  effective_from: string;
  created_at: string;
  updated_at: string;
}

// ─── Contracts, documents, signatures, deliveries ────────────────────────────

export interface ContractTemplate {
  id: string;
  template_key: string;
  title: string;
  service_type: string | null;
  party_namespaces: string[];
  version: number;
  active: boolean;
}

export type DocumentStatus = 'DRAFT' | 'PENDING' | 'PARTIALLY_SIGNED' | 'EXECUTED' | 'VOID';

export interface DocumentRow {
  id: string;
  display_code: string | null;
  /** Legacy link; null on all spine docs (contract/onboarding/kiosk). */
  engagement_id?: string | null;
  /** Spine link: the contract this doc belongs to, when it's a deal doc. */
  contract_id?: string | null;
  /** Spine link: the contact who owns the doc. */
  contact_id?: string | null;
  template_id: string | null;
  title: string | null;
  merged_body: string | null;
  status: string;
  generated_at: string;
  effective_date: string | null;
  /** Tamper-evidence hash (hex sha256), stamped at the EXECUTED flip
   *  (20260703110000). NULL on drafts and pre-hardening executions. */
  execution_hash?: string | null;
  /** A8B: when the all-parties executed-copy email fired. NULL = not sent yet. */
  executed_email_sent_at?: string | null;
  /** THE TELL (TASK-SURFACEEDITOR): the template version this document was
   *  signed against. Non-null on all 67 executed documents; the drift guard in
   *  regenerate_contract_document reads it, and the viewer now states it.
   *  `select('*')` always returned it — only the type was missing. */
  signed_template_version?: number | null;
  /** Where the template sits TODAY, embedded by getDocument. "Signed against v1"
   *  only reads as a guarantee next to it. */
  template?: { version: number | null } | null;
  created_at: string;
  updated_at: string;
}

/**
 * `document_parties.party_role` vocabulary (`document_parties_party_role_check`).
 * Distinct from `PartyRole` above (which is `signatures`' vocabulary and carries
 * `COMPANY` instead of `FHE`) — the two tables were given different spellings for
 * "the org acting as a party" and this type follows `document_parties`, the one
 * TASK-DOCCOLS reads. Ten of the fourteen have zero rows in production
 * (2026-08-11): BUYER, SELLER, OWNER, PARENT, GUARDIAN, EMERGENCY_CONTACT,
 * CONTRACTOR, FACILITY_CONTACT, RIDER, FHE.
 */
export type DocumentPartyRole =
  | 'CLIENT' | 'BUYER' | 'SELLER' | 'LESSOR' | 'LESSEE' | 'OWNER' | 'RIDER'
  | 'PARTICIPANT' | 'PARENT' | 'GUARDIAN' | 'EMERGENCY_CONTACT'
  | 'CONTRACTOR' | 'FACILITY_CONTACT' | 'FHE';

/** One `document_parties` row as embedded onto a queue row — the raw material
 *  `deriveDocumentParties` (`src/lib/ops/partyDisplay.ts`) collapses into
 *  Party 1 / Party 2. `contact.is_company` is what marks the org acting as a
 *  party (the company contact has been observed under `LESSEE`, not `FHE` —
 *  the role actually held varies; company-ness does not). */
export interface DocumentPartyRow {
  contact_id: string;
  party_role: DocumentPartyRole;
  signer_order: number | null;
  contact: { first_name: string | null; last_name: string | null; is_company: boolean } | null;
}

/** One `signatures` row as embedded onto a queue row — raw material for
 *  Date Signed (`max(signed_at)` over non-deleted rows; there is no
 *  `documents.signed_at` column). */
export interface DocumentSignatureRow {
  signed_at: string | null;
  deleted_at: string | null;
}

/**
 * OPS-DOCS-QUEUE row — what the staff work-queue actually renders. A slim
 * projection of `documents` (never `merged_body`) plus the party/horse/version
 * the row is already carrying, embedded via a single query
 * (contacts/horses/contract_templates/document_parties/signatures FKs) rather
 * than N+1 lookups. TASK-DOCCOLS (20260811) added `sent_at`/`voided_at`/
 * `signed_template_version`/`parties`/`signatures`, and widened the `template`
 * embed to `version` (the current-template fallback for an unsigned doc's
 * Version column) — `title`/`template_key` dropped from the embed since the
 * Type column that read them is gone and nothing else in this row used them.
 */
export interface DocumentQueueRow {
  id: string;
  display_code: string | null;
  title: string | null;
  status: string;
  generated_at: string;
  sent_at: string | null;
  voided_at: string | null;
  signed_template_version: number | null;
  contact_id: string | null;
  horse_id: string | null;
  contract_id: string | null;
  template_id: string | null;
  archived_at: string | null;
  terminated_at: string | null;
  /** Trigger-maintained; 'superseded' when a newer executed version governs. */
  current_status: string | null;
  contact: { first_name: string | null; last_name: string | null } | null;
  horse: { registered_name: string | null; nickname: string | null } | null;
  template: { version: number | null } | null;
  parties: DocumentPartyRow[];
  signatures: DocumentSignatureRow[];
}

/**
 * A document type the "+ Add new" picker can offer. `has_clauses` is
 * DERIVED from whether `contract_clause_defs` rows exist for the key — never
 * a hardcoded list — and is what decides the card's act: authoring (clause-
 * composed) vs assign-and-generate (flat, nothing to author).
 */
export interface DocumentTypeOption {
  template_key: string;
  title: string;
  contract_kind: string | null;
  has_clauses: boolean;
}

/** generate_document(p_engagement_id, p_template_key) → (document_id, merged_body). */
export interface GeneratedDocument {
  document_id: string;
  merged_body: string;
}

export type PartyRole =
  | 'CLIENT' | 'BUYER' | 'SELLER' | 'LESSOR' | 'LESSEE' | 'OWNER' | 'RIDER'
  | 'PARTICIPANT' | 'PARENT' | 'GUARDIAN' | 'EMERGENCY_CONTACT'
  | 'CONTRACTOR' | 'FACILITY_CONTACT' | 'COMPANY';

export interface Signature {
  id: string;
  document_id: string;
  signer_contact_id: string;
  party_role: PartyRole;
  typed_name: string | null;
  signed_at: string | null;
  ip_address: string | null;
  /** Signer's browser user-agent (20260703110000 session attribution). */
  user_agent?: string | null;
  method: string | null;
  created_at: string;
}

export type DeliveryChannel = 'EMAIL' | 'PORTAL' | 'DOWNLOAD' | 'MAIL';

export interface DocumentDelivery {
  id: string;
  document_id: string;
  recipient_contact_id: string;
  channel: DeliveryChannel;
  copy_url: string | null;
  delivered_at: string;
  created_at: string;
}

export interface DeliveryInput {
  document_id: string;
  recipient_contact_id: string;
  channel?: DeliveryChannel;
  copy_url?: string | null;
}

/** An engagement party flattened for recipient pickers: contact id + role +
 *  the OFFICIAL name canon (contactName: first+last) + email (null when the
 *  contact has none on file — such a recipient cannot be emailed). */
export interface DocumentPartyContact {
  contact_id: string;
  party_role: PartyRole;
  name: string;
  email: string | null;
}

// ─── Transactions & billing ──────────────────────────────────────────────────

export type BillableLineStatus = 'OPEN' | 'SETTLED' | 'VOID';

export interface BillableLine {
  id: string;
  org_id: string;
  payer_contact_id: string;
  source_kind: 'consumption' | 'board' | 'lesson' | 'fee';
  source_id: string | null;
  horse_id: string | null;
  qty: number;
  unit_amount: number;
  amount: number;
  status: BillableLineStatus;
  period: string | null;
  transaction_id: string | null;
  created_at: string;
  updated_at: string;
}


// ─── Public intake (requests) ────────────────────────────────────────────────

export type IntakeStatus = 'new' | 'contacted' | 'invited' | 'expired' | 'converted';

export interface IntakeRequest {
  id: string;
  created_at: string;
  status: IntakeStatus;
  contact_name: string;
  contact_email: string;
  contact_phone: string | null;
  contact_method: 'text' | 'call' | 'email' | null;
  proposed_times: unknown[];
  notes: string | null;
}
