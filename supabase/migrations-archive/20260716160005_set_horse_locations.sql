-- Resolve a horse's Home and Current locations (by name) to real `locations` rows
-- and set home_location_id / current_location_id. Called after the horse form saves
-- so the three-location model is populated without rewriting create_horse_record.
--
-- Names are resolved against barn-wide locations first, then the horse owner's
-- personal ones; an unmatched name creates a personal location for the owner (or
-- a barn-wide one when staff act with no distinct owner). Also keeps the legacy
-- current_location text in sync so nothing regresses.

CREATE OR REPLACE FUNCTION public.set_horse_locations(
  p_horse_id uuid,
  p_home_name text DEFAULT NULL,
  p_current_name text DEFAULT NULL
)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_org   uuid;
  v_owner uuid;
  v_me    uuid := current_contact_id();
  v_staff boolean := has_staff_access();

  v_home uuid;
  v_curr uuid;

  -- resolve a name → location id (barn-wide or the owner's personal; create if new)
  v_target_owner uuid;
BEGIN
  SELECT org_id, current_owner_contact_id INTO v_org, v_owner
    FROM horses WHERE id = p_horse_id AND deleted_at IS NULL;
  IF v_org IS NULL THEN RAISE EXCEPTION 'unknown horse'; END IF;

  -- authorization: staff, or the horse's owner/lessee
  IF NOT (v_staff AND v_org = current_org()) THEN
    IF v_me IS NULL OR v_me NOT IN (
      (SELECT current_owner_contact_id FROM horses WHERE id = p_horse_id),
      (SELECT lessee_contact_id FROM horses WHERE id = p_horse_id)
    ) THEN
      RAISE EXCEPTION 'not authorized for this horse';
    END IF;
  END IF;

  -- personal locations attach to the owner (fallback: the acting contact)
  v_target_owner := coalesce(v_owner, v_me);

  IF nullif(btrim(p_home_name), '') IS NOT NULL THEN
    SELECT id INTO v_home FROM locations
     WHERE org_id = v_org AND active AND lower(name) = lower(btrim(p_home_name))
       AND (owner_contact_id IS NULL OR owner_contact_id = v_target_owner)
     ORDER BY (owner_contact_id IS NULL) DESC LIMIT 1;
    IF v_home IS NULL THEN
      INSERT INTO locations (org_id, name, owner_contact_id, is_offsite, is_default, active)
      VALUES (v_org, btrim(p_home_name), v_target_owner, false, false, true)
      RETURNING id INTO v_home;
    END IF;
  END IF;

  IF nullif(btrim(p_current_name), '') IS NOT NULL THEN
    SELECT id INTO v_curr FROM locations
     WHERE org_id = v_org AND active AND lower(name) = lower(btrim(p_current_name))
       AND (owner_contact_id IS NULL OR owner_contact_id = v_target_owner)
     ORDER BY (owner_contact_id IS NULL) DESC LIMIT 1;
    IF v_curr IS NULL THEN
      INSERT INTO locations (org_id, name, owner_contact_id, is_offsite, is_default, active)
      VALUES (v_org, btrim(p_current_name), v_target_owner, false, false, true)
      RETURNING id INTO v_curr;
    END IF;
  END IF;

  UPDATE horses
     SET home_location_id    = coalesce(v_home, home_location_id),
         current_location_id = coalesce(v_curr, current_location_id),
         current_location    = coalesce(nullif(btrim(p_current_name), ''), current_location),
         updated_at = now()
   WHERE id = p_horse_id;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.set_horse_locations(uuid, text, text) TO authenticated;
