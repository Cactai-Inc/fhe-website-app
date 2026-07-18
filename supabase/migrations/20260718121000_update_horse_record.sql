-- Full-record update for a horse, client-gated to its owner/lessee (or staff). Mirrors
-- create_horse_record's field coverage; only updates a column when its key is PRESENT
-- in the payload (COALESCE against a sentinel), so callers can send partial patches.
-- Locations and medications are handled by their own RPCs (set_horse_locations,
-- set_horse_medications), same as on create.
CREATE OR REPLACE FUNCTION public.update_horse_record(p_id uuid, p jsonb)
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE v_org uuid;
BEGIN
  SELECT org_id INTO v_org FROM horses WHERE id = p_id AND deleted_at IS NULL;
  IF v_org IS NULL THEN RAISE EXCEPTION 'unknown horse'; END IF;
  IF NOT (has_staff_access() OR caller_owns_horse(p_id)) THEN
    RAISE EXCEPTION 'not authorized for this horse';
  END IF;

  UPDATE horses SET
    registered_name     = CASE WHEN p ? 'registered_name'     THEN nullif(btrim(p ->> 'registered_name'),'')     ELSE registered_name END,
    nickname            = CASE WHEN p ? 'nickname'            THEN nullif(btrim(p ->> 'nickname'),'')            ELSE nickname END,
    breed               = CASE WHEN p ? 'breed'               THEN nullif(btrim(p ->> 'breed'),'')               ELSE breed END,
    color               = CASE WHEN p ? 'color'               THEN nullif(btrim(p ->> 'color'),'')               ELSE color END,
    markings            = CASE WHEN p ? 'markings'            THEN nullif(btrim(p ->> 'markings'),'')            ELSE markings END,
    sex                 = CASE WHEN p ? 'sex'                 THEN nullif(btrim(p ->> 'sex'),'')                 ELSE sex END,
    date_of_birth       = CASE WHEN p ? 'date_of_birth'       THEN nullif(p ->> 'date_of_birth','')::date        ELSE date_of_birth END,
    height              = CASE WHEN p ? 'height'              THEN nullif(btrim(p ->> 'height'),'')              ELSE height END,
    registration_number = CASE WHEN p ? 'registration_number' THEN nullif(btrim(p ->> 'registration_number'),'') ELSE registration_number END,
    registration_org    = CASE WHEN p ? 'registration_org'    THEN nullif(btrim(p ->> 'registration_org'),'')    ELSE registration_org END,
    microchip_id        = CASE WHEN p ? 'microchip_id'        THEN nullif(btrim(p ->> 'microchip_id'),'')        ELSE microchip_id END,
    passport_number     = CASE WHEN p ? 'passport_number'     THEN nullif(btrim(p ->> 'passport_number'),'')     ELSE passport_number END,
    passport_country    = CASE WHEN p ? 'passport_country'    THEN nullif(btrim(p ->> 'passport_country'),'')    ELSE passport_country END,
    fair_market_value   = CASE WHEN p ? 'fair_market_value'   THEN nullif(regexp_replace(coalesce(p ->> 'fair_market_value',''),'[$,\s]','','g'),'')::numeric ELSE fair_market_value END,
    vet_name            = CASE WHEN p ? 'vet_name'            THEN nullif(btrim(p ->> 'vet_name'),'')            ELSE vet_name END,
    vet_phone           = CASE WHEN p ? 'vet_phone'           THEN nullif(btrim(p ->> 'vet_phone'),'')           ELSE vet_phone END,
    vet_business_name   = CASE WHEN p ? 'vet_business_name'   THEN nullif(btrim(p ->> 'vet_business_name'),'')   ELSE vet_business_name END,
    vet_address_line1   = CASE WHEN p ? 'vet_address_line1'   THEN nullif(btrim(p ->> 'vet_address_line1'),'')   ELSE vet_address_line1 END,
    vet_city            = CASE WHEN p ? 'vet_city'            THEN nullif(btrim(p ->> 'vet_city'),'')            ELSE vet_city END,
    vet_state           = CASE WHEN p ? 'vet_state'           THEN nullif(btrim(p ->> 'vet_state'),'')           ELSE vet_state END,
    vet_postal          = CASE WHEN p ? 'vet_postal'          THEN nullif(btrim(p ->> 'vet_postal'),'')          ELSE vet_postal END,
    farrier_name        = CASE WHEN p ? 'farrier_name'        THEN nullif(btrim(p ->> 'farrier_name'),'')        ELSE farrier_name END,
    farrier_phone       = CASE WHEN p ? 'farrier_phone'       THEN nullif(btrim(p ->> 'farrier_phone'),'')       ELSE farrier_phone END,
    medical_history     = CASE WHEN p ? 'medical_history'     THEN nullif(btrim(p ->> 'medical_history'),'')     ELSE medical_history END,
    behavioral_history  = CASE WHEN p ? 'behavioral_history'  THEN nullif(btrim(p ->> 'behavioral_history'),'')  ELSE behavioral_history END,
    known_conditions    = CASE WHEN p ? 'known_conditions'    THEN nullif(btrim(p ->> 'known_conditions'),'')    ELSE known_conditions END,
    euthanasia_authorization = CASE WHEN p ? 'euthanasia_authorization' THEN nullif(btrim(p ->> 'euthanasia_authorization'),'') ELSE euthanasia_authorization END,
    training_history    = CASE WHEN p ? 'training_history'    THEN nullif(btrim(p ->> 'training_history'),'')    ELSE training_history END,
    competition_history = CASE WHEN p ? 'competition_history' THEN nullif(btrim(p ->> 'competition_history'),'') ELSE competition_history END,
    updated_at = now()
  WHERE id = p_id;
END;
$function$;
GRANT EXECUTE ON FUNCTION public.update_horse_record(uuid, jsonb) TO authenticated;
