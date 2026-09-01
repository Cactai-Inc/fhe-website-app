-- SLICE 5 — admin oversight. One RPC returns the numbers an admin watches (usage)
-- plus the latest activity from audit_logs. Admin-only; org-scoped.
CREATE OR REPLACE FUNCTION public.admin_oversight()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_org uuid := current_org();
  v_usage jsonb;
  v_activity jsonb;
BEGIN
  IF NOT is_admin() THEN
    RAISE EXCEPTION 'admin access required';
  END IF;

  SELECT jsonb_build_object(
    'members',          (SELECT count(*) FROM profiles WHERE org_id = v_org),
    'open_engagements', (SELECT count(*) FROM engagements e
                          JOIN engagement_status s ON s.code = e.status
                          WHERE e.org_id = v_org AND e.deleted_at IS NULL AND s.is_terminal = false),
    'open_support',     (SELECT count(*) FROM support_requests WHERE org_id = v_org AND status <> 'resolved'),
    'feed_posts',       (SELECT count(*) FROM feed_posts WHERE org_id = v_org AND pulled_down = false),
    'flagged_posts',    (SELECT count(*) FROM feed_posts WHERE org_id = v_org AND scan_state <> 'clean')
  ) INTO v_usage;

  SELECT COALESCE(jsonb_agg(a ORDER BY a.occurred_at DESC), '[]'::jsonb) INTO v_activity
  FROM (
    SELECT occurred_at, action, table_name, actor_user_id
    FROM audit_logs
    ORDER BY occurred_at DESC
    LIMIT 50
  ) a;

  RETURN jsonb_build_object('usage', v_usage, 'activity', v_activity);
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_oversight() TO authenticated;
