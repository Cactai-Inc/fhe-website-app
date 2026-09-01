-- Attach a horse RECORD to an existing contract and fill its HORSE.* fields from
-- that record — the post-creation counterpart to generate_document's p_horse_id
-- path. Powers the "which horse is this contract for?" gate: an owner opening a
-- contract picks one of their horses (or adds a new record), and this stamps the
-- document + populates the horse section from the chosen record.
--
-- Authorization: staff (any admin), OR a party on the document who owns the horse.
-- Only on an editable document (never touch a locked/executed contract).

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
  r         record;
  v_val     text;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'authentication required'; END IF;

  SELECT org_id, workflow_state INTO v_org, v_state FROM documents WHERE id = p_document_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'unknown document'; END IF;
  IF v_state NOT IN ('editable', 'editing', 'in_review') THEN
    RAISE EXCEPTION 'this contract can no longer be edited';
  END IF;

  -- caller must be staff in the org, or a party on this document
  IF NOT (v_staff AND v_org = current_org()) THEN
    IF NOT EXISTS (SELECT 1 FROM document_parties dp WHERE dp.document_id = p_document_id AND dp.contact_id = v_me) THEN
      RAISE EXCEPTION 'not authorized for this document';
    END IF;
  END IF;

  SELECT * INTO v_horse FROM horses WHERE id = p_horse_id AND deleted_at IS NULL;
  IF NOT FOUND THEN RAISE EXCEPTION 'unknown horse'; END IF;
  IF v_horse.org_id <> v_org THEN RAISE EXCEPTION 'horse is not in this organization'; END IF;

  -- a non-staff caller may only attach a horse they own
  IF NOT (v_staff AND v_org = current_org()) THEN
    IF v_horse.current_owner_contact_id IS DISTINCT FROM v_me THEN
      RAISE EXCEPTION 'you can only attach your own horse';
    END IF;
  END IF;

  SELECT display_name INTO v_breed FROM horse_breeds WHERE code = v_horse.breed;
  SELECT display_name INTO v_color FROM horse_colors WHERE code = v_horse.color;

  UPDATE documents SET horse_id = p_horse_id, updated_at = now() WHERE id = p_document_id;

  -- Fill every HORSE.* contract field from the record (same mapping as
  -- generate_document). Only rewrites HORSE.* — other fields are untouched.
  -- field_key may be stored as '{{HORSE.X}}' or 'HORSE.X'; derive the bare field
  -- name either way so we don't depend on the exact stored form.
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
      WHEN 'CURRENT_LOCATION'    THEN v_horse.current_location
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
      WHEN 'EUTHANASIA_A' THEN CASE WHEN v_horse.euthanasia_authorization = 'A' THEN 'X' ELSE ' ' END
      WHEN 'EUTHANASIA_B' THEN CASE WHEN v_horse.euthanasia_authorization = 'B' THEN 'X' ELSE ' ' END
      ELSE '' END;

    UPDATE contract_fields SET value = v_val, updated_at = now() WHERE id = r.id;
  END LOOP;

  -- re-merge the body from the now-filled fields
  PERFORM remerge_contract_from_fields(p_document_id);
END;
$function$;

GRANT EXECUTE ON FUNCTION public.attach_horse_to_document(uuid, uuid) TO authenticated;
