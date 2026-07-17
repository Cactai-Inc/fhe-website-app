-- attach_horse_to_document resolves markings/registration_org/passport_country
-- lookup CODES to display names (falls back to the raw value for Other entries).
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
  v_breed   text;
  v_color   text;
  v_markings text;
  v_reg_org  text;
  v_passport_country text;
  v_home_loc text;
  v_curr_loc text;
  r         record;
  v_val     text;
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

  SELECT display_name INTO v_breed FROM horse_breeds WHERE code = v_horse.breed;
  SELECT display_name INTO v_color FROM horse_colors WHERE code = v_horse.color;
  v_markings := coalesce((SELECT display_name FROM lookup_options WHERE lookup_key='horse_markings' AND code = v_horse.markings), v_horse.markings);
  v_reg_org := coalesce((SELECT display_name FROM lookup_options WHERE lookup_key='horse_registration_org' AND code = v_horse.registration_org), v_horse.registration_org);
  v_passport_country := coalesce((SELECT display_name FROM lookup_options WHERE lookup_key='horse_passport_country' AND code = v_horse.passport_country), v_horse.passport_country);
  v_home_loc := coalesce((SELECT name FROM locations WHERE id = v_horse.home_location_id), '');
  v_curr_loc := coalesce((SELECT name FROM locations WHERE id = v_horse.current_location_id), '');

  UPDATE documents SET horse_id = p_horse_id, updated_at = now() WHERE id = p_document_id;

  FOR r IN
    SELECT cf.id,
           upper(split_part(regexp_replace(cf.field_key, '[{}]', '', 'g'), '.', 2)) AS field
    FROM contract_fields cf
    WHERE cf.document_id = p_document_id
      AND regexp_replace(cf.field_key, '[{}]', '', 'g') LIKE 'HORSE.%'
  LOOP
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
      WHEN 'MARKINGS'            THEN v_markings
      WHEN 'REGISTRATION_ORG'    THEN v_reg_org
      WHEN 'PASSPORT_NUMBER'     THEN v_horse.passport_number
      WHEN 'PASSPORT_COUNTRY'    THEN v_passport_country
      WHEN 'CURRENT_LOCATION'    THEN coalesce(nullif(v_curr_loc,''), v_horse.current_location)
      WHEN 'HOME_LOCATION'       THEN v_home_loc
      WHEN 'VET_NAME'            THEN v_horse.vet_name
      WHEN 'VET_PHONE'           THEN v_horse.vet_phone
      WHEN 'FARRIER_NAME'        THEN v_horse.farrier_name
      WHEN 'FARRIER_PHONE'       THEN v_horse.farrier_phone
      WHEN 'FAIR_MARKET_VALUE'   THEN fmt_money(v_horse.fair_market_value)
      WHEN 'MEDICATION_NAME'         THEN v_horse.medication_name
      WHEN 'MEDICATION_DOSAGE'       THEN v_horse.medication_dosage
      WHEN 'MEDICATION_INSTRUCTIONS' THEN v_horse.medication_instructions
      WHEN 'MEDICATION_ADDITIONAL'   THEN v_horse.medication_additional
      WHEN 'KNOWN_CONDITIONS'        THEN v_horse.known_conditions
      WHEN 'TRAINING_HISTORY'        THEN v_horse.training_history
      WHEN 'COMPETITION_HISTORY'     THEN v_horse.competition_history
      WHEN 'MEDICAL_HISTORY'         THEN v_horse.medical_history
      WHEN 'BEHAVIORAL_HISTORY'      THEN v_horse.behavioral_history
      WHEN 'MEDICATION_HISTORY'      THEN v_horse.medication_current
      WHEN 'EUTHANASIA_A' THEN CASE WHEN v_horse.euthanasia_authorization = 'A' THEN 'X' ELSE ' ' END
      WHEN 'EUTHANASIA_B' THEN CASE WHEN v_horse.euthanasia_authorization = 'B' THEN 'X' ELSE ' ' END
      ELSE '' END;

    UPDATE contract_fields SET value = v_val, updated_at = now() WHERE id = r.id;
  END LOOP;

  PERFORM remerge_contract_from_fields(p_document_id);
END;
$function$;
