/*
  # Covered lessee = a standing CLAUSE, not a named person

  Correction (owner): the horse documents should not name a specific lessee as a
  party. Instead they carry a standing provision extending coverage to FHE
  (COMPANY) and to ANY lessee while a lease of the Horse is in effect. This makes
  the docs owner-scoped — re-leasing to a different lessee needs NO reissue, and
  docs that already exist before a lease is created already cover the future
  lessee.

  - ensure_horse_documents: OWNER is the only party/signer again (drops the
    named-lessee covered party added in ..390000).
  - Bodies: remove the "{{LESSEE.FULL_NAME}}" line; add a COVERAGE EXTENSION
    clause after the Released Parties definition, on both the vet auth and care
    release. Re-register tokens (drops LESSEE.FULL_NAME).
  - Sequential execution (sign_sequence gate) from ..390000 is unchanged.
*/

CREATE OR REPLACE FUNCTION public.ensure_horse_documents(p_horse_id uuid, p_contract_id uuid DEFAULT NULL::uuid, p_include_care boolean DEFAULT NULL::boolean)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_org       uuid := current_org();
  v_horse     horses%ROWTYPE;
  v_owner     uuid;
  v_contact   uuid := current_contact_id();
  v_templates text[] := ARRAY['HORSE_EMERGENCY_VET'];
  v_tpl       text;
  v_doc       uuid;
  v_voided    int := 0;
  v_rc        int := 0;
  v_gen       jsonb := '[]'::jsonb;
  v_may       boolean;
  v_seq       int;
BEGIN
  SELECT * INTO v_horse FROM horses WHERE id = p_horse_id AND org_id = v_org AND deleted_at IS NULL;
  IF NOT FOUND THEN RAISE EXCEPTION 'horse not found in this org'; END IF;

  v_may := has_staff_access()
    OR v_horse.current_owner_contact_id = v_contact
    OR v_horse.lessee_contact_id = v_contact
    OR EXISTS (SELECT 1 FROM horse_relationships hr WHERE hr.horse_id = p_horse_id AND hr.party_contact_id = v_contact AND hr.active);
  IF NOT v_may THEN RAISE EXCEPTION 'not authorized for this horse'; END IF;

  v_owner := coalesce(v_horse.current_owner_contact_id, v_contact);
  IF v_owner IS NULL THEN RAISE EXCEPTION 'horse has no owner on record to authorize'; END IF;

  IF p_include_care IS TRUE
     OR (p_include_care IS NULL AND owner_has_executed_template(v_owner, 'RELEASE_HORSE_CARE')) THEN
    v_templates := array_append(v_templates, 'RELEASE_HORSE_CARE');
  END IF;

  FOREACH v_tpl IN ARRAY v_templates LOOP
    WITH tmpl AS (SELECT id FROM contract_templates WHERE template_key = v_tpl)
    UPDATE documents d
       SET deleted_at = now(), deleted_by = auth.uid()
     WHERE d.contact_id = v_owner
       AND d.template_id = (SELECT id FROM tmpl)
       AND d.deleted_at IS NULL
       AND (d.horse_id IS NULL
            OR (d.horse_id = p_horse_id AND d.merged_body LIKE '%{{HORSE.REGISTERED_NAME}}%'));
    GET DIAGNOSTICS v_rc = ROW_COUNT;
    v_voided := v_voided + v_rc;

    IF EXISTS (
      SELECT 1 FROM documents d
      JOIN contract_templates t ON t.id = d.template_id
      WHERE d.contact_id = v_owner AND t.template_key = v_tpl
        AND d.horse_id = p_horse_id AND d.deleted_at IS NULL
        AND d.merged_body NOT LIKE '%{{HORSE.REGISTERED_NAME}}%'
    ) THEN
      CONTINUE;
    END IF;

    -- OWNER is the sole party/signer; coverage of FHE + any active-term lessee is
    -- a standing clause in the body, not a named party.
    SELECT gd.document_id INTO v_doc FROM generate_document(
      v_owner, v_tpl, p_contract_id, p_horse_id,
      jsonb_build_array(jsonb_build_object(
        'contact_id', v_owner, 'role', 'CLIENT', 'is_signer', true, 'signer_order', 1)),
      'horse'::text) gd;

    v_seq := CASE WHEN p_contract_id IS NULL THEN NULL
                  WHEN v_tpl = 'HORSE_EMERGENCY_VET' THEN 2
                  WHEN v_tpl = 'RELEASE_HORSE_CARE'  THEN 3 END;
    UPDATE documents SET status = 'AWAITING_SIGNATURE', sign_sequence = v_seq
      WHERE id = v_doc AND status = 'DRAFT';
    v_gen := v_gen || jsonb_build_object('template_key', v_tpl, 'document_id', v_doc);
  END LOOP;

  IF p_contract_id IS NOT NULL THEN
    UPDATE documents d SET sign_sequence = 1
      FROM contract_templates t
     WHERE d.template_id = t.id AND t.template_key = 'HORSE_LEASE'
       AND d.contract_id = p_contract_id AND d.deleted_at IS NULL
       AND d.sign_sequence IS DISTINCT FROM 1;
  END IF;

  RETURN jsonb_build_object('owner_contact_id', v_owner, 'generated', v_gen, 'voided', v_voided);
END;
$function$;

-- ── Bodies: drop the named line; add the standing coverage-extension clause ──
UPDATE contract_templates SET body = replace(
    body,
    E'HORSE INFORMATION\nCovered party — current Lessee of the Horse during the lease term (if any): {{LESSEE.FULL_NAME}}',
    E'HORSE INFORMATION')
 WHERE template_key IN ('HORSE_EMERGENCY_VET','RELEASE_HORSE_CARE');

UPDATE contract_templates SET body = replace(
    body,
    E'on behalf of COMPANY at any location where it is authorized to conduct business.',
    E'on behalf of COMPANY at any location where it is authorized to conduct business. COVERAGE EXTENSION: The authorizations, releases, and protections set forth in this document extend to and benefit COMPANY (French Heritage Equestrian) and, during any period in which a lease of the Horse is in effect, the then-current lessee of the Horse under that lease, each as an additional covered party — without the need to name that lessee.')
 WHERE template_key IN ('HORSE_EMERGENCY_VET','RELEASE_HORSE_CARE')
   AND body NOT LIKE '%COVERAGE EXTENSION:%';

DO $tok$
DECLARE k text;
BEGIN
  FOREACH k IN ARRAY ARRAY['HORSE_EMERGENCY_VET','RELEASE_HORSE_CARE'] LOOP
    DELETE FROM template_tokens WHERE template_id = (SELECT id FROM contract_templates WHERE template_key = k);
    INSERT INTO template_tokens (template_id, namespace, field, token, kind, required, party_scoped)
      SELECT (SELECT id FROM contract_templates WHERE template_key = k),
             split_part(trim(both '{}' from tok), '.', 1),
             substr(trim(both '{}' from tok), position('.' in trim(both '{}' from tok)) + 1),
             tok,
             CASE split_part(trim(both '{}' from tok), '.', 1)
               WHEN 'SIG' THEN 'signature' WHEN 'DOC' THEN 'system' ELSE 'field' END,
             false,
             split_part(trim(both '{}' from tok), '.', 1) IN ('CLIENT','LESSEE','LESSOR','PARTICIPANT','SIG')
        FROM (SELECT DISTINCT unnest(regexp_matches(
                (SELECT body FROM contract_templates WHERE template_key = k),
                '\{\{[A-Z0-9_.]+\}\}', 'g')) AS tok) t;
  END LOOP;
END;
$tok$;
