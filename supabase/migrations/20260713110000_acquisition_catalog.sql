/*
  # Catalog: support→acquisition, consolidate acquisition offerings, price_model

  Owner decisions:
  - Segment "support" is confusing next to support REQUESTS. Rename to
    "acquisition" (evaluation, assistance, finder, leasing — all ways a client
    comes to HAVE a horse). Both offerings + service_types carry segment; both
    CHECK constraints hardcode the value → update both.
  - The acquisition offerings were duplicated/auto-generated (8 rows split by
    party/purpose with --item-hash slugs). Consolidate to 3 clean offerings,
    all "inquire" for now:
      Horse Evaluation      (HORSE_EVALUATION)          — one flexible evaluation
      Acquisition Assistance(HORSE_PURCHASE_ASSISTANCE) — full/partial: paperwork,
                                                          logistics, negotiation,
                                                          advising (lease OR buy)
      Horse Finder          (HORSE_FINDER)              — sourcing a match
  - Flexible pricing (acquisition only, DISPLAY-ONLY): a price_model jsonb
    describing fixed / percent / fee_plus_percent + cadence. The catalog renders
    human text; staff compute the actual charge per engagement. Simple offerings
    (lessons etc.) keep their flat price_amount untouched.
*/

-- 1. widen both CHECK constraints, then migrate the data
ALTER TABLE offerings DROP CONSTRAINT IF EXISTS offerings_segment_check;
ALTER TABLE offerings ADD CONSTRAINT offerings_segment_check
  CHECK (segment = ANY (ARRAY['rider','horse','acquisition','support']));  -- both allowed during migration
ALTER TABLE service_types DROP CONSTRAINT IF EXISTS service_types_segment_check;
ALTER TABLE service_types ADD CONSTRAINT service_types_segment_check
  CHECK (segment = ANY (ARRAY['rider','horse','acquisition','support','internal']));

UPDATE offerings     SET segment = 'acquisition' WHERE segment = 'support';
UPDATE service_types SET segment = 'acquisition' WHERE segment = 'support';

-- tighten: drop 'support' now that data is migrated
ALTER TABLE offerings DROP CONSTRAINT offerings_segment_check;
ALTER TABLE offerings ADD CONSTRAINT offerings_segment_check
  CHECK (segment = ANY (ARRAY['rider','horse','acquisition']));
ALTER TABLE service_types DROP CONSTRAINT service_types_segment_check;
ALTER TABLE service_types ADD CONSTRAINT service_types_segment_check
  CHECK (segment = ANY (ARRAY['rider','horse','acquisition','internal']));

-- 2. price_model — DISPLAY-ONLY flexible pricing (acquisition offerings)
--    { kind: 'fixed'|'percent'|'fee_plus_percent'|'inquire',
--      fee_amount: numeric|null, percent: numeric|null,
--      cadence: 'one_time'|'per_session'|'monthly'|'per_engagement'|null,
--      basis: text|null   -- what the % is of, e.g. 'sale price' (display label)
--    }
ALTER TABLE offerings ADD COLUMN IF NOT EXISTS price_model jsonb;

-- 3. consolidate the acquisition offerings to 3 clean rows (all inquire).
--    Soft-approach: retire the duplicates by deactivating, then upsert the 3
--    canonical rows. Keeps any historical references intact (no hard delete).
UPDATE offerings SET active = false
 WHERE segment = 'acquisition'
   AND slug NOT IN ('horse-evaluation', 'acquisition-assistance', 'horse-finder');

INSERT INTO offerings (org_id, segment, name, slug, service_type, tagline, description,
                       price_amount, price_unit, price_min, purchase_type, horse_included,
                       is_popular, active, sort_order, price_model)
VALUES
  ('e656f20b-ef43-4725-9029-19e7f0190d9c', 'acquisition', 'Horse Evaluation', 'horse-evaluation',
   'HORSE_EVALUATION', 'Expert eyes before you commit',
   'A professional assessment of a horse under consideration — movement, temperament, training, and suitability. Scoped and reported to fit the situation, whether you are buying, leasing, or presenting a horse to prospects.',
   NULL, NULL, NULL, NULL, true, false, true, 10,
   '{"kind":"inquire"}'::jsonb),
  ('e656f20b-ef43-4725-9029-19e7f0190d9c', 'acquisition', 'Acquisition Assistance', 'acquisition-assistance',
   'HORSE_PURCHASE_ASSISTANCE', 'Full or partial support through the deal',
   'Representation through acquiring a horse — lease or purchase. Any part of, or all of: paperwork, logistics, negotiation, and advising, tailored to how much help you want.',
   NULL, NULL, NULL, NULL, true, false, true, 20,
   '{"kind":"inquire"}'::jsonb),
  ('e656f20b-ef43-4725-9029-19e7f0190d9c', 'acquisition', 'Horse Finder', 'horse-finder',
   'HORSE_FINDER', 'We find the right match — you make the decision',
   'We source horses that fit your goals, budget, and level, and bring you qualified candidates to consider.',
   NULL, NULL, NULL, NULL, false, false, true, 30,
   '{"kind":"inquire"}'::jsonb)
ON CONFLICT (slug) DO UPDATE SET
  segment = excluded.segment, name = excluded.name, service_type = excluded.service_type,
  tagline = excluded.tagline, description = excluded.description,
  price_amount = NULL, price_unit = NULL, price_min = NULL, purchase_type = NULL,
  active = true, sort_order = excluded.sort_order,
  price_model = coalesce(offerings.price_model, excluded.price_model);
