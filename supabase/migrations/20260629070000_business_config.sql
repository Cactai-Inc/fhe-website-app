/*
  # FHE CRM — Business Config (migration 14)

  Phase 1, step 6 — closes the Phase 1 schema. Additive.

  business_config is the single home for the owner-supplied blanks (security
  model §11; reconciliation E10). One singleton row; every value nullable so the
  schema ships before the business values are decided, and they are filled in
  before go-live. The Phase 3 document-merge RPC (SECURITY DEFINER) reads this to
  fill {{FHE.*}}, {{TXN.COMMISSION_*}}, and {{ENG.PROTECTION_PERIOD}} tokens.

  RLS: admin-only. These are internal commercial terms (commission, retention,
  e-sign provider); they are not exposed to clients directly — contract-facing
  values reach clients only through the merged document the RPC produces.

  Config changes are audited (they alter contract terms), so the audit trigger
  from migration 13 is attached here too.
*/

-- ============================================================
-- business_config — singleton owner/business settings
-- ============================================================
CREATE TABLE IF NOT EXISTS business_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Legal entity / signatory ({{FHE.*}})
  legal_entity_name   text,
  entity_formation    text,                -- e.g. "California LLC"
  registered_agent    text,
  signatory_name      text,
  signatory_title     text,
  business_address    text,

  -- Commission ({{TXN.COMMISSION_RATE}} resolved by transaction type; {{TXN.COMMISSION_MIN}})
  commission_purchase_rate numeric(5,2),   -- percent
  commission_sale_rate     numeric(5,2),
  commission_lease_rate    numeric(5,2),
  commission_min           numeric(12,2),  -- dollars

  -- Travel fee (method undecided in the pricing spec)
  travel_fee_method   text CHECK (travel_fee_method IS NULL OR travel_fee_method IN ('FLAT','MILEAGE','TIME')),
  travel_fee_amount   numeric(12,2),

  -- Cancellation / late / no-show
  cancellation_fee    numeric(12,2),
  late_fee            numeric(12,2),
  no_show_fee         numeric(12,2),

  -- Representation protection window ({{ENG.PROTECTION_PERIOD}})
  protection_period   text,                -- e.g. "12 months"

  -- Tax, retention, e-signature
  sales_tax_rate      numeric(5,2),
  document_retention  text,                -- e.g. "7 years"
  esignature_provider text,

  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Singleton: a unique index on a constant permits exactly one row.
CREATE UNIQUE INDEX IF NOT EXISTS business_config_singleton ON business_config ((true));

DROP TRIGGER IF EXISTS business_config_set_updated_at ON business_config;
CREATE TRIGGER business_config_set_updated_at BEFORE UPDATE ON business_config
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Seed the single (all-blank) row, idempotently.
INSERT INTO business_config (id)
  SELECT gen_random_uuid() WHERE NOT EXISTS (SELECT 1 FROM business_config);

-- Audit config changes (they alter contract terms) — reuse the migration-13 trigger.
DROP TRIGGER IF EXISTS audit_business_config ON business_config;
CREATE TRIGGER audit_business_config AFTER INSERT OR UPDATE OR DELETE ON business_config
  FOR EACH ROW EXECUTE FUNCTION audit_row_change();

-- ============================================================
-- RLS — admin only
-- ============================================================
ALTER TABLE business_config ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS business_config_admin_all ON business_config;
CREATE POLICY business_config_admin_all ON business_config
  FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin());
