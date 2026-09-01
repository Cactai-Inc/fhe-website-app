-- Stage 2 fix: adding p_marker (DEFAULT 'CLIENT') to _ensure_client_account
-- created a SECOND overload — 6-argument calls became ambiguous ("function is
-- not unique"), breaking every existing caller. The old 6-arg version is a
-- shadow writer (no markers) and must go; the 7-arg version's default keeps
-- every existing call site working unchanged.
DROP FUNCTION _ensure_client_account(uuid, text, text, text, text[], text[]);

DO $$
DECLARE v_n int;
BEGIN
  SELECT count(*) INTO v_n FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname = 'public' AND proname = '_ensure_client_account';
  IF v_n <> 1 THEN RAISE EXCEPTION 'expected exactly 1 _ensure_client_account, found %', v_n; END IF;
END $$;
