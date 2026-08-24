-- TASK-OFFERINGDOCS — request_documents_from_contact refuses an unknown template.
--
-- Found in its own verification: asking for 'MEDIA_RELEASE' succeeded, wrote the
-- requirement, raised the notification — and the person was walled by nothing and
-- shown nothing, because contact_document_wall_state joins active templates and
-- no active MEDIA_RELEASE exists. The result is an obligation that can never be
-- satisfied and never appears: exactly the deadlock the wall's own "one shared
-- predicate" comment exists to prevent, arriving through a different door.
CREATE OR REPLACE FUNCTION public.request_documents_from_contact(
  p_contact_id uuid, p_template_keys text[], p_disposition text DEFAULT 'WHEN_READY')
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_org uuid; v_user uuid; v_email text; v_titles text[]; v_n int; v_unknown text[];
BEGIN
  IF NOT coalesce(has_staff_access(), false) THEN
    RAISE EXCEPTION 'staff access required';
  END IF;
  IF p_disposition NOT IN ('AT_LOGIN','WITH_CONTRACT','WHEN_READY') THEN
    RAISE EXCEPTION 'unknown disposition %', p_disposition;
  END IF;

  SELECT c.org_id, c.email INTO v_org, v_email
    FROM contacts c WHERE c.id = p_contact_id AND c.deleted_at IS NULL;
  IF v_org IS NULL THEN RAISE EXCEPTION 'contact % not found', p_contact_id; END IF;

  -- ⚠️ AN OBLIGATION NOBODY CAN SATISFY IS WORSE THAN NO OBLIGATION.
  SELECT array_agg(k) INTO v_unknown
    FROM unnest(coalesce(p_template_keys, ARRAY[]::text[])) k
   WHERE btrim(k) <> ''
     AND NOT EXISTS (SELECT 1 FROM contract_templates ct
                      WHERE ct.template_key = k AND ct.active AND ct.deleted_at IS NULL);
  IF v_unknown IS NOT NULL THEN
    RAISE EXCEPTION 'no active template for %  — nothing was asked for',
      array_to_string(v_unknown, ', ');
  END IF;

  INSERT INTO contact_required_documents (contact_id, template_key, org_id, disposition)
  SELECT p_contact_id, k, v_org, p_disposition
    FROM unnest(coalesce(p_template_keys, ARRAY[]::text[])) k
   WHERE btrim(k) <> ''
  ON CONFLICT (contact_id, template_key) DO UPDATE
    SET disposition = EXCLUDED.disposition, skipped_at = NULL, skipped_by = NULL;

  SELECT array_agg(DISTINCT coalesce(ct.title, k)), count(DISTINCT k)
    INTO v_titles, v_n
    FROM unnest(coalesce(p_template_keys, ARRAY[]::text[])) k
    LEFT JOIN contract_templates ct ON ct.template_key = k AND ct.active AND ct.deleted_at IS NULL
   WHERE btrim(k) <> '';

  SELECT p.user_id INTO v_user FROM profiles p WHERE p.contact_id = p_contact_id;
  IF v_user IS NOT NULL AND coalesce(v_n, 0) > 0 THEN
    PERFORM notify_user(v_user, 'documents_requested',
      CASE WHEN v_n = 1 THEN 'A document needs your signature'
           ELSE v_n || ' documents need your signature' END,
      array_to_string(v_titles, ', '), '/app/onboarding');
  END IF;

  RETURN jsonb_build_object('count', coalesce(v_n, 0), 'titles',
    to_jsonb(coalesce(v_titles, ARRAY[]::text[])), 'email', v_email,
    'has_account', v_user IS NOT NULL, 'disposition', p_disposition);
END;
$function$;
