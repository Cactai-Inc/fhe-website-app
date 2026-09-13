-- 20260912T1900 — offerings carry a duration, so a session has a real length.
--
-- AR1 measured that `offerings` has NO duration column and nothing records how
-- long a service takes — which is why 72 of 75 scheduled bookings are exactly 60
-- minutes and the 90-minute evaluation has never been drawn. The remastered
-- calendar sizes a block by its true duration and applies the offering's length
-- when staff pick it, so the length has to live somewhere. Here.
--
-- Additive: a nullable-with-default column. 60 is the safe default (what every
-- booking already is). Evaluations get 90 by name match — the one service the
-- report named as longer — but this is owner-editable data going forward
-- (D13/D21: it belongs in the Products/offering editor, wired in a follow-up if
-- not already present; the column is the spine that makes that editable).
ALTER TABLE public.offerings
  ADD COLUMN IF NOT EXISTS duration_minutes integer NOT NULL DEFAULT 60
    CHECK (duration_minutes > 0 AND duration_minutes <= 24 * 60);

-- Seed the one known longer service. Evaluations are 90 minutes (AR1). Match by
-- name and by the evaluation config_kind so a renamed SKU still lands.
UPDATE public.offerings
   SET duration_minutes = 90
 WHERE (name ILIKE '%evaluation%' OR config_kind = 'intake_evaluation')
   AND duration_minutes = 60;
