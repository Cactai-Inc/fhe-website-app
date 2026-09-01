/*
  # FHE CRM — Contract Templates & Token Dictionary (migration 11)

  Phase 1, step 3. Additive. Builds the template-assembly substrate:

  - contract_templates — one row per canonical contract (the 17 survivors after
    the Group A de-duplication). Seeded here with metadata (key, title, the
    service it generates from, the party namespaces on its signature blocks);
    the tokenized legal `body` is loaded in Phase 2 (RECONCILIATION_SPEC Group A),
    so body is nullable now.
  - template_tokens — the Merge Token Dictionary, in the database. Generated from
    MERGE_TOKEN_DICTIONARY.md; they must match (the db test enforces it). Global
    dictionary rows have template_id = NULL; Phase 2 attaches per-template usage
    rows as each contract body is tokenized.

  Party-scoped tokens (the shared person field set, and every {{SIG.*}}) are
  stored once under the placeholder namespace 'PARTY' with party_scoped = true:
  the merge layer expands PARTY → the concrete party_role (BUYER/SELLER/…) per
  engagement_parties row. This is why one dictionary row serves every namespace.

  RLS (security model E11): contract_templates is all-read-active / admin-write;
  template_tokens is authenticated-read / admin-write.

  source_table/source_column are documentation metadata (text, not FKs) — some
  point at tables created in later migrations (transactions, documents, intake).
*/

-- ============================================================
-- contract_templates — the canonical contracts
-- ============================================================
CREATE TABLE IF NOT EXISTS contract_templates (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_key     text UNIQUE NOT NULL,
  title            text NOT NULL,
  service_type     text REFERENCES service_types(code),   -- NULL for non-service docs (releases, facility)
  party_namespaces text[] NOT NULL DEFAULT '{}',
  body             text,                                  -- tokenized legal text; loaded in Phase 2
  version          integer NOT NULL DEFAULT 1,
  active           boolean NOT NULL DEFAULT true,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),
  deleted_at       timestamptz,
  deleted_by       uuid REFERENCES profiles(user_id) ON DELETE SET NULL,
  CONSTRAINT contract_templates_parties_present CHECK (cardinality(party_namespaces) > 0)
);

DROP TRIGGER IF EXISTS contract_templates_set_updated_at ON contract_templates;
CREATE TRIGGER contract_templates_set_updated_at BEFORE UPDATE ON contract_templates
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- The 17 canonical contracts (party namespaces per MERGE_TOKEN_DICTIONARY.md
-- §"Party namespaces"). service_type maps to the 13-value catalog where the
-- contract is the legal artifact of a specific service; NULL where it is not
-- service-specific (lease applies to both in/out, releases apply broadly).
INSERT INTO contract_templates (template_key, title, service_type, party_namespaces) VALUES
  ('HORSE_PURCHASE_SALE',      'Horse Purchase and Sale Agreement',                'HORSE_PURCHASE_ASSISTANCE', ARRAY['BUYER','SELLER','FHE']),
  ('HORSE_SALE_TRANSFER',      'Horse Sale and Transfer Agreement',                'HORSE_SALE_ASSISTANCE',     ARRAY['SELLER','BUYER','FHE']),
  ('HORSE_LEASE',              'Horse Lease Agreement',                            NULL,                        ARRAY['LESSOR','LESSEE','FHE']),
  ('HORSE_REPRESENTATION',     'Horse Lease/Purchase Representation Agreement',     NULL,                        ARRAY['CLIENT','FHE']),
  ('HORSE_SEARCH_RETAINER',    'Horse Search and Acquisition Retainer',            'HORSE_FINDER',              ARRAY['CLIENT','FHE']),
  ('HORSE_EVALUATION',         'Horse Evaluation Services Agreement',              'HORSE_EVALUATION',          ARRAY['CLIENT','FHE']),
  ('HORSE_TRAINING',           'Horse Training Services Agreement',                'HORSE_TRAINING',            ARRAY['CLIENT','FHE']),
  ('HORSE_EXERCISE',           'Horse Exercise Services Agreement',                'HORSE_EXERCISE',            ARRAY['CLIENT','FHE']),
  ('HORSEMANSHIP_TRAINING',    'Horsemanship Training Agreement',                  'HORSEMANSHIP_TRAINING',     ARRAY['PARTICIPANT','GUARDIAN','FHE']),
  ('RIDER_LESSON_JUMPER',      'Rider Lesson and Jumper Training Agreement',       'RIDING_LESSON',             ARRAY['PARTICIPANT','GUARDIAN','FHE']),
  ('MINOR_RIDER',              'Minor Rider Agreement',                            NULL,                        ARRAY['PARTICIPANT','GUARDIAN','FHE']),
  ('INDEPENDENT_CONTRACTOR',   'Independent Contractor Agreement',                 'INDEPENDENT_CONTRACTOR',    ARRAY['CONTRACTOR','FHE']),
  ('HORSE_EMERGENCY_VET',      'Horse Emergency Veterinary Authorization',         NULL,                        ARRAY['OWNER','FHE']),
  ('HUMAN_EMERGENCY_MEDICAL',  'Human Emergency Medical Authorization v2',         NULL,                        ARRAY['PARTICIPANT','GUARDIAN','FHE']),
  ('MEDIA_RELEASE',            'Photo/Video/Media Release',                        NULL,                        ARRAY['PARTICIPANT','GUARDIAN','FHE']),
  ('FACILITY_RULES',           'Facility Rules and Safety Acknowledgment',         NULL,                        ARRAY['CLIENT','FHE']),
  ('FACILITY_LICENSE',         'Facility Use and Business Operations License',     NULL,                        ARRAY['OWNER','FHE'])
ON CONFLICT (template_key) DO UPDATE SET
  title = EXCLUDED.title, service_type = EXCLUDED.service_type,
  party_namespaces = EXCLUDED.party_namespaces;

-- ============================================================
-- template_tokens — the Merge Token Dictionary, in the database
-- ============================================================
CREATE TABLE IF NOT EXISTS template_tokens (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id   uuid REFERENCES contract_templates(id) ON DELETE CASCADE,  -- NULL = global dictionary entry
  namespace     text NOT NULL,
  field         text NOT NULL,
  token         text NOT NULL,                          -- literal pattern, e.g. {{PARTY.FULL_NAME}}
  kind          text NOT NULL CHECK (kind IN ('field','system','signature')),
  source_table  text,
  source_column text,
  computed      boolean NOT NULL DEFAULT false,          -- value is computed/config, not a stored column
  required      boolean NOT NULL DEFAULT false,
  party_scoped  boolean NOT NULL DEFAULT false,          -- namespace is the PARTY placeholder, expanded per party
  notes         text,
  created_at    timestamptz NOT NULL DEFAULT now()
);

-- One canonical definition per (namespace, field) in the global dictionary.
CREATE UNIQUE INDEX IF NOT EXISTS template_tokens_dict_uniq
  ON template_tokens (namespace, field) WHERE template_id IS NULL;
CREATE INDEX IF NOT EXISTS template_tokens_template_idx ON template_tokens (template_id);

-- Seed the global dictionary (template_id NULL). Mirrors MERGE_TOKEN_DICTIONARY.md
-- section by section. party_scoped rows live under namespace 'PARTY'.
INSERT INTO template_tokens (namespace, field, token, kind, source_table, source_column, computed, required, party_scoped, notes) VALUES
  -- Person field set (shared across every party namespace) ----------------------
  ('PARTY','FULL_NAME',     '{{PARTY.FULL_NAME}}',     'field', 'contacts',      'full_name',    false, true,  true,  'Full Legal Name / Name'),
  ('PARTY','PHONE',         '{{PARTY.PHONE}}',         'field', 'contacts',      'phone',        false, false, true,  NULL),
  ('PARTY','EMAIL',         '{{PARTY.EMAIL}}',         'field', 'contacts',      'email',        false, false, true,  NULL),
  ('PARTY','ADDRESS',       '{{PARTY.ADDRESS}}',       'field', 'contacts',      'address_composed', false, false, true, 'single-line composed address'),
  ('PARTY','PRINTED_NAME',  '{{PARTY.PRINTED_NAME}}',  'field', 'contacts',      'full_name',    false, false, true,  'signature block printed name'),
  ('PARTY','TITLE',         '{{PARTY.TITLE}}',         'field', 'contact_roles', 'title',        false, false, true,  'only where a title applies'),
  ('PARTY','RELATIONSHIP',  '{{PARTY.RELATIONSHIP}}',  'field', 'engagement_parties', 'relationship', false, false, true, 'e.g. parent of participant'),
  -- FHE company namespace -------------------------------------------------------
  ('FHE','LEGAL_NAME',      '{{FHE.LEGAL_NAME}}',      'field', 'config',  'legal_entity_name',   true,  false, false, 'blank until owner supplies; DBA French Heritage Equestrian'),
  ('FHE','SIGNATORY_NAME',  '{{FHE.SIGNATORY_NAME}}',  'field', 'config',  'signatory_name',      true,  false, false, NULL),
  ('FHE','SIGNATORY_TITLE', '{{FHE.SIGNATORY_TITLE}}', 'field', 'config',  'signatory_title',     true,  false, false, NULL),
  ('FHE','PHONE',           '{{FHE.PHONE}}',           'field', 'brand',   'phone_display',       true,  false, false, '858-439-3614'),
  ('FHE','EMAIL',           '{{FHE.EMAIL}}',           'field', 'brand',   'email',               true,  false, false, 'Hello@FHEquestrian.com'),
  ('FHE','ADDRESS',         '{{FHE.ADDRESS}}',         'field', 'config',  'business_address',    true,  false, false, NULL),
  -- Horse namespace -------------------------------------------------------------
  ('HORSE','REGISTERED_NAME',    '{{HORSE.REGISTERED_NAME}}',    'field', 'horses', 'registered_name',     false, false, false, NULL),
  ('HORSE','BARN_NAME',          '{{HORSE.BARN_NAME}}',          'field', 'horses', 'barn_name',           false, false, false, NULL),
  ('HORSE','BREED',              '{{HORSE.BREED}}',              'field', 'horses', 'breed',               false, false, false, 'resolved via horse_breeds lookup'),
  ('HORSE','COLOR',              '{{HORSE.COLOR}}',              'field', 'horses', 'color',               false, false, false, 'resolved via horse_colors lookup'),
  ('HORSE','SEX',                '{{HORSE.SEX}}',                'field', 'horses', 'sex',                 false, false, false, NULL),
  ('HORSE','AGE_DOB',            '{{HORSE.AGE_DOB}}',            'field', 'horses', 'date_of_birth',       false, false, false, 'rendered as age or DOB'),
  ('HORSE','HEIGHT',             '{{HORSE.HEIGHT}}',             'field', 'horses', 'height',              false, false, false, NULL),
  ('HORSE','REGISTRATION_NUMBER','{{HORSE.REGISTRATION_NUMBER}}','field', 'horses', 'registration_number', false, false, false, NULL),
  ('HORSE','MICROCHIP',          '{{HORSE.MICROCHIP}}',          'field', 'horses', 'microchip_id',        false, false, false, NULL),
  ('HORSE','CURRENT_LOCATION',   '{{HORSE.CURRENT_LOCATION}}',   'field', 'horses', 'current_location',    false, false, false, NULL),
  -- Transaction / money namespace (transactions table arrives in a later migration)
  ('TXN','PURCHASE_PRICE',   '{{TXN.PURCHASE_PRICE}}',   'field', 'transactions', 'amount',            false, false, false, NULL),
  ('TXN','DEPOSIT_AMOUNT',   '{{TXN.DEPOSIT_AMOUNT}}',   'field', 'transactions', 'deposit_amount',    false, false, false, NULL),
  ('TXN','DEPOSIT_TERMS',    '{{TXN.DEPOSIT_TERMS}}',    'field', 'transactions', 'deposit_terms',     false, false, false, NULL),
  ('TXN','BALANCE_DUE',      '{{TXN.BALANCE_DUE}}',      'field', NULL,           NULL,                true,  false, false, 'computed: price - deposit'),
  ('TXN','PAYMENT_TERMS',    '{{TXN.PAYMENT_TERMS}}',    'field', 'transactions', 'payment_terms',     false, false, false, NULL),
  ('TXN','PAYMENT_SCHEDULE', '{{TXN.PAYMENT_SCHEDULE}}', 'field', 'transactions', 'payment_schedule',  false, false, false, NULL),
  ('TXN','COMMISSION_RATE',  '{{TXN.COMMISSION_RATE}}',  'field', 'config',       'commission_rate',   true,  false, false, 'blank until owner supplies'),
  ('TXN','COMMISSION_MIN',   '{{TXN.COMMISSION_MIN}}',   'field', 'config',       'commission_min',    true,  false, false, 'blank until owner supplies'),
  ('TXN','LEASE_TERM',       '{{TXN.LEASE_TERM}}',       'field', 'transactions', 'lease_term',        false, false, false, NULL),
  ('TXN','TRIAL_PERIOD',     '{{TXN.TRIAL_PERIOD}}',     'field', 'transactions', 'trial_period',      false, false, false, NULL),
  ('TXN','DELIVERY_DATE',    '{{TXN.DELIVERY_DATE}}',    'field', 'transactions', 'delivery_date',     false, false, false, NULL),
  ('TXN','DELIVERY_LOCATION','{{TXN.DELIVERY_LOCATION}}','field', 'transactions', 'delivery_location', false, false, false, NULL),
  -- Engagement / service namespace ---------------------------------------------
  ('ENG','ID',               '{{ENG.ID}}',               'field', 'engagements', 'display_code',  false, true,  false, 'ENG-YYYY-NNNNNN'),
  ('ENG','SERVICE_TYPE',     '{{ENG.SERVICE_TYPE}}',     'field', 'engagements', 'service_type',  false, false, false, '13-value catalog'),
  ('ENG','START_DATE',       '{{ENG.START_DATE}}',       'field', 'engagements', 'start_date',    false, false, false, NULL),
  ('ENG','INTENDED_USE',     '{{ENG.INTENDED_USE}}',     'field', 'intake',      'intended_use',  false, false, false, 'intake table arrives later'),
  ('ENG','DISCIPLINE',       '{{ENG.DISCIPLINE}}',       'field', 'intake',      'discipline',    false, false, false, 'intake table arrives later'),
  ('ENG','BUDGET',           '{{ENG.BUDGET}}',           'field', 'intake',      'budget',        false, false, false, 'intake table arrives later'),
  ('ENG','PROTECTION_PERIOD','{{ENG.PROTECTION_PERIOD}}','field', 'config',      'protection_period', true, false, false, 'representation protection window'),
  -- System / document namespace ------------------------------------------------
  ('DOC','UUID',           '{{DOC.UUID}}',           'system', 'documents', 'id',           false, true,  false, NULL),
  ('DOC','ID',             '{{DOC.ID}}',             'system', 'documents', 'display_code', false, false, false, 'DOC-...'),
  ('DOC','GENERATED_DATE', '{{DOC.GENERATED_DATE}}', 'system', NULL,        NULL,           true,  true,  false, 'now() at generation'),
  ('DOC','EFFECTIVE_DATE', '{{DOC.EFFECTIVE_DATE}}', 'system', 'documents', 'effective_date', false, false, false, 'set at execution'),
  -- Signature namespace (party-scoped; never pre-merged) -----------------------
  ('PARTY','SIG_NAME', '{{SIG.PARTY.NAME}}', 'signature', 'signatures', 'typed_name', false, true,  true, 'filled when signer types name'),
  ('PARTY','SIG_DATE', '{{SIG.PARTY.DATE}}', 'signature', 'signatures', 'signed_at',  false, true,  true, 'signature timestamp'),
  ('PARTY','SIG_IP',   '{{SIG.PARTY.IP}}',   'signature', 'signatures', 'ip_address', false, false, true, 'captured for the audit trail')
ON CONFLICT DO NOTHING;

-- ============================================================
-- RLS
-- ============================================================
ALTER TABLE contract_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE template_tokens ENABLE ROW LEVEL SECURITY;

-- contract_templates: everyone reads ACTIVE (non-deleted) templates; admin sees
-- all and writes. (A client may preview the blank contract they will sign.)
DROP POLICY IF EXISTS contract_templates_read_active ON contract_templates;
CREATE POLICY contract_templates_read_active ON contract_templates
  FOR SELECT TO anon, authenticated
  USING (is_admin() OR (active AND deleted_at IS NULL));

DROP POLICY IF EXISTS contract_templates_admin_write ON contract_templates;
CREATE POLICY contract_templates_admin_write ON contract_templates
  FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin());

-- template_tokens: merge metadata — authenticated read, admin write.
DROP POLICY IF EXISTS template_tokens_read ON template_tokens;
CREATE POLICY template_tokens_read ON template_tokens
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS template_tokens_admin_write ON template_tokens;
CREATE POLICY template_tokens_admin_write ON template_tokens
  FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin());

-- ============================================================
-- Indexes
-- ============================================================
CREATE INDEX IF NOT EXISTS contract_templates_service_idx ON contract_templates (service_type);
CREATE INDEX IF NOT EXISTS contract_templates_active_idx  ON contract_templates (active) WHERE deleted_at IS NULL;
