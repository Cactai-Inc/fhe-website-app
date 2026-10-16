-- Horse records overhaul, phase 6: remove the replaced columns. Vet/farrier and the
-- care team now live in horse_relationships; location in horse_locations; the five
-- narratives in their list columns. Every reader has been re-pointed.

-- This trigger normalised horses.vet_phone / farrier_phone, which are being removed
-- (phones live on horse_relationships now). Drop it before the columns.
DROP TRIGGER IF EXISTS horses_normalise_phone_trg ON public.horses;

ALTER TABLE public.horses
  DROP COLUMN IF EXISTS vet_name,
  DROP COLUMN IF EXISTS vet_phone,
  DROP COLUMN IF EXISTS vet_business_name,
  DROP COLUMN IF EXISTS vet_address_line1,
  DROP COLUMN IF EXISTS vet_city,
  DROP COLUMN IF EXISTS vet_state,
  DROP COLUMN IF EXISTS vet_postal,
  DROP COLUMN IF EXISTS farrier_name,
  DROP COLUMN IF EXISTS farrier_phone,
  DROP COLUMN IF EXISTS home_location_id,
  DROP COLUMN IF EXISTS current_location_id,
  DROP COLUMN IF EXISTS home_barn,
  DROP COLUMN IF EXISTS home_stall,
  DROP COLUMN IF EXISTS current_barn,
  DROP COLUMN IF EXISTS current_stall,
  DROP COLUMN IF EXISTS home_keeping_spots,
  DROP COLUMN IF EXISTS current_keeping_spots,
  DROP COLUMN IF EXISTS home_location_notes,
  DROP COLUMN IF EXISTS current_location_notes,
  DROP COLUMN IF EXISTS home_trainer,
  DROP COLUMN IF EXISTS home_care_giver,
  DROP COLUMN IF EXISTS home_groom,
  DROP COLUMN IF EXISTS home_other_person,
  DROP COLUMN IF EXISTS current_trainer,
  DROP COLUMN IF EXISTS current_care_giver,
  DROP COLUMN IF EXISTS current_groom,
  DROP COLUMN IF EXISTS current_other_person,
  DROP COLUMN IF EXISTS medical_history,
  DROP COLUMN IF EXISTS behavioral_history,
  DROP COLUMN IF EXISTS known_conditions,
  DROP COLUMN IF EXISTS training_history,
  DROP COLUMN IF EXISTS competition_history;

-- Provider phones are normalised on write, the same way the horse phone columns were.
DROP TRIGGER IF EXISTS horse_relationships_normalise_phone_trg ON public.horse_relationships;
CREATE TRIGGER horse_relationships_normalise_phone_trg
  BEFORE INSERT OR UPDATE OF phone ON public.horse_relationships
  FOR EACH ROW EXECUTE FUNCTION normalise_phone_columns('phone');

-- _resolve_location and _first_spot_string supported the old location columns and
-- have no remaining caller.
DROP FUNCTION IF EXISTS public._resolve_location(uuid, uuid, jsonb);
DROP FUNCTION IF EXISTS public._first_spot_string(jsonb, text[]);
