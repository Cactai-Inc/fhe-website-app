# Spec B — Horse Schema Columns

Goal: add the horse columns the merge engine (v9) and the new lease template reference, so those tokens resolve instead of rendering blank.

## B.1 Problem
`horses` (defined in `20260629030000_engagements_horses_backbone.sql`) has `registered_name`, `barn_name`, `breed`, `color`, `sex`, `date_of_birth`, `height`, `registration_number`, `microchip_id`, `current_location`. It does NOT have `vet_name`, `vet_phone`, `farrier_name`, `farrier_phone`, or `fair_market_value`. But:
- `generate_document` v9 (`20260703030000_rider_onboarding.sql`) already reads `v_horse.vet_name / vet_phone / farrier_name / farrier_phone` in its HORSE arm — these currently resolve to NULL→blank because the columns don't exist as written (verify: if v9 references non-existent columns the function would error at runtime; confirm whether the columns were added by a later migration this project hasn't read, and if not, add them).
- The new `HORSE_LEASE.md` references `{{HORSE.FAIR_MARKET_VALUE}}`, `{{HORSE.VET_NAME}}`, `{{HORSE.VET_PHONE}}`, `{{HORSE.FARRIER_NAME}}`, `{{HORSE.FARRIER_PHONE}}`.

## B.2 Change — additive migration
New migration (timestamp after `20260705020000`), additive only:

```
-- 202607xxxxxxxx_horse_care_and_value_columns.sql
ALTER TABLE horses ADD COLUMN IF NOT EXISTS fair_market_value numeric;
ALTER TABLE horses ADD COLUMN IF NOT EXISTS vet_name         text;
ALTER TABLE horses ADD COLUMN IF NOT EXISTS vet_phone        text;
ALTER TABLE horses ADD COLUMN IF NOT EXISTS farrier_name     text;
ALTER TABLE horses ADD COLUMN IF NOT EXISTS farrier_phone    text;
```

No backfill (nullable; render blank when absent, which is the fillable-blank behavior). RLS is inherited from the existing `horses` policies; adding columns needs no policy change.

## B.3 Extend generate_document HORSE arm for fair_market_value
v9 already resolves vet/farrier. Add the one missing arm. In the next `generate_document` CREATE OR REPLACE (this project will already be replacing it for GAP C — fold this in there, do not write a separate replacement), add to the HORSE CASE:

```
WHEN 'FAIR_MARKET_VALUE' THEN fmt_money(v_horse.fair_market_value)
```

`fmt_money` already exists (used for TXN money tokens in v9). If for any reason GAP C does not end up replacing `generate_document`, then add a dedicated CREATE OR REPLACE here that adds only this arm.

## B.4 Token dictionary
Add to `docs/TOKEN_DICTIONARY.md` HORSE namespace: `HORSE.FAIR_MARKET_VALUE` (current fair market value; lease, and available to purchase/transfer if desired). `HORSE.VET_NAME/VET_PHONE/FARRIER_NAME/FARRIER_PHONE` are already implied by v9; add them explicitly if not present.

## B.5 Acceptance
- The five columns exist on `horses`.
- Generating a lease for a horse with these values populated renders them; with them null renders blank (no leftover token).
