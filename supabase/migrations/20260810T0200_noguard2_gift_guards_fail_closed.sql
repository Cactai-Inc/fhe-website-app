-- NOGUARD2 item 4 — make the three remaining gift_* guards FAIL CLOSED.
--
-- gift_claim_link, gift_mark_sent and gift_reschedule each carry:
--
--   IF NOT (has_staff_access() OR v_g.buyer_user_id = auth.uid()) THEN
--     RAISE EXCEPTION 'not your gift';
--
-- For a caller with no session auth.uid() is NULL, so `v_g.buyer_user_id = NULL`
-- is NULL, `false OR NULL` is NULL, `NOT NULL` is NULL, and an IF on NULL does
-- not execute its body. The guard reads like a deny and behaves like an allow.
-- Verified verbatim against production 2026-08-10 (bodies read from
-- pg_get_functiondef, grants read from pg_proc.proacl).
--
-- These are the last three of the "check present, no effect" class. The repair is
-- a copy, not a design: gift_transfer — same table, same lookup, same predicate,
-- ten lines away in the same file — already carries
--
--   IF NOT coalesce(has_staff_access() OR v_g.buyer_user_id = auth.uid(), false) THEN
--
-- applied 2026-08-07 in 20260808T0300_payment_guards_fail_closed.sql.
--
-- WHAT EACH LEAKS TODAY, to an unauthenticated caller holding a gift id:
--   gift_claim_link  — returns /redeem?code=<code>. The code IS the credential
--                      for open_gift and redeem_gift, so this hands over the gift.
--   gift_mark_sent   — bumps last_sent_at and send_count; corrupts send state.
--   gift_reschedule  — moves someone else's delivery date.
--
-- NO OUTAGE RISK. Callers, listed before changing anything:
--   src/lib/gifts.ts → src/components/app/GiftsContent.tsx   (authenticated browser)
--   api/                                                      NONE
--   pg_proc (any in-database caller)                           NONE
--   overloads                                                  NONE (one signature each)
-- No api/ caller means no service_role path to preserve, so the session_user /
-- auth.role() trap does not arise here. All four gift actions are invoked from the
-- SAME component in the SAME way, and gift_transfer — already carrying this exact
-- shape — works there in production. Every caller that works today evaluates the
-- predicate to a non-NULL value and is unaffected: coalesce(X, false) = X whenever
-- X IS NOT NULL. Only the undetermined case changes, and only to denied.
--
-- ONE BEHAVIOUR CHANGE WORTH NAMING. The predicate is also NULL for a *signed-in*
-- non-staff caller when v_g.buyer_user_id IS NULL (the column is nullable — a
-- future guest-checkout gift). Today any such gift is actionable by any account;
-- afterwards it is actionable by staff only. That is a correction, not a
-- regression — such a caller was never matched on identity, only unmatched by a
-- guard that never ran. It is currently moot: gifts holds 0 rows and no INSERT
-- path into it exists in pg_proc, src/ or api/.
--
-- The DO block asserts each replacement actually matched. This repo has ~31
-- migrations that rewrite function bodies by string replacement, and a
-- replacement that matches nothing silently no-ops and reports success.
--
-- Grants are deliberately NOT touched. NULLUID's most durable result was that
-- contact_dossier and inbound_open_count began enforcing correctly once the
-- predicate was repaired, without any revoke. Fix the check first.

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
       AND p.proname IN ('gift_claim_link', 'gift_mark_sent', 'gift_reschedule')
  LOOP
    v_src := pg_get_functiondef(r.oid);

    v_new := replace(
      v_src,
      'IF NOT (has_staff_access() OR v_g.buyer_user_id = auth.uid()) THEN',
      'IF NOT coalesce(has_staff_access() OR v_g.buyer_user_id = auth.uid(), false) THEN');

    IF v_new = v_src THEN
      RAISE EXCEPTION
        'NOGUARD2: guard text not matched in %(); refusing to report a no-op as success', r.proname;
    END IF;

    EXECUTE v_new;
    v_count := v_count + 1;
  END LOOP;

  IF v_count <> 3 THEN
    RAISE EXCEPTION 'NOGUARD2: expected to rewrite 3 gift functions, rewrote %', v_count;
  END IF;

  RAISE NOTICE 'NOGUARD2: % gift functions rewritten', v_count;
END
$mig$;

-- Prove the guards now read fail-closed, in the same transaction. Checked
-- against the whole gift_* family so gift_transfer's existing fix is re-asserted
-- rather than assumed.
DO $verify$
DECLARE v_bad int := 0;
BEGIN
  SELECT count(*) INTO v_bad
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname = 'public'
     AND p.proname IN ('gift_claim_link', 'gift_mark_sent', 'gift_reschedule', 'gift_transfer')
     AND pg_get_functiondef(p.oid) NOT LIKE '%coalesce(has_staff_access() OR v_g.buyer_user_id = auth.uid(), false)%';
  IF v_bad > 0 THEN
    RAISE EXCEPTION 'NOGUARD2: % gift function(s) still lack the coalesce guard', v_bad;
  END IF;

  -- And that no bare (NULL-propagating) form survives anywhere in the family.
  SELECT count(*) INTO v_bad
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname = 'public'
     AND p.proname LIKE 'gift\_%'
     AND pg_get_functiondef(p.oid) LIKE '%IF NOT (has_staff_access() OR v_g.buyer_user_id = auth.uid()) THEN%';
  IF v_bad > 0 THEN
    RAISE EXCEPTION 'NOGUARD2: % gift function(s) still carry the bare NULL-propagating guard', v_bad;
  END IF;
END
$verify$;

COMMIT;
