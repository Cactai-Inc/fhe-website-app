-- CR-126: set_horse_locations now persists keeping_spots (the unbounded list) and
-- vaccinations, and DERIVES the legacy home_barn/home_stall/current_barn/current_stall
-- from the list so existing readers (contract merge, HorsePage, HorseRecordsPage)
-- keep resolving a barn/stall string without change. The list is the source of truth;
-- the flat columns are a computed mirror of the first Barn/Stable and first Stall/Pen.

CREATE OR REPLACE FUNCTION public.set_horse_locations(p_horse_id uuid, p_payload jsonb)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_org uuid; v_owner uuid; v_me uuid := current_contact_id(); v_staff boolean := has_staff_access();
  v_target_owner uuid;
  v_home_id uuid; v_curr_id uuid;
  v_home jsonb := p_payload -> 'home';
  v_curr jsonb := p_payload -> 'current';
  v_vacc jsonb := p_payload -> 'vaccinations';
BEGIN
  SELECT org_id, current_owner_contact_id INTO v_org, v_owner FROM horses WHERE id = p_horse_id AND deleted_at IS NULL;
  IF v_org IS NULL THEN RAISE EXCEPTION 'unknown horse'; END IF;
  IF NOT coalesce(v_staff AND v_org = current_org(), false) THEN
    IF v_me IS NULL OR v_me NOT IN (
      (SELECT current_owner_contact_id FROM horses WHERE id = p_horse_id),
      (SELECT lessee_contact_id FROM horses WHERE id = p_horse_id)
    ) THEN RAISE EXCEPTION 'not authorized for this horse'; END IF;
  END IF;
  v_target_owner := coalesce(v_owner, v_me);

  IF v_home IS NOT NULL AND nullif(btrim(v_home ->> 'name'), '') IS NOT NULL THEN
    v_home_id := public._resolve_location(v_org, v_target_owner, v_home);
  END IF;

  IF v_curr IS NOT NULL AND nullif(btrim(v_curr ->> 'name'), '') IS NOT NULL THEN
    v_curr_id := public._resolve_location(v_org, v_target_owner, v_curr);
  ELSE
    v_curr_id := v_home_id;
    v_curr := v_home;
  END IF;

  UPDATE horses SET
      home_location_id     = coalesce(v_home_id, home_location_id),
      current_location_id  = coalesce(v_curr_id, current_location_id),
      current_location     = coalesce((SELECT name FROM locations WHERE id = v_curr_id), current_location),

      home_keeping_spots    = coalesce(v_home -> 'keeping_spots', '[]'::jsonb),
      current_keeping_spots = coalesce(v_curr -> 'keeping_spots', '[]'::jsonb),

      -- legacy mirror: first Barn/Stable and first Stall/Pen, composed "<term> <value>"
      home_barn = public._first_spot_string(v_home -> 'keeping_spots', ARRAY['Barn','Stable']),
      home_stall = public._first_spot_string(v_home -> 'keeping_spots', ARRAY['Stall','Pen']),
      current_barn = public._first_spot_string(v_curr -> 'keeping_spots', ARRAY['Barn','Stable']),
      current_stall = public._first_spot_string(v_curr -> 'keeping_spots', ARRAY['Stall','Pen']),

      home_location_notes  = v_home ->> 'notes',
      home_trainer         = v_home ->> 'trainer',
      home_care_giver      = v_home ->> 'care_giver',
      home_groom           = v_home ->> 'groom',
      home_other_person    = v_home ->> 'other',
      current_location_notes = v_curr ->> 'notes',
      current_trainer      = v_curr ->> 'trainer',
      current_care_giver   = v_curr ->> 'care_giver',
      current_groom        = v_curr ->> 'groom',
      current_other_person = v_curr ->> 'other',

      vaccinations = CASE WHEN v_vacc IS NOT NULL THEN v_vacc ELSE vaccinations END,
      updated_at = now()
   WHERE id = p_horse_id;
END;
$function$;

-- helper: the first spot whose term is in the allowed set, composed as "<term> <value>"
CREATE OR REPLACE FUNCTION public._first_spot_string(p_spots jsonb, p_terms text[])
 RETURNS text
 LANGUAGE sql
 IMMUTABLE
AS $function$
  SELECT btrim(concat_ws(' ', spot ->> 'term', nullif(btrim(spot ->> 'value'), '')))
  FROM jsonb_array_elements(coalesce(p_spots, '[]'::jsonb)) spot
  WHERE spot ->> 'term' = ANY(p_terms)
  LIMIT 1;
$function$;

-- fresh functions inherit anon via PUBLIC default privileges; keep the helper off the public surface
REVOKE EXECUTE ON FUNCTION public._first_spot_string(jsonb, text[]) FROM PUBLIC;
