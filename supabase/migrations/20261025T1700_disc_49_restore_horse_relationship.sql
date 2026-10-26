-- disc_49 (fix round item 6a): ENDING a party relationship is reversible. The
-- ledger already ENDS rows (staff_end_horse_relationship sets active=false,
-- ended_at) rather than deleting them; this is the matching restore, so the
-- parties page can offer an undo right after an End. Single transaction.

BEGIN;

CREATE OR REPLACE FUNCTION public.staff_restore_horse_relationship(p_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT has_staff_access() THEN
    RAISE EXCEPTION 'staff access required';
  END IF;
  UPDATE horse_relationships SET active = true, ended_at = NULL
   WHERE id = p_id AND org_id = current_org() AND NOT active;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'relationship not found or already active';
  END IF;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.staff_restore_horse_relationship(uuid) TO authenticated;

COMMIT;
