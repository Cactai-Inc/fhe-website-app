/*
  # FHE Suite — Brokerage & Contracts module (U7, migration 34) — module mod.brokerage

  Per PLATFORM_ARCHITECTURE.md §7.1 + CONTRACT_MODULE_ARCHITECTURE.md: an engagement
  is a CHAIN OF SEPARATELY-EXECUTED, INDEPENDENTLY-BILLED STAGES — search, evaluation,
  transaction-representation — with NO required predecessor. A client may enter or exit
  at any stage; the data model must NOT assume a full pipeline. Directional terminology
  (buy/sell/lease-in/lease-out) is TOKEN-DRIVEN by (retained_by, deal_side), never
  hard-coded per document.

  This migration builds:

    engagement_stages   — the separately-executed stages of an engagement. MODULE table:
                          boundary (seam 1) + module_gate('mod.brokerage') (seam 2) +
                          access (seam 3). Each stage independently created/billed with
                          no required predecessor.

    template_variants   — a GLOBAL table with NO org_id, modeled exactly like
                          contract_templates/template_tokens (§2, §7.1). Maps
                          (template_key, retained_by, deal_side) → token_overrides jsonb
                          so ONE tokenized HORSE_FINDER/representation template serves all
                          four directions without duplicated documents. World-read-active,
                          org-admin write, NO boundary, NO module_gate. Listed in the §4.3
                          intended-global allow-list. A tenant-specific override, if ever
                          needed, goes in a SEPARATE org-scoped org_template_overrides
                          table — never as a nullable org_id here.

  Brokerage-gating decision (§7.1, resolves the coherence question): brokerage entitlement
  must be CONSISTENT across all three engagement-creation RPCs. create_purchase_engagement
  already exists (migration 23) as core/ungated. U7 adds `require_module('mod.brokerage')`
  as the FIRST statement (after the auth check) of ALL THREE brokerage RPCs —
  create_purchase_engagement (via CREATE OR REPLACE, signature UNCHANGED),
  create_search_engagement, and create_lease_engagement (both new). The FHE launch tier
  includes mod.brokerage, so purchase_flow.test.ts (org #1 caller) stays green; a
  lesson-only tenant without mod.brokerage is correctly denied all three.

  Audit-trigger attachment is U14's sole job (§8.3): this migration declares
  deleted_at/deleted_by on engagement_stages but does NOT attach an audit trigger.

  Depends on U2 (has_module/require_module, from 20260630010000_entitlements.sql).
*/

-- ============================================================
-- engagement_stages — the separately-executed, independently-billed stages
--   MODULE table: boundary + module_gate('mod.brokerage') + access.
--   org_id added via the migration-26-style DO-loop below (seam 1).
-- ============================================================
CREATE TABLE IF NOT EXISTS engagement_stages (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  engagement_id  uuid NOT NULL REFERENCES engagements(id) ON DELETE CASCADE,
  stage          text NOT NULL CHECK (stage IN ('SEARCH','EVALUATION','TRANSACTION_REP')),
  retained_by    text,
  deal_side      text CHECK (deal_side IN ('BUY','SELL','LEASE_IN','LEASE_OUT')),
  status         text NOT NULL DEFAULT 'OPEN',
  fee_value_key  text,
  effective_from timestamptz NOT NULL DEFAULT now(),
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now(),
  deleted_at     timestamptz,
  deleted_by     uuid REFERENCES profiles(user_id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS engagement_stages_engagement_idx ON engagement_stages (engagement_id);

DROP TRIGGER IF EXISTS engagement_stages_set_updated_at ON engagement_stages;
CREATE TRIGGER engagement_stages_set_updated_at BEFORE UPDATE ON engagement_stages
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ------------------------------------------------------------
-- Seam 1 — tenancy boundary (migration-26 recipe, DO-loop style §8.1).
--   New table is born empty, so no backfill; DEFAULT current_org() + NOT NULL suffice.
-- ------------------------------------------------------------
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['engagement_stages'] LOOP
    EXECUTE format('ALTER TABLE %I ADD COLUMN IF NOT EXISTS org_id uuid REFERENCES organizations(id)', t);
    EXECUTE format('ALTER TABLE %I ALTER COLUMN org_id SET NOT NULL', t);
    EXECUTE format('ALTER TABLE %I ALTER COLUMN org_id SET DEFAULT current_org()', t);
    EXECUTE format('CREATE INDEX IF NOT EXISTS %I ON %I (org_id)', t||'_org_idx', t);
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I', t||'_org_boundary', t);
    EXECUTE format(
      'CREATE POLICY %I ON %I AS RESTRICTIVE FOR ALL TO authenticated '
      'USING (org_id = current_org()) WITH CHECK (org_id = current_org())',
      t||'_org_boundary', t);
  END LOOP;
END $$;

-- ------------------------------------------------------------
-- Seam 2 — module gate (module tables only) §8.2. RESTRICTIVE: ANDs with the
--   boundary, so a mod.brokerage-off tenant's rows are invisible AND unwritable
--   even to that org's own ADMIN.
-- ------------------------------------------------------------
DROP POLICY IF EXISTS engagement_stages_module_gate ON engagement_stages;
CREATE POLICY engagement_stages_module_gate ON engagement_stages AS RESTRICTIVE FOR ALL TO authenticated
  USING (has_module('mod.brokerage')) WITH CHECK (has_module('mod.brokerage'));

-- ------------------------------------------------------------
-- Seam 3 — access (PERMISSIVE, ORs within the restrictive envelope) §8.3.
--   Staff of the tenant RCUD; client reads stages of an engagement they own.
-- ------------------------------------------------------------
DROP POLICY IF EXISTS engagement_stages_staff_all ON engagement_stages;
CREATE POLICY engagement_stages_staff_all ON engagement_stages
  FOR ALL TO authenticated USING (has_staff_access()) WITH CHECK (has_staff_access());

DROP POLICY IF EXISTS engagement_stages_client_read ON engagement_stages;
CREATE POLICY engagement_stages_client_read ON engagement_stages
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM engagements e
      JOIN clients c ON c.id = e.client_id
      WHERE e.id = engagement_stages.engagement_id
        AND c.contact_id = current_contact_id()
    )
  );

-- ============================================================
-- template_variants — GLOBAL (no org_id), modeled like contract_templates (§2, §7.1).
--   (template_key, retained_by, deal_side) → token_overrides jsonb. World-read-active,
--   org-admin write, NO boundary, NO module_gate. Optional org_id override lives in a
--   SEPARATE org_template_overrides table — never a nullable column here.
-- ============================================================
CREATE TABLE IF NOT EXISTS template_variants (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_key    text NOT NULL,
  retained_by     text NOT NULL,
  deal_side       text NOT NULL CHECK (deal_side IN ('BUY','SELL','LEASE_IN','LEASE_OUT')),
  token_overrides jsonb NOT NULL DEFAULT '{}',
  active          boolean NOT NULL DEFAULT true,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (template_key, retained_by, deal_side)
);

DROP TRIGGER IF EXISTS template_variants_set_updated_at ON template_variants;
CREATE TRIGGER template_variants_set_updated_at BEFORE UPDATE ON template_variants
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

ALTER TABLE template_variants ENABLE ROW LEVEL SECURITY;

-- Global read-active (everyone reads active variants; admin sees all).
DROP POLICY IF EXISTS template_variants_read_active ON template_variants;
CREATE POLICY template_variants_read_active ON template_variants
  FOR SELECT TO anon, authenticated
  USING (is_admin() OR active);

-- Org-admin write (per spec "global read-active + org-admin write").
DROP POLICY IF EXISTS template_variants_admin_write ON template_variants;
CREATE POLICY template_variants_admin_write ON template_variants
  FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin());

-- ============================================================
-- Register the four directional HORSE_FINDER variants (§7.1 / CONTRACT_MODULE_ARCHITECTURE
-- Layer 1). One tokenized template (HORSE_SEARCH_RETAINER, service HORSE_FINDER) serves all
-- four directions; token_overrides carry the direction-specific terminology.
--   buyer  / BUY       — find a horse to buy
--   lessee / LEASE_IN  — find a horse to lease
--   owner  / SELL      — find a buyer
--   owner  / LEASE_OUT — find a lessee
-- ============================================================
INSERT INTO template_variants (template_key, retained_by, deal_side, token_overrides) VALUES
  ('HORSE_SEARCH_RETAINER', 'buyer',  'BUY',       jsonb_build_object(
     'ROLE_TERM','buyer',  'TARGET_TERM','a horse',  'DIRECTION_TERM','purchase',       'SIDE','BUY')),
  ('HORSE_SEARCH_RETAINER', 'lessee', 'LEASE_IN',  jsonb_build_object(
     'ROLE_TERM','lessee', 'TARGET_TERM','a horse',  'DIRECTION_TERM','lease (lessee)', 'SIDE','LEASE_IN')),
  ('HORSE_SEARCH_RETAINER', 'owner',  'SELL',      jsonb_build_object(
     'ROLE_TERM','owner',  'TARGET_TERM','a buyer',  'DIRECTION_TERM','sale',           'SIDE','SELL')),
  ('HORSE_SEARCH_RETAINER', 'owner',  'LEASE_OUT', jsonb_build_object(
     'ROLE_TERM','owner',  'TARGET_TERM','a lessee', 'DIRECTION_TERM','lease (lessor)', 'SIDE','LEASE_OUT'))
ON CONFLICT (template_key, retained_by, deal_side) DO NOTHING;

-- ============================================================
-- Brokerage RPC guards (§7.1 Brokerage-gating decision; Layer B enforcement §4.3).
--   ALL THREE engagement-creation RPCs gate on mod.brokerage as their first
--   statement after the auth check. require_module runs SECURITY DEFINER and protects
--   the SECURITY DEFINER RPCs that run PAST RLS.
-- ============================================================

-- create_purchase_engagement — CREATE OR REPLACE, signature UNCHANGED. Only add the
-- require_module guard; every other line is identical to migration 23. FHE (org #1)
-- has mod.brokerage, so purchase_flow.test.ts stays green.
CREATE OR REPLACE FUNCTION create_purchase_engagement(
  p_buyer_contact_id  uuid,
  p_horse_id          uuid    DEFAULT NULL,
  p_seller_contact_id uuid    DEFAULT NULL,
  p_amount            numeric DEFAULT NULL,
  p_deposit           numeric DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $fn$
DECLARE
  v_client_id uuid;
  v_eng_id    uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'authentication required';
  END IF;
  PERFORM require_module('mod.brokerage');

  -- find-or-create the buyer's client record (clients.contact_id is UNIQUE)
  SELECT id INTO v_client_id FROM clients WHERE contact_id = p_buyer_contact_id AND deleted_at IS NULL;
  IF NOT FOUND THEN
    INSERT INTO clients (contact_id) VALUES (p_buyer_contact_id) RETURNING id INTO v_client_id;
  END IF;

  INSERT INTO engagements (client_id, service_type, primary_horse_id, start_date)
    VALUES (v_client_id, 'HORSE_PURCHASE_ASSISTANCE', p_horse_id, now()::date)
    RETURNING id INTO v_eng_id;

  -- the buyer (our client) and, if known, the seller — both signers
  INSERT INTO engagement_parties (engagement_id, contact_id, party_role, is_signer, signer_order)
    VALUES (v_eng_id, p_buyer_contact_id, 'BUYER', true, 1);
  IF p_seller_contact_id IS NOT NULL THEN
    INSERT INTO engagement_parties (engagement_id, contact_id, party_role, is_signer, signer_order)
      VALUES (v_eng_id, p_seller_contact_id, 'SELLER', true, 2);
  END IF;

  INSERT INTO transactions (engagement_id, txn_type, amount, deposit_amount)
    VALUES (v_eng_id, 'PURCHASE', p_amount, p_deposit);

  RETURN v_eng_id;
END;
$fn$;

-- create_search_engagement — Layer 1 sourcing retainer (service HORSE_FINDER). Opens a
-- SEARCH-stage engagement for the retaining party; deal_side is token-driven. Creates the
-- engagement, attaches the client as signer, and records the standalone SEARCH stage. No
-- required predecessor (§7.1) — a search stands alone.
CREATE OR REPLACE FUNCTION create_search_engagement(
  p_client_contact_id uuid,
  p_retained_by       text    DEFAULT 'buyer',
  p_deal_side         text    DEFAULT 'BUY',
  p_horse_id          uuid    DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $fn$
DECLARE
  v_client_id uuid;
  v_eng_id    uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'authentication required';
  END IF;
  PERFORM require_module('mod.brokerage');

  SELECT id INTO v_client_id FROM clients WHERE contact_id = p_client_contact_id AND deleted_at IS NULL;
  IF NOT FOUND THEN
    INSERT INTO clients (contact_id) VALUES (p_client_contact_id) RETURNING id INTO v_client_id;
  END IF;

  INSERT INTO engagements (client_id, service_type, primary_horse_id, start_date)
    VALUES (v_client_id, 'HORSE_FINDER', p_horse_id, now()::date)
    RETURNING id INTO v_eng_id;

  INSERT INTO engagement_parties (engagement_id, contact_id, party_role, is_signer, signer_order)
    VALUES (v_eng_id, p_client_contact_id, 'CLIENT', true, 1);

  INSERT INTO engagement_stages (engagement_id, stage, retained_by, deal_side, status)
    VALUES (v_eng_id, 'SEARCH', p_retained_by, p_deal_side, 'OPEN');

  RETURN v_eng_id;
END;
$fn$;

-- create_lease_engagement — Layer 2 lease representation (service HORSE_LEASE_IN/OUT).
-- Opens a TRANSACTION_REP-stage lease engagement. deal_side LEASE_IN → lessee side
-- (HORSE_LEASE_IN_ASSISTANCE); LEASE_OUT → lessor side (HORSE_LEASE_OUT_ASSISTANCE).
-- Stands alone: a client may enter here fresh (already has the horse), no search required.
CREATE OR REPLACE FUNCTION create_lease_engagement(
  p_client_contact_id uuid,
  p_deal_side         text    DEFAULT 'LEASE_IN',
  p_horse_id          uuid    DEFAULT NULL,
  p_counterparty_contact_id uuid DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $fn$
DECLARE
  v_client_id      uuid;
  v_eng_id         uuid;
  v_service        text;
  v_retained_by    text;
  v_client_role    text;   -- our client's party_role (valid engagement_parties CHECK value)
  v_counter_role   text;   -- the counterparty's party_role
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'authentication required';
  END IF;
  PERFORM require_module('mod.brokerage');

  IF p_deal_side NOT IN ('LEASE_IN','LEASE_OUT') THEN
    RAISE EXCEPTION 'lease engagement deal_side must be LEASE_IN or LEASE_OUT, got %', p_deal_side;
  END IF;

  IF p_deal_side = 'LEASE_IN' THEN
    v_service      := 'HORSE_LEASE_IN_ASSISTANCE';
    v_retained_by  := 'lessee';
    v_client_role  := 'LESSEE';
    v_counter_role := 'LESSOR';
  ELSE
    v_service      := 'HORSE_LEASE_OUT_ASSISTANCE';
    v_retained_by  := 'lessor';
    v_client_role  := 'LESSOR';
    v_counter_role := 'LESSEE';
  END IF;

  SELECT id INTO v_client_id FROM clients WHERE contact_id = p_client_contact_id AND deleted_at IS NULL;
  IF NOT FOUND THEN
    INSERT INTO clients (contact_id) VALUES (p_client_contact_id) RETURNING id INTO v_client_id;
  END IF;

  INSERT INTO engagements (client_id, service_type, primary_horse_id, start_date)
    VALUES (v_client_id, v_service, p_horse_id, now()::date)
    RETURNING id INTO v_eng_id;

  INSERT INTO engagement_parties (engagement_id, contact_id, party_role, is_signer, signer_order)
    VALUES (v_eng_id, p_client_contact_id, v_client_role, true, 1);
  IF p_counterparty_contact_id IS NOT NULL THEN
    INSERT INTO engagement_parties (engagement_id, contact_id, party_role, is_signer, signer_order)
      VALUES (v_eng_id, p_counterparty_contact_id, v_counter_role, true, 2);
  END IF;

  INSERT INTO engagement_stages (engagement_id, stage, retained_by, deal_side, status)
    VALUES (v_eng_id, 'TRANSACTION_REP', v_retained_by, p_deal_side, 'OPEN');

  RETURN v_eng_id;
END;
$fn$;
