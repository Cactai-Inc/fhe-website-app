-- The injuries-to-humans change log: who changed the disclosure and when. The
-- audit_horses trigger already records every change to the horses row (actor,
-- timestamp, old/new) in audit_logs; this reads back the entries where the
-- injuries_to_humans value actually changed, as the authoritative, tamper-evident
-- log (it is written by the trigger, never by the editor).

CREATE OR REPLACE FUNCTION public.horse_injuries_change_log(p_horse uuid)
 RETURNS jsonb
 LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
  SELECT coalesce(jsonb_agg(jsonb_build_object(
      'at', a.occurred_at,
      'by', coalesce(nullif(btrim(c.first_name||' '||c.last_name),''), c.email, p.display_name, 'Someone'),
      'action', a.action,
      'before', a.old_value -> 'injuries_to_humans',
      'after', a.new_value -> 'injuries_to_humans') ORDER BY a.occurred_at DESC), '[]'::jsonb)
  FROM audit_logs a
  LEFT JOIN profiles p ON p.user_id = a.actor_user_id
  LEFT JOIN contacts c ON c.id = p.contact_id
  WHERE a.table_name = 'horses' AND a.record_id = p_horse
    AND (a.old_value -> 'injuries_to_humans') IS DISTINCT FROM (a.new_value -> 'injuries_to_humans')
    AND has_staff_access()  -- the disclosure log is a staff/record-keeping view
    AND current_org() = (SELECT org_id FROM horses WHERE id = p_horse);
$function$;
REVOKE EXECUTE ON FUNCTION public.horse_injuries_change_log(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.horse_injuries_change_log(uuid) TO authenticated, service_role;
