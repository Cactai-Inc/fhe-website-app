-- Two render defects found while QA-reviewing the full sample lease:
--
-- 1. {{TXN.TRAINER_EVAL_CHOICE}} sat as a bare unlabeled token at the end of
--    HORSE.WARRANTY (Disclaimer of Warranties), rendering an orphan line like
--    "Lessor provided at no cost" inside the disclaimer. It gets its own clause
--    mirroring HORSE.VET_CHECK ("Pre-Lease Veterinary Examination" @50), placed
--    between it and the disclaimer (@60).
--
-- 2. percent fields rendered raw ("Lessee's share of the cost: 50") — remerge
--    now appends % to bare numeric values of fields whose def format_type is
--    'percent' (same def-lookup mechanism the certify branch already uses).

BEGIN;

UPDATE contract_clause_defs SET body =
'Except for the representations expressly stated in this Agreement, LESSOR MAKES NO WARRANTIES, EXPRESS OR IMPLIED, REGARDING THE HORSE, INCLUDING THE WARRANTY OF FITNESS FOR A PARTICULAR PURPOSE.'
WHERE template_key='HORSE_LEASE_V2' AND clause_key='HORSE.WARRANTY';

INSERT INTO contract_clause_defs
  (template_key, section_key, clause_key, heading, body, clause_type, sort_order, is_optional, conditional_on)
VALUES
  ('HORSE_LEASE_V2','HORSE','HORSE.TRAINER_EVAL','Pre-Lease Trainer Evaluation',
   'Pre-lease trainer evaluation of the Horse: {{TXN.TRAINER_EVAL_CHOICE}}',
   'input',55,false,NULL)
ON CONFLICT (template_key, clause_key) DO UPDATE
  SET heading = EXCLUDED.heading, body = EXCLUDED.body, clause_type = EXCLUDED.clause_type,
      sort_order = EXCLUDED.sort_order, is_optional = EXCLUDED.is_optional,
      conditional_on = EXCLUDED.conditional_on;

-- percent formatting in remerge: replace the token-substitution CASE chain's
-- final ELSE with a percent-aware branch (full-body re-create, repo convention)
DO $$
DECLARE
  v_src text;
BEGIN
  SELECT pg_get_functiondef(oid) INTO v_src
    FROM pg_proc WHERE proname = 'remerge_contract_from_clauses';

  IF v_src NOT LIKE '%certify_statement%' THEN
    RAISE EXCEPTION 'remerge_contract_from_clauses shape changed; aborting';
  END IF;
  IF v_src LIKE '%percent%' THEN
    RETURN; -- already patched
  END IF;

  v_src := replace(v_src,
$OLD$certify_statement(v_tok, v_fields ->> v_tok, v_tkey));$OLD$,
$NEW$certify_statement(v_tok, v_fields ->> v_tok, v_tkey));
            ELSIF (v_fields ->> v_tok) ~ '^\d+(\.\d+)?$'
              AND EXISTS (SELECT 1 FROM contract_field_defs fdpct
                          WHERE fdpct.template_key = v_tkey AND fdpct.field_key = v_tok
                            AND fdpct.format_type = 'percent') THEN
              v_line := replace(v_line, '{{'||v_tok||'}}', (v_fields ->> v_tok) || '%');$NEW$);

  IF v_src NOT LIKE '%percent%' THEN
    RAISE EXCEPTION 'percent patch did not take (anchor not found)';
  END IF;

  EXECUTE v_src;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM contract_clause_defs
              WHERE template_key='HORSE_LEASE_V2' AND clause_key='HORSE.WARRANTY'
                AND body LIKE '%TRAINER_EVAL%') THEN
    RAISE EXCEPTION 'stray trainer-eval token survives in HORSE.WARRANTY';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM contract_clause_defs
                  WHERE template_key='HORSE_LEASE_V2' AND clause_key='HORSE.TRAINER_EVAL') THEN
    RAISE EXCEPTION 'HORSE.TRAINER_EVAL clause missing';
  END IF;
  IF (SELECT pg_get_functiondef(oid) FROM pg_proc WHERE proname='remerge_contract_from_clauses')
     NOT LIKE '%percent%' THEN
    RAISE EXCEPTION 'percent branch not present in remerge';
  END IF;
END $$;

COMMIT;
