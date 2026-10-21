-- Disclosure reciprocity, phase 17: clause refinements from owner review.
--
-- 1. Known-conditions NONE clause must enumerate the same set as the DISCLOSED
--    clause. Surgeries, medications, and behavioral issues have their own sections,
--    so they are struck from the NONE enumeration on all three documents. Vices stay.
-- 2. The human-injury DISCLOSED clause carries the acknowledgment sentence on all
--    three documents (the sale was missing it; align up to lease + BOS).
-- 3. The imported DISCLOSED content clause is suppressed when the record section is
--    empty, so no disclosure line prints with an empty value. Marking each DISCLOSED
--    clause optional-input lets the composer's empty-token rule drop it when its only
--    record token is blank (an empty record with an author-answered YES gate): the
--    author's new content shows in the ADD clause instead. A populated record leaves
--    the token non-empty, so the clause still shows.

-- 1. NONE enumeration alignment (lease / sale / BOS).
UPDATE contract_clause_defs
   SET body = replace(body,
     'medical conditions, lameness history, surgeries, allergies, medications, behavioral issues, vices, or prior veterinary concerns',
     'medical conditions, lameness history, allergies, vices, or prior veterinary concerns')
 WHERE template_key IN ('HORSE_LEASE_V3','HORSE_SALE_V3','HORSE_BILL_OF_SALE')
   AND clause_key IN ('HORSE.KNOWN_CONDITIONS_NONE','BOS_KNOWN_CONDITIONS_NONE')
   AND body LIKE '%surgeries, allergies, medications, behavioral issues, vices%';

-- 2. Sale human-injury DISCLOSED gains the acknowledgment sentence (lease + BOS have it).
UPDATE contract_clause_defs
   SET body = body || ' Buyer acknowledges this disclosure and proceeds with knowledge of it.'
 WHERE template_key = 'HORSE_SALE_V3'
   AND clause_key = 'HORSE.INJURIES_TO_HUMANS_DISCLOSED'
   AND body NOT LIKE '%acknowledges this disclosure%';

-- 3. Suppress the imported DISCLOSED clause when its record token is empty.
UPDATE contract_clause_defs
   SET is_optional = true
 WHERE template_key IN ('HORSE_LEASE_V3','HORSE_SALE_V3','HORSE_BILL_OF_SALE')
   AND clause_key LIKE '%_DISCLOSED'
   AND clause_key NOT LIKE '%_DISCLOSED_ADD'
   AND clause_type = 'input';

-- 4. Remove the call to the nonexistent contract_horse_field_writeback in
--    set_field_structured (it would throw if any HORSE.* field were ever structured).
DO $scf$
DECLARE
  v_def text;
  v_old text := $q$  IF p_field_key LIKE 'HORSE.%' THEN
    PERFORM contract_horse_field_writeback(p_document_id, p_field_key, v_new_prose);
  END IF;
$q$;
BEGIN
  SELECT pg_get_functiondef('public.set_field_structured(uuid,text,jsonb)'::regprocedure) INTO v_def;
  IF position('contract_horse_field_writeback' IN v_def) = 0 THEN RETURN; END IF;
  IF position(v_old IN v_def) = 0 THEN
    RAISE EXCEPTION 'set_field_structured writeback-call block not found';
  END IF;
  EXECUTE replace(v_def, v_old, '');
END $scf$;
