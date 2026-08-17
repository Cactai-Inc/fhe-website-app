-- CAREPLANS m1 — a care service offers exactly two shapes: a la carte, or weekly.
--
-- Owner, 2026-08-16: "right now it says 1x or 2x and it shouldnt do that, it should
-- just offer ala carte and weekly as the two options and the provisioning that we do
-- on the staff side is to select the days of the week and the quantity is determined
-- from that."
--
-- WHAT THIS DOES AND DOES NOT DO:
--   * RETIRES the three 2x care SKUs (active = false). It does NOT delete them —
--     executed orders may reference them, and the catalog is evidence.
--   * RENAMES the three 1x care SKUs to "<Service> Weekly". The frequency stops
--     being part of what the customer picks; it is chosen at provisioning.
--   * CHANGES NO PRICE. Owner, 2026-08-17: "im not supplying any price revisions."
--     Every price_amount, price_unit, price_min and price_model is left alone.
--   * DROPS NO COLUMN. weekly_frequency stays, populated, on every row —
--     owner, 2026-08-17: "we cant let it do that." It is now the DEFAULT that
--     pre-fills the staff day picker, not the customer's choice.
--   * LESSONS ARE UNTOUCHED. Nothing here matches segment = 'rider'.
--
-- The descriptions have to move with the structure: "One exercise session a week"
-- stops being true the moment staff can choose two days.

-- ── the 2x variants stop being customer-selectable ──────────────────────────
UPDATE offerings
   SET active = false
 WHERE segment = 'horse'
   AND config_kind = 'recurring'
   AND weekly_frequency = 2
   AND name IN ('Exercise 2x Weekly', 'Turnout 2x Weekly', 'Training 2x Weekly');

-- ── the surviving weekly SKU is just "Weekly" ───────────────────────────────
UPDATE offerings SET name = 'Exercise Weekly',
       description = 'Exercise sessions on the days we agree with you — billed monthly'
 WHERE segment = 'horse' AND name = 'Exercise 1x Weekly';

UPDATE offerings SET name = 'Turnout Weekly',
       description = 'Turnouts on the days we agree with you — billed monthly'
 WHERE segment = 'horse' AND name = 'Turnout 1x Weekly';

UPDATE offerings SET name = 'Training Weekly',
       description = 'Training sessions on the days we agree with you — billed monthly'
 WHERE segment = 'horse' AND name = 'Training 1x Weekly';

-- The slug is NOT touched. Slugs here are opaque ("horse-exercise--item-73441c62"),
-- they carry no frequency, and they are the stable handle a cart line and any saved
-- link resolve by. Renaming the display name must not break either.
