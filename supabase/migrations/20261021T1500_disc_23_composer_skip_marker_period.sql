-- Disclosure rebuild, phase 23: the clause composer must not append a
-- sentence-terminal period to a disclosure marker line.
--
-- A disclosed section's body ends with the token {{HORSE.<SECTION>}}, which
-- expands to a block whose last line is the close marker [[/DISCLOSURE]]. R5's
-- "add terminal punctuation to a token-bearing line" rule then produced
-- "[[/DISCLOSURE]].", leaving a stray period on the (hidden) marker line — visible
-- only in a raw merged_body dump, but wrong. Skip the period when the composed
-- line IS a disclosure marker. The marker renderers tolerate the period regardless
-- (defence in depth); this keeps the stored body clean.

DO $m$
DECLARE
  v_def text;
  v_old text := $q$          IF NOT v_has_sig AND NOT v_is_label_line AND btrim(v_line) <> '' AND btrim(v_line) !~ '[.!?:;)"'']$' THEN
            v_line := v_line || '.';
          END IF;$q$;
  v_new text := $q$          IF NOT v_has_sig AND NOT v_is_label_line AND btrim(v_line) <> '' AND btrim(v_line) !~ '[.!?:;)"'']$'
             AND btrim(v_line) !~ '^\[\[/?DISCLOSURE' THEN
            v_line := v_line || '.';
          END IF;$q$;
BEGIN
  SELECT pg_get_functiondef('public.remerge_contract_from_clauses(uuid)'::regprocedure) INTO v_def;
  IF position('^\[\[/?DISCLOSURE' IN v_def) > 0 THEN RETURN; END IF;
  IF position(v_old IN v_def) = 0 THEN
    RAISE EXCEPTION 'remerge_contract_from_clauses R5 period block not found';
  END IF;
  EXECUTE replace(v_def, v_old, v_new);
END $m$;
