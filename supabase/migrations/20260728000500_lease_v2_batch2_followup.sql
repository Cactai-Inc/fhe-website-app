-- Batch 2 follow-up (authoring-thread review, 2026-07-27): three items before push
--
-- 1. Part 11b (missed in the main pass): the 3.1 schedule sentence — the label
--    text lives in the CLAUSE BODY, not the field label. "Days of the week
--    reserved for Lessee's use" (which mis-describes a both-parties listing)
--    becomes "Reserved days of use".
-- 2. GL-unset render: the "General Liability Insurance" heading rendered as an
--    orphan when the posture was unset (draft state). Parallel absence line
--    added, matching mortality's: "No general liability insurance is required
--    under this Agreement."
-- 3. Lock-time party-type consistency: locking (and the direct sign-from-
--    editable path) now also refuses a PARTY_TYPE that contradicts the Lessee
--    party record's person/company kind — in both directions. Draft override
--    remains possible; a contradictory document can never lock or execute.

BEGIN;

-- 1. Part 11b — schedule sentence
UPDATE contract_clause_defs
   SET body = replace(body, 'Days of the week reserved for Lessee''s use:', 'Reserved days of use:')
 WHERE template_key='HORSE_LEASE_V2' AND clause_key='SCHEDULE.MAIN';

-- 2. GL absence line (renders only while the posture election is unset)
INSERT INTO contract_clause_defs
  (template_key, section_key, clause_key, heading, body, clause_type, sort_order, is_optional, conditional_on)
VALUES
  ('HORSE_LEASE_V2','INSURANCE_RISK','INSURANCE_RISK.GL_NONE',NULL,
   'No general liability insurance is required under this Agreement.',
   'input',168,false,'{"equals":[""],"field_key":"TXN.GL_POSTURE"}'::jsonb)
ON CONFLICT (template_key, clause_key) DO UPDATE
  SET body=EXCLUDED.body, sort_order=EXCLUDED.sort_order, conditional_on=EXCLUDED.conditional_on;

-- 3. lock-time party-type consistency (both gate functions, in-place patch)
DO $MIG$
DECLARE v_src text; v_new text;
BEGIN
  -- advance_document_workflow: after its required-fields refusal
  SELECT pg_get_functiondef(oid) INTO v_src FROM pg_proc WHERE proname='advance_document_workflow';
  IF v_src NOT LIKE '%PARTY_TYPE contradicts%' THEN
    v_new := regexp_replace(v_src,
      $P$RAISE EXCEPTION 'cannot lock: % required field\(s\) still empty', v_missing;(\s+)END IF;$P$,
      $R$RAISE EXCEPTION 'cannot lock: % required field(s) still empty', v_missing;\1END IF;\1IF EXISTS (
      SELECT 1 FROM contract_fields cf
        JOIN documents d2 ON d2.id = cf.document_id
        JOIN contract_parties cp2 ON cp2.contract_id = d2.contract_id AND cp2.party_role = 'LESSEE'
        JOIN contacts c2 ON c2.id = cp2.contact_id
       WHERE cf.document_id = p_document_id AND cf.field_key = 'LESSEE.PARTY_TYPE'
         AND ((cf.value = 'INDIVIDUAL' AND coalesce(c2.is_company,false))
           OR (cf.value = 'ENTITY' AND NOT coalesce(c2.is_company,false)))
    ) THEN
      RAISE EXCEPTION 'cannot lock: LESSEE.PARTY_TYPE contradicts the Lessee party record (person vs company) — correct the field or the contact record';
    END IF;$R$);
    IF v_new = v_src THEN RAISE EXCEPTION 'advance_document_workflow anchor not found'; END IF;
    EXECUTE v_new;
  END IF;

  -- lock_and_sign_contract: after its required-fields refusal (editable path)
  SELECT pg_get_functiondef(oid) INTO v_src FROM pg_proc WHERE proname='lock_and_sign_contract';
  IF v_src NOT LIKE '%PARTY_TYPE contradicts%' THEN
    v_new := regexp_replace(v_src,
      $P$RAISE EXCEPTION 'cannot sign: % required field\(s\) still empty', v_missing;(\s+)END IF;$P$,
      $R$RAISE EXCEPTION 'cannot sign: % required field(s) still empty', v_missing;\1END IF;\1IF EXISTS (
      SELECT 1 FROM contract_fields cf
        JOIN documents d2 ON d2.id = cf.document_id
        JOIN contract_parties cp2 ON cp2.contract_id = d2.contract_id AND cp2.party_role = 'LESSEE'
        JOIN contacts c2 ON c2.id = cp2.contact_id
       WHERE cf.document_id = p_document_id AND cf.field_key = 'LESSEE.PARTY_TYPE'
         AND ((cf.value = 'INDIVIDUAL' AND coalesce(c2.is_company,false))
           OR (cf.value = 'ENTITY' AND NOT coalesce(c2.is_company,false)))
    ) THEN
      RAISE EXCEPTION 'cannot sign: LESSEE.PARTY_TYPE contradicts the Lessee party record (person vs company) — correct the field or the contact record';
    END IF;$R$);
    IF v_new = v_src THEN RAISE EXCEPTION 'lock_and_sign_contract anchor not found'; END IF;
    EXECUTE v_new;
  END IF;
END $MIG$;

-- verify
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM contract_clause_defs
                  WHERE template_key='HORSE_LEASE_V2' AND clause_key='SCHEDULE.MAIN'
                    AND body LIKE 'Reserved days of use:%') THEN
    RAISE EXCEPTION '11b schedule sentence not fixed';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM contract_clause_defs
                  WHERE template_key='HORSE_LEASE_V2' AND clause_key='INSURANCE_RISK.GL_NONE') THEN
    RAISE EXCEPTION 'GL absence clause missing';
  END IF;
  IF (SELECT pg_get_functiondef(oid) FROM pg_proc WHERE proname='advance_document_workflow')
     NOT LIKE '%PARTY_TYPE contradicts%' THEN
    RAISE EXCEPTION 'lock party-type consistency missing (advance)';
  END IF;
  IF (SELECT pg_get_functiondef(oid) FROM pg_proc WHERE proname='lock_and_sign_contract')
     NOT LIKE '%PARTY_TYPE contradicts%' THEN
    RAISE EXCEPTION 'lock party-type consistency missing (sign)';
  END IF;
END $$;

COMMIT;
