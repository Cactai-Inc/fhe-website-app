-- SPEC C (CORE) + SPEC B.3 — re-merge from fields at lock, data-driven CUT,
-- strip-unfilled; and generate_document v10 (FAIR_MARKET_VALUE arm + negotiated-
-- contract CUT sections survive generation so lock-time re-merge can evaluate them).
--
-- remerge_contract_from_fields(document_id):
--   1. starts from the ORIGINAL template body (idempotent, reversible)
--   2. evaluates the lease's CUT sections from contract_fields values (C.3 table);
--      INSURANCE wrapper first, then its three children; unknown sections keep
--      their content (markers removed) — conservative
--   3. fills every non-SIG token from contract_fields; DOC.EFFECTIVE_DATE from the
--      document row; SIG.* left for record_signature
--   4. strip-unfilled: a line whose tokens are ALL empty is dropped — except
--      *.PRINTED_NAME lines (signature-ceremony identity stays visible) and lines
--      containing SIG tokens; mixed lines with any filled token are kept
--   5. collapses runs of blank lines; never rewrites an executed body
CREATE OR REPLACE FUNCTION public.generate_document(p_engagement_id uuid, p_template_key text)
 RETURNS TABLE(document_id uuid, merged_body text)
 LANGUAGE plpgsql
AS $function$
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
  m         record;
  v_fn text; v_ph text; v_em text; v_ad text; v_ti text; v_re text; v_db text;
  v_ec1n text; v_ec1r text; v_ec1p text; v_ec2n text; v_ec2r text; v_ec2p text;
  v_ry text; v_jx text; v_rb text; v_jl text;
  v_c_phone text; v_c_email text; v_c_url text;
  v_has_minor boolean := false;
  v_is_jumper boolean := false;
  v_sel text;
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

  -- DIRECTIONAL TERMINOLOGY (v6, CONTRACT_MODULE_ARCHITECTURE Layer 1)
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

  -- v9: explicit org stamp — DEFAULT current_org() is NULL for service-role callers.
  INSERT INTO documents (org_id, engagement_id, template_id, title, status)
    VALUES (v_eng.org_id, p_engagement_id, v_tmpl.id, v_tmpl.title, 'DRAFT')
    RETURNING id, display_code INTO v_doc_id, v_doc_code;

  v_body := v_tmpl.body;

  -- ── v9: CUT-marker processing (owner's conditional template sections) ──────
  -- MINOR_* sections stay only when a PARTICIPANT (minor) party is on the
  -- engagement; JUMPER_* sections only for jumper-training engagements. Kept
  -- sections lose their marker comments; excluded sections are removed whole.
  v_has_minor := EXISTS (
    SELECT 1 FROM engagement_parties
    WHERE engagement_id = p_engagement_id AND party_role = 'PARTICIPANT');
  v_is_jumper := v_eng.service_type = 'JUMPER_TRAINING';
  FOR m IN
    SELECT DISTINCT (regexp_matches(v_body, '<!-- CUT-START: ([A-Z_]+)', 'g'))[1] AS name
  LOOP
    IF m.name IN ('EVALUATION_PERIOD','PARTIAL_LEASE','INSURANCE',
                  'MORTALITY_INSURANCE','MAJOR_MEDICAL_INSURANCE',
                  'LOSS_OF_USE_INSURANCE','COMPETITION') THEN
      -- v10: negotiated-contract sections — leave markers AND content intact;
      -- remerge_contract_from_fields evaluates them from contract_fields at lock.
      CONTINUE;
    END IF;
    IF (m.name LIKE 'MINOR%' AND v_has_minor)
       OR (m.name LIKE 'JUMPER%' AND v_is_jumper) THEN
      v_body := regexp_replace(
        v_body, '[ \t]*<!-- CUT-(START|END): ' || m.name || '[^>]*-->\n?', '', 'g');
    ELSE
      v_body := regexp_replace(
        v_body,
        '\n?[ \t]*<!-- CUT-START: ' || m.name || '[^>]*-->.*<!-- CUT-END: ' || m.name || ' -->\n?',
        E'\n', 'g');
    END IF;
  END LOOP;

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
        WHEN 'FAIR_MARKET_VALUE'   THEN fmt_money(v_horse.fair_market_value)
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
        -- v9: the owner's revised templates open with {{DOC.EFFECTIVE_DATE}}; the
        -- document is generated for same-session signing, so generation date IS the
        -- effective date (documents.effective_date is separately set at EXECUTED).
        WHEN 'EFFECTIVE_DATE' THEN to_char(now(), 'FMMonth FMDD, YYYY')
        ELSE '' END;

    ELSIF r.namespace = 'ORD' THEN
      -- v9: order-form tokens (owner revision) — the document IS the order copy.
      IF r.field = 'SERVICE_SELECTION' THEN
        SELECT cp.tier_label INTO v_sel FROM client_purchases cp
          WHERE cp.engagement_id = p_engagement_id
          ORDER BY cp.created_at DESC LIMIT 1;
        v_val := v_sel;
      ELSE
        v_val := CASE r.field
          WHEN 'UUID' THEN v_doc_id::text
          WHEN 'ID'   THEN v_doc_code
          ELSE '' END;
      END IF;

    ELSIF r.namespace = 'REQ' THEN
      -- request-capture inputs arrive with Flow A's public request form (plan §5);
      -- until then they merge blank (missing-source posture).
      v_val := '';

    ELSIF r.namespace = 'DIR' THEN
      v_val := v_dir ->> r.field;

    ELSIF r.namespace IN ('ORG', 'FHE') THEN
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
          WHEN 'PACKAGE_FEE'       THEN fmt_money(v_txn.service_fee)
          WHEN 'SUCCESS_FEE'       THEN fmt_money(v_txn.success_fee)
          WHEN 'EVALUATION_FEE'    THEN fmt_money(v_txn.evaluation_fee)
          WHEN 'REPRESENTATION_FEE' THEN fmt_money(v_txn.representation_fee)
          ELSE '' END;
      ELSE
        v_val := '';  -- no transaction yet → blank
      END IF;

    ELSE
      v_fn := NULL; v_ph := NULL; v_em := NULL; v_ad := NULL; v_ti := NULL; v_re := NULL; v_db := NULL;
      v_ec1n := NULL; v_ec1r := NULL; v_ec1p := NULL; v_ec2n := NULL; v_ec2r := NULL; v_ec2p := NULL;
      v_ry := NULL; v_jx := NULL; v_rb := NULL; v_jl := NULL;
      -- the OFFICIAL name is first_name || ' ' || last_name (v7 canon).
      SELECT NULLIF(trim(coalesce(c.first_name, '') || ' ' || coalesce(c.last_name, '')), ''),
             c.phone, c.email, c.address_composed, ep.title, ep.relationship,
             CASE WHEN c.date_of_birth IS NULL THEN NULL
                  ELSE to_char(c.date_of_birth, 'FMMonth FMDD, YYYY') END,
             c.emergency_contact_1_name, c.emergency_contact_1_relationship, c.emergency_contact_1_phone,
             c.emergency_contact_2_name, c.emergency_contact_2_relationship, c.emergency_contact_2_phone,
             c.riding_experience_years, c.jump_experience, c.riding_background, c.jump_limitations
        INTO v_fn, v_ph, v_em, v_ad, v_ti, v_re, v_db,
             v_ec1n, v_ec1r, v_ec1p, v_ec2n, v_ec2r, v_ec2p,
             v_ry, v_jx, v_rb, v_jl
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
        WHEN 'DOB'          THEN v_db
        -- v9: owner-revision CLIENT.* projection fields (stored on contacts)
        WHEN 'EMERGENCY_CONTACT_1_NAME'         THEN v_ec1n
        WHEN 'EMERGENCY_CONTACT_1_RELATIONSHIP' THEN v_ec1r
        WHEN 'EMERGENCY_CONTACT_1_PHONE'        THEN v_ec1p
        WHEN 'EMERGENCY_CONTACT_2_NAME'         THEN v_ec2n
        WHEN 'EMERGENCY_CONTACT_2_RELATIONSHIP' THEN v_ec2r
        WHEN 'EMERGENCY_CONTACT_2_PHONE'        THEN v_ec2p
        WHEN 'RIDING_EXPERIENCE_YEARS'          THEN v_ry
        WHEN 'JUMP_EXPERIENCE'                  THEN v_jx
        WHEN 'RIDING_BACKGROUND'                THEN v_rb
        WHEN 'JUMP_LIMITATIONS'                 THEN v_jl
        ELSE '' END;
    END IF;

    v_body := replace(v_body, r.token, COALESCE(v_val, ''));
  END LOOP;

  UPDATE documents SET merged_body = v_body WHERE id = v_doc_id;

  document_id := v_doc_id;
  merged_body := v_body;
  RETURN NEXT;
END;
$function$
;

-- ---- remerge_contract_from_fields — the lock-time authority ------------------
CREATE OR REPLACE FUNCTION remerge_contract_from_fields(p_document_id uuid)
RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $fn$
DECLARE
  v_doc      documents%ROWTYPE;
  v_body     text;
  v_fields   jsonb := '{}'::jsonb;     -- field_key → value (trimmed; '' when empty)
  v_keep     boolean;
  v_name     text;
  v_lines    text[];
  v_out      text[] := '{}';
  v_line     text;
  v_toks     text[];
  v_tok      text;
  v_all_empty boolean;
  v_has_sig   boolean;
  v_has_printed boolean;
  v_any_token boolean;
  r          record;
BEGIN
  IF auth.uid() IS NULL AND current_setting('request.jwt.claims', true) IS NULL THEN
    NULL; -- service/definer chains allowed
  END IF;

  SELECT * INTO v_doc FROM documents WHERE id = p_document_id AND deleted_at IS NULL;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'unknown document: %', p_document_id;
  END IF;

  -- staff of the org, the originator, or any document party may re-derive
  IF auth.uid() IS NOT NULL AND NOT (
       (has_staff_access() AND v_doc.org_id = current_org())
    OR contract_caller_is_originator(p_document_id)
    OR caller_is_document_party(p_document_id)
  ) THEN
    RAISE EXCEPTION 'not authorized to re-merge document %', p_document_id;
  END IF;

  -- 1. the ORIGINAL tokenized template body
  SELECT body INTO v_body FROM contract_templates WHERE id = v_doc.template_id;
  IF v_body IS NULL THEN
    RAISE EXCEPTION 'document % has no template body', p_document_id;
  END IF;

  -- 2. field map
  FOR r IN SELECT field_key, coalesce(trim(value), '') AS val
             FROM contract_fields WHERE document_id = p_document_id LOOP
    v_fields := v_fields || jsonb_build_object(r.field_key, r.val);
  END LOOP;

  -- helper predicate inline: a field is "present" when non-empty after trim
  -- 3. CUT evaluation — INSURANCE wrapper FIRST, then children, then the rest.
  FOREACH v_name IN ARRAY ARRAY[
    'INSURANCE',
    'MORTALITY_INSURANCE','MAJOR_MEDICAL_INSURANCE','LOSS_OF_USE_INSURANCE',
    'EVALUATION_PERIOD','PARTIAL_LEASE','COMPETITION'
  ] LOOP
    -- skip sections not present in this template's body
    CONTINUE WHEN position('<!-- CUT-START: ' || v_name in v_body) = 0;

    v_keep := CASE v_name
      WHEN 'EVALUATION_PERIOD' THEN
        coalesce(v_fields ->> 'TXN.EVALUATION_START', '') <> ''
        OR coalesce(v_fields ->> 'TXN.EVALUATION_END', '') <> ''
      WHEN 'PARTIAL_LEASE' THEN
        lower(coalesce(v_fields ->> 'TXN.LEASE_TYPE', '')) LIKE '%partial%'
      WHEN 'INSURANCE' THEN
        coalesce(v_fields ->> 'TXN.MORTALITY_INSURANCE_COST', '') <> ''
        OR coalesce(v_fields ->> 'TXN.MORTALITY_INSURANCE_PARTY', '') <> ''
        OR coalesce(v_fields ->> 'TXN.MAJOR_MEDICAL_INSURANCE_COST', '') <> ''
        OR coalesce(v_fields ->> 'TXN.MAJOR_MEDICAL_INSURANCE_PARTY', '') <> ''
        OR coalesce(v_fields ->> 'TXN.LOSS_OF_USE_INSURANCE_COST', '') <> ''
        OR coalesce(v_fields ->> 'TXN.LOSS_OF_USE_INSURANCE_PARTY', '') <> ''
      WHEN 'MORTALITY_INSURANCE' THEN
        coalesce(v_fields ->> 'TXN.MORTALITY_INSURANCE_COST', '') <> ''
        OR coalesce(v_fields ->> 'TXN.MORTALITY_INSURANCE_PARTY', '') <> ''
      WHEN 'MAJOR_MEDICAL_INSURANCE' THEN
        coalesce(v_fields ->> 'TXN.MAJOR_MEDICAL_INSURANCE_COST', '') <> ''
        OR coalesce(v_fields ->> 'TXN.MAJOR_MEDICAL_INSURANCE_PARTY', '') <> ''
      WHEN 'LOSS_OF_USE_INSURANCE' THEN
        coalesce(v_fields ->> 'TXN.LOSS_OF_USE_INSURANCE_COST', '') <> ''
        OR coalesce(v_fields ->> 'TXN.LOSS_OF_USE_INSURANCE_PARTY', '') <> ''
      WHEN 'COMPETITION' THEN
        coalesce(v_fields ->> 'TXN.COMPETITION_TERMS', '') <> ''
        OR coalesce(v_fields ->> 'TXN.COMPETITION_EXPENSES', '') <> ''
        OR coalesce(v_fields ->> 'TXN.COMPETITION_WINNINGS', '') <> ''
      ELSE true  -- unknown/other sections: keep content (conservative)
    END;

    IF v_keep THEN
      v_body := regexp_replace(
        v_body, '[ \t]*<!-- CUT-(START|END): ' || v_name || '[^>]*-->\n?', '', 'g');
    ELSE
      v_body := regexp_replace(
        v_body,
        '\n?[ \t]*<!-- CUT-START: ' || v_name || '[^>]*-->.*<!-- CUT-END: ' || v_name || ' -->\n?',
        E'\n', 'g');
    END IF;
  END LOOP;

  -- any other CUT sections this template carries (e.g. future additions): keep
  FOR r IN SELECT DISTINCT (regexp_matches(v_body, '<!-- CUT-START: ([A-Z_]+)', 'g'))[1] AS name LOOP
    v_body := regexp_replace(
      v_body, '[ \t]*<!-- CUT-(START|END): ' || r.name || '[^>]*-->\n?', '', 'g');
  END LOOP;

  -- 4+5. token fill + strip-unfilled, line by line
  v_lines := string_to_array(v_body, E'\n');
  FOREACH v_line IN ARRAY v_lines LOOP
    v_toks := ARRAY(SELECT (regexp_matches(v_line, '\{\{([A-Z0-9_.]+)\}\}', 'g'))[1]);
    v_any_token := coalesce(array_length(v_toks, 1), 0) > 0;

    IF NOT v_any_token THEN
      v_out := v_out || v_line;
      CONTINUE;
    END IF;

    v_all_empty := true;
    v_has_sig := false;
    v_has_printed := false;
    FOREACH v_tok IN ARRAY v_toks LOOP
      IF v_tok LIKE 'SIG.%' THEN
        v_has_sig := true; v_all_empty := false;
      ELSIF v_tok = 'DOC.EFFECTIVE_DATE' THEN
        v_all_empty := false;
      ELSIF v_tok LIKE '%.PRINTED_NAME' THEN
        v_has_printed := true;
      ELSIF coalesce(v_fields ->> v_tok, '') <> '' THEN
        v_all_empty := false;
      END IF;
    END LOOP;

    -- drop a line whose fillable tokens all resolved empty (decision 6) — unless
    -- it carries a SIG token or a PRINTED_NAME (signature-ceremony lines stay)
    IF v_all_empty AND NOT v_has_sig AND NOT v_has_printed THEN
      CONTINUE;
    END IF;

    -- fill: contract_fields values; DOC.EFFECTIVE_DATE from the document; SIG left
    FOREACH v_tok IN ARRAY v_toks LOOP
      IF v_tok LIKE 'SIG.%' THEN
        CONTINUE;
      ELSIF v_tok = 'DOC.EFFECTIVE_DATE' THEN
        v_line := replace(v_line, '{{' || v_tok || '}}',
          to_char(coalesce(v_doc.effective_date, v_doc.created_at::date), 'FMMonth FMDD, YYYY'));
      ELSE
        v_line := replace(v_line, '{{' || v_tok || '}}', coalesce(v_fields ->> v_tok, ''));
      END IF;
    END LOOP;

    v_out := v_out || v_line;
  END LOOP;

  v_body := array_to_string(v_out, E'\n');
  -- 6. collapse the gaps stripped sections/lines leave behind
  v_body := regexp_replace(v_body, E'\n{3,}', E'\n\n', 'g');

  -- 7. never rewrite an executed body
  UPDATE documents SET merged_body = v_body
   WHERE id = p_document_id AND workflow_state <> 'executed';

  RETURN v_body;
END;
$fn$;

REVOKE ALL ON FUNCTION remerge_contract_from_fields(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION remerge_contract_from_fields(uuid) TO authenticated, service_role;

COMMENT ON FUNCTION remerge_contract_from_fields(uuid) IS
  'Lock-time authority for negotiated contracts: rebuilds merged_body from the ORIGINAL template + current contract_fields (idempotent), evaluates the lease''s optional-section CUT conditions from field values (INSURANCE wrapper before its children), fills every non-SIG token (DOC.EFFECTIVE_DATE from the document row), drops lines whose fillable tokens all ended empty (strip-unfilled; SIG/PRINTED_NAME lines exempt), collapses blank runs. Never rewrites an executed body. Wired into the locked transition and lock_and_sign_contract.';
