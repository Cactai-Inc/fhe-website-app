/*
  # Visitor release preview — merged company identity before signing

  The /release kiosk displayed the raw RELEASE_GENERAL template, so visitors saw
  {{ORG.*}}/{{DOC.EFFECTIVE_DATE}} tokens instead of who they were releasing and
  the date (owner-reported). A release must present the real identity BEFORE
  signature; the signed document itself is still produced by sign_general_release.

  general_release_preview(p_org): anon-executable, read-only merge of the
  org-identity + date tokens (same resolution sources as generate_document's ORG
  arm, scoped to the resolved org). Person/signature tokens render as blank
  lines — the visitor's own details arrive when they sign.
  Org resolution mirrors sign_general_release: p_org → current_org() →
  current_addressed_org() → sole_org().
*/

CREATE OR REPLACE FUNCTION general_release_preview(p_org uuid DEFAULT NULL)
RETURNS TABLE (title text, body text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
DECLARE
  v_org   uuid;
  v_tmpl  record;
  v_cfg   business_config%ROWTYPE;
  v_body  text;
  v_ident text;
  v_phone text;
  v_email text;
  v_url   text;
BEGIN
  v_org := coalesce(p_org, current_org(), current_addressed_org(), sole_org());
  IF v_org IS NULL THEN
    RAISE EXCEPTION 'no organization resolvable for release preview';
  END IF;

  SELECT t.title, t.body INTO v_tmpl
    FROM contract_templates t
   WHERE t.template_key = 'RELEASE_GENERAL' AND t.active AND t.body IS NOT NULL;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'general release template unavailable';
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

  v_body := v_tmpl.body;
  v_body := replace(v_body, '{{ORG.LEGAL_IDENTITY}}',  coalesce(v_ident, v_cfg.legal_entity_name, ''));
  v_body := replace(v_body, '{{ORG.LEGAL_NAME}}',      coalesce(v_cfg.legal_entity_name, ''));
  v_body := replace(v_body, '{{ORG.SIGNATORY_NAME}}',  coalesce(v_cfg.signatory_name, ''));
  v_body := replace(v_body, '{{ORG.SIGNATORY_TITLE}}', coalesce(v_cfg.signatory_title, ''));
  v_body := replace(v_body, '{{ORG.ADDRESS}}',         coalesce(v_cfg.business_address, ''));
  v_body := replace(v_body, '{{ORG.PHONE}}',           coalesce(v_phone, ''));
  v_body := replace(v_body, '{{ORG.EMAIL}}',           coalesce(v_email, ''));
  v_body := replace(v_body, '{{ORG.URL}}',             coalesce(v_url, ''));
  v_body := replace(v_body, '{{DOC.EFFECTIVE_DATE}}',  to_char(current_date, 'FMMonth DD, YYYY'));
  v_body := replace(v_body, '{{DOC.GENERATED_DATE}}',  to_char(current_date, 'FMMonth DD, YYYY'));
  -- Person + signature tokens become fill-in lines: the visitor's details land
  -- on the SIGNED document (sign_general_release), not the preview.
  v_body := regexp_replace(v_body, '\{\{[A-Z0-9_.]+\}\}', '__________', 'g');

  RETURN QUERY SELECT v_tmpl.title, v_body;
END;
$$;

REVOKE ALL ON FUNCTION general_release_preview(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION general_release_preview(uuid) TO anon, authenticated;
