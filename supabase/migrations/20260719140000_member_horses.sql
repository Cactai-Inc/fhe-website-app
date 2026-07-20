-- A member's owned horses (for the community profile/card): name + home location.
-- Ownership = horses.current_owner_contact_id → the member's profile contact.
CREATE OR REPLACE FUNCTION public.member_horses(p_user_id uuid)
 RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $function$
  SELECT coalesce(jsonb_agg(jsonb_build_object(
      'name', coalesce(nullif(btrim(h.nickname),''), h.registered_name),
      'home_location', (SELECT name FROM locations WHERE id = h.home_location_id))
      ORDER BY h.created_at), '[]'::jsonb)
  FROM horses h
  JOIN profiles p ON p.contact_id = h.current_owner_contact_id
  WHERE p.user_id = p_user_id AND h.deleted_at IS NULL;
$function$;
GRANT EXECUTE ON FUNCTION public.member_horses(uuid) TO authenticated;
