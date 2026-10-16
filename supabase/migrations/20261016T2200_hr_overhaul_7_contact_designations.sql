-- The designations a given contact carries, for the Team page editor (staff only).
CREATE OR REPLACE FUNCTION public.contact_designations(p_contact uuid)
 RETURNS text[]
 LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
  SELECT coalesce(array_agg(designation ORDER BY designation), '{}')
  FROM staff_designations
  WHERE org_id = current_org() AND contact_id = p_contact AND has_staff_access();
$function$;
REVOKE EXECUTE ON FUNCTION public.contact_designations(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.contact_designations(uuid) TO authenticated, service_role;
