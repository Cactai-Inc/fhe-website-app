-- RECORDS ARCHIVE — the missing "delete function" on the Horses tab.
--
-- Owner, 2026-08-15: "i need a delete function on the records page." Leads/
-- Partners/Vendors already had one (deleteContact, stranded on the retired
-- ContactsPage — now wired into the shared ContactDirectory every current
-- Records tab uses). Clients already has a full Deactivate/Soft-delete/Hard-
-- delete set (Admin.tsx). Horses had nothing. Owner ruling on "what delete
-- means": archive everywhere (D11 — nothing is purged, only hidden from main
-- views), same as every other soft-delete in this codebase.
--
-- staff_update_horse (existing) explicitly whitelists descriptive columns
-- only and its own WHERE clause requires deleted_at IS NULL — it cannot be
-- reused for this without widening what it accepts, which is a different
-- function's job. A dedicated RPC, matching every other staff-write pattern
-- in this file, is the convergent choice.

CREATE OR REPLACE FUNCTION public.staff_archive_horse(p_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT has_staff_access() THEN RAISE EXCEPTION 'staff access required'; END IF;
  UPDATE horses SET deleted_at = now(), deleted_by = auth.uid()
   WHERE id = p_id AND org_id = current_org() AND deleted_at IS NULL;
  IF NOT FOUND THEN RAISE EXCEPTION 'horse not found in this org, or already archived'; END IF;
END;
$function$;

REVOKE ALL ON FUNCTION public.staff_archive_horse(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.staff_archive_horse(uuid) TO authenticated, service_role;
