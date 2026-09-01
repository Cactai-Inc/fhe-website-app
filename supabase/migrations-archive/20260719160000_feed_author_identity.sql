-- feed_get: include the post author's display name + avatar so social posts
-- render as "[Member Name] posted" with their avatar (not a generic "Member").
CREATE OR REPLACE FUNCTION public.feed_get(p_limit integer DEFAULT 50, p_before timestamp with time zone DEFAULT NULL::timestamp with time zone)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_org uuid := current_org();
  v_shape text;
  v_posts jsonb;
  v_items jsonb;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'authentication required'; END IF;

  SELECT shape::text INTO v_shape FROM feed_view_pref WHERE user_id = v_uid;
  v_shape := coalesce(v_shape, 'blended');

  SELECT coalesce(jsonb_agg(row_to_json(t)), '[]'::jsonb) INTO v_posts FROM (
    SELECT p.id, p.post_type, p.media_url, p.media_kind, p.body, p.source_link,
           p.subject_horse_id, p.visibility, p.publish_at, p.as_company,
           p.author_id,
           ap.author_name,
           ap.author_avatar,
           (s.user_id IS NOT NULL) AS seen,
           sh.from_name AS shared_by
      FROM feed_posts p
      LEFT JOIN feed_seen s ON s.post_id = p.id AND s.user_id = v_uid
      LEFT JOIN LATERAL (
        SELECT coalesce(nullif(btrim(pr.display_name), ''),
                        nullif(btrim(coalesce(pr.first_name,'') || ' ' || coalesce(pr.last_name,'')), ''),
                        'Member') AS author_name,
               pr.avatar_url AS author_avatar
          FROM profiles pr
         WHERE pr.user_id = p.author_id
        LIMIT 1
      ) ap ON true
      LEFT JOIN LATERAL (
        SELECT trim(coalesce(pr.first_name,'') || ' ' || coalesce(pr.last_name,'')) AS from_name
          FROM feed_shares fsh
          JOIN contacts pr ON pr.id = (SELECT contact_id FROM profiles WHERE user_id = fsh.from_user_id)
         WHERE fsh.post_id = p.id AND fsh.to_user_id = v_uid
         ORDER BY fsh.created_at DESC LIMIT 1
      ) sh ON true
     WHERE p.org_id = v_org
       AND p.published AND p.publish_at <= now() AND NOT p.pulled_down AND p.scan_state = 'clean'
       AND (p_before IS NULL OR p.publish_at < p_before)
       AND (
         p.visibility IN ('members','both')  -- authed member sees member+both
         OR EXISTS (SELECT 1 FROM feed_shares fsh WHERE fsh.post_id = p.id AND fsh.to_user_id = v_uid)
       )
     ORDER BY p.publish_at DESC
     LIMIT p_limit
  ) t;

  SELECT coalesce(jsonb_agg(row_to_json(a)), '[]'::jsonb) INTO v_items FROM (
    SELECT id, kind, title, body, payload, resolved, publish_at
      FROM feed_account_items
     WHERE user_id = v_uid AND publish_at <= now() AND NOT resolved
     ORDER BY publish_at DESC
  ) a;

  RETURN jsonb_build_object('shape', v_shape, 'posts', v_posts, 'account_items', v_items);
END;
$function$

