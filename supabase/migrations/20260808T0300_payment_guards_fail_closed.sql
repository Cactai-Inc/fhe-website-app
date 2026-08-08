-- Make three anon-reachable payment/gift guards FAIL CLOSED.
--
-- CONFIRMED EXPLOITABLE in production 2026-08-07. As `anon`, against a REAL
-- purchase id, update_purchase_payment_method did not raise 'not your purchase'
-- — it proceeded to the write. Verified inside BEGIN…ROLLBACK; no data changed.
--
-- Why the guard fails. Each reads:
--
--   IF NOT (has_staff_access() OR v_p.buyer_user_id = auth.uid()
--           OR v_p.buyer_contact_id = current_contact_id()) THEN
--
-- For an anonymous caller has_staff_access() is now false (TASK-NULLUID fixed
-- that), but auth.uid() and current_contact_id() are NULL, so both comparisons
-- evaluate to NULL. `false OR NULL OR NULL` is NULL, `NOT NULL` is NULL, and an
-- IF on NULL does not execute its body. The guard reads like a deny and behaves
-- like an allow.
--
-- Note this is NOT the same bug TASK-NULLUID fixed. That one was a NULL-valued
-- predicate function. These guards still fail with a correctly-behaving
-- has_staff_access(), because the NULL enters through the uuid comparisons.
-- Fixing the predicate functions was necessary and not sufficient.
--
-- The fix: coalesce the whole predicate to false, so an indeterminate
-- authorisation is a denial. Nothing else in the body changes.
--
-- No outage risk: all three are called only from src/ (authenticated browser
-- sessions). No api/ caller, so no service_role path, and no database-internal
-- caller — verified by grep over src/ and api/ and by scanning pg_proc.prosrc.
-- Every currently-working caller evaluates the predicate to TRUE and is
-- unaffected; only the NULL case changes, and only to denied.
--
-- open_gift is deliberately NOT touched. It has no guard by design: it takes a
-- gift CODE, and knowing the code IS the authorisation — a recipient opens a
-- gift before having an account. A bogus code returns nothing.
--
-- The DO block asserts each replacement actually happened. This repo has ~31
-- migrations that rewrite function bodies by string replacement, and a
-- replacement that matches nothing silently no-ops and reports success.

BEGIN;

DO $mig$
DECLARE
  r record;
  v_src text;
  v_new text;
  v_count int := 0;
BEGIN
  FOR r IN
    SELECT p.oid, p.proname
      FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = 'public'
       AND p.proname IN ('gift_transfer',
                         'update_purchase_payment_method',
                         'transfer_payment_responsibility')
  LOOP
    v_src := pg_get_functiondef(r.oid);

    v_new := replace(
      v_src,
      'IF NOT (has_staff_access() OR v_g.buyer_user_id = auth.uid()) THEN',
      'IF NOT coalesce(has_staff_access() OR v_g.buyer_user_id = auth.uid(), false) THEN');

    v_new := replace(
      v_new,
      E'IF NOT (has_staff_access() OR v_p.buyer_user_id = auth.uid()\n          OR v_p.buyer_contact_id = current_contact_id()) THEN',
      E'IF NOT coalesce(has_staff_access() OR v_p.buyer_user_id = auth.uid()\n          OR v_p.buyer_contact_id = current_contact_id(), false) THEN');

    IF v_new = v_src THEN
      RAISE EXCEPTION
        'PAYGUARD: guard text not matched in %(); refusing to report a no-op as success', r.proname;
    END IF;

    EXECUTE v_new;
    v_count := v_count + 1;
  END LOOP;

  IF v_count <> 3 THEN
    RAISE EXCEPTION 'PAYGUARD: expected to rewrite 3 functions, rewrote %', v_count;
  END IF;

  RAISE NOTICE 'PAYGUARD: % functions rewritten', v_count;
END
$mig$;

-- Prove the guards now deny an indeterminate caller, in the same transaction.
DO $verify$
DECLARE v_bad int := 0;
BEGIN
  SELECT count(*) INTO v_bad
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname = 'public'
     AND p.proname IN ('gift_transfer',
                       'update_purchase_payment_method',
                       'transfer_payment_responsibility')
     AND pg_get_functiondef(p.oid) NOT LIKE '%coalesce(has_staff_access()%';
  IF v_bad > 0 THEN
    RAISE EXCEPTION 'PAYGUARD: % function(s) still lack the coalesce guard', v_bad;
  END IF;
END
$verify$;

COMMIT;
