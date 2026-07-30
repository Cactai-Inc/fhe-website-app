-- ─────────────────────────────────────────────────────────────────────────────
-- ADD-HORSE: MARKINGS GO TO markings, NOT medical_history (2026-07-30)
--
-- The member-facing Add-Horse modal collects "Markings / notes" and (until this
-- change) "Discipline". src/lib/stable.ts concatenated the two with ' · ' and
-- passed them as p_notes, which my_stable_add_horse mapped onto
-- create_horse_record's `medical_history`.
--
-- Two things wrong with that:
--   • `horses.markings` is a REAL column that the intake form, the record page
--     and the HORSE.MARKINGS merge token all read. Markings entered here never
--     reached it, so they were invisible everywhere afterwards.
--   • medical_history is medically significant — it is surfaced to staff and
--     rendered into documents. Silently seeding it with "Hunter · Star and left
--     hind sock" pollutes a clinical field with cosmetic data.
--
-- There is no `discipline` column on horses (verified), so that input was
-- collecting data with nowhere to go. It is removed from the form in the same
-- commit rather than left to look functional.
--
-- p_notes is KEPT (a member may legitimately have medical notes to add) but is
-- no longer overloaded: the client now sends markings separately.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.my_stable_add_horse(
  p_name text,
  p_barn_name text DEFAULT NULL,
  p_breed text DEFAULT NULL,
  p_sex text DEFAULT NULL,
  p_height text DEFAULT NULL,
  p_dob date DEFAULT NULL,
  p_color text DEFAULT NULL,
  p_location text DEFAULT NULL,
  p_notes text DEFAULT NULL,
  p_markings text DEFAULT NULL)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_res jsonb;
BEGIN
  v_res := create_horse_record(jsonb_strip_nulls(jsonb_build_object(
    'registered_name', p_name,
    'nickname', p_barn_name,
    'breed', p_breed,
    'sex', p_sex,
    'height', p_height,
    'date_of_birth', p_dob,
    'color', p_color,
    'current_location', coalesce(p_location, 'Carmel Creek Ranch'),
    'markings', p_markings,
    'medical_history', p_notes
  )));
  -- return the horse id for both created + matched outcomes (back-compat).
  RETURN (v_res->>'horse_id')::uuid;
END;
$function$;

-- Drop the previous 9-arg form so the new 10-arg one cannot be shadowed by an
-- ambiguous-overload error — the same defect this audit just fixed on
-- staff_assign_horse_party. Guarded so a re-run is a no-op.
DO $do$
BEGIN
  IF (SELECT count(*) FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
       WHERE n.nspname = 'public' AND p.proname = 'my_stable_add_horse') > 1 THEN
    DROP FUNCTION public.my_stable_add_horse(text, text, text, text, text, date, text, text, text);
    RAISE NOTICE 'dropped the superseded 9-arg my_stable_add_horse';
  END IF;
END
$do$;
