/*
  # Slice 3 — Feed RLS + RPCs

  RLS: members read LIVE posts (published, publish_at<=now, not pulled, clean) in
  their org; authors manage their own; admins moderate everything.
  RPCs: feed_get (assembled feed), feed_post_create, feed_mark_seen,
  feed_set_view_shape, feed_share, feed_report_post, feed_moderate (admin).

  Moderation seam (owner B3): create defaults scan_state='clean' (report-and-review;
  the scan hook returns clean now, NudeNet/vision later). Admin lists = queries.
*/

ALTER TABLE feed_posts         ENABLE ROW LEVEL SECURITY;
ALTER TABLE feed_seen          ENABLE ROW LEVEL SECURITY;
ALTER TABLE feed_view_pref     ENABLE ROW LEVEL SECURITY;
ALTER TABLE feed_shares        ENABLE ROW LEVEL SECURITY;
ALTER TABLE feed_account_items ENABLE ROW LEVEL SECURITY;

-- posts: live posts in-org readable; own posts manageable; admins all
DROP POLICY IF EXISTS feed_posts_read ON feed_posts;
CREATE POLICY feed_posts_read ON feed_posts FOR SELECT TO authenticated
  USING (
    org_id = current_org() AND (
      is_admin()
      OR author_id = auth.uid()
      OR (published AND publish_at <= now() AND NOT pulled_down AND scan_state = 'clean')
    )
  );
DROP POLICY IF EXISTS feed_posts_author_write ON feed_posts;
CREATE POLICY feed_posts_author_write ON feed_posts FOR ALL TO authenticated
  USING (author_id = auth.uid() OR is_admin())
  WITH CHECK (org_id = current_org() AND (author_id = auth.uid() OR is_admin()));

-- seen/view-pref: each user manages their own rows
DROP POLICY IF EXISTS feed_seen_own ON feed_seen;
CREATE POLICY feed_seen_own ON feed_seen FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS feed_view_pref_own ON feed_view_pref;
CREATE POLICY feed_view_pref_own ON feed_view_pref FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- shares: sender/recipient can see; sender creates
DROP POLICY IF EXISTS feed_shares_party ON feed_shares;
CREATE POLICY feed_shares_party ON feed_shares FOR SELECT TO authenticated
  USING (from_user_id = auth.uid() OR to_user_id = auth.uid() OR is_admin());
DROP POLICY IF EXISTS feed_shares_create ON feed_shares;
CREATE POLICY feed_shares_create ON feed_shares FOR INSERT TO authenticated
  WITH CHECK (from_user_id = auth.uid() AND org_id = current_org());

-- account items: each user sees their own; admins all
DROP POLICY IF EXISTS feed_account_items_own ON feed_account_items;
CREATE POLICY feed_account_items_own ON feed_account_items FOR ALL TO authenticated
  USING (user_id = auth.uid() OR is_admin())
  WITH CHECK (user_id = auth.uid() OR is_admin());

-- ── feed_get: the assembled feed for the caller ───────────────────────────
-- Returns live posts in-org (visibility filtered) + posts shared TO me + my
-- account items, newest publish first, with a seen flag and (for shares) the
-- sharer's name. The client applies view-shape + seen-scroll on top.
CREATE OR REPLACE FUNCTION feed_get(p_limit int DEFAULT 50, p_before timestamptz DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $fn$
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
           (s.user_id IS NOT NULL) AS seen,
           sh.from_name AS shared_by
      FROM feed_posts p
      LEFT JOIN feed_seen s ON s.post_id = p.id AND s.user_id = v_uid
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
$fn$;

-- create a post (moderation seam: scan returns clean; single-media enforced by NOT NULL)
CREATE OR REPLACE FUNCTION feed_post_create(
  p_type feed_post_type, p_media_url text, p_media_kind feed_media_kind,
  p_body text DEFAULT NULL, p_source_link text DEFAULT NULL,
  p_subject_horse_id uuid DEFAULT NULL, p_as_company boolean DEFAULT false,
  p_visibility feed_visibility DEFAULT 'members', p_publish_at timestamptz DEFAULT NULL)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $fn$
DECLARE v_id uuid; v_org uuid := current_org(); v_scan feed_scan_state;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'authentication required'; END IF;
  -- only operators may post as the company
  IF p_as_company AND NOT is_admin() THEN RAISE EXCEPTION 'only operators may post as the company'; END IF;
  -- MODERATION SEAM: run the scan (returns clean at launch; NudeNet/vision later).
  v_scan := feed_scan_media(p_media_url, p_media_kind);
  INSERT INTO feed_posts (org_id, author_id, as_company, post_type, media_url, media_kind,
                          body, source_link, subject_horse_id, visibility, scan_state,
                          published, publish_at)
    VALUES (v_org, auth.uid(), p_as_company, p_type, p_media_url, p_media_kind,
            p_body, p_source_link, p_subject_horse_id, p_visibility, v_scan,
            v_scan = 'clean',                       -- clean posts go live; blocked stay unpublished
            coalesce(p_publish_at, now()))
    RETURNING id INTO v_id;
  RETURN v_id;
END;
$fn$;

-- the moderation SCAN seam (owner B3): returns 'clean' at launch. Swap the body
-- for a NudeNet/vision call later WITHOUT touching any caller.
CREATE OR REPLACE FUNCTION feed_scan_media(p_media_url text, p_media_kind feed_media_kind)
RETURNS feed_scan_state LANGUAGE sql IMMUTABLE AS $$ SELECT 'clean'::feed_scan_state $$;

CREATE OR REPLACE FUNCTION feed_mark_seen(p_post_id uuid)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path TO 'public' AS $$
  INSERT INTO feed_seen (user_id, post_id) VALUES (auth.uid(), p_post_id)
  ON CONFLICT (user_id, post_id) DO NOTHING;
$$;

CREATE OR REPLACE FUNCTION feed_set_view_shape(p_shape feed_view_shape)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path TO 'public' AS $$
  INSERT INTO feed_view_pref (user_id, shape, updated_at) VALUES (auth.uid(), p_shape, now())
  ON CONFLICT (user_id) DO UPDATE SET shape = EXCLUDED.shape, updated_at = now();
$$;

CREATE OR REPLACE FUNCTION feed_share(p_post_id uuid, p_to_user_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $fn$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'authentication required'; END IF;
  INSERT INTO feed_shares (org_id, post_id, from_user_id, to_user_id)
    VALUES (current_org(), p_post_id, auth.uid(), p_to_user_id);
END;
$fn$;

-- user reports a block as inaccurate → disputed (admin review list picks it up)
CREATE OR REPLACE FUNCTION feed_report_post(p_post_id uuid, p_reason text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $fn$
BEGIN
  UPDATE feed_posts SET scan_state = 'disputed', reported_reason = p_reason, updated_at = now()
   WHERE id = p_post_id AND author_id = auth.uid() AND scan_state = 'blocked';
END;
$fn$;

-- admin moderation: approve (overturn→clean+live), affirm (uphold block), or pull down a live post
CREATE OR REPLACE FUNCTION feed_moderate(p_post_id uuid, p_action text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $fn$
BEGIN
  IF NOT is_admin() THEN RAISE EXCEPTION 'admin only'; END IF;
  IF p_action = 'approve' THEN
    UPDATE feed_posts SET scan_state='clean', published=true, pulled_down=false, updated_at=now() WHERE id=p_post_id;
  ELSIF p_action = 'affirm' THEN
    UPDATE feed_posts SET scan_state='blocked', published=false, updated_at=now() WHERE id=p_post_id;
  ELSIF p_action = 'pull_down' THEN
    UPDATE feed_posts SET pulled_down=true, updated_at=now() WHERE id=p_post_id;
  ELSE RAISE EXCEPTION 'unknown moderation action: %', p_action;
  END IF;
END;
$fn$;

-- grants
GRANT EXECUTE ON FUNCTION feed_get(int, timestamptz), feed_post_create(feed_post_type, text, feed_media_kind, text, text, uuid, boolean, feed_visibility, timestamptz),
  feed_mark_seen(uuid), feed_set_view_shape(feed_view_shape), feed_share(uuid, uuid),
  feed_report_post(uuid, text), feed_moderate(uuid, text) TO authenticated, service_role;
