-- Regroup scattered subjects (audit finding): responsibility fields lived in
-- 'Vet & Farrier' / 'Boarding & Care' while their costs lived in 'Cost Allocation'.
-- Fold each subject's responsibility + cost (+ provider) into ONE section, and
-- order them so responsibility precedes its cost, matching the Horse Care pattern.
--
-- Implemented as a reusable remap applied both by the seeder (for new leases) and
-- to existing docs. Uses field_key → (section, sort_order) so responsibility and
-- cost for the same subject sit together.

CREATE OR REPLACE FUNCTION public.regroup_contract_subjects(p_document_id uuid)
 RETURNS void
 LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
BEGIN
  -- BOARDING subject
  UPDATE contract_fields SET section='Boarding', sort_order=CASE field_key
      WHEN 'TXN.BOARDING_RESPONSIBILITY' THEN 1000 WHEN 'TXN.BOARD_COST' THEN 1001 ELSE sort_order END
    WHERE document_id=p_document_id AND field_key IN ('TXN.BOARDING_RESPONSIBILITY','TXN.BOARD_COST');

  -- FARRIER subject
  UPDATE contract_fields SET section='Farrier', sort_order=CASE field_key
      WHEN 'TXN.FARRIER_RESPONSIBILITY' THEN 1100 WHEN 'TXN.FARRIER_COST' THEN 1101 ELSE sort_order END
    WHERE document_id=p_document_id AND field_key IN ('TXN.FARRIER_RESPONSIBILITY','TXN.FARRIER_COST');

  -- VETERINARY subject (routine + emergency + non-routine + auth contact)
  UPDATE contract_fields SET section='Veterinary Care', sort_order=CASE field_key
      WHEN 'TXN.ROUTINE_VET_RESPONSIBILITY' THEN 1200 WHEN 'TXN.ROUTINE_VET_COST' THEN 1201
      WHEN 'TXN.EMERGENCY_VET_RESPONSIBILITY' THEN 1202 WHEN 'TXN.NON_ROUTINE_VET_COST' THEN 1203
      WHEN 'TXN.VET_AUTH_CONTACT' THEN 1204 ELSE sort_order END
    WHERE document_id=p_document_id AND field_key IN
      ('TXN.ROUTINE_VET_RESPONSIBILITY','TXN.ROUTINE_VET_COST','TXN.EMERGENCY_VET_RESPONSIBILITY',
       'TXN.NON_ROUTINE_VET_COST','TXN.VET_AUTH_CONTACT');

  -- SUPPLEMENTS subject
  UPDATE contract_fields SET section='Supplements & Medications', sort_order=CASE field_key
      WHEN 'TXN.SUPPLEMENTS' THEN 1300 WHEN 'TXN.SUPPLEMENTS_RESPONSIBILITY' THEN 1301
      WHEN 'TXN.SUPPLEMENTS_COST' THEN 1302 ELSE sort_order END
    WHERE document_id=p_document_id AND field_key IN
      ('TXN.SUPPLEMENTS','TXN.SUPPLEMENTS_RESPONSIBILITY','TXN.SUPPLEMENTS_COST');

  -- EXERCISE & HANDLING subject
  UPDATE contract_fields SET section='Exercise & Handling', sort_order=CASE field_key
      WHEN 'TXN.CARE_RESPONSIBILITY' THEN 1400 WHEN 'TXN.EXERCISE_RESPONSIBILITY' THEN 1401
      WHEN 'TXN.CLIPPING_RESPONSIBILITY' THEN 1402 ELSE sort_order END
    WHERE document_id=p_document_id AND field_key IN
      ('TXN.CARE_RESPONSIBILITY','TXN.EXERCISE_RESPONSIBILITY','TXN.CLIPPING_RESPONSIBILITY');

  -- TRAINING & LESSONS: fold their costs into the existing Training & Lessons section
  UPDATE contract_fields SET section='Training & Lessons'
    WHERE document_id=p_document_id AND field_key IN ('TXN.TRAINING_COST','TXN.LESSONS_COST');

  -- OTHER care/expenses → their own subject
  UPDATE contract_fields SET section='Other Care & Expenses'
    WHERE document_id=p_document_id AND field_key IN ('TXN.OTHER_CARE_COST','TXN.OTHER_EXPENSES_COST');
END;
$function$;
GRANT EXECUTE ON FUNCTION public.regroup_contract_subjects(uuid) TO authenticated;
