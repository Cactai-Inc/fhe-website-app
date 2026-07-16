-- Staff creating a horse record FOR a client should see that CLIENT'S locations
-- (barn-wide + the client's personal ones), not the staff member's own personal
-- locations. my_locations() is scoped to the caller; this staff-only variant is
-- scoped to a named contact.
--
-- Barn-wide locations (owner_contact_id NULL) are always included; personal ones
-- are the named contact's. Staff-gated.

CREATE OR REPLACE FUNCTION public.contact_locations(p_contact_id uuid)
 RETURNS TABLE(id uuid, name text, address text, is_offsite boolean, is_default boolean, is_mine boolean)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT l.id, l.name, l.address, l.is_offsite, l.is_default,
         (l.owner_contact_id = p_contact_id) AS is_mine
  FROM locations l
  WHERE l.org_id = current_org()
    AND l.active
    AND has_staff_access()
    AND (l.owner_contact_id IS NULL OR l.owner_contact_id = p_contact_id)
  ORDER BY l.is_default DESC, (l.owner_contact_id IS NOT NULL), l.sort_order, l.name
$function$;

GRANT EXECUTE ON FUNCTION public.contact_locations(uuid) TO authenticated;

-- Staff add a personal location ON BEHALF OF a client (e.g. capturing where a
-- newly-sold horse will live). Scoped to that contact, staff-gated. De-dups by name.
CREATE OR REPLACE FUNCTION public.add_contact_location(p_contact_id uuid, p_name text, p_address text DEFAULT NULL)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_org uuid := current_org();
  v_id  uuid;
BEGIN
  IF NOT (has_staff_access() AND v_org IS NOT NULL) THEN
    RAISE EXCEPTION 'staff access required';
  END IF;
  IF p_contact_id IS NULL THEN RAISE EXCEPTION 'a contact is required'; END IF;
  p_name := nullif(btrim(p_name), '');
  IF p_name IS NULL THEN RAISE EXCEPTION 'a location name is required'; END IF;

  SELECT id INTO v_id FROM locations
   WHERE org_id = v_org AND owner_contact_id = p_contact_id AND lower(name) = lower(p_name) AND active
   LIMIT 1;
  IF v_id IS NOT NULL THEN RETURN v_id; END IF;

  INSERT INTO locations (org_id, name, address, owner_contact_id, is_offsite, is_default, active)
  VALUES (v_org, p_name, nullif(btrim(p_address), ''), p_contact_id, false, false, true)
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.add_contact_location(uuid, text, text) TO authenticated;
