-- horse_field_token_value: BREED and COLOR fall back to the raw stored value
-- on a lookup miss, exactly like markings/registration_org/passport_country.
-- Without the fallback, a value stored before its lookup row existed (Beau:
-- SELLE_FRANCAIS, added to live horse_breeds outside any migration)
-- materialized as NULL at attach time and the blank never self-healed.
-- Full body carried forward from live otherwise unchanged. 2026-08-02.
CREATE OR REPLACE FUNCTION public.horse_field_token_value(v_horse horses, p_field text)
 RETURNS text
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
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
  v_breed := coalesce((SELECT display_name FROM horse_breeds WHERE code = v_horse.breed), v_horse.breed);
  v_color := coalesce((SELECT display_name FROM horse_colors WHERE code = v_horse.color), v_horse.color);
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
$function$

;
