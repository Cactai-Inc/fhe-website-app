-- TASK ONBOARD — `book_open_slot` must have exactly ONE signature, whatever order
-- the branches land in.
--
-- WHAT HAPPENED. M6 (20260816T1500) dropped the 2-argument `book_open_slot(uuid, uuid)`
-- and created the 3-argument one that takes the member's chosen credit. Verified
-- immediately after applying: `overloads = 1`. An hour later the verification pass for
-- this report found **two**, and the 2-argument one was anon-callable again. Its body
-- carries the `REVIEWQ R1` comment, so a concurrent thread re-applied
-- `20260815T2300_reviewq_m2_write_paths_land_pending.sql` to prod after this task's
-- migration — recreating the old signature, and picking up this database's default
-- privilege that grants EXECUTE on new functions to `anon`.
--
-- WHY IT MATTERS MORE THAN A STRAY GRANT. PostgREST resolves RPCs by argument NAME.
-- With both signatures present, `book_open_slot({p_booking_id, p_horse_id})` is
-- ambiguous, and the client that passes `p_credit_id` may or may not reach the function
-- that honours it — which would silently spend the wrong purchased item, the exact
-- defect §7 was written to fix.
--
-- WHY A DO BLOCK RATHER THAN ANOTHER `DROP FUNCTION`. A hard-coded signature only
-- removes the overload that exists on the day it is written, and the collision above is
-- proof that these two migrations can land in either order (or twice). This drops every
-- `book_open_slot` that is NOT the 3-argument one, is safe to re-run, and is safe if
-- REVIEWQ's file is replayed after it — that would still resurrect the old signature,
-- but merging this branch puts this file LAST, and running it again is a no-op when
-- there is nothing to remove.

DO $mig$
DECLARE
  r RECORD;
  v_dropped int := 0;
BEGIN
  FOR r IN
    SELECT p.oid::regprocedure AS sig
      FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = 'public'
       AND p.proname = 'book_open_slot'
       AND pg_get_function_identity_arguments(p.oid) <> 'p_booking_id uuid, p_horse_id uuid, p_credit_id uuid'
  LOOP
    EXECUTE format('DROP FUNCTION %s', r.sig);
    v_dropped := v_dropped + 1;
    RAISE NOTICE 'dropped superseded overload %', r.sig;
  END LOOP;

  IF NOT EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = 'public' AND p.proname = 'book_open_slot'
       AND pg_get_function_identity_arguments(p.oid) = 'p_booking_id uuid, p_horse_id uuid, p_credit_id uuid'
  ) THEN
    RAISE EXCEPTION 'the 3-argument book_open_slot is missing — apply '
                    '20260816T1500_onboard_m6_booking_credits_edits_and_fee_schedule.sql first';
  END IF;

  RAISE NOTICE 'book_open_slot overloads removed: %', v_dropped;
END $mig$;

-- Re-assert the ACL on the survivor: a replay of the other branch's file may have
-- left `anon` on the dropped twin, and grants are the thing this repo has repeatedly
-- got wrong by assuming rather than proving.
REVOKE ALL ON FUNCTION public.book_open_slot(uuid, uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.book_open_slot(uuid, uuid, uuid) TO authenticated, service_role, postgres;
