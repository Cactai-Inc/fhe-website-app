-- Sub-item rendering (owner, 2026-07-27): the deductible-responsibility line
-- renders as a lettered sub-item under its policy clause —
--   13.4 Lessor carries general liability insurance …
--   (a) Both parties shall split the cost … 50% paid by Lessor and 50% paid by Lessee.
-- instead of consuming a full clause number (13.5).
--
-- Mechanism: new contract_clause_defs.render_as_subitem flag. In
-- remerge_contract_from_clauses, a headingless clause with the flag set is
-- prefixed "(a)", "(b)", … (letter counter resets at each numbered clause)
-- and does not increment the clause number. Patched in place per repo
-- convention, with strict anchors and a patched-guard.

BEGIN;

ALTER TABLE contract_clause_defs
  ADD COLUMN IF NOT EXISTS render_as_subitem boolean NOT NULL DEFAULT false;

DO $MIG$
DECLARE
  v_src text;
  v_new text;
BEGIN
  SELECT pg_get_functiondef(oid) INTO v_src
    FROM pg_proc WHERE proname = 'remerge_contract_from_clauses';

  IF v_src LIKE '%render_as_subitem%' THEN
    RETURN; -- already patched
  END IF;

  -- declaration + per-section init
  v_new := replace(v_src, 'v_cl_no int;', 'v_cl_no int; v_sub_no int := 0;');
  IF v_new = v_src THEN RAISE EXCEPTION 'declare anchor not found'; END IF;
  v_src := v_new;

  v_new := replace(v_src, $A$v_sec_buf := '{}'; v_cl_no := 0;$A$,
                          $A$v_sec_buf := '{}'; v_cl_no := 0; v_sub_no := 0;$A$);
  IF v_new = v_src THEN RAISE EXCEPTION 'init anchor not found'; END IF;
  v_src := v_new;

  -- numbering: wrap the existing numbered branch in ELSE of the sub-item branch
  v_new := regexp_replace(v_src,
    $P$v_cl_no := v_cl_no \+ 1;(\s+)IF v_cl\.heading$P$,
    $R$IF coalesce(v_cl.render_as_subitem,false) AND (v_cl.heading IS NULL OR v_cl.heading = '') AND coalesce(array_length(v_cl_buf,1),0) > 0 THEN\1  v_sub_no := v_sub_no + 1;\1  v_cl_buf[1] := '(' || chr(96 + v_sub_no) || ') ' || v_cl_buf[1];\1  v_sec_buf := v_sec_buf || v_cl_buf;\1ELSE\1v_sub_no := 0;\1v_cl_no := v_cl_no + 1;\1IF v_cl.heading$R$);
  IF v_new = v_src THEN RAISE EXCEPTION 'numbering anchor not found'; END IF;
  v_src := v_new;

  -- close the wrapper before the blank-line append (first match = clause loop)
  v_new := regexp_replace(v_src,
    $P$END IF;(\s+)v_sec_buf := array_append\(v_sec_buf, ''::text\);(\s+)END LOOP;$P$,
    $R$END IF;\1END IF;\1v_sec_buf := array_append(v_sec_buf, ''::text);\2END LOOP;$R$);
  IF v_new = v_src THEN RAISE EXCEPTION 'close anchor not found'; END IF;
  v_src := v_new;

  EXECUTE v_src;
END $MIG$;

UPDATE contract_clause_defs SET render_as_subitem = true
 WHERE template_key='HORSE_LEASE_V2' AND clause_key LIKE 'INSURANCE_RISK.%\_DED\_%';

DO $CHK$
DECLARE v_n int; v_src text;
BEGIN
  SELECT pg_get_functiondef(oid) INTO v_src
    FROM pg_proc WHERE proname='remerge_contract_from_clauses';
  IF v_src NOT LIKE '%render_as_subitem%' OR v_src NOT LIKE '%chr(96 + v_sub_no)%' THEN
    RAISE EXCEPTION 'sub-item branch missing from remerge';
  END IF;

  SELECT count(*) INTO v_n FROM contract_clause_defs
   WHERE template_key='HORSE_LEASE_V2' AND render_as_subitem;
  IF v_n <> 9 THEN RAISE EXCEPTION 'expected 9 sub-item clauses, found %', v_n; END IF;
END $CHK$;

COMMIT;
