-- Disclosure reciprocity, phase 1: the record-side schema for the seven sections.
-- Injuries to the horse is its own list, separate from medical history. Medications
-- and supplements gain a conditions-of-use note. The settled entry shapes are stored
-- as jsonb; description is the only required field in any section.

-- Injuries to the horse — dated events, separate from medical history.
ALTER TABLE public.horses
  ADD COLUMN IF NOT EXISTS injuries_to_horse jsonb NOT NULL DEFAULT '[]'::jsonb;

-- Medications / supplements: a conditions-of-use note alongside the library structure.
ALTER TABLE public.horse_medications
  ADD COLUMN IF NOT EXISTS conditions_of_use text;

-- The existing injuries_to_humans entries use {date, person_type, description, outcome}.
-- The settled shape is {date, was_riding, description, outcome}. Migrate person_type
-- ('rider' => was_riding true) without losing anything; keep description/outcome/date.
UPDATE public.horses h
   SET injuries_to_humans = (
     SELECT coalesce(jsonb_agg(
       jsonb_strip_nulls(jsonb_build_object(
         'date', e->>'date',
         'was_riding', CASE WHEN e ? 'was_riding' THEN (e->>'was_riding')::boolean
                            WHEN lower(coalesce(e->>'person_type','')) = 'rider' THEN true
                            WHEN lower(coalesce(e->>'person_type','')) = 'non-rider' THEN false
                            ELSE NULL END,
         'description', e->>'description',
         'outcome', e->>'outcome'))), '[]'::jsonb)
     FROM jsonb_array_elements(h.injuries_to_humans) e)
 WHERE jsonb_array_length(coalesce(h.injuries_to_humans,'[]'::jsonb)) > 0;
