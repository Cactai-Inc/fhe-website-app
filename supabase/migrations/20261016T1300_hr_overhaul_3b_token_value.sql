-- Horse records overhaul, phase 3b: horse_field_token_value reads vet, farrier,
-- location and narrative values from the new structures (providers, horse_locations,
-- narrative lists) instead of the horse columns being removed.

CREATE OR REPLACE FUNCTION public.horse_field_token_value(v_horse horses, p_field text)
 RETURNS text
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_breed  text;
  v_color  text;
  v_reg_org  text;
  v_passport_country text;
BEGIN
  v_breed := coalesce((SELECT display_name FROM horse_breeds WHERE code = v_horse.breed), v_horse.breed);
  v_color := coalesce((SELECT display_name FROM horse_colors WHERE code = v_horse.color), v_horse.color);
  v_reg_org := coalesce((SELECT display_name FROM lookup_options WHERE lookup_key='horse_registration_org' AND code = v_horse.registration_org), v_horse.registration_org);
  v_passport_country := coalesce((SELECT display_name FROM lookup_options WHERE lookup_key='horse_passport_country' AND code = v_horse.passport_country), v_horse.passport_country);

  RETURN CASE p_field
    WHEN 'REGISTERED_NAME'     THEN v_horse.registered_name
    WHEN 'BARN_NAME'           THEN v_horse.nickname
    WHEN 'BREED'               THEN v_breed
    WHEN 'COLOR'               THEN v_color
    WHEN 'SEX'                 THEN CASE upper(coalesce(v_horse.sex, ''))
                                   WHEN 'MARE' THEN 'Mare'
                                   WHEN 'GELDING' THEN 'Gelding'
                                   WHEN 'STALLION' THEN 'Stallion'
                                   WHEN 'COLT' THEN 'Colt'
                                   WHEN 'FILLY' THEN 'Filly'
                                   WHEN '' THEN v_horse.sex
                                   ELSE initcap(v_horse.sex) END
    WHEN 'AGE_DOB'             THEN to_char(v_horse.date_of_birth, 'FMMonth FMDD, YYYY')
    WHEN 'HEIGHT'              THEN v_horse.height
    WHEN 'REGISTRATION_NUMBER' THEN v_horse.registration_number
    WHEN 'MICROCHIP'           THEN v_horse.microchip_id
    WHEN 'MARKINGS'            THEN v_horse.markings
    WHEN 'REGISTRATION_ORG'    THEN v_reg_org
    WHEN 'PASSPORT_NUMBER'     THEN v_horse.passport_number
    WHEN 'PASSPORT_COUNTRY'    THEN v_passport_country
    WHEN 'CURRENT_LOCATION'    THEN coalesce(horse_current_location_label(v_horse.id), v_horse.current_location)
    WHEN 'HOME_LOCATION'       THEN horse_current_location_label(v_horse.id)
    WHEN 'VET_NAME'            THEN horse_provider_value(v_horse.id, 'VET', 'NAME')
    WHEN 'VET_PHONE'           THEN horse_provider_value(v_horse.id, 'VET', 'PHONE')
    WHEN 'VET_BUSINESS'        THEN horse_provider_value(v_horse.id, 'VET', 'BUSINESS')
    WHEN 'VET_ADDRESS'         THEN horse_provider_value(v_horse.id, 'VET', 'ADDRESS')
    WHEN 'FARRIER_NAME'        THEN horse_provider_value(v_horse.id, 'FARRIER', 'NAME')
    WHEN 'FARRIER_PHONE'       THEN horse_provider_value(v_horse.id, 'FARRIER', 'PHONE')
    WHEN 'FAIR_MARKET_VALUE'   THEN fmt_money(v_horse.fair_market_value)
    WHEN 'MEDICATION_NAME'         THEN horse_medications_prose(v_horse.id, 'MEDICATION')
    WHEN 'MEDICATION_DOSAGE'       THEN ''
    WHEN 'MEDICATION_INSTRUCTIONS' THEN ''
    WHEN 'MEDICATION_ADDITIONAL'   THEN ''
    WHEN 'KNOWN_CONDITIONS'        THEN horse_list_prose(v_horse.known_conditions_list, 'condition')
    WHEN 'TRAINING_HISTORY'        THEN horse_list_prose(v_horse.training_history_list, 'entry')
    WHEN 'COMPETITION_HISTORY'     THEN horse_list_prose(v_horse.competition_history_list, 'entry')
    WHEN 'MEDICAL_HISTORY'         THEN horse_list_prose(v_horse.medical_history_list, 'summary')
    WHEN 'BEHAVIORAL_HISTORY'      THEN horse_list_prose(v_horse.behavioral_history_list, 'concern')
    WHEN 'INJURIES_TO_HUMANS'      THEN horse_injuries_prose(v_horse.injuries_to_humans)
    WHEN 'MEDICATION_HISTORY'      THEN horse_medications_prose(v_horse.id, 'MEDICATION')
    WHEN 'EUTHANASIA_A' THEN CASE WHEN v_horse.euthanasia_authorization = 'A' THEN 'X' ELSE ' ' END
    WHEN 'EUTHANASIA_B' THEN CASE WHEN v_horse.euthanasia_authorization = 'B' THEN 'X' ELSE ' ' END
    ELSE '' END;
END;
$function$;
