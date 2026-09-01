/*
  # Lease dropdowns — options-first for fields with natural choice sets

  Extends the structured-capture pass so fields that have obvious options render
  as a dropdown (with an "Other (specify)…" escape provided by the frontend
  SelectWithOther control) instead of a bare text box:

    HORSE.SEX            → Mare/Gelding/Stallion/Colt/Filly
    HORSE.COLOR          → common coat colors
    HORSE.BREED          → common breeds
    TXN.LEASE_TERM       → 3/6/12 months, month-to-month
    TXN.PAYMENT_SCHEDULE → Monthly/Quarterly/Semi-annually/Annually/One-time

  Open text remains available on every one of these via the "Other" option, per
  the principle: offer options first, keep free-text as an escape — never as the
  primary input. Implemented by adding these to _lease_button_options' sibling
  (_lease_select_options) and stamping them in apply_field_formats.
*/

CREATE OR REPLACE FUNCTION public._lease_select_options(p_field_key text)
RETURNS jsonb LANGUAGE sql IMMUTABLE SET search_path TO 'public' AS $fn$
  SELECT CASE p_field_key
    WHEN 'HORSE.SEX' THEN jsonb_build_array(
      jsonb_build_object('value','MARE','label','Mare'),
      jsonb_build_object('value','GELDING','label','Gelding'),
      jsonb_build_object('value','STALLION','label','Stallion'),
      jsonb_build_object('value','COLT','label','Colt'),
      jsonb_build_object('value','FILLY','label','Filly'))
    WHEN 'HORSE.COLOR' THEN jsonb_build_array(
      jsonb_build_object('value','BAY','label','Bay'),
      jsonb_build_object('value','CHESTNUT','label','Chestnut'),
      jsonb_build_object('value','GRAY','label','Gray'),
      jsonb_build_object('value','BLACK','label','Black'),
      jsonb_build_object('value','BROWN','label','Brown'),
      jsonb_build_object('value','ROAN','label','Roan'),
      jsonb_build_object('value','PALOMINO','label','Palomino'),
      jsonb_build_object('value','PINTO','label','Pinto / Paint'),
      jsonb_build_object('value','BUCKSKIN','label','Buckskin'),
      jsonb_build_object('value','DUN','label','Dun'),
      jsonb_build_object('value','WHITE','label','White / Cremello'))
    WHEN 'HORSE.BREED' THEN jsonb_build_array(
      jsonb_build_object('value','WARMBLOOD','label','Warmblood'),
      jsonb_build_object('value','THOROUGHBRED','label','Thoroughbred'),
      jsonb_build_object('value','QUARTER_HORSE','label','Quarter Horse'),
      jsonb_build_object('value','ARABIAN','label','Arabian'),
      jsonb_build_object('value','PONY','label','Pony'),
      jsonb_build_object('value','DRAFT','label','Draft'),
      jsonb_build_object('value','APPALOOSA','label','Appaloosa'),
      jsonb_build_object('value','MORGAN','label','Morgan'),
      jsonb_build_object('value','FRIESIAN','label','Friesian'),
      jsonb_build_object('value','ANDALUSIAN','label','Andalusian'),
      jsonb_build_object('value','MUSTANG','label','Mustang'),
      jsonb_build_object('value','CROSSBRED','label','Crossbred / Grade'))
    WHEN 'TXN.LEASE_TERM' THEN jsonb_build_array(
      jsonb_build_object('value','3_MONTHS','label','3 months'),
      jsonb_build_object('value','6_MONTHS','label','6 months'),
      jsonb_build_object('value','12_MONTHS','label','12 months'),
      jsonb_build_object('value','MONTH_TO_MONTH','label','Month-to-month'))
    WHEN 'TXN.PAYMENT_SCHEDULE' THEN jsonb_build_array(
      jsonb_build_object('value','MONTHLY','label','Monthly'),
      jsonb_build_object('value','QUARTERLY','label','Quarterly'),
      jsonb_build_object('value','SEMIANNUAL','label','Semi-annually'),
      jsonb_build_object('value','ANNUAL','label','Annually'),
      jsonb_build_object('value','ONE_TIME','label','One-time'))
    ELSE NULL
  END;
$fn$;


CREATE OR REPLACE FUNCTION public.apply_field_formats(p_document_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  pairs text[][] := ARRAY[
    ARRAY['TXN.BOARDING_RESPONSIBILITY','TXN.BOARD_COST'],
    ARRAY['TXN.FARRIER_RESPONSIBILITY','TXN.FARRIER_COST'],
    ARRAY['TXN.ROUTINE_VET_RESPONSIBILITY','TXN.ROUTINE_VET_COST'],
    ARRAY['TXN.EMERGENCY_VET_RESPONSIBILITY','TXN.NON_ROUTINE_VET_COST'],
    ARRAY['TXN.SUPPLEMENTS_RESPONSIBILITY','TXN.SUPPLEMENTS_COST']
  ];
  party_fields text[] := ARRAY[
    'TXN.CARE_RESPONSIBILITY','TXN.EXERCISE_RESPONSIBILITY','TXN.CLIPPING_RESPONSIBILITY',
    'TXN.OTHER_CARE_COST','TXN.OTHER_EXPENSES_COST',
    'TXN.MORTALITY_INSURANCE_PARTY','TXN.MAJOR_MEDICAL_INSURANCE_PARTY','TXN.LOSS_OF_USE_INSURANCE_PARTY',
    'TXN.COMPETITION_EXPENSES','TXN.COMPETITION_WINNINGS'
  ];
  button_fields text[] := ARRAY[
    'TXN.PERMITTED_ACTIVITIES','TXN.PROHIBITED_ACTIVITIES','TXN.USE_RESTRICTIONS','TXN.AUTHORIZED_USERS'
  ];
  select_fields text[] := ARRAY[
    'HORSE.SEX','HORSE.COLOR','HORSE.BREED','TXN.LEASE_TERM','TXN.PAYMENT_SCHEDULE'
  ];
  p text[];
  bf text;
  sf text;
BEGIN
  -- correct the mangled labels on this document's fields (idempotent)
  UPDATE contract_fields SET label='Lessons/Day — Advanced'     WHERE document_id=p_document_id AND field_key='TXN.LESSONS_ADVANCED';
  UPDATE contract_fields SET label='Lessons/Day — Beginner'     WHERE document_id=p_document_id AND field_key='TXN.LESSONS_BEGINNER';
  UPDATE contract_fields SET label='Lessons/Day — Intermediate' WHERE document_id=p_document_id AND field_key='TXN.LESSONS_INTERMEDIATE';
  UPDATE contract_fields SET label='Payment Options (one per line: amount — description)' WHERE document_id=p_document_id AND field_key='TXN.PAYMENT_OPTIONS';

  -- base format_type from input_kind/value_type
  UPDATE contract_fields SET format_type = CASE
      WHEN input_kind = 'responsibility' THEN 'party'
      WHEN input_kind = 'contact'        THEN 'person'
      WHEN input_kind IN ('week_grid','select','buttons','currency','date','percent','longtext') THEN input_kind
      ELSE 'text' END
    WHERE document_id = p_document_id AND coalesce(format_type,'') = '';

  -- semantic upgrades so the data is reusable
  UPDATE contract_fields SET format_type='email'       WHERE document_id=p_document_id AND field_key LIKE '%.EMAIL';
  UPDATE contract_fields SET format_type='phone'       WHERE document_id=p_document_id AND (field_key LIKE '%.PHONE' OR field_key LIKE '%\_PHONE');
  UPDATE contract_fields SET format_type='person_name' WHERE document_id=p_document_id AND (field_key LIKE '%.FULL_NAME' OR field_key LIKE '%.PRINTED_NAME' OR field_key LIKE '%.VET_NAME' OR field_key LIKE '%.FARRIER_NAME');
  UPDATE contract_fields SET format_type='address'     WHERE document_id=p_document_id AND (field_key LIKE '%.ADDRESS' OR field_key='HORSE.VET_ADDRESS');
  UPDATE contract_fields SET format_type='currency'    WHERE document_id=p_document_id AND field_key LIKE '%FAIR_MARKET_VALUE';
  UPDATE contract_fields SET format_type='location'    WHERE document_id=p_document_id AND field_key IN ('HORSE.CURRENT_LOCATION','HORSE.HOME_LOCATION');
  UPDATE contract_fields SET format_type='number'      WHERE document_id=p_document_id AND field_key LIKE 'TXN.LESSONS_%' AND field_key <> 'TXN.LESSONS_COST';

  -- standalone responsibility/cost fields → party picker (Lessor/Lessee/Shared %)
  UPDATE contract_fields SET format_type='party', input_kind='responsibility'
   WHERE document_id=p_document_id AND field_key = ANY(party_fields);

  -- multi-select activity/rules fields → buttons with preset options
  FOREACH bf IN ARRAY button_fields LOOP
    UPDATE contract_fields
       SET format_type='buttons', input_kind='buttons', value_type='select',
           options = _lease_button_options(bf)
     WHERE document_id=p_document_id AND field_key=bf;
  END LOOP;

  -- single-choice fields with natural option sets → dropdown (SelectWithOther
  -- gives a free-text escape). Options-first, open text still available.
  FOREACH sf IN ARRAY select_fields LOOP
    UPDATE contract_fields
       SET format_type='select', input_kind='select', value_type='select',
           options = _lease_select_options(sf)
     WHERE document_id=p_document_id AND field_key=sf;
  END LOOP;

  -- Days Used → week-grid day picker
  UPDATE contract_fields SET format_type='week_grid', input_kind='week_grid'
   WHERE document_id=p_document_id AND field_key='TXN.DAYS_USED';

  -- link the manage↔cost pairs
  FOREACH p SLICE 1 IN ARRAY pairs LOOP
    UPDATE contract_fields SET format_type='pair', input_kind='pair', pair_cost_key=p[2]
      WHERE document_id=p_document_id AND field_key=p[1];
    UPDATE contract_fields SET pair_manage_key=p[1]
      WHERE document_id=p_document_id AND field_key=p[2];
  END LOOP;

  -- guidance from the registry where missing
  UPDATE contract_fields cf SET guidance = f.guidance
    FROM contract_formats f
   WHERE cf.document_id=p_document_id AND cf.format_type=f.format_type
     AND coalesce(cf.guidance,'')='' AND coalesce(f.guidance,'')<>'';
END;
$function$;
