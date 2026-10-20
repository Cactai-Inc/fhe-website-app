-- The booking instructor picker lists people carrying the INSTRUCTOR designation,
-- not every staff profile. Designations are the single source of who appears on a
-- staff picker (horse care team, additional contacts, and booking assignment alike).

CREATE OR REPLACE FUNCTION public.instructor_options()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE v_org uuid := current_org();
BEGIN
  IF NOT has_staff_access() THEN RAISE EXCEPTION 'operator access required'; END IF;
  RETURN (
    SELECT coalesce(jsonb_agg(jsonb_build_object(
        'user_id', x.user_id,
        'name',    x.name,
        'title',   x.title) ORDER BY x.name), '[]'::jsonb)
      FROM (
        SELECT p.user_id,
               coalesce(
                 nullif(btrim(coalesce(c.first_name,'') || ' ' || coalesce(c.last_name,'')), ''),
                 nullif(btrim(coalesce(p.display_name,'')), ''),
                 c.email, 'Staff') AS name,
               p.title
          FROM staff_designations d
          JOIN contacts c ON c.id = d.contact_id
          JOIN profiles p ON p.contact_id = c.id
         WHERE d.org_id = v_org AND d.designation = 'instructor'
           AND p.org_id = v_org
           AND c.deleted_at IS NULL
      ) x);
END;
$function$;
