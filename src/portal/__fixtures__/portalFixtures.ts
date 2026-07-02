/**
 * Portal fixtures — typed, deterministic seed rows mirroring the REAL column
 * shapes RLS returns to a portal/public caller. Every fixture is typed against
 * the shared ops-layer domain types (`src/lib/ops/types.ts`) or the module
 * schema so portal/public slices can render + test against a stable seam without
 * re-declaring KIT/backbone types or hitting the network.
 *
 * Column shapes verified against the backbone migrations:
 *   - engagements                 20260629030000_engagements_horses_backbone.sql
 *   - documents (merged_body)     20260629050000… + generate_document
 *   - horse_parties               20260630080000_mod_horserecords.sql
 *   - billable_lines              20260630040000_products_billing.sql
 *   - org_public_config (jsonb)   20260630020000_value_registry.sql
 */
import type {
  Engagement,
  DocumentRow,
  BillableLine,
} from '../../lib/ops/types';

// ─── Engagement row ──────────────────────────────────────────────────────────
export const engagementFixture: Engagement = {
  id: 'eng-00000000-0000-0000-0000-000000000001',
  display_code: 'ENG-1042',
  client_id: 'cli-00000000-0000-0000-0000-000000000001',
  assigned_staff_id: 'usr-00000000-0000-0000-0000-000000000009',
  service_type: 'PURCHASE_REP',
  status: 'ACTIVE',
  primary_horse_id: 'hrs-00000000-0000-0000-0000-000000000001',
  start_date: '2026-06-15',
  notes: 'Buyer representation for hunter prospect.',
  created_at: '2026-06-15T14:03:00.000Z',
  updated_at: '2026-06-20T09:12:00.000Z',
};

// ─── Document row (with merged_body) ─────────────────────────────────────────
export const documentFixture: DocumentRow = {
  id: 'doc-00000000-0000-0000-0000-000000000001',
  display_code: 'DOC-2201',
  engagement_id: engagementFixture.id,
  template_id: 'tpl-00000000-0000-0000-0000-000000000001',
  title: 'Purchase Representation Agreement',
  merged_body:
    '# Purchase Representation Agreement\n\nThis agreement is made between ' +
    'Fair Hill Equine and the Buyer for representation in the acquisition of ' +
    'the horse identified herein. The commission shall be 10% of the purchase ' +
    'price, due on execution.',
  status: 'EXECUTED',
  generated_at: '2026-06-16T10:00:00.000Z',
  effective_date: '2026-06-16',
  created_at: '2026-06-16T10:00:00.000Z',
  updated_at: '2026-06-17T11:30:00.000Z',
};

// ─── horse_parties row ───────────────────────────────────────────────────────
export type HorsePartyRole =
  | 'owner'
  | 'lessee'
  | 'trainer'
  | 'caretaker'
  | 'boarder';

/** Mirrors public.horse_parties (20260630080000_mod_horserecords.sql). */
export interface HorseParty {
  id: string;
  org_id: string;
  horse_id: string;
  contact_id: string;
  role: HorsePartyRole;
  share_pct: number | null;
  effective_from: string | null;
  effective_to: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  deleted_by: string | null;
}

export const horsePartyFixture: HorseParty = {
  id: 'hp-00000000-0000-0000-0000-000000000001',
  org_id: 'org-00000000-0000-0000-0000-000000000001',
  horse_id: engagementFixture.primary_horse_id as string,
  contact_id: 'con-00000000-0000-0000-0000-000000000001',
  role: 'owner',
  share_pct: 100,
  effective_from: '2026-01-01',
  effective_to: null,
  notes: 'Sole registered owner.',
  created_at: '2026-01-01T00:00:00.000Z',
  updated_at: '2026-01-01T00:00:00.000Z',
  deleted_at: null,
  deleted_by: null,
};

// ─── billable_lines rows ─────────────────────────────────────────────────────
export const billableLineFixtures: BillableLine[] = [
  {
    id: 'bl-00000000-0000-0000-0000-000000000001',
    org_id: horsePartyFixture.org_id,
    payer_contact_id: horsePartyFixture.contact_id,
    source_kind: 'board',
    source_id: 'ba-00000000-0000-0000-0000-000000000001',
    horse_id: horsePartyFixture.horse_id,
    qty: 1,
    unit_amount: 1200,
    amount: 1200,
    status: 'OPEN',
    period: '["2026-06-01 00:00:00+00","2026-07-01 00:00:00+00")',
    transaction_id: null,
    created_at: '2026-06-01T00:00:00.000Z',
    updated_at: '2026-06-01T00:00:00.000Z',
  },
  {
    id: 'bl-00000000-0000-0000-0000-000000000002',
    org_id: horsePartyFixture.org_id,
    payer_contact_id: horsePartyFixture.contact_id,
    source_kind: 'consumption',
    source_id: 'ce-00000000-0000-0000-0000-000000000002',
    horse_id: horsePartyFixture.horse_id,
    qty: 8,
    unit_amount: 22.5,
    amount: 180,
    status: 'SETTLED',
    period: '["2026-06-01 00:00:00+00","2026-07-01 00:00:00+00")',
    transaction_id: 'txn-00000000-0000-0000-0000-000000000003',
    created_at: '2026-06-30T00:00:00.000Z',
    updated_at: '2026-07-01T00:00:00.000Z',
  },
];

// ─── org_public_config (jsonb from org_public_config(slug)) ──────────────────
/** Mirrors the jsonb org_public_config(slug) returns (20260630020000). */
export interface OrgPublicConfig {
  org_id: string;
  slug: string;
  /** Flat BRAND.* object merged with CONTACT_<KEY> public-safe fields. */
  brand: Record<string, string>;
  /** Active public module keys. */
  modules: string[];
  /** Active products at current effective price (no commission/e-sign). */
  pricing: { product_key: string; name: string; amount: number }[];
}

export const orgPublicConfigFixture: OrgPublicConfig = {
  org_id: horsePartyFixture.org_id,
  slug: 'fair-hill-equine',
  brand: {
    NAME: 'Fair Hill Equine',
    SHORT_NAME: 'FHE',
    TAGLINE: 'Sport horse brokerage & care',
    PRIMARY_COLOR: '#1b4332',
    SECONDARY_COLOR: '#d8f3dc',
    CONTACT_PHONE: '+1-555-0100',
    CONTACT_EMAIL: 'hello@fairhillequine.example',
    CONTACT_URL: 'https://fairhillequine.example',
  },
  modules: ['mod.brokerage', 'mod.boarding', 'mod.lessons'],
  pricing: [
    { product_key: 'BOARD_FULL', name: 'Full-care board', amount: 1200 },
    { product_key: 'LESSON_PRIVATE', name: 'Private lesson', amount: 85 },
  ],
};
