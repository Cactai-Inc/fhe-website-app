-- R11 PHASE B follow-up — terminal punctuation for AUTHORED lines.
--
-- R5 (2026-08-04) moved sentence-terminal punctuation out of the authored text
-- and into the composer, so a clause body never carries a trailing "." that
-- would double up against a signer's own. But that rule only ever reached lines
-- that CONTAIN A TOKEN: a line with no {{token}} at all is appended verbatim and
-- returns before the punctuation step.
--
-- For template prose that is correct — its punctuation is part of the drafted
-- instrument. For an AUTHORED line it is not: the add-item composer tells the
-- author "no closing period required", and a line with no inline element (e.g.
-- the gated line "Evening turnout requires the Lessee to bring the Horse in
-- before dark") then composed with no period at all.
--
-- Authored rows are exactly the ones whose clause_key is a CUSTOM.* key, so the
-- rule is scoped without touching a single template clause.

DO $do$
DECLARE v_src text; v_old text; v_new text;
BEGIN
  SELECT pg_get_functiondef(p.oid) INTO v_src
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname = 'public' AND p.proname = 'remerge_contract_from_clauses';
  IF v_src IS NULL THEN RAISE EXCEPTION 'remerge_contract_from_clauses not found'; END IF;

  v_old := $q$          IF NOT v_any_token THEN v_cl_buf := array_append(v_cl_buf, v_line); CONTINUE; END IF;$q$;
  v_new := $q$          IF NOT v_any_token THEN
            /* R11: an AUTHORED line is never typed with a closing period —
               the composer supplies terminal punctuation here, exactly as R5
               does for a token-bearing line. Template prose is left verbatim:
               its punctuation is part of the drafted instrument. */
            IF v_cl.clause_key LIKE 'CUSTOM.%' AND btrim(v_line) <> ''
               AND btrim(v_line) !~ '[.!?:;)"'']$' THEN
              v_line := v_line || '.';
            END IF;
            v_cl_buf := array_append(v_cl_buf, v_line); CONTINUE;
          END IF;$q$;

  IF position(v_new in v_src) > 0 THEN RETURN; END IF;            -- already patched
  IF position(v_old in v_src) = 0 THEN
    RAISE EXCEPTION 'remerge_contract_from_clauses rewrite did not match its anchor';
  END IF;
  v_src := replace(v_src, v_old, v_new);
  EXECUTE v_src;
END $do$;
