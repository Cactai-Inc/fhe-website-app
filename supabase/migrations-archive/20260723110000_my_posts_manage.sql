-- "My Posts" management: list, edit, and delete one's own feed posts.
--
-- feed_posts RLS already permits author_id = auth.uid() (or is_admin()) to write,
-- so these RPCs enforce the same in-function and rely on RLS as the backstop.

-- List the caller's own posts (any state: published, scheduled, or pulled down),
-- newest first, with the fields the management UI needs.
CREATE OR REPLACE FUNCTION public.feed_my_posts()
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT coalesce(jsonb_agg(row_to_json(t) ORDER BY t.created_at DESC), '[]'::jsonb)
  FROM (
    SELECT p.id, p.post_type, p.media_url, p.media_kind, p.body, p.source_link,
           p.visibility, p.as_company, p.published, p.publish_at, p.pulled_down,
           p.created_at, p.updated_at
      FROM feed_posts p
     WHERE p.author_id = auth.uid()
  ) t;
$function$;

GRANT EXECUTE ON FUNCTION public.feed_my_posts() TO authenticated;

-- Edit a post's text / link / visibility. Media and type are fixed at creation
-- (re-post to change those). Only the author (or an admin) may edit.
CREATE OR REPLACE FUNCTION public.feed_post_update(
  p_id uuid,
  p_body text DEFAULT NULL,
  p_source_link text DEFAULT NULL,
  p_visibility feed_visibility DEFAULT NULL)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE v_author uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'authentication required'; END IF;
  SELECT author_id INTO v_author FROM feed_posts WHERE id = p_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'post not found'; END IF;
  IF v_author <> auth.uid() AND NOT is_admin() THEN
    RAISE EXCEPTION 'not your post';
  END IF;

  UPDATE feed_posts SET
    body        = nullif(btrim(coalesce(p_body, body)), ''),
    source_link = nullif(btrim(coalesce(p_source_link, source_link)), ''),
    visibility  = coalesce(p_visibility, visibility),
    updated_at  = now()
   WHERE id = p_id;
  RETURN true;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.feed_post_update(uuid, text, text, feed_visibility) TO authenticated;

-- Delete a post (author or admin). Hard delete — the post and its media reference
-- go; the storage object is left (a later sweep can GC orphaned media).
CREATE OR REPLACE FUNCTION public.feed_post_delete(p_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE v_author uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'authentication required'; END IF;
  SELECT author_id INTO v_author FROM feed_posts WHERE id = p_id;
  IF NOT FOUND THEN RETURN false; END IF;
  IF v_author <> auth.uid() AND NOT is_admin() THEN
    RAISE EXCEPTION 'not your post';
  END IF;

  DELETE FROM feed_posts WHERE id = p_id;
  RETURN true;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.feed_post_delete(uuid) TO authenticated;
