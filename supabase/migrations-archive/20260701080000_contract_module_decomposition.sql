/*
  # FHE Suite — Contract module decomposition (CONTRACT_MODULE_ARCHITECTURE build)

  Implements the owner-directed decomposition: search / evaluation / transaction
  representation are SEPARATELY EXECUTED modules; directional terminology
  (buy / sell / lease-in / lease-out) is TOKEN-DRIVEN from the engagement's
  CURRENT stage (engagement_stages.retained_by + deal_side, U7) via the global
  template_variants catalog — never hard-coded per document. Legal wording stays
  attorney-swappable (see ATTORNEY_FILLIN_CHECKLIST.md §18). ADDITIVE; the shipped
  migrations are untouched — the resolver and the purchase RPC are re-issued via
  CREATE OR REPLACE with their FULL live bodies (from 20260701000000) plus the
  additions below.

  1. transactions — three nullable fee columns backing the staged revenue chain,
     one fee per module: success_fee (search module's contingent success /
     acquisition fee — distinct from the flat retainer_fee), evaluation_fee
     (Layer-3 per-horse evaluation fee), representation_fee (Layer-2 transaction
     representation fee). service_fee remains for the generic service agreements.

  2. contract_templates —
       - HORSE_SEARCH_RETAINER retitled: it is now the ONE tokenized Layer-1
         HORSE_FINDER search/sourcing template (four directional variants; keeps
         the flat retainer AND the contingent success/acquisition fee; explicit
         no-result / no-consummation recitals). The template_key is deliberately
         UNCHANGED (referential integrity with template_variants seeds,
         contract_requirements, and the pinned tests).
       - HORSE_REPRESENTATION retired: it was the lease-flavored search+placement
         bundle, now collapsed into the finder's lease directions. Row kept
         (documents.template_id may reference it) but deactivated and its body
         cleared; its .md source is deleted so the regenerated loader no longer
         carries it.
       - HORSE_TRANSACTION_REP registered: the side-scoped Layer-2 representation
         module (CLIENT + COMPANY), distinct from the buyer↔seller transfer
         instruments (HORSE_PURCHASE_SALE / HORSE_SALE_TRANSFER / HORSE_LEASE,
         which stay dual-party deal documents). service_type NULL — one tokenized
         template serves all four *_ASSISTANCE services via DIR tokens.
       - HORSE_EVALUATION retitled transaction-agnostic (was "Pre-Purchase").

  3. service_types.HORSE_FINDER description extended to cover OWNER-SIDE sourcing
     (find a buyer / find a lessee), per the spec's Layer-1 fix list.

  4. template_variants — directional token_overrides for the two new DIR-token
     consumers (HORSE_TRANSACTION_REP, HORSE_EVALUATION). The four
     HORSE_SEARCH_RETAINER rows were seeded by U7 (mod_brokerage) and are
     unchanged. Extra retained_by spellings (owner vs seller/lessor) are seeded
     so a stage recorded with either vocabulary resolves.

  5. generate_document v6 — FULL v5 body (20260701000000) plus:
       - DIR arm: {{DIR.*}} resolves template_variants.token_overrides for
         (p_template_key, stage.retained_by, stage.deal_side) using the
         engagement's CURRENT stage (latest live engagement_stages row). No
         stage / no variant → blank (same posture as every other missing source).
       - TXN arm: SUCCESS_FEE / EVALUATION_FEE / REPRESENTATION_FEE (fmt_money).

  6. create_purchase_engagement — FULL body from 20260701000000 plus a
     TRANSACTION_REP stage row ('buyer'/'BUY'), making the purchase RPC record
     the directional-token source exactly like create_search_engagement /
     create_lease_engagement already do. (KNOWN ADDITION: purchase engagements
     now carry a stage row.)

  7. Global dictionary rows for the new tokens (documentation-only; per-template
     usage rows are derived by the regenerated loader).
*/

-- ============================================================
-- 1. transactions — one fee column per module (staged revenue chain)
-- ============================================================
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS success_fee        numeric(12,2);  -- {{TXN.SUCCESS_FEE}} (search module, contingent)
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS evaluation_fee     numeric(12,2);  -- {{TXN.EVALUATION_FEE}} (per-horse evaluation module)
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS representation_fee numeric(12,2);  -- {{TXN.REPRESENTATION_FEE}} (transaction-rep module)

-- ============================================================
-- 2. contract_templates — module registration / retirement / retitles
-- ============================================================

-- Layer 1 — the ONE tokenized HORSE_FINDER search/sourcing template.
UPDATE contract_templates
  SET title = 'Horse Finder Search and Sourcing Retainer Agreement'
  WHERE template_key = 'HORSE_SEARCH_RETAINER';

-- HORSE_REPRESENTATION → folded into the finder's lease directions; retired.
UPDATE contract_templates
  SET active = false, body = NULL, updated_at = now()
  WHERE template_key = 'HORSE_REPRESENTATION';

-- Layer 2 — side-scoped transaction representation module. The row may already
-- exist (the regenerated loader POST_SEED-inserts it on a fresh database, since
-- the loader runs before this migration); assert its metadata either way.
INSERT INTO contract_templates (template_key, title, service_type, party_namespaces)
  VALUES ('HORSE_TRANSACTION_REP', 'Horse Transaction Representation Agreement', NULL, ARRAY['CLIENT','COMPANY'])
ON CONFLICT (template_key) DO UPDATE SET
  title = EXCLUDED.title, service_type = EXCLUDED.service_type,
  party_namespaces = EXCLUDED.party_namespaces;

-- Layer 3 — evaluation, repositioned transaction-agnostic (was "Pre-Purchase").
UPDATE contract_templates
  SET title = 'Horse Evaluation Agreement'
  WHERE template_key = 'HORSE_EVALUATION';

-- ============================================================
-- 3. HORSE_FINDER covers owner-side sourcing too (find a buyer / find a lessee)
-- ============================================================
UPDATE service_types
  SET description = 'Search and sourcing on either side of a deal: shortlisting horses matched to a buyer''s or lessee''s goals, budget, and experience — or finding a buyer or lessee for a horse the client owns.'
  WHERE code = 'HORSE_FINDER';

-- ============================================================
-- 4. template_variants — directional overrides for the DIR-token consumers.
--    (HORSE_SEARCH_RETAINER's four rows were seeded by 20260630060000 and are
--    unchanged.) retained_by is recorded free-text by stage writers, so both
--    the search vocabulary ('owner') and the rep vocabulary ('seller'/'lessor')
--    are seeded where they can plausibly reach the same template.
-- ============================================================
INSERT INTO template_variants (template_key, retained_by, deal_side, token_overrides) VALUES
  -- Layer 2 — transaction representation
  ('HORSE_TRANSACTION_REP', 'buyer',  'BUY',       jsonb_build_object(
     'ROLE_TERM','buyer',  'DIRECTION_TERM','purchase',           'COUNTERPARTY_TERM','seller')),
  ('HORSE_TRANSACTION_REP', 'seller', 'SELL',      jsonb_build_object(
     'ROLE_TERM','seller', 'DIRECTION_TERM','sale',               'COUNTERPARTY_TERM','buyer')),
  ('HORSE_TRANSACTION_REP', 'owner',  'SELL',      jsonb_build_object(
     'ROLE_TERM','seller', 'DIRECTION_TERM','sale',               'COUNTERPARTY_TERM','buyer')),
  ('HORSE_TRANSACTION_REP', 'lessee', 'LEASE_IN',  jsonb_build_object(
     'ROLE_TERM','lessee', 'DIRECTION_TERM','lease (as lessee)',  'COUNTERPARTY_TERM','lessor')),
  ('HORSE_TRANSACTION_REP', 'lessor', 'LEASE_OUT', jsonb_build_object(
     'ROLE_TERM','lessor', 'DIRECTION_TERM','lease (as lessor)',  'COUNTERPARTY_TERM','lessee')),
  ('HORSE_TRANSACTION_REP', 'owner',  'LEASE_OUT', jsonb_build_object(
     'ROLE_TERM','lessor', 'DIRECTION_TERM','lease (as lessor)',  'COUNTERPARTY_TERM','lessee')),
  -- Layer 3 — per-horse evaluation (transaction context lines)
  ('HORSE_EVALUATION', 'buyer',  'BUY',       jsonb_build_object('ROLE_TERM','buyer',  'DIRECTION_TERM','purchase')),
  ('HORSE_EVALUATION', 'seller', 'SELL',      jsonb_build_object('ROLE_TERM','seller', 'DIRECTION_TERM','sale')),
  ('HORSE_EVALUATION', 'owner',  'SELL',      jsonb_build_object('ROLE_TERM','seller', 'DIRECTION_TERM','sale')),
  ('HORSE_EVALUATION', 'lessee', 'LEASE_IN',  jsonb_build_object('ROLE_TERM','lessee', 'DIRECTION_TERM','lease (lessee)')),
  ('HORSE_EVALUATION', 'lessor', 'LEASE_OUT', jsonb_build_object('ROLE_TERM','lessor', 'DIRECTION_TERM','lease (lessor)')),
  ('HORSE_EVALUATION', 'owner',  'LEASE_OUT', jsonb_build_object('ROLE_TERM','lessor', 'DIRECTION_TERM','lease (lessor)'))
ON CONFLICT (template_key, retained_by, deal_side) DO NOTHING;

-- ============================================================
-- 5. generate_document — resolver v6. CREATE OR REPLACE extending the v5 body
--    (20260701000000 — every existing arm preserved verbatim):
--    + engagement CURRENT stage lookup (latest live engagement_stages row) and
--      DIR arm over template_variants.token_overrides
--    + TXN SUCCESS_FEE / EVALUATION_FEE / REPRESENTATION_FEE
-- ============================================================
CREATE OR REPLACE FUNCTION generate_document(
  p_engagement_id uuid,
  p_template_key  text
)
RETURNS TABLE (document_id uuid, merged_body text)
LANGUAGE plpgsql
AS $fn$
DECLARE
  v_tmpl    contract_templates%ROWTYPE;
  v_eng     engagements%ROWTYPE;
  v_horse   horses%ROWTYPE;
  v_cfg     business_config%ROWTYPE;
  v_txn     transactions%ROWTYPE;
  v_has_txn boolean := false;
  v_breed   text := '';
  v_color   text := '';
  v_doc_id  uuid;
  v_doc_code text;
  v_body    text;
  v_val     text;
  v_org     text;   -- shared {{ORG.*}}/{{FHE.*}} resolution (aliases)
  v_rate    numeric;
  v_dir     jsonb := '{}'::jsonb;  -- directional token_overrides (v6)
  r         record;
  v_fn text; v_ph text; v_em text; v_ad text; v_ti text; v_re text;
  v_c_phone text; v_c_email text; v_c_url text;
BEGIN
  SELECT * INTO v_tmpl FROM contract_templates
    WHERE template_key = p_template_key AND active AND deleted_at IS NULL;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'unknown or inactive contract template: %', p_template_key;
  END IF;
  IF v_tmpl.body IS NULL THEN
    RAISE EXCEPTION 'template % has no body loaded (no source document yet)', p_template_key;
  END IF;

  SELECT * INTO v_eng FROM engagements WHERE id = p_engagement_id AND deleted_at IS NULL;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'unknown engagement: %', p_engagement_id;
  END IF;

  IF v_eng.primary_horse_id IS NOT NULL THEN
    SELECT * INTO v_horse FROM horses WHERE id = v_eng.primary_horse_id;
    SELECT display_name INTO v_breed FROM horse_breeds WHERE code = v_horse.breed;
    SELECT display_name INTO v_color FROM horse_colors WHERE code = v_horse.color;
  END IF;

  -- config — scope to the ENGAGEMENT'S org (v_eng already loaded above). Explicit,
  -- not RLS-accidental: correct for authenticated AND service_role/BYPASSRLS callers
  -- (current_org() would follow the session GUC, not the target engagement's tenant).
  SELECT * INTO v_cfg FROM business_config WHERE org_id = v_eng.org_id;

  -- public contact (phone/email/url) live in config_values ns CONTACT, resolved for
  -- the engagement's tenant. business_config has NO phone/email/url column.
  SELECT value_text INTO v_c_phone FROM config_values
    WHERE org_id = v_eng.org_id AND namespace = 'CONTACT' AND key = 'PHONE';
  SELECT value_text INTO v_c_email FROM config_values
    WHERE org_id = v_eng.org_id AND namespace = 'CONTACT' AND key = 'EMAIL';
  SELECT value_text INTO v_c_url FROM config_values
    WHERE org_id = v_eng.org_id AND namespace = 'CONTACT' AND key = 'URL';

  -- the engagement's financial record (latest), if any
  SELECT * INTO v_txn FROM transactions
    WHERE engagement_id = p_engagement_id AND deleted_at IS NULL
    ORDER BY created_at DESC LIMIT 1;
  v_has_txn := FOUND;

  -- DIRECTIONAL TERMINOLOGY (v6, CONTRACT_MODULE_ARCHITECTURE Layer 1): the
  -- engagement's CURRENT stage (latest live engagement_stages row) carries
  -- retained_by + deal_side; template_variants maps (template_key, retained_by,
  -- deal_side) → token_overrides. No stage or no variant row → v_dir stays '{}'
  -- and every {{DIR.*}} merges blank (missing-source posture).
  SELECT COALESCE(tv.token_overrides, '{}'::jsonb) INTO v_dir
    FROM engagement_stages es
    LEFT JOIN template_variants tv
      ON tv.template_key = p_template_key
     AND tv.retained_by  = es.retained_by
     AND tv.deal_side    = es.deal_side
     AND tv.active
    WHERE es.engagement_id = p_engagement_id AND es.deleted_at IS NULL
    ORDER BY es.effective_from DESC, es.created_at DESC
    LIMIT 1;
  v_dir := COALESCE(v_dir, '{}'::jsonb);

  INSERT INTO documents (engagement_id, template_id, title, status)
    VALUES (p_engagement_id, v_tmpl.id, v_tmpl.title, 'DRAFT')
    RETURNING id, display_code INTO v_doc_id, v_doc_code;

  v_body := v_tmpl.body;
  FOR r IN
    SELECT namespace, field, token FROM template_tokens
    WHERE template_id = v_tmpl.id AND kind <> 'signature'
  LOOP
    v_val := '';

    IF r.namespace = 'HORSE' THEN
      v_val := CASE r.field
        WHEN 'REGISTERED_NAME'     THEN v_horse.registered_name
        WHEN 'BARN_NAME'           THEN v_horse.barn_name
        WHEN 'BREED'               THEN v_breed
        WHEN 'COLOR'               THEN v_color
        WHEN 'SEX'                 THEN v_horse.sex
        WHEN 'AGE_DOB'             THEN to_char(v_horse.date_of_birth, 'FMMonth FMDD, YYYY')
        WHEN 'HEIGHT'              THEN v_horse.height
        WHEN 'REGISTRATION_NUMBER' THEN v_horse.registration_number
        WHEN 'MICROCHIP'           THEN v_horse.microchip_id
        WHEN 'CURRENT_LOCATION'    THEN v_horse.current_location
        WHEN 'VET_NAME'            THEN v_horse.vet_name
        WHEN 'VET_PHONE'           THEN v_horse.vet_phone
        WHEN 'FARRIER_NAME'        THEN v_horse.farrier_name
        WHEN 'FARRIER_PHONE'       THEN v_horse.farrier_phone
        ELSE '' END;

    ELSIF r.namespace = 'ENG' THEN
      v_val := CASE r.field
        WHEN 'ID'           THEN v_eng.display_code
        WHEN 'SERVICE_TYPE' THEN v_eng.service_type
        WHEN 'START_DATE'   THEN to_char(v_eng.start_date, 'FMMonth FMDD, YYYY')
        ELSE '' END;

    ELSIF r.namespace = 'DOC' THEN
      v_val := CASE r.field
        WHEN 'UUID'           THEN v_doc_id::text
        WHEN 'ID'             THEN v_doc_code
        WHEN 'GENERATED_DATE' THEN to_char(now(), 'FMMonth FMDD, YYYY')
        ELSE '' END;

    ELSIF r.namespace = 'DIR' THEN
      -- directional terminology from the current stage's variant (v6)
      v_val := v_dir ->> r.field;

    ELSIF r.namespace IN ('ORG', 'FHE') THEN
      -- {{FHE.*}} is a literal alias of {{ORG.*}}: identical resolution from the
      -- SAME per-engagement v_cfg (typed) + config_values ns CONTACT for PHONE/
      -- EMAIL/URL (business_config has no such column) — section 6.2.
      v_org := CASE r.field
        WHEN 'LEGAL_NAME'       THEN v_cfg.legal_entity_name
        WHEN 'SIGNATORY_NAME'   THEN v_cfg.signatory_name
        WHEN 'SIGNATORY_TITLE'  THEN v_cfg.signatory_title
        WHEN 'ADDRESS'          THEN v_cfg.business_address
        WHEN 'BRAND_NAME'       THEN v_cfg.legal_entity_name
        WHEN 'ENTITY_FORMATION' THEN v_cfg.entity_formation
        WHEN 'REGISTERED_AGENT' THEN v_cfg.registered_agent
        WHEN 'CANCELLATION_FEE' THEN fmt_money(v_cfg.cancellation_fee)
        WHEN 'LATE_FEE'         THEN fmt_money(v_cfg.late_fee)
        WHEN 'NO_SHOW_FEE'      THEN fmt_money(v_cfg.no_show_fee)
        WHEN 'PHONE'            THEN v_c_phone
        WHEN 'EMAIL'            THEN v_c_email
        WHEN 'URL'              THEN v_c_url
        ELSE NULL END;
      -- GENERIC EAV FALLBACK (v5): any ORG.* field with no typed resolution reads
      -- config_values ns ORG for the ENGAGEMENT's org. Deliberately NOT config_value()
      -- — that seam is current_org()-scoped, which is the WRONG tenant for
      -- service_role/BYPASSRLS callers (value_registry.sql §config_value). This makes
      -- future ORG.* tokens (LEGAL_IDENTITY, INVOICE_DUE_DAYS, CANCELLATION_NOTICE_
      -- HOURS, TERMINATION_NOTICE_DAYS, …) seed-only: no resolver migration needed.
      IF v_org IS NULL THEN
        SELECT coalesce(cv.value_text, cv.value_num::text, cv.value_json #>> '{}')
          INTO v_org
          FROM config_values cv
          WHERE cv.org_id = v_eng.org_id AND cv.namespace = 'ORG' AND cv.key = r.field;
      END IF;
      v_val := v_org;

    ELSIF r.namespace = 'TXN' THEN
      IF r.field = 'COMMISSION_RATE' THEN
        v_rate := CASE
          WHEN v_eng.service_type ILIKE '%SALE%'  THEN v_cfg.commission_sale_rate
          WHEN v_eng.service_type ILIKE '%LEASE%' THEN v_cfg.commission_lease_rate
          ELSE v_cfg.commission_purchase_rate END;
        v_val := CASE WHEN v_rate IS NULL THEN ''
                      ELSE rtrim(rtrim(to_char(v_rate, 'FM999990.00'), '0'), '.') || '%' END;
      ELSIF r.field = 'COMMISSION_MIN' THEN
        v_val := fmt_money(v_cfg.commission_min);
      ELSIF v_has_txn THEN
        v_val := CASE r.field
          WHEN 'PURCHASE_PRICE'    THEN fmt_money(v_txn.amount)
          WHEN 'DEPOSIT_AMOUNT'    THEN fmt_money(v_txn.deposit_amount)
          WHEN 'DEPOSIT_TERMS'     THEN v_txn.deposit_terms
          WHEN 'BALANCE_DUE'       THEN CASE WHEN v_txn.amount IS NULL THEN ''
                                        ELSE fmt_money(v_txn.amount - COALESCE(v_txn.deposit_amount, 0)) END
          WHEN 'PAYMENT_TERMS'     THEN v_txn.payment_terms
          WHEN 'PAYMENT_SCHEDULE'  THEN v_txn.payment_schedule
          WHEN 'LEASE_TERM'        THEN v_txn.lease_term
          WHEN 'LEASE_FEE'         THEN fmt_money(v_txn.lease_fee)
          WHEN 'TRIAL_PERIOD'      THEN v_txn.trial_period
          WHEN 'DELIVERY_DATE'     THEN to_char(v_txn.delivery_date, 'FMMonth FMDD, YYYY')
          WHEN 'DELIVERY_LOCATION' THEN v_txn.delivery_location
          WHEN 'RETAINER_FEE'      THEN fmt_money(v_txn.retainer_fee)
          WHEN 'SERVICE_FEE'       THEN fmt_money(v_txn.service_fee)
          WHEN 'SUCCESS_FEE'       THEN fmt_money(v_txn.success_fee)
          WHEN 'EVALUATION_FEE'    THEN fmt_money(v_txn.evaluation_fee)
          WHEN 'REPRESENTATION_FEE' THEN fmt_money(v_txn.representation_fee)
          ELSE '' END;
      ELSE
        v_val := '';  -- no transaction yet → blank
      END IF;

    ELSE
      v_fn := NULL; v_ph := NULL; v_em := NULL; v_ad := NULL; v_ti := NULL; v_re := NULL;
      SELECT c.full_name, c.phone, c.email, c.address_composed, ep.title, ep.relationship
        INTO v_fn, v_ph, v_em, v_ad, v_ti, v_re
        FROM engagement_parties ep
        JOIN contacts c ON c.id = ep.contact_id
        WHERE ep.engagement_id = p_engagement_id AND ep.party_role = r.namespace
        ORDER BY ep.signer_order NULLS LAST
        LIMIT 1;
      v_val := CASE r.field
        WHEN 'FULL_NAME'    THEN v_fn
        WHEN 'PRINTED_NAME' THEN v_fn
        WHEN 'PHONE'        THEN v_ph
        WHEN 'EMAIL'        THEN v_em
        WHEN 'ADDRESS'      THEN v_ad
        WHEN 'TITLE'        THEN v_ti
        WHEN 'RELATIONSHIP' THEN v_re
        ELSE '' END;
    END IF;

    v_body := replace(v_body, r.token, COALESCE(v_val, ''));
  END LOOP;

  UPDATE documents SET merged_body = v_body WHERE id = v_doc_id;

  document_id := v_doc_id;
  merged_body := v_body;
  RETURN NEXT;
END;
$fn$;

COMMENT ON FUNCTION generate_document(uuid, text) IS
  'Phase 3 merge engine (resolver v6, contract-module decomposition): v5 (ORG typed arms + generic ORG EAV fallback, HORSE vet/farrier, party-role fallback) + DIR arm — {{DIR.*}} directional terminology from template_variants.token_overrides keyed by the engagement''s CURRENT stage (retained_by, deal_side) — and TXN SUCCESS_FEE / EVALUATION_FEE / REPRESENTATION_FEE. {{SIG.*}} left for signing.';

-- ============================================================
-- 6. create_purchase_engagement — FULL body from 20260701000000 (COMPANY signer
--    party and all) + the TRANSACTION_REP stage row ('buyer'/'BUY'), so purchase
--    engagements carry the directional-token source like search/lease ones do.
-- ============================================================
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
  v_client_id      uuid;
  v_eng_id         uuid;
  v_company_signer uuid;
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

  -- COMPANY is a real signing party when the tenant has designated a signatory
  -- (business_config.signatory_contact_id, resolved for the ENGAGEMENT's org).
  SELECT bc.signatory_contact_id INTO v_company_signer
    FROM business_config bc
    JOIN engagements e ON e.org_id = bc.org_id
    WHERE e.id = v_eng_id;
  IF v_company_signer IS NOT NULL THEN
    INSERT INTO engagement_parties (engagement_id, contact_id, party_role, is_signer, signer_order)
      VALUES (v_eng_id, v_company_signer, 'COMPANY', true, 99);
  END IF;

  INSERT INTO transactions (engagement_id, txn_type, amount, deposit_amount)
    VALUES (v_eng_id, 'PURCHASE', p_amount, p_deposit);

  -- the directional-token source: purchase representation is buyer-side / BUY
  -- (CONTRACT_MODULE_ARCHITECTURE — stage rows drive {{DIR.*}}; standalone, no
  -- required predecessor, exactly like create_search/create_lease already record).
  INSERT INTO engagement_stages (engagement_id, stage, retained_by, deal_side, status)
    VALUES (v_eng_id, 'TRANSACTION_REP', 'buyer', 'BUY', 'OPEN');

  RETURN v_eng_id;
END;
$fn$;

-- ============================================================
-- 7. Global dictionary rows for the new tokens (documentation-only; template_id
--    NULL rows are never merged — per-template usage rows come from the loader).
-- ============================================================
INSERT INTO template_tokens (namespace, field, token, kind, source_table, source_column, computed, required, party_scoped, notes) VALUES
  ('TXN','SUCCESS_FEE',        '{{TXN.SUCCESS_FEE}}',        'field', 'transactions', 'success_fee',        false, false, false, 'search module: contingent success/acquisition fee (distinct from the flat retainer_fee)'),
  ('TXN','EVALUATION_FEE',     '{{TXN.EVALUATION_FEE}}',     'field', 'transactions', 'evaluation_fee',     false, false, false, 'evaluation module: per-horse evaluation fee'),
  ('TXN','REPRESENTATION_FEE', '{{TXN.REPRESENTATION_FEE}}', 'field', 'transactions', 'representation_fee', false, false, false, 'transaction-representation module fee'),
  ('DIR','ROLE_TERM',          '{{DIR.ROLE_TERM}}',          'field', 'template_variants', 'token_overrides', true, false, false, 'directional: the client''s role word (buyer/seller/owner/lessee/lessor) — resolved from the engagement''s current stage (retained_by, deal_side)'),
  ('DIR','TARGET_TERM',        '{{DIR.TARGET_TERM}}',        'field', 'template_variants', 'token_overrides', true, false, false, 'directional: what the search looks for (a horse / a buyer / a lessee)'),
  ('DIR','DIRECTION_TERM',     '{{DIR.DIRECTION_TERM}}',     'field', 'template_variants', 'token_overrides', true, false, false, 'directional: the transaction word (purchase / sale / lease …)'),
  ('DIR','COUNTERPARTY_TERM',  '{{DIR.COUNTERPARTY_TERM}}',  'field', 'template_variants', 'token_overrides', true, false, false, 'directional: the other side''s role word (seller/buyer/lessor/lessee)')
ON CONFLICT DO NOTHING;
