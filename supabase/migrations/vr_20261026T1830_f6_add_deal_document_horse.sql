-- VALIDATION ROUND — F6 (part 2): adding a document to a deal was broken.
--
-- add_deal_document read `v_ctr contracts%ROWTYPE` and then used `v_ctr.horse_id`,
-- but the `contracts` table has NO horse_id column — the horse lives on the
-- DOCUMENT, read through contract_horse_id(contract_id). So every add raised
-- `record "v_ctr" has no field "horse_id"` (42703), i.e. a deal could not add a
-- bill of sale (or any second document) at all. This is exactly the F6 requirement:
-- a deal must be able to add a sale agreement, a bill of sale, or a lease, with no
-- horse attached.
--
-- Fix: resolve the deal's horse once from contract_horse_id(...) and use that
-- everywhere v_ctr.horse_id was used. When the deal has no horse yet the value is
-- NULL and the document is created hornless (the horse is attached later, deal-wide,
-- by attach_horse_to_deal — F6 part 1).

BEGIN;

DO $fix$
DECLARE v_def text;
BEGIN
  SELECT pg_get_functiondef('public.add_deal_document'::regproc) INTO v_def;
  IF position('v_ctr.horse_id' IN v_def) = 0 THEN
    RETURN;  -- already fixed
  END IF;

  -- Declare a resolved horse id alongside the existing v_ctr declaration.
  v_def := replace(v_def,
    'v_deal deals%ROWTYPE; v_ctr contracts%ROWTYPE; v_anchor uuid; v_doc uuid;',
    'v_deal deals%ROWTYPE; v_ctr contracts%ROWTYPE; v_anchor uuid; v_doc uuid; v_deal_horse uuid;');

  -- Populate it right after v_ctr is loaded.
  v_def := replace(v_def,
    'SELECT * INTO v_ctr FROM contracts WHERE id = v_deal.contract_id;',
    'SELECT * INTO v_ctr FROM contracts WHERE id = v_deal.contract_id;' || chr(10)
      || '  v_deal_horse := contract_horse_id(v_deal.contract_id);');

  -- Every v_ctr.horse_id becomes the resolved v_deal_horse.
  v_def := replace(v_def, 'v_ctr.horse_id', 'v_deal_horse');

  EXECUTE v_def;
END $fix$;

COMMIT;
