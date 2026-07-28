-- Stage 3d (REMEDIATION_PLAN): parties on the horse record drive account
-- visibility, reading the Stage-1 survivor table. caller_owns_horse now
-- accepts an active OWNER / LESSEE / LESSOR horse_relationships row alongside
-- the maintained horses columns (staff already exempt at every call site via
-- has_staff_access()). Listing rights (can_list_horse) stay owner/lessee/
-- sublease per the executed lease — those columns are themselves maintained
-- from the survivor table's write paths.
CREATE OR REPLACE FUNCTION public.caller_owns_horse(h_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
  SELECT current_contact_id() IS NOT NULL AND EXISTS (
    SELECT 1 FROM horses h
    WHERE h.id = h_id
      AND h.deleted_at IS NULL
      AND (h.current_owner_contact_id = current_contact_id()
           OR h.lessee_contact_id = current_contact_id()
           OR EXISTS (SELECT 1 FROM horse_relationships hr
                       WHERE hr.horse_id = h.id
                         AND hr.party_contact_id = current_contact_id()
                         AND hr.active
                         AND hr.relationship IN ('OWNER','LESSEE','LESSOR')
                         AND (hr.term_end IS NULL OR hr.term_end >= current_date)))
  );
$function$;
