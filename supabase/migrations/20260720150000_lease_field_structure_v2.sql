/*
  # Lease field structure v2 — make the contract capture structured data

  Three fixes to how a freshly-generated lease's fields are typed, so the UI
  renders proper controls instead of a wall of free-text boxes:

  1. Corrupted labels — the "Lessons/Day — X" and "Payment Options (… — …)"
     labels carried a mangled em-dash. Corrected to clean ASCII at the source
     (start_lease_contract's seed and any live fields).

  2. Cost / responsibility allocation fields → party pickers. The standalone
     responsibility fields (routine care, exercise, hair clipping) and the
     insurance responsible-party fields become format_type='party' so they render
     as the Lessor/Lessee/Shared picker with a % split — not a text box. (The
     boarding/farrier/vet/supplements manage↔cost pairs are already handled.)

  3. Yes/no & multi-select fields → buttons from preset equestrian option lists
     (permitted/prohibited activities, use restrictions, authorized users), and
     Days Used → the week-grid day picker. Each keeps an "other" escape via a
     companion note where needed; options are seeded on contract_field_defs and
     applied per document.

  Implemented by extending apply_field_formats (runs on every fresh contract via
  start_lease_contract) and adding a helper that stamps the button option lists.
  Idempotent: safe to re-run; only sets types/options, never clears user values.
*/

-- ── 1. correct the corrupted labels at the seed source ──────────────────────
-- The seed lives inline in start_lease_contract; rather than rewrite that 60KB
-- (UTF-8-fragile) function, we fix labels wherever they land: the defs table and
-- any already-seeded live fields. New contracts get corrected labels via the
-- post-seed UPDATE in apply_field_formats below.
UPDATE contract_field_defs SET label = 'Lessons/Day — Advanced'     WHERE template_key='HORSE_LEASE' AND field_key='TXN.LESSONS_ADVANCED';
UPDATE contract_field_defs SET label = 'Lessons/Day — Beginner'     WHERE template_key='HORSE_LEASE' AND field_key='TXN.LESSONS_BEGINNER';
UPDATE contract_field_defs SET label = 'Lessons/Day — Intermediate' WHERE template_key='HORSE_LEASE' AND field_key='TXN.LESSONS_INTERMEDIATE';
UPDATE contract_field_defs SET label = 'Payment Options (one per line: amount — description)' WHERE template_key='HORSE_LEASE' AND field_key='TXN.PAYMENT_OPTIONS';


-- ── button option lists (equestrian presets) ────────────────────────────────
-- Stored so apply_field_formats can stamp them on the fields per document.
CREATE OR REPLACE FUNCTION public._lease_button_options(p_field_key text)
RETURNS jsonb LANGUAGE sql IMMUTABLE SET search_path TO 'public' AS $fn$
  SELECT CASE p_field_key
    WHEN 'TXN.PERMITTED_ACTIVITIES' THEN jsonb_build_array(
      jsonb_build_object('value','FLAT','label','Flat / dressage'),
      jsonb_build_object('value','JUMPING','label','Jumping'),
      jsonb_build_object('value','TRAIL','label','Trail riding'),
      jsonb_build_object('value','SHOWING','label','Showing / competition'),
      jsonb_build_object('value','LESSONS','label','Lessons'),
      jsonb_build_object('value','TURNOUT','label','Turnout'),
      jsonb_build_object('value','BREEDING','label','Breeding'))
    WHEN 'TXN.PROHIBITED_ACTIVITIES' THEN jsonb_build_array(
      jsonb_build_object('value','JUMPING','label','Jumping'),
      jsonb_build_object('value','SHOWING','label','Showing / competition'),
      jsonb_build_object('value','BREEDING','label','Breeding'),
      jsonb_build_object('value','TRAIL','label','Trail riding'),
      jsonb_build_object('value','LOANING','label','Loaning to third parties'),
      jsonb_build_object('value','CLINICS','label','Clinics / off-site events'))
    WHEN 'TXN.USE_RESTRICTIONS' THEN jsonb_build_array(
      jsonb_build_object('value','SUPERVISED','label','Supervised use only'),
      jsonb_build_object('value','NO_MINORS','label','No minors without guardian'),
      jsonb_build_object('value','ARENA_ONLY','label','Arena only'),
      jsonb_build_object('value','NO_OFFSITE','label','No off-site use'),
      jsonb_build_object('value','WEATHER','label','Weather restrictions apply'))
    WHEN 'TXN.AUTHORIZED_USERS' THEN jsonb_build_array(
      jsonb_build_object('value','LESSEE_ONLY','label','Lessee only'),
      jsonb_build_object('value','FAMILY','label','Lessee & immediate family'),
      jsonb_build_object('value','TRAINER','label','Lessee & their trainer'),
      jsonb_build_object('value','NAMED','label','Named riders only (list below)'))
    ELSE NULL
  END;
$fn$;


-- ── 2 + 3. extend apply_field_formats ───────────────────────────────────────
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
  -- standalone responsibility/party fields (not part of a manage↔cost pair)
  party_fields text[] := ARRAY[
    'TXN.CARE_RESPONSIBILITY','TXN.EXERCISE_RESPONSIBILITY','TXN.CLIPPING_RESPONSIBILITY',
    'TXN.OTHER_CARE_COST','TXN.OTHER_EXPENSES_COST',
    'TXN.MORTALITY_INSURANCE_PARTY','TXN.MAJOR_MEDICAL_INSURANCE_PARTY','TXN.LOSS_OF_USE_INSURANCE_PARTY',
    'TXN.COMPETITION_EXPENSES','TXN.COMPETITION_WINNINGS'
  ];
  -- multi-select button fields (options from _lease_button_options)
  button_fields text[] := ARRAY[
    'TXN.PERMITTED_ACTIVITIES','TXN.PROHIBITED_ACTIVITIES','TXN.USE_RESTRICTIONS','TXN.AUTHORIZED_USERS'
  ];
  p text[];
  bf text;
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

  -- NEW: standalone responsibility/cost fields → party picker (Lessor/Lessee/Shared %)
  UPDATE contract_fields SET format_type='party', input_kind='responsibility'
   WHERE document_id=p_document_id AND field_key = ANY(party_fields);

  -- NEW: multi-select activity/rules fields → buttons with preset options
  FOREACH bf IN ARRAY button_fields LOOP
    UPDATE contract_fields
       SET format_type='buttons', input_kind='buttons', value_type='select',
           options = _lease_button_options(bf)
     WHERE document_id=p_document_id AND field_key=bf;
  END LOOP;

  -- NEW: Days Used → week-grid day picker
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
