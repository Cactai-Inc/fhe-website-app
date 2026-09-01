-- RICH LOCATION MODEL. A horse's location must be actually findable: a structured
-- address on the shared place record, plus THIS horse's barn/stall, findability
-- notes, and on-site people (which vary per horse even at the same barn).

-- 1. structured address on the shared location record (address is always structured) --
ALTER TABLE public.locations ADD COLUMN IF NOT EXISTS address_line1 text;
ALTER TABLE public.locations ADD COLUMN IF NOT EXISTS city text;
ALTER TABLE public.locations ADD COLUMN IF NOT EXISTS state text;
ALTER TABLE public.locations ADD COLUMN IF NOT EXISTS postal text;

-- 2. per-horse detail for home + current locations (barn/stall, notes, care people) --
--    Stored on the horse because Stall B-12 / "gate code 4432" / trainer Jane are
--    specific to this horse, not the barn.
ALTER TABLE public.horses ADD COLUMN IF NOT EXISTS home_barn_stall text;
ALTER TABLE public.horses ADD COLUMN IF NOT EXISTS home_location_notes text;
ALTER TABLE public.horses ADD COLUMN IF NOT EXISTS home_trainer text;
ALTER TABLE public.horses ADD COLUMN IF NOT EXISTS home_care_giver text;
ALTER TABLE public.horses ADD COLUMN IF NOT EXISTS home_groom text;
ALTER TABLE public.horses ADD COLUMN IF NOT EXISTS home_other_person text;

ALTER TABLE public.horses ADD COLUMN IF NOT EXISTS current_barn_stall text;
ALTER TABLE public.horses ADD COLUMN IF NOT EXISTS current_location_notes text;
ALTER TABLE public.horses ADD COLUMN IF NOT EXISTS current_trainer text;
ALTER TABLE public.horses ADD COLUMN IF NOT EXISTS current_care_giver text;
ALTER TABLE public.horses ADD COLUMN IF NOT EXISTS current_groom text;
ALTER TABLE public.horses ADD COLUMN IF NOT EXISTS current_other_person text;

-- 3. remove the seeded "FHE Main Barn Stall 12" location (barn/stall is now per-horse,
--    not a place name). Deactivate rather than hard-delete in case anything references it.
UPDATE public.locations SET active = false WHERE name = 'FHE Main Barn Stall 12';
