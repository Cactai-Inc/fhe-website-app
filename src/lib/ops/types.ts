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
  barn_name: string | null;
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
    | 'registered_name' | 'barn_name' | 'breed' | 'color' | 'sex'
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

/** getEngagement() rollup: the engagement row plus its related-record children. */
export interface EngagementDetail extends Engagement {
  stages: EngagementStage[];
  documents: DocumentRow[];
  transactions: Transaction[];
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
  engagement_id: string;
  template_id: string | null;
  title: string | null;
  merged_body: string | null;
  status: string;
  generated_at: string;
  effective_date: string | null;
  created_at: string;
  updated_at: string;
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

// ─── Transactions & billing ──────────────────────────────────────────────────

export interface Transaction {
  id: string;
  display_code: string | null;
  engagement_id: string;
  txn_type: 'PURCHASE' | 'SALE' | 'LEASE';
  amount: number | null;
  deposit_amount: number | null;
  status: string;
  created_at: string;
  updated_at: string;
}

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

/** settle_billable_lines(p_payer_contact_id, p_period) → TABLE(transaction_id, amount, lines_settled). */
export interface SettlementResult {
  transaction_id: string;
  amount: number;
  lines_settled: number;
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
