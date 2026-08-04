-- Horse location rendering (owner directive 2026-08-03): the location token
-- renders the FULL facility address, with the internal location (barn/stall)
-- on its own following line, as is customary. Composer: facility block +
-- newline + "Barn, Stall" (was one line joined with an em dash). Data: the
-- Carmel Creek Ranch locations row gains its real address; Beau repoints to
-- it with Main Barn / Stall 12 as structured barn/stall (previously his
-- location_id pointed at a mis-modeled locations row literally named
-- "FHE Main Barn Stall 12" with no address — deleted below, no references).
UPDATE locations SET address_line1 = '11500 Clews Ranch Rd', city = 'San Diego', state = 'CA', postal = '92130'
 WHERE id = '2d771cea-5150-43b9-8e3d-38faa434a07d' AND name = 'Carmel Creek Ranch'
   AND coalesce(address_line1,'') = '';

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
  v_home_loc := nullif(btrim(concat_ws(E'\n',
    (SELECT nullif(btrim(concat_ws(', ', l.name, l.address_line1, l.city, nullif(btrim(concat_ws(' ', l.state, l.postal)),''))),'') FROM locations l WHERE l.id = v_horse.home_location_id),
    nullif(btrim(concat_ws(', ', v_horse.home_barn, v_horse.home_stall)),''))), '');
  v_curr_loc := nullif(btrim(concat_ws(E'\n',
    (SELECT nullif(btrim(concat_ws(', ', l.name, l.address_line1, l.city, nullif(btrim(concat_ws(' ', l.state, l.postal)),''))),'') FROM locations l WHERE l.id = v_horse.current_location_id),
    nullif(btrim(concat_ws(', ', v_horse.current_barn, v_horse.current_stall)),''))), '');

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

UPDATE horses SET
    current_location_id = '2d771cea-5150-43b9-8e3d-38faa434a07d',
    home_location_id    = '2d771cea-5150-43b9-8e3d-38faa434a07d',
    current_barn  = 'Main Barn',
    current_stall = 'Stall 12',
    current_location = 'Carmel Creek Ranch, Main Barn, Stall 12'
 WHERE id = 'a8e82033-cf9e-48aa-8ea5-a856f2ede597'
   AND current_location_id = '2e77ca20-f6f3-4de7-9e37-63228c8ec503';

DELETE FROM locations WHERE id = '2e77ca20-f6f3-4de7-9e37-63228c8ec503'
  AND name = 'FHE Main Barn Stall 12'
  AND NOT EXISTS (SELECT 1 FROM horses WHERE current_location_id = '2e77ca20-f6f3-4de7-9e37-63228c8ec503' OR home_location_id = '2e77ca20-f6f3-4de7-9e37-63228c8ec503')
  AND NOT EXISTS (SELECT 1 FROM horse_contract_locations WHERE location_id = '2e77ca20-f6f3-4de7-9e37-63228c8ec503')
  AND NOT EXISTS (SELECT 1 FROM bookings WHERE location_id = '2e77ca20-f6f3-4de7-9e37-63228c8ec503');
