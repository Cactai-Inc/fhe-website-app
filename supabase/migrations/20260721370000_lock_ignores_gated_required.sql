-- Lock-for-signing was blocked by required fields that are currently GATED OFF
-- (e.g. TXN.LESSONS_REQUIRED when Lessons isn't a permitted activity, TXN.SCHEDULE_TYPE
-- on a full lease, TXN.TRAINING_TYPE when Training isn't selected). A required field
-- should only block the lock when its clause is actually visible. Also skip fields
-- the author marked N/A or de-included.
--
-- Rewrite the required-empty count in advance_document_workflow to evaluate each
-- required-empty field's clause condition against the current field values.

-- (a) first, clean up over-eager `required` flags: gates and optional details
-- shouldn't be hard-required.
UPDATE contract_field_defs SET required = false
 WHERE template_key='HORSE_LEASE_V2'
   AND field_key IN ('TXN.MORTALITY_INSURANCE_REQ','TXN.MAJOR_MEDICAL_INSURANCE_REQ',
                     'TXN.LOSS_OF_USE_INSURANCE_REQ','TXN.LESSONS_REQUIRED','TXN.TRAINING_TYPE',
                     'TXN.SCHEDULE_TYPE','TXN.EVALUATION_ENABLED','TXN.PROTECTIVE_REQUIRED');
-- mirror onto any existing document field rows
UPDATE contract_fields SET required = false
 WHERE field_key IN ('TXN.MORTALITY_INSURANCE_REQ','TXN.MAJOR_MEDICAL_INSURANCE_REQ',
                     'TXN.LOSS_OF_USE_INSURANCE_REQ','TXN.LESSONS_REQUIRED','TXN.TRAINING_TYPE',
                     'TXN.SCHEDULE_TYPE','TXN.EVALUATION_ENABLED','TXN.PROTECTIVE_REQUIRED')
   AND document_id IN (SELECT d.id FROM documents d JOIN contract_templates t ON t.id=d.template_id
                        WHERE t.template_key='HORSE_LEASE_V2');

-- (b) make the lock's required-field check gate-aware.
DO $do$
DECLARE v_def text;
BEGIN
  v_def := pg_get_functiondef('advance_document_workflow'::regproc);
  v_def := replace(v_def,
$old$    SELECT count(*) INTO v_missing FROM contract_fields
      WHERE document_id = p_document_id AND required
        AND nullif(trim(coalesce(value, '')), '') IS NULL;$old$,
$new$    -- only required fields that are currently VISIBLE (clause condition met,
    -- included, not N/A) block the lock. Build the field-value map first.
    DECLARE v_vals jsonb := '{}'::jsonb; r2 record;
    BEGIN
      FOR r2 IN SELECT field_key, coalesce(trim(value),'') AS val
                  FROM contract_fields WHERE document_id = p_document_id LOOP
        v_vals := v_vals || jsonb_build_object(r2.field_key, r2.val);
      END LOOP;
      SELECT count(*) INTO v_missing
        FROM contract_fields cf
        LEFT JOIN contract_clause_defs cd
          ON cd.template_key = (SELECT ct.template_key FROM documents d JOIN contract_templates ct ON ct.id=d.template_id WHERE d.id=p_document_id)
         AND cd.clause_key = cf.clause_key
       WHERE cf.document_id = p_document_id AND cf.required
         AND coalesce(cf.included, true) AND NOT coalesce(cf.is_na, false)
         AND nullif(trim(coalesce(cf.value, '')), '') IS NULL
         AND clause_condition_met(cd.conditional_on, v_vals);
    END;$new$);
  EXECUTE v_def;
END $do$;

-- (c) at lock, a clause-model document (one with clause defs) must be re-composed
-- with the CLAUSE merger, not the flat remerge_contract_from_fields (which would
-- ignore the clause structure). Route to the right merger.
DO $do$
DECLARE v_def text;
BEGIN
  v_def := pg_get_functiondef('advance_document_workflow'::regproc);
  v_def := replace(v_def,
    'PERFORM remerge_contract_from_fields(p_document_id);',
    'IF EXISTS (SELECT 1 FROM contract_clause_defs cdf JOIN documents d2 ON true JOIN contract_templates ct2 ON ct2.id=d2.template_id AND ct2.template_key=cdf.template_key WHERE d2.id=p_document_id) THEN
       PERFORM remerge_contract_from_clauses(p_document_id);
     ELSE
       PERFORM remerge_contract_from_fields(p_document_id);
     END IF;');
  EXECUTE v_def;
END $do$;
