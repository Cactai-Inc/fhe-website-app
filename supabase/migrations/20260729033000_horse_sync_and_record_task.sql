-- HORSE → CONTRACT SYNC + RECORD-COMPLETION TASK (owner-approved, 2026-07-28).
--
-- 1) horse_field_token_value(): the ONE HORSE.* materialization map, extracted
--    from attach_horse_to_document (which now calls it) so the new sync trigger
--    reuses the identical logic — including lookup_options display-name
--    resolution — instead of duplicating it.
-- 2) attach_horse_to_document(): behavior-identical rewrite on the helper.
-- 3) horses AFTER UPDATE trigger: re-materializes HORSE.* contract fields on
--    every attached OPEN document (workflow_state editable/editing/in_review).
--    A field a party manually overrode is preserved: only values that are
--    EMPTY or still equal the horse record's PREVIOUS value are overwritten.
--    Locked/executed documents are never touched. This is what carries intake
--    edits into an in-authoring lease in real time.
-- 4) staff_request_horse_record_completion(): assigns the finish-the-required-
--    fields task through the EXISTING notifications machinery (notify_user →
--    dashboard alert + badge, linking to the intake form in edit mode).

-- ── 1. the shared materialization map ────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.horse_field_token_value(v_horse horses, p_field text)
 RETURNS text
 LANGUAGE plpgsql
 STABLE
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_breed  text;
  v_color  text;
  v_markings text;
  v_reg_org  text;
  v_passport_country text;
  v_home_loc text;
  v_curr_loc text;
BEGIN
  SELECT display_name INTO v_breed FROM horse_breeds WHERE code = v_horse.breed;
  SELECT display_name INTO v_color FROM horse_colors WHERE code = v_horse.color;
  v_markings := coalesce((SELECT display_name FROM lookup_options WHERE lookup_key='horse_markings' AND code = v_horse.markings), v_horse.markings);
  v_reg_org := coalesce((SELECT display_name FROM lookup_options WHERE lookup_key='horse_registration_org' AND code = v_horse.registration_org), v_horse.registration_org);
  v_passport_country := coalesce((SELECT display_name FROM lookup_options WHERE lookup_key='horse_passport_country' AND code = v_horse.passport_country), v_horse.passport_country);
  v_home_loc := nullif(btrim(concat_ws(' — ',
    (SELECT nullif(btrim(concat_ws(', ', l.name, l.address_line1, l.city, nullif(btrim(concat_ws(' ', l.state, l.postal)),''))),'') FROM locations l WHERE l.id = v_horse.home_location_id),
    nullif(btrim(concat_ws(' ', v_horse.home_barn, v_horse.home_stall)),''))), '');
  v_curr_loc := nullif(btrim(concat_ws(' — ',
    (SELECT nullif(btrim(concat_ws(', ', l.name, l.address_line1, l.city, nullif(btrim(concat_ws(' ', l.state, l.postal)),''))),'') FROM locations l WHERE l.id = v_horse.current_location_id),
    nullif(btrim(concat_ws(' ', v_horse.current_barn, v_horse.current_stall)),''))), '');

  RETURN CASE p_field
    WHEN 'REGISTERED_NAME'     THEN v_horse.registered_name
    WHEN 'BARN_NAME'           THEN v_horse.nickname
    WHEN 'BREED'               THEN v_breed
    WHEN 'COLOR'               THEN v_color
    WHEN 'SEX'                 THEN v_horse.sex
    WHEN 'AGE_DOB'             THEN to_char(v_horse.date_of_birth, 'FMMonth FMDD, YYYY')
    WHEN 'HEIGHT'              THEN v_horse.height
    WHEN 'REGISTRATION_NUMBER' THEN v_horse.registration_number
    WHEN 'MICROCHIP'           THEN v_horse.microchip_id
    WHEN 'MARKINGS'            THEN v_markings
    WHEN 'REGISTRATION_ORG'    THEN v_reg_org
    WHEN 'PASSPORT_NUMBER'     THEN v_horse.passport_number
    WHEN 'PASSPORT_COUNTRY'    THEN v_passport_country
    WHEN 'CURRENT_LOCATION'    THEN coalesce(nullif(v_curr_loc,''), v_horse.current_location)
    WHEN 'HOME_LOCATION'       THEN v_home_loc
    WHEN 'VET_NAME'            THEN v_horse.vet_name
    WHEN 'VET_PHONE'           THEN v_horse.vet_phone
    WHEN 'VET_BUSINESS'        THEN v_horse.vet_business_name
    WHEN 'VET_ADDRESS'         THEN nullif(btrim(concat_ws(', ', v_horse.vet_address_line1, v_horse.vet_city, nullif(btrim(concat_ws(' ', v_horse.vet_state, v_horse.vet_postal)),''))), '')
    WHEN 'FARRIER_NAME'        THEN v_horse.farrier_name
    WHEN 'FARRIER_PHONE'       THEN v_horse.farrier_phone
    WHEN 'FAIR_MARKET_VALUE'   THEN fmt_money(v_horse.fair_market_value)
    WHEN 'MEDICATION_NAME'         THEN horse_medications_prose(v_horse.id, 'MEDICATION')
    WHEN 'MEDICATION_DOSAGE'       THEN ''
    WHEN 'MEDICATION_INSTRUCTIONS' THEN ''
    WHEN 'MEDICATION_ADDITIONAL'   THEN ''
    WHEN 'KNOWN_CONDITIONS'        THEN v_horse.known_conditions
    WHEN 'TRAINING_HISTORY'        THEN v_horse.training_history
    WHEN 'COMPETITION_HISTORY'     THEN v_horse.competition_history
    WHEN 'MEDICAL_HISTORY'         THEN v_horse.medical_history
    WHEN 'BEHAVIORAL_HISTORY'      THEN v_horse.behavioral_history
    WHEN 'MEDICATION_HISTORY'      THEN horse_medications_prose(v_horse.id, 'MEDICATION')
    WHEN 'EUTHANASIA_A' THEN CASE WHEN v_horse.euthanasia_authorization = 'A' THEN 'X' ELSE ' ' END
    WHEN 'EUTHANASIA_B' THEN CASE WHEN v_horse.euthanasia_authorization = 'B' THEN 'X' ELSE ' ' END
    ELSE '' END;
END;
$function$;

REVOKE ALL ON FUNCTION public.horse_field_token_value(horses, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.horse_field_token_value(horses, text) TO authenticated, service_role;

-- ── 2. attach_horse_to_document — identical behavior, on the helper ─────────
CREATE OR REPLACE FUNCTION public.attach_horse_to_document(p_document_id uuid, p_horse_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_me      uuid := current_contact_id();
  v_staff   boolean := has_staff_access();
  v_org     uuid;
  v_state   text;
  v_horse   horses%ROWTYPE;
  r         record;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'authentication required'; END IF;

  SELECT org_id, workflow_state INTO v_org, v_state FROM documents WHERE id = p_document_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'unknown document'; END IF;
  IF v_state NOT IN ('editable', 'editing', 'in_review') THEN
    RAISE EXCEPTION 'this contract can no longer be edited';
  END IF;

  IF NOT (v_staff AND v_org = current_org()) THEN
    IF NOT EXISTS (SELECT 1 FROM document_parties dp WHERE dp.document_id = p_document_id AND dp.contact_id = v_me) THEN
      RAISE EXCEPTION 'not authorized for this document';
    END IF;
  END IF;

  SELECT * INTO v_horse FROM horses WHERE id = p_horse_id AND deleted_at IS NULL;
  IF NOT FOUND THEN RAISE EXCEPTION 'unknown horse'; END IF;
  IF v_horse.org_id <> v_org THEN RAISE EXCEPTION 'horse is not in this organization'; END IF;

  IF NOT (v_staff AND v_org = current_org()) THEN
    IF v_horse.current_owner_contact_id IS DISTINCT FROM v_me THEN
      RAISE EXCEPTION 'you can only attach your own horse';
    END IF;
  END IF;

  UPDATE documents SET horse_id = p_horse_id, updated_at = now() WHERE id = p_document_id;

  FOR r IN
    SELECT cf.id,
           upper(split_part(regexp_replace(cf.field_key, '[{}]', '', 'g'), '.', 2)) AS field
    FROM contract_fields cf
    WHERE cf.document_id = p_document_id
      AND regexp_replace(cf.field_key, '[{}]', '', 'g') LIKE 'HORSE.%'
  LOOP
    UPDATE contract_fields
       SET value = horse_field_token_value(v_horse, r.field), updated_at = now()
     WHERE id = r.id;
  END LOOP;

  -- Recompose with the engine the document actually uses: clause-engine
  -- templates (contract_section_defs rows) compose from clauses; flat
  -- templates from the tokenized body. (Previously always from_fields; the
  -- frontend papered over it with a follow-up clauses remerge.)
  IF EXISTS (
    SELECT 1 FROM contract_section_defs s
    JOIN contract_templates ct ON ct.id = (SELECT template_id FROM documents WHERE id = p_document_id)
    WHERE s.template_key = ct.template_key
  ) THEN
    PERFORM remerge_contract_from_clauses(p_document_id);
  ELSE
    PERFORM remerge_contract_from_fields(p_document_id);
  END IF;
END;
$function$;

-- ── 3. horses → open documents sync trigger ──────────────────────────────────
CREATE OR REPLACE FUNCTION public.sync_horse_fields_to_documents()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  d         record;
  f         record;
  v_new     text;
  v_old     text;
  v_changed boolean;
BEGIN
  FOR d IN
    SELECT doc.id, ct.template_key FROM documents doc
    JOIN contract_templates ct ON ct.id = doc.template_id
    WHERE doc.horse_id = NEW.id
      AND doc.deleted_at IS NULL
      AND doc.workflow_state IN ('editable', 'editing', 'in_review')
  LOOP
    -- Per-document sub-block: a document-side failure (e.g. the horse's owner
    -- updating their record while not (yet) a party on some staff draft, so
    -- remerge refuses) must NEVER block the horse record save. That document
    -- simply stays as-is (its fields refresh on the next attach/edit).
    BEGIN
      v_changed := false;
      FOR f IN
        SELECT cf.id, cf.value,
               upper(split_part(regexp_replace(cf.field_key, '[{}]', '', 'g'), '.', 2)) AS field
        FROM contract_fields cf
        WHERE cf.document_id = d.id
          AND regexp_replace(cf.field_key, '[{}]', '', 'g') LIKE 'HORSE.%'
      LOOP
        v_new := horse_field_token_value(NEW, f.field);
        v_old := horse_field_token_value(OLD, f.field);
        -- Preserve deliberate contract-side edits: overwrite only when the
        -- stored value is empty OR still equals the horse record's PREVIOUS
        -- value (i.e. it was never manually diverged).
        IF (f.value IS NULL OR btrim(f.value) = '' OR f.value = v_old)
           AND f.value IS DISTINCT FROM v_new THEN
          UPDATE contract_fields SET value = v_new, updated_at = now() WHERE id = f.id;
          v_changed := true;
        END IF;
      END LOOP;
      IF v_changed THEN
        -- clause-engine docs recompose from clauses; flat docs from the body
        IF EXISTS (SELECT 1 FROM contract_section_defs s WHERE s.template_key = d.template_key) THEN
          PERFORM remerge_contract_from_clauses(d.id);
        ELSE
          PERFORM remerge_contract_from_fields(d.id);
        END IF;
      END IF;
    EXCEPTION WHEN OTHERS THEN
      NULL; -- this document is skipped; the horse save proceeds
    END;
  END LOOP;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS horses_sync_contract_fields ON public.horses;
CREATE TRIGGER horses_sync_contract_fields
  AFTER UPDATE ON public.horses
  FOR EACH ROW EXECUTE FUNCTION public.sync_horse_fields_to_documents();

-- ── 4. assign the finish-the-record task (existing notification machinery) ──
CREATE OR REPLACE FUNCTION public.staff_request_horse_record_completion(p_horse_id uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_horse horses%ROWTYPE;
  v_user  uuid;
  v_name  text;
BEGIN
  IF NOT has_staff_access() THEN RAISE EXCEPTION 'staff access required'; END IF;
  SELECT * INTO v_horse FROM horses WHERE id = p_horse_id AND deleted_at IS NULL;
  IF NOT FOUND THEN RAISE EXCEPTION 'unknown horse'; END IF;
  SELECT p.user_id INTO v_user FROM profiles p WHERE p.contact_id = v_horse.current_owner_contact_id;
  IF v_user IS NULL THEN RAISE EXCEPTION 'the horse''s owner has no account to notify'; END IF;
  v_name := coalesce(nullif(btrim(v_horse.nickname), ''), v_horse.registered_name, 'your horse');
  RETURN notify_user(
    v_user,
    'horse_record_task',
    'Complete ' || v_name || '''s record',
    'A few details are still needed on ' || v_name || '''s record so their care paperwork can be completed. It only takes a couple of minutes.',
    '/app/horse-intake?horse=' || p_horse_id::text);
END;
$function$;

REVOKE ALL ON FUNCTION public.staff_request_horse_record_completion(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.staff_request_horse_record_completion(uuid) TO authenticated, service_role;
