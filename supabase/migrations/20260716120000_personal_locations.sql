-- Locations become per-person-extensible. Today `locations` is org-wide and
-- staff-write-only (one row: Carmel Creek Ranch, the barn default). A member who
-- adds their own location should see it ONLY on their own future horses/bookings —
-- it must NOT become a global option for everyone.
--
-- Model: owner_contact_id NULL = a barn-wide location (managed by staff, visible
-- to all). owner_contact_id SET = a personal location, visible and editable only
-- to that member. Everyone sees: barn locations + their own.

ALTER TABLE locations
  ADD COLUMN IF NOT EXISTS owner_contact_id uuid REFERENCES contacts(id) ON DELETE CASCADE;

-- Read: barn-wide (owner null) OR mine.
DROP POLICY IF EXISTS locations_read ON locations;
CREATE POLICY locations_read ON locations
  FOR SELECT USING (
    org_id = current_org()
    AND (owner_contact_id IS NULL OR owner_contact_id = current_contact_id())
  );

-- Write barn-wide locations: staff only (unchanged intent).
DROP POLICY IF EXISTS locations_write ON locations;
CREATE POLICY locations_write_barn ON locations
  FOR ALL USING (org_id = current_org() AND owner_contact_id IS NULL AND has_staff_access())
  WITH CHECK (org_id = current_org() AND owner_contact_id IS NULL AND has_staff_access());

-- Write your OWN personal locations: any member, only their own rows.
DROP POLICY IF EXISTS locations_write_own ON locations;
CREATE POLICY locations_write_own ON locations
  FOR ALL USING (org_id = current_org() AND owner_contact_id = current_contact_id())
  WITH CHECK (org_id = current_org() AND owner_contact_id = current_contact_id());

-- Reader: barn locations + the caller's own, barn default first.
CREATE OR REPLACE FUNCTION public.my_locations()
 RETURNS TABLE(id uuid, name text, address text, is_offsite boolean, is_default boolean, is_mine boolean)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT l.id, l.name, l.address, l.is_offsite, l.is_default,
         (l.owner_contact_id IS NOT NULL) AS is_mine
  FROM locations l
  WHERE l.org_id = current_org()
    AND l.active
    AND (l.owner_contact_id IS NULL OR l.owner_contact_id = current_contact_id())
  ORDER BY l.is_default DESC, (l.owner_contact_id IS NOT NULL), l.sort_order, l.name
$function$;

GRANT EXECUTE ON FUNCTION public.my_locations() TO authenticated;

-- Add a personal location for the signed-in member; returns its id. De-dups on
-- (name, owner) so re-adding the same name reuses it.
CREATE OR REPLACE FUNCTION public.add_my_location(p_name text, p_address text DEFAULT NULL)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_me  uuid := current_contact_id();
  v_org uuid := current_org();
  v_id  uuid;
BEGIN
  IF v_me IS NULL OR v_org IS NULL THEN RAISE EXCEPTION 'sign in first'; END IF;
  p_name := nullif(btrim(p_name), '');
  IF p_name IS NULL THEN RAISE EXCEPTION 'a location name is required'; END IF;

  SELECT id INTO v_id FROM locations
   WHERE org_id = v_org AND owner_contact_id = v_me AND lower(name) = lower(p_name) AND active
   LIMIT 1;
  IF v_id IS NOT NULL THEN RETURN v_id; END IF;

  INSERT INTO locations (org_id, name, address, owner_contact_id, is_offsite, is_default, active)
  VALUES (v_org, p_name, nullif(btrim(p_address), ''), v_me, false, false, true)
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.add_my_location(text, text) TO authenticated;
