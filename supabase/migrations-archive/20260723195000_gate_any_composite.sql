-- Gating: add an 'any' (OR) composite to clause_condition_met, mirroring 'all'.
-- A clause/field gated on {"any": [condA, condB]} is included when EITHER holds.
DO $mig$
DECLARE v_def text;
BEGIN
  v_def := pg_get_functiondef('clause_condition_met'::regproc);
  v_def := replace(v_def,
$old$  IF p_cond ? 'all' THEN
    FOR v_sub IN SELECT * FROM jsonb_array_elements(p_cond -> 'all') LOOP
      IF NOT clause_condition_met(v_sub, v_fields) THEN RETURN false; END IF;
    END LOOP;
    RETURN true;
  END IF;$old$,
$new$  IF p_cond ? 'all' THEN
    FOR v_sub IN SELECT * FROM jsonb_array_elements(p_cond -> 'all') LOOP
      IF NOT clause_condition_met(v_sub, v_fields) THEN RETURN false; END IF;
    END LOOP;
    RETURN true;
  END IF;

  -- composite OR: any sub-condition holding is enough
  IF p_cond ? 'any' THEN
    FOR v_sub IN SELECT * FROM jsonb_array_elements(p_cond -> 'any') LOOP
      IF clause_condition_met(v_sub, v_fields) THEN RETURN true; END IF;
    END LOOP;
    RETURN false;
  END IF;$new$);
  IF v_def NOT LIKE '%composite OR%' THEN RAISE EXCEPTION 'clause_condition_met: all-block not found'; END IF;
  EXECUTE v_def;
END $mig$;
