/*
  # Flat catalog — data flatten + drop offering_tiers (Slice 1)

  Turns each offering_tiers row into its OWN flat offering. Derivations:
    - purchase_type: session/flat -> one_time; month/week -> subscription;
      percent -> deposit_retainer. Overridden below for known retainers
      (HORSE_FINDER Search Retainer, brokering, lease arrangement = deposit_retainer).
    - horse_included: ONLY for RIDING_LESSON offerings. Label starting
      'Own Horse' -> false (rider brings horse); otherwise true (we provide a horse).
      NULL for every non-RIDING_LESSON offering.
    - label rename: 'Own Horse — X' -> 'X (Ride your horse)'; the our-horse rows
      keep their label (they are the default). New public naming is applied in code.

  History preservation: client_purchases has 2 live rows referencing tier_id +
  snapshotting tier_label/amount. We null the FK (tier_label/amount already carry
  the record); no history lost. order_items/request_selections have 0 tier refs.

  Idempotent-ish: guarded by a marker column check; safe to re-run (skips if flat
  offerings already created). Placeholder pricing carried straight from tiers.
*/

-- 1. Create a flat offering per tier. Parent offering becomes a "group" we keep
--    for its marketing copy but the CHILD flat offerings are the purchasable rows.
--    We mark flattened children with a distinguishing slug so we don't double-run.
DO $$
DECLARE
  r record;
  v_new_slug text;
  v_purchase_type purchase_type;
  v_horse_included boolean;
  v_label text;
  v_seg text;
BEGIN
  -- skip if already flattened (any offering whose slug ends in a tier-derived suffix)
  IF EXISTS (SELECT 1 FROM offerings WHERE slug LIKE '%--item-%') THEN
    RAISE NOTICE 'flat offerings already exist, skipping flatten';
    RETURN;
  END IF;

  FOR r IN
    SELECT ot.id AS tier_id, ot.label, ot.description, ot.price_amount, ot.price_unit,
           ot.price_min, ot.is_popular, ot.note, ot.sort_order,
           o.id AS parent_id, o.segment, o.service_type, o.slug AS parent_slug,
           o.tagline, o.org_id
    FROM offering_tiers ot
    JOIN offerings o ON o.id = ot.offering_id
  LOOP
    -- purchase_type from unit, with retainer overrides
    v_purchase_type := CASE
      WHEN r.service_type IN ('HORSE_FINDER','HORSE_PURCHASE_ASSISTANCE','HORSE_SALE_ASSISTANCE',
                              'HORSE_LEASE_IN_ASSISTANCE','HORSE_LEASE_OUT_ASSISTANCE')
        THEN 'deposit_retainer'::purchase_type
      WHEN r.price_unit IN ('month','week') THEN 'subscription'::purchase_type
      WHEN r.price_unit = 'percent' THEN 'deposit_retainer'::purchase_type
      ELSE 'one_time'::purchase_type
    END;

    -- horse_included only for riding lessons
    v_horse_included := CASE
      WHEN r.service_type = 'RIDING_LESSON'
        THEN NOT (r.label ILIKE 'Own Horse%')
      ELSE NULL
    END;

    -- label: rename Own Horse -> "(Ride your horse)"
    v_label := CASE
      WHEN r.label ILIKE 'Own Horse — %'
        THEN regexp_replace(r.label, '^Own Horse — ', '') || ' (Ride your horse)'
      WHEN r.label ILIKE 'Own Horse %'
        THEN regexp_replace(r.label, '^Own Horse ', '') || ' (Ride your horse)'
      ELSE r.label
    END;

    v_new_slug := r.parent_slug || '--item-' || substr(r.tier_id::text, 1, 8);

    INSERT INTO offerings (org_id, segment, name, tagline, description, slug, active,
                           sort_order, service_type, price_amount, price_unit, price_min,
                           purchase_type, horse_included, is_popular, note)
    VALUES (r.org_id, r.segment, v_label, r.tagline, r.description, v_new_slug, true,
            r.sort_order, r.service_type, r.price_amount, r.price_unit, r.price_min,
            v_purchase_type, v_horse_included, coalesce(r.is_popular,false), r.note);
  END LOOP;
END $$;

-- 2. Deactivate the old parent "group" offerings (no price; kept for reference/rollback,
--    not purchasable). Their children (flat --item- offerings) are the live catalog now.
UPDATE offerings SET active = false
  WHERE slug NOT LIKE '%--item-%'
    AND id IN (SELECT DISTINCT offering_id FROM offering_tiers);

-- 3. Preserve client_purchases history: null the tier_id FK (tier_label + amount
--    already snapshot the purchase). Then the FK can be dropped.
UPDATE client_purchases SET tier_id = NULL WHERE tier_id IS NOT NULL;

-- 4. Drop the tier layer. order_items.tier_id / request_selections.tier_id had 0 rows;
--    drop those FK columns too (flat model uses offering_id only).
ALTER TABLE order_items       DROP COLUMN IF EXISTS tier_id;
ALTER TABLE request_selections DROP COLUMN IF EXISTS tier_id;
ALTER TABLE client_purchases  DROP COLUMN IF EXISTS tier_id;
DROP TABLE IF EXISTS offering_tiers CASCADE;
