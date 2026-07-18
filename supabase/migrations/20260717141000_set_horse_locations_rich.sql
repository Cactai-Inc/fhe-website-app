-- set_horse_locations gains a rich payload: for home and (optional) current, the
-- location name + structured address (on the shared location record) and the
-- per-horse detail (barn/stall, notes, trainer, care_giver, groom, other person).
-- Backward-compatible overload kept (name-only) so existing callers don't break.

-- new rich form: p_payload = {
--   home:    { name, address_line1, city, state, postal, barn_stall, notes,
--              trainer, care_giver, groom, other },
--   current: { ...same... } | null    -- null/absent => current == home
-- }
CREATE OR REPLACE FUNCTION public.set_horse_locations(p_horse_id uuid, p_payload jsonb)
 RETURNS void
 LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  v_org uuid; v_owner uuid; v_me uuid := current_contact_id(); v_staff boolean := has_staff_access();
  v_target_owner uuid;
  v_home_id uuid; v_curr_id uuid;
  v_home jsonb := p_payload -> 'home';
  v_curr jsonb := p_payload -> 'current';
BEGIN
  SELECT org_id, current_owner_contact_id INTO v_org, v_owner FROM horses WHERE id = p_horse_id AND deleted_at IS NULL;
  IF v_org IS NULL THEN RAISE EXCEPTION 'unknown horse'; END IF;
  IF NOT (v_staff AND v_org = current_org()) THEN
    IF v_me IS NULL OR v_me NOT IN (
      (SELECT current_owner_contact_id FROM horses WHERE id = p_horse_id),
      (SELECT lessee_contact_id FROM horses WHERE id = p_horse_id)
    ) THEN RAISE EXCEPTION 'not authorized for this horse'; END IF;
  END IF;
  v_target_owner := coalesce(v_owner, v_me);

  -- HOME
  IF v_home IS NOT NULL AND nullif(btrim(v_home ->> 'name'), '') IS NOT NULL THEN
    v_home_id := public._resolve_location(v_org, v_target_owner, v_home);
  END IF;

  -- CURRENT (only when provided AND distinct); otherwise current mirrors home
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
      home_barn_stall      = v_home ->> 'barn_stall',
      home_location_notes  = v_home ->> 'notes',
      home_trainer         = v_home ->> 'trainer',
      home_care_giver      = v_home ->> 'care_giver',
      home_groom           = v_home ->> 'groom',
      home_other_person    = v_home ->> 'other',
      current_barn_stall   = v_curr ->> 'barn_stall',
      current_location_notes = v_curr ->> 'notes',
      current_trainer      = v_curr ->> 'trainer',
      current_care_giver   = v_curr ->> 'care_giver',
      current_groom        = v_curr ->> 'groom',
      current_other_person = v_curr ->> 'other',
      updated_at = now()
   WHERE id = p_horse_id;
END;
$function$;

-- helper: find-or-create a location by name for the owner and update its structured address
CREATE OR REPLACE FUNCTION public._resolve_location(p_org uuid, p_owner uuid, p_loc jsonb)
 RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE v_id uuid; v_name text := btrim(p_loc ->> 'name');
BEGIN
  IF v_name = '' THEN RETURN NULL; END IF;
  SELECT id INTO v_id FROM locations
   WHERE org_id = p_org AND active AND lower(name) = lower(v_name)
     AND (owner_contact_id IS NULL OR owner_contact_id = p_owner)
   ORDER BY (owner_contact_id IS NULL) DESC LIMIT 1;
  IF v_id IS NULL THEN
    INSERT INTO locations (org_id, name, owner_contact_id, is_offsite, is_default, active,
                           address_line1, city, state, postal)
    VALUES (p_org, v_name, p_owner, false, false, true,
            nullif(p_loc ->> 'address_line1',''), nullif(p_loc ->> 'city',''),
            nullif(p_loc ->> 'state',''), nullif(p_loc ->> 'postal',''))
    RETURNING id INTO v_id;
  ELSE
    -- update address on the existing record when new parts are supplied
    UPDATE locations SET
        address_line1 = coalesce(nullif(p_loc ->> 'address_line1',''), address_line1),
        city  = coalesce(nullif(p_loc ->> 'city',''),  city),
        state = coalesce(nullif(p_loc ->> 'state',''), state),
        postal= coalesce(nullif(p_loc ->> 'postal',''),postal)
     WHERE id = v_id;
  END IF;
  RETURN v_id;
END;
$function$;
GRANT EXECUTE ON FUNCTION public.set_horse_locations(uuid, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public._resolve_location(uuid, uuid, jsonb) TO authenticated;
