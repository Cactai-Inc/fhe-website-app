-- Staff could not create a purchase for any quote-priced offering.
--
-- Found by TASK-LESSONFORM while working in CREDITALIGN's ground, verified live:
-- purchase_items.price_amount is NOT NULL, and _provision_purchase_for_offerings
-- inserts offerings.price_amount straight through. Three ACTIVE offerings carry
-- price_amount IS NULL by design -- Horse Finder, Horse Evaluation and
-- Acquisition Assistance, all price_model kind 'inquire' -- so provisioning any
-- of them raised a not-null violation. They are real sellable services; the
-- whole acquisition lane was unprovisionable.
--
-- (LESSONFORM's report said 13 of 43. The live figure is 3 of 26 active. The
-- mechanism it described was exactly right; the count was not.)
--
-- Fix: coalesce to 0 at the insert. 0 is already how this codebase represents
-- "priced later" -- the sum on line 11 has always used coalesce(...,0), so the
-- purchase total was already computed that way. This aligns the line item with
-- the total that was already being written, rather than inventing a convention.
-- Quote-priced work is billed by amending the order once the number is known.
DO $$
DECLARE v_src text;
BEGIN
  SELECT pg_get_functiondef(p.oid) INTO v_src
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname = 'public' AND p.proname = '_provision_purchase_for_offerings';
  IF v_src IS NULL THEN RAISE EXCEPTION '_provision_purchase_for_offerings not found'; END IF;

  IF position('coalesce(o.price_amount, 0), o.price_unit' in v_src) > 0 THEN
    RAISE NOTICE 'already patched; nothing to do';
    RETURN;
  END IF;

  v_src := replace(v_src,
    'SELECT p_org_id, v_purchase, o.id, o.name, o.price_amount, o.price_unit, 1',
    'SELECT p_org_id, v_purchase, o.id, o.name, coalesce(o.price_amount, 0), o.price_unit, 1');

  IF position('coalesce(o.price_amount, 0), o.price_unit' in v_src) = 0 THEN
    RAISE EXCEPTION 'anchor did not match — the insert has changed shape; fix by hand';
  END IF;

  EXECUTE v_src;
END $$;
