-- release_preview: resolve {{ORG.PRINCIPALS}} (2026-08-02 onboarding bodies).
-- The kiosk preview hard-codes its ORG substitutions; without this the new
-- Released Parties clauses preview as a fill-in blank. Signed documents were
-- already correct (sign_release -> generate_document -> ORG EAV fallback).
-- Full function body carried forward from live otherwise unchanged.
CREATE OR REPLACE FUNCTION public.release_preview(p_template_key text, p_org uuid DEFAULT NULL::uuid)
 RETURNS TABLE(title text, body text)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_org    uuid;
  v_tmpl   record;
  v_cfg    business_config%ROWTYPE;
  v_body   text;
  v_ident  text;
  v_phone  text;
  v_email  text;
  v_url    text;
  v_princ  text;
  v_marker text;
  v_cut    integer;
BEGIN
  -- The kiosk's readable surface: the four releases + the rules-gate document.
  IF p_template_key NOT IN ('RELEASE_GENERAL','RELEASE_PARTICIPANT',
                            'RELEASE_HORSE_EXERCISE','RELEASE_HORSE_CARE',
                            'FACILITY_RULES','COMPANY_POLICIES',
                            'HUMAN_EMERGENCY_MEDICAL') THEN
    RAISE EXCEPTION 'unknown release template: %', p_template_key;
  END IF;

  v_org := coalesce(p_org, current_org(), current_addressed_org(), sole_org());
  IF v_org IS NULL THEN
    RAISE EXCEPTION 'no organization resolvable for release preview';
  END IF;

  SELECT t.title, t.body INTO v_tmpl
    FROM contract_templates t
   WHERE t.template_key = p_template_key AND t.active AND t.body IS NOT NULL;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'release template unavailable: %', p_template_key;
  END IF;

  SELECT * INTO v_cfg FROM business_config bc WHERE bc.org_id = v_org;
  SELECT cv.value_text INTO v_ident FROM config_values cv
   WHERE cv.org_id = v_org AND cv.namespace = 'ORG' AND cv.key = 'LEGAL_IDENTITY';
  SELECT cv.value_text INTO v_phone FROM config_values cv
   WHERE cv.org_id = v_org AND cv.namespace = 'CONTACT' AND cv.key = 'PHONE';
  SELECT cv.value_text INTO v_email FROM config_values cv
   WHERE cv.org_id = v_org AND cv.namespace = 'CONTACT' AND cv.key = 'EMAIL';
  SELECT cv.value_text INTO v_url FROM config_values cv
   WHERE cv.org_id = v_org AND cv.namespace = 'CONTACT' AND cv.key = 'URL';
  SELECT cv.value_text INTO v_princ FROM config_values cv
   WHERE cv.org_id = v_org AND cv.namespace = 'ORG' AND cv.key = 'PRINCIPALS';

  v_body := v_tmpl.body;
  -- Truncate BEFORE merging: nothing signature-ish reaches a preview. Owner
  -- revision 2026-07-03: every kiosk document (all four releases AND
  -- FACILITY_RULES) ends with the SAME single CLIENT signer block, and the
  -- minor CUT section sits below it — one marker truncates them all.
  v_marker := E'CLIENT\n\nDate: {{SIG.CLIENT.DATE}}';
  v_cut := position(v_marker IN v_body);
  IF v_cut > 0 THEN
    v_body := rtrim(left(v_body, v_cut - 1));
  END IF;
  -- Belt-and-braces: no CUT-marker comment may survive into a rendered preview
  -- (today they all live below the truncation point).
  v_body := regexp_replace(v_body, '[ \t]*<!-- CUT-(START|END): [A-Z_]+[^>]*-->\n?', '', 'g');

  -- Releases identify the business by trade name only (owner 2026-07-02); the
  -- LEGAL_IDENTITY arm stays for non-release documents.
  v_body := replace(v_body, '{{ORG.LEGAL_IDENTITY}}',  coalesce(v_ident, v_cfg.legal_entity_name, ''));
  v_body := replace(v_body, '{{ORG.LEGAL_NAME}}',      coalesce(v_cfg.legal_entity_name, ''));
  v_body := replace(v_body, '{{ORG.SIGNATORY_NAME}}',  coalesce(v_cfg.signatory_name, ''));
  v_body := replace(v_body, '{{ORG.SIGNATORY_TITLE}}', coalesce(v_cfg.signatory_title, ''));
  v_body := replace(v_body, '{{ORG.ADDRESS}}',         coalesce(v_cfg.business_address, ''));
  v_body := replace(v_body, '{{ORG.PHONE}}',           coalesce(v_phone, ''));
  v_body := replace(v_body, '{{ORG.EMAIL}}',           coalesce(v_email, ''));
  v_body := replace(v_body, '{{ORG.URL}}',             coalesce(v_url, ''));
  -- Named principals in the Released Parties definitions (2026-08-02 bodies).
  v_body := replace(v_body, '{{ORG.PRINCIPALS}}',      coalesce(v_princ, ''));
  v_body := replace(v_body, '{{DOC.EFFECTIVE_DATE}}',  to_char(current_date, 'FMMonth DD, YYYY'));
  v_body := replace(v_body, '{{DOC.GENERATED_DATE}}',  to_char(current_date, 'FMMonth DD, YYYY'));
  -- Any remaining token (HORSE.*, person tokens above the cut, …) becomes a
  -- fill-in line: the signer's details land on the SIGNED document only.
  v_body := regexp_replace(v_body, '\{\{[A-Z0-9_.]+\}\}', '__________', 'g');

  RETURN QUERY SELECT v_tmpl.title, v_body;
END;
$function$

;
