-- CLOSEOUT §2.2 — the mint seam's comment contradicted its own code.
--
-- CREDITALIGN F1 ("à la carte care mints nothing") was CLOSED on 2026-08-16 by
-- 20260816T2900_horse_scheduled_skus_mint_credits.sql, under the owner ruling
-- "any of the services that have a single quantity need to mint a credit with
-- the service attached to it." Verified live 2026-08-19: a Full Body Clip
-- purchase mints exactly one credit tagged to the offering.
--
-- But the live body of _mint_credits_for_purchase_item still carried the
-- pre-ruling comment — "a HORSE-segment scheduled SKU mints nothing (a Full
-- Body Clip is not a lesson credit — FLOWTRACE F2)" — beside code that no
-- longer does that. This is the D20 stale-claim trap: a state claim in a
-- comment is a hypothesis, and this one sent CLOSEOUT §2.2 hunting for a
-- defect that was fixed three days ago. The comment now states the ruling.
--
-- Same in-place string-replace mechanism as 20260816T2900 itself, with the
-- same guards: refuse silently-changed bodies, prove the replacement landed.

DO $$
DECLARE v_src text;
BEGIN
  SELECT pg_get_functiondef(p.oid) INTO v_src
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname = 'public' AND p.proname = '_mint_credits_for_purchase_item';
  IF v_src IS NULL THEN RAISE EXCEPTION '_mint_credits_for_purchase_item not found'; END IF;

  IF position($m$TAGGED to the offering$m$ in v_src) > 0 THEN
    RAISE NOTICE 'comment already truthful; nothing to do';
    RETURN;
  END IF;

  v_src := replace(v_src,
    $m$    -- CREDITFIX's ruling, unchanged and re-proven by this task's test: a session pack
    -- mints unit_count × quantity, and a HORSE-segment scheduled SKU mints nothing
    -- (a Full Body Clip is not a lesson credit — FLOWTRACE F2). No period, no expiry.$m$,
    $m$    -- A session pack mints unit_count × quantity. No period, no expiry. Owner
    -- ruling 2026-08-16 (20260816T2900): single-quantity HORSE services mint one
    -- credit each, TAGGED to the offering — a Full Body Clip credit is a
    -- Full-Body-Clip credit, kept apart from lessons by offering_id, not by a
    -- segment gate. Only unit_count <= 0 (inquire / quote-priced rows) mints nothing.$m$);

  IF position($m$mints nothing$m$ in v_src) > 0 AND position($m$TAGGED to the offering$m$ in v_src) = 0 THEN
    RAISE EXCEPTION 'comment replacement did not match the live body — inspect before re-running';
  END IF;

  EXECUTE v_src;
END $$;
