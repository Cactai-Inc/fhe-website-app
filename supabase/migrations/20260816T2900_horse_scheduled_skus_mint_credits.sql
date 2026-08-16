-- Owner ruling 2026-08-16: "any of the services that have a single quantity need
-- to mint a credit with the service attached to it. They need to be bookable the
-- same as any other service, they all follow the same paradigm."
--
-- CREDITFIX gated horse-segment SCHEDULED SKUs to mint nothing, to stop a
-- grooming service minting a bookable LESSON credit. That was the right instinct
-- and the wrong mechanism: credits carry offering_id since CREDITALIGN, so a
-- Full Body Clip credit is a Full-Body-Clip credit, not a lesson credit. The
-- segment test is no longer what keeps them apart -- the offering tag is.
--
-- Effect: the six one-off horse services (Bridle Path & Ears, Exercise Session,
-- Full Body Clip, Legs & Face Clip, Training Session, Turnout Session -- all
-- unit_count 1, price_unit 'session') mint one credit each, tagged to the
-- service, and become bookable like every other service. book_open_slot is
-- already segment-aware, so consumption needs no change.
--
-- The unit_count guard STAYS: a SKU with no unit_count still mints nothing,
-- which is what keeps 'inquire' and quote-priced rows out.
DO $$
DECLARE v_src text;
BEGIN
  SELECT pg_get_functiondef(p.oid) INTO v_src
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname = 'public' AND p.proname = '_mint_credits_for_purchase_item';
  IF v_src IS NULL THEN RAISE EXCEPTION '_mint_credits_for_purchase_item not found'; END IF;

  IF position($m$IF coalesce(v_off.unit_count, 0) <= 0 THEN RETURN 0; END IF;$m$ in v_src) > 0 THEN
    RAISE NOTICE 'already patched; nothing to do';
    RETURN;
  END IF;

  v_src := replace(v_src,
    $m$IF v_off.segment = 'horse' OR coalesce(v_off.unit_count, 0) <= 0 THEN RETURN 0; END IF;$m$,
    $m$IF coalesce(v_off.unit_count, 0) <= 0 THEN RETURN 0; END IF;$m$);

  IF position($m$IF coalesce(v_off.unit_count, 0) <= 0 THEN RETURN 0; END IF;$m$ in v_src) = 0 THEN
    RAISE EXCEPTION 'anchor did not match — the segment gate has changed shape; fix by hand';
  END IF;

  EXECUTE v_src;
END $$;
