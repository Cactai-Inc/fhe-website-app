-- The owner can reveal and un-hide lessee entries they previously hid. The merged
-- view omits hidden entries; add a hidden count to horse_page_detail and an RPC the
-- owner/staff call to list the hidden entries for the reveal action. set_lessee_entry
-- _hidden(false) un-hides. Nothing is ever deleted; the lessee's access is unaffected.

-- 1. hidden count on horse_page_detail (owner/staff can see there is something hidden)
DO $m$
DECLARE
  v_def text;
  v_old text := $q$        AND NOT e.hidden_by_owner), '[]'::jsonb)
  );
  RETURN v_out;$q$;
  v_new text := $q$        AND NOT e.hidden_by_owner), '[]'::jsonb),
    'lessee_hidden_count', (SELECT count(*) FROM horse_lessee_entries e
       WHERE e.horse_id = p_horse_id AND e.deleted_at IS NULL AND e.hidden_by_owner)
  );
  RETURN v_out;$q$;
BEGIN
  SELECT pg_get_functiondef('public.horse_page_detail(uuid)'::regprocedure) INTO v_def;
  IF position(v_old IN v_def) = 0 THEN
    RAISE EXCEPTION 'horse_page_detail lessee_entries anchor not found';
  END IF;
  EXECUTE replace(v_def, v_old, v_new);
END $m$;

-- 2. the hidden entries, for the owner's reveal action (owner or staff only).
CREATE OR REPLACE FUNCTION public.horse_hidden_lessee_entries(p_horse uuid)
 RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
  SELECT coalesce(jsonb_agg(jsonb_build_object(
      'id', e.id, 'kind', e.kind, 'data', e.data, 'created_at', e.created_at,
      'author', coalesce(nullif(btrim(c.first_name||' '||c.last_name),''), c.email, 'Lessee'),
      'author_contact_id', e.author_contact_id) ORDER BY e.created_at DESC), '[]'::jsonb)
  FROM horse_lessee_entries e
  JOIN contacts c ON c.id = e.author_contact_id
  WHERE e.horse_id = p_horse AND e.deleted_at IS NULL AND e.hidden_by_owner
    AND e.org_id = current_org()
    AND (has_staff_access() OR EXISTS (
      SELECT 1 FROM horses h WHERE h.id = p_horse AND h.current_owner_contact_id = current_contact_id()));
$function$;
REVOKE EXECUTE ON FUNCTION public.horse_hidden_lessee_entries(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.horse_hidden_lessee_entries(uuid) TO authenticated, service_role;
