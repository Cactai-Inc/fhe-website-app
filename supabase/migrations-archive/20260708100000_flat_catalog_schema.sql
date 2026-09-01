/*
  # Flat catalog — schema (Slice 1 of launch build)

  Strip the offering_tiers layer: each purchasable thing becomes its own offering.
  Price moves ONTO the offering (it lived only on tiers). Add:
    - price_amount / price_unit / price_min  (was on offering_tiers)
    - purchase_type  (one_time | subscription | deposit_retainer) — drives payment UI
    - horse_included (boolean) — rider LESSON split: "Ride our horse" (true) vs
      "Ride your horse" (false). Null for non-lesson offerings.
    - is_popular / note  (carried from tiers for marketing display)

  This migration is ADDITIVE (adds columns). The data flatten (create flat
  offerings from current tiers) + offering_tiers drop happen in the NEXT migration
  (20260708110000) so this one is safe/reversible on its own.

  Owner: SaaS `tiers` table (licensing) is UNTOUCHED — different concept.
  Pricing values are placeholder (owner finalizing); structure is what matters here.
*/

-- purchase_type enum
DO $$ BEGIN
  CREATE TYPE purchase_type AS ENUM ('one_time', 'subscription', 'deposit_retainer');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE offerings ADD COLUMN IF NOT EXISTS price_amount   numeric(10,2);
ALTER TABLE offerings ADD COLUMN IF NOT EXISTS price_unit     text
  CHECK (price_unit IN ('session','week','month','flat','percent'));
ALTER TABLE offerings ADD COLUMN IF NOT EXISTS price_min      numeric(10,2);
ALTER TABLE offerings ADD COLUMN IF NOT EXISTS purchase_type  purchase_type;
ALTER TABLE offerings ADD COLUMN IF NOT EXISTS horse_included boolean;  -- null = N/A (non-lesson)
ALTER TABLE offerings ADD COLUMN IF NOT EXISTS is_popular     boolean NOT NULL DEFAULT false;
ALTER TABLE offerings ADD COLUMN IF NOT EXISTS note           text;

COMMENT ON COLUMN offerings.purchase_type IS 'Drives payment-time UI: one_time | subscription | deposit_retainer.';
COMMENT ON COLUMN offerings.horse_included IS 'Rider lessons only: true = "Ride our horse", false = "Ride your horse", null = not a lesson.';
