-- Disclosure reciprocity, phase 12: create/update horse record accept injuries_to_horse.

DO $c$
DECLARE v_def text;
BEGIN
  SELECT pg_get_functiondef('public.create_horse_record(jsonb)'::regprocedure) INTO v_def;
  v_def := replace(v_def,
    'training_history_list, competition_history_list, injuries_to_humans,',
    'training_history_list, competition_history_list, injuries_to_humans, injuries_to_horse,');
  v_def := replace(v_def,
    $old$    coalesce(p -> 'injuries_to_humans', '[]'::jsonb),
    v_me, v_me, v_owner_text,$old$,
    $new$    coalesce(p -> 'injuries_to_humans', '[]'::jsonb),
    coalesce(p -> 'injuries_to_horse', '[]'::jsonb),
    v_me, v_me, v_owner_text,$new$);
  EXECUTE v_def;
END $c$;

DO $u$
DECLARE v_def text;
BEGIN
  SELECT pg_get_functiondef('public.update_horse_record(uuid,jsonb)'::regprocedure) INTO v_def;
  -- add an injuries_to_horse assignment mirroring injuries_to_humans
  v_def := replace(v_def,
    $old$    injuries_to_humans       = CASE WHEN p ? 'injuries_to_humans'       THEN coalesce(p -> 'injuries_to_humans', '[]'::jsonb)       ELSE injuries_to_humans END,$old$,
    $new$    injuries_to_humans       = CASE WHEN p ? 'injuries_to_humans'       THEN coalesce(p -> 'injuries_to_humans', '[]'::jsonb)       ELSE injuries_to_humans END,
    injuries_to_horse        = CASE WHEN p ? 'injuries_to_horse'        THEN coalesce(p -> 'injuries_to_horse', '[]'::jsonb)        ELSE injuries_to_horse END,$new$);
  EXECUTE v_def;
END $u$;
