-- LEASE TEMPLATE ROUND item 3 — location save stores a crammed single line.
--
-- A known location picked in a contract location field saved only { name, line1 } with
-- the WHOLE address jammed into line1 (city/state/postal empty), because my_locations()
-- returned only the pre-combined `address` text — the UI had no structured parts to
-- store. The locations table already holds address_line1/city/state/postal. Return them
-- so the picker can store a real structured address and reopen showing the known
-- selection. Signature change requires DROP+CREATE; re-REVOKE from PUBLIC and re-GRANT
-- to anon/authenticated exactly as before (DROP+CREATE resets ACLs — known trap).

BEGIN;

DROP FUNCTION IF EXISTS public.my_locations();

CREATE FUNCTION public.my_locations()
 RETURNS TABLE(id uuid, name text, address text, address_line1 text, city text,
               state text, postal text, is_offsite boolean, is_default boolean, is_mine boolean)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT l.id, l.name, l.address, l.address_line1, l.city, l.state, l.postal,
         l.is_offsite, l.is_default,
         (l.owner_contact_id IS NOT NULL) AS is_mine
  FROM locations l
  WHERE l.org_id = current_org()
    AND l.active
    AND (l.owner_contact_id IS NULL OR l.owner_contact_id = current_contact_id())
  ORDER BY l.is_default DESC, (l.owner_contact_id IS NOT NULL), l.sort_order, l.name
$function$;

REVOKE ALL ON FUNCTION public.my_locations() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.my_locations() TO anon, authenticated, service_role;

COMMIT;
