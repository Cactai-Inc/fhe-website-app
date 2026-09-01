-- Reevaluated with the owner (2026-07-27): the deductible-responsibility
-- sentence should not be a separate line at all — it flows into the policy
-- paragraph it belongs to:
--   13.4 Lessor carries general liability insurance … effective as of
--   June 1, 2026. Both parties shall split the cost … 50% paid by Lessor and
--   50% paid by Lessee.
-- render_as_subitem semantics change from "(a) lettered line" to "continue
-- the previous clause's paragraph". The conditional shape selection (party /
-- split / other) is unchanged.

BEGIN;

DO $MIG$
DECLARE
  v_src text;
  v_new text;
BEGIN
  SELECT pg_get_functiondef(oid) INTO v_src
    FROM pg_proc WHERE proname = 'remerge_contract_from_clauses';

  IF v_src LIKE '%array_to_string(v_cl_buf%' THEN
    RETURN; -- already patched
  END IF;
  IF v_src NOT LIKE '%render_as_subitem%' THEN
    RAISE EXCEPTION 'expected lettered sub-item branch to patch';
  END IF;

  v_new := regexp_replace(v_src,
    $P$IF coalesce\(v_cl\.render_as_subitem,false\).*?v_sec_buf := v_sec_buf \|\| v_cl_buf;(\s+)ELSE$P$,
    $R$IF coalesce(v_cl.render_as_subitem,false) AND (v_cl.heading IS NULL OR v_cl.heading = '') AND coalesce(array_length(v_cl_buf,1),0) > 0 THEN\1  IF coalesce(array_length(v_sec_buf,1),0) >= 2 AND v_sec_buf[array_upper(v_sec_buf,1)] = '' THEN\1    v_sec_buf[array_upper(v_sec_buf,1)-1] := v_sec_buf[array_upper(v_sec_buf,1)-1] || ' ' || array_to_string(v_cl_buf, ' ');\1  ELSE\1    v_sec_buf := v_sec_buf || v_cl_buf;\1  END IF;\1ELSE$R$);
  IF v_new = v_src THEN RAISE EXCEPTION 'sub-item branch anchor not found'; END IF;

  EXECUTE v_new;
END $MIG$;

DO $CHK$
DECLARE v_src text;
BEGIN
  SELECT pg_get_functiondef(oid) INTO v_src
    FROM pg_proc WHERE proname='remerge_contract_from_clauses';
  IF v_src NOT LIKE '%array_to_string(v_cl_buf%' THEN
    RAISE EXCEPTION 'inline continuation branch missing';
  END IF;
  IF v_src LIKE '%chr(96 + v_sub_no)%' THEN
    RAISE EXCEPTION 'lettered prefix still present';
  END IF;
END $CHK$;

COMMIT;
