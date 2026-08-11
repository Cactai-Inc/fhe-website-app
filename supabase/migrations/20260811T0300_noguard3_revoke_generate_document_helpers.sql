-- TASK NOGUARD3 / PHASE B — DRY RUN ONLY. NOT APPLIED. Do not apply without review.
--
-- KEPT SEPARATE FROM 20260811T0200 ON PURPOSE. These five carry a risk the
-- other eighteen do not, and they should be approved or rejected on their own.
--
-- The five: document_horse_ids, expand_horse_blocks, horse_medication_component,
-- horse_medications_prose, location_full_label. They leak animal medical data,
-- addresses and document/horse links by id, with no identity check.
--
-- WHY THEY ARE DIFFERENT. Their only in-database caller is generate_document,
-- and generate_document is SECURITY **INVOKER** (prosecdef = false), not
-- DEFINER. NOGUARD2's clearance argument — "revoking never breaks an
-- in-database caller, because every caller is a postgres-owned SECURITY
-- DEFINER function and the inner privilege check is made against postgres" —
-- DOES NOT COVER AN INVOKER CALLER. An invoker function runs as whoever is
-- current_user at the time, so its inner calls are checked against that role.
--
-- Tested rather than reasoned about, in a rolled-back transaction, with a
-- three-function probe mirroring the real shape (probe objects confirmed gone
-- afterwards: 0 rows matching ng3_%):
--
--   definer_outer -> invoker -> target, target revoked from authenticated
--     called as authenticated  ->  "target reached"        (SURVIVES)
--
--   invoker -> target, target revoked from authenticated
--     called as authenticated  ->  ERROR: permission denied for function
--
-- So the revoke is safe for the real path and unsafe for a direct one:
--   * generate_document has NO direct browser or api/ RPC caller (grepped for
--     rpc('generate_document') and the bare identifier).
--   * All 10 of its in-database callers ARE SECURITY DEFINER, so in every real
--     invocation current_user is postgres by the time it runs and the five
--     inner calls resolve against postgres.
--   * generate_document is itself granted to anon AND authenticated, so a
--     direct PostgREST call is possible today. After this migration such a call
--     would fail partway through instead of completing.
--
-- THE OPEN QUESTION FOR REVIEW: generate_document is a SECURITY INVOKER
-- function that creates documents and is granted to anon. That grant, not
-- these five, is the more interesting finding. It is left alone here because
-- changing it is a larger decision than this migration should make.
--
-- No transaction control of its own. Do not add BEGIN/COMMIT.

DO $mig$
DECLARE
  r       record;
  v_count int := 0;
  v_names text[] := ARRAY['document_horse_ids','expand_horse_blocks',
                          'horse_medication_component','horse_medications_prose',
                          'location_full_label'];
BEGIN
  FOR r IN
    SELECT p.oid::regprocedure::text AS sig
      FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = 'public' AND p.proname = ANY(v_names)
       AND p.prorettype::regtype::text <> 'trigger'
  LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC',        r.sig);
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM anon',          r.sig);
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM authenticated', r.sig);
    v_count := v_count + 1;
  END LOOP;

  IF v_count <> array_length(v_names, 1) THEN
    RAISE EXCEPTION 'NOGUARD3: expected % functions, revoked on %',
      array_length(v_names, 1), v_count;
  END IF;
  RAISE NOTICE 'NOGUARD3: revoked on % generate_document helpers', v_count;
END
$mig$;

DO $verify$
DECLARE v_open int; v_lost int;
BEGIN
  SELECT count(*) INTO v_open FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname='public' AND p.proname = ANY(ARRAY['document_horse_ids','expand_horse_blocks',
         'horse_medication_component','horse_medications_prose','location_full_label'])
     AND (has_function_privilege('anon',p.oid,'EXECUTE')
       OR has_function_privilege('authenticated',p.oid,'EXECUTE'));
  SELECT count(*) INTO v_lost FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname='public' AND p.proname = ANY(ARRAY['document_horse_ids','expand_horse_blocks',
         'horse_medication_component','horse_medications_prose','location_full_label'])
     AND NOT has_function_privilege('service_role',p.oid,'EXECUTE');
  IF v_open > 0 THEN RAISE EXCEPTION 'NOGUARD3: % still reachable by anon/authenticated', v_open; END IF;
  IF v_lost > 0 THEN RAISE EXCEPTION 'NOGUARD3: % lost service_role', v_lost; END IF;
END
$verify$;
