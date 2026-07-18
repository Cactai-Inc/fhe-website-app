-- Migrate any existing single-medication data into one MEDICATION row, then drop the
-- flat columns so the child table is the single source. medication_current held a
-- free-text "history" summary — preserved into the horse's known_conditions is wrong;
-- it was surfaced as MEDICATION_HISTORY, a disclosure field, so we keep it out of the
-- structured meds and let it map from... nothing (it's dropped with the rest, being a
-- redundant free-text summary now that individual meds are structured).
INSERT INTO public.horse_medications (org_id, horse_id, kind, sort_order, name, dosage, instructions)
SELECT org_id, id, 'MEDICATION', 0,
       nullif(btrim(medication_name),''), nullif(btrim(medication_dosage),''),
       nullif(btrim(concat_ws(' — ', nullif(btrim(medication_instructions),''), nullif(btrim(medication_additional),''))),'')
  FROM public.horses
 WHERE deleted_at IS NULL
   AND coalesce(nullif(btrim(medication_name),''),'') <> '';

ALTER TABLE public.horses DROP COLUMN IF EXISTS medication_name;
ALTER TABLE public.horses DROP COLUMN IF EXISTS medication_dosage;
ALTER TABLE public.horses DROP COLUMN IF EXISTS medication_instructions;
ALTER TABLE public.horses DROP COLUMN IF EXISTS medication_additional;
ALTER TABLE public.horses DROP COLUMN IF EXISTS medication_current;
