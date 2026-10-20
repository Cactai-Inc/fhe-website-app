-- Revert the booking staff-assignment picker to listing the staff who work here.
-- Who delivers a booking — a lesson, a turnout, a clipping — is Claire or whichever
-- staff member is doing it; it is not gated by a designation. The designation model
-- belongs to the horse-record pickers (trainer / groom / care giver on a horse),
-- where it prevents listing unrelated people; it does not belong here. This restores
-- the original behaviour: every active staff profile.

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
          FROM profiles p
          LEFT JOIN contacts c ON c.id = p.contact_id
         WHERE p.org_id = v_org
           AND coalesce(p.staff_active, false)
           AND p.role IN ('ADMIN','MANAGER','EMPLOYEE')
           AND (c.id IS NULL OR c.deleted_at IS NULL)
      ) x);
END;
$function$;

-- Remove the instructor designations I seeded onto Claire and CJ; the picker no
-- longer depends on them, and they were an unrequested write.
DELETE FROM public.staff_designations
 WHERE designation = 'instructor'
   AND contact_id IN (
     SELECT c.id FROM contacts c
      WHERE c.email IN ('hello@fhequestrian.com','admin@fhequestrian.com'));
