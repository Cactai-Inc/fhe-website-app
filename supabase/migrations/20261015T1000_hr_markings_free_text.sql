-- Markings is a free-text field, not a vocabulary. A Jockey Club registration
-- certificate describes markings in a paragraph no closed list can capture, so the
-- stored value is the written description itself and renders verbatim everywhere it
-- appears (horse record, lease, sale, Bill of Sale). An empty markings reads "None".

-- 1. Existing horse records hold vocabulary CODES. Convert each to its display text;
--    NONE / empty becomes the literal "None".
UPDATE horses h
   SET markings = CASE
     WHEN h.markings IS NULL OR btrim(h.markings) = '' OR h.markings = 'NONE' THEN 'None'
     ELSE coalesce(
       (SELECT lo.display_name FROM lookup_options lo
         WHERE lo.lookup_key = 'horse_markings' AND lo.code = h.markings),
       h.markings)
   END;

-- 2. horse_field_token_value resolves {{HORSE.MARKINGS}} for the contract_fields
--    path. Markings is now plain text: pass it through, emit "None" when empty.
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
  v_markings := coalesce(nullif(btrim(v_horse.markings), ''), 'None');
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

-- 3. generate_document reads markings raw on its own path; give it the same
--    "None" when empty, by replacing that one branch in place.
DO $gd$
DECLARE
  v_def text;
  v_old text := $q$        WHEN 'MARKINGS'            THEN v_horse.markings$q$;
  v_new text := $q$        WHEN 'MARKINGS'            THEN coalesce(nullif(btrim(v_horse.markings), ''), 'None')$q$;
BEGIN
  SELECT pg_get_functiondef('public.generate_document(uuid,text,uuid,uuid,jsonb,text,uuid[])'::regprocedure) INTO v_def;
  IF position(v_old IN v_def) = 0 THEN
    RAISE EXCEPTION 'generate_document MARKINGS branch anchor not found';
  END IF;
  EXECUTE replace(v_def, v_old, v_new);
END $gd$;

-- 4. Refresh HORSE.MARKINGS on documents that are still editable (executed /
--    locked documents are frozen against their signed version and untouched).
UPDATE contract_fields cf
   SET value = CASE WHEN h.markings IS NULL OR btrim(h.markings) = '' THEN 'None' ELSE h.markings END,
       updated_at = now()
  FROM documents d
  JOIN horses h ON h.id = d.horse_id
 WHERE cf.document_id = d.id
   AND cf.field_key = 'HORSE.MARKINGS'
   AND d.deleted_at IS NULL
   AND d.workflow_state IN ('editable','editing','in_review');

-- 5. Remove the markings vocabulary. Markings is not a standardized, searchable
--    term (unlike colour or breed), so it carries no vocabulary.
DELETE FROM lookup_options WHERE lookup_key = 'horse_markings';

-- 6. my_stable_add_horse was reachable only from a dead modal. Remove it.
DROP FUNCTION IF EXISTS public.my_stable_add_horse(text, text, text, text, text, date, text, text, text, text, boolean);
