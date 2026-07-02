/*
  # FHE CRM → Suite — generate_document org-isolation fix + {{ORG.*}} de-specification (U1)

  ISOLATION-CRITICAL. Lands FIRST in the Suite backbone, before any second tenant
  is provisioned. Additive CREATE OR REPLACE only — no schema/table change — so the
  existing generate_document.test.ts and purchase_flow.test.ts stay green.

  Ground truth (PLATFORM_ARCHITECTURE.md §6, verified against the migration-22 copy
  in 20260629150000_transactions.sql, which is the authoritative body this unit
  re-creates — preserving every TXN money-token arm):

  Defect 1 — cross-tenant config leak. The config read was
    SELECT * INTO v_cfg FROM business_config LIMIT 1
  which, with a second tenant, could merge another tenant's legal entity /
  signatory / commission into a contract. The fix keys the read off the
  ENGAGEMENT's own tenant — NOT current_org():
    SELECT * INTO v_cfg FROM business_config WHERE org_id = v_eng.org_id
  because generate_document runs SECURITY INVOKER and a legitimate caller can be
  service_role / BYPASSRLS (batch/provisioning) where auth.uid() IS NULL, so
  current_org() would fall back to the *session* app.current_org GUC — the wrong
  tenant. v_eng.org_id is the target engagement's own tenant and is correct for
  BOTH authenticated and service-role callers. This is the isolation fix.

  Defect 2 — hardcoded FHE namespace. Add an org-neutral {{ORG.*}} CASE arm
  alongside {{FHE.*}}, both resolving from the SAME per-engagement v_cfg typed
  columns, so {{FHE.*}} becomes a literal ALIAS of {{ORG.*}} and already-loaded
  verbatim contract bodies (which use {{FHE.SIGNATORY_NAME}}/{{FHE.SIGNATORY_TITLE}})
  keep merging identically. Fields (both namespaces): LEGAL_NAME, SIGNATORY_NAME,
  SIGNATORY_TITLE, ADDRESS, BRAND_NAME from v_cfg. PHONE/EMAIL are wired to the
  CONTACT registry by U3 (config_value(); does not exist yet) — in U1 they resolve
  BLANK. U1 stays dependency-free (it lands first): it does NOT call config_value().

  No contract template body is edited. The added {{ORG.PHONE}}/{{ORG.EMAIL}} and
  {{FHE.PHONE}}/{{FHE.EMAIL}} template_tokens rows are GLOBAL dictionary rows
  (template_id = NULL); the merge loop only touches per-template rows, so they are
  documentation-only and never introduce a leftover token.
*/

-- ============================================================
-- {{FHE.PHONE}} / {{FHE.EMAIL}} global dictionary rows already exist (migration 11).
-- The {{ORG.*}} global dictionary rows (a new namespace) — and the CONTACT-backed
-- PHONE/EMAIL wiring — are DEFERRED TO U3 per PLATFORM_ARCHITECTURE.md §6.2:
-- U1 lands FIRST and stays dependency-free (no config_value(), no new global
-- namespace), and any such global rows are documentation-only anyway because the
-- merge loop only ever touches PER-TEMPLATE rows (template_id = v_tmpl.id), never
-- global (template_id IS NULL) rows. Adding an ORG global namespace here would
-- also break the frozen contract_templates_tokens.test.ts namespace-set assertion.
-- U1's {{ORG.*}} de-specification is therefore delivered entirely by the RPC CASE
-- arm below (the resolution), which is what actually merges for any body/per-
-- template row that uses {{ORG.*}}.
-- ============================================================

-- ============================================================
-- generate_document — org-scoped config read + {{ORG.*}}/{{FHE.*}} alias
-- (re-created from the migration-22 body: every TXN money-token arm preserved).
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
  r         record;
  v_fn text; v_ph text; v_em text; v_ad text; v_ti text; v_re text;
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

  -- the engagement's financial record (latest), if any
  SELECT * INTO v_txn FROM transactions
    WHERE engagement_id = p_engagement_id AND deleted_at IS NULL
    ORDER BY created_at DESC LIMIT 1;
  v_has_txn := FOUND;

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

    ELSIF r.namespace IN ('ORG', 'FHE') THEN
      -- {{FHE.*}} is a literal alias of {{ORG.*}}: identical resolution from the
      -- SAME per-engagement v_cfg. PHONE/EMAIL/URL are wired to the CONTACT
      -- registry by U3 (config_value); in U1 they resolve blank.
      v_org := CASE r.field
        WHEN 'LEGAL_NAME'      THEN v_cfg.legal_entity_name
        WHEN 'SIGNATORY_NAME'  THEN v_cfg.signatory_name
        WHEN 'SIGNATORY_TITLE' THEN v_cfg.signatory_title
        WHEN 'ADDRESS'         THEN v_cfg.business_address
        WHEN 'BRAND_NAME'      THEN v_cfg.legal_entity_name
        ELSE '' END;  -- PHONE / EMAIL / URL → blank until U3 seeds CONTACT
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
  'Phase 3 merge engine (Suite U1): config read scoped to the ENGAGEMENT''s org (v_eng.org_id, not current_org()) for cross-tenant isolation; {{FHE.*}} is a literal alias of the org-neutral {{ORG.*}} namespace. {{SIG.*}} left for signing.';
