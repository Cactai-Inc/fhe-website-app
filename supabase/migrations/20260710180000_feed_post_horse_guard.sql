-- SPEC H.9 — feed_post_create v2: server-side listing-eligibility guard on
-- subject_horse_id (owner / lessee-with-sublease / staff). Patched from the
-- live v1 definition; the guard runs before the moderation seam.
CREATE OR REPLACE FUNCTION public.feed_post_create(p_type feed_post_type, p_media_url text, p_media_kind feed_media_kind, p_body text DEFAULT NULL::text, p_source_link text DEFAULT NULL::text, p_subject_horse_id uuid DEFAULT NULL::uuid, p_as_company boolean DEFAULT false, p_visibility feed_visibility DEFAULT 'members'::feed_visibility, p_publish_at timestamp with time zone DEFAULT NULL::timestamp with time zone)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE v_id uuid; v_org uuid := current_org(); v_scan feed_scan_state;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'authentication required'; END IF;
  -- only operators may post as the company
  IF p_as_company AND NOT is_admin() THEN RAISE EXCEPTION 'only operators may post as the company'; END IF;
  -- H.9 LISTING ELIGIBILITY: a horse-record-backed post may only be created by
  -- someone entitled to list that horse (owner; lessee only with sublease rights;
  -- staff unrestricted). Enforced server-side, not just in the picker.
  IF p_subject_horse_id IS NOT NULL
     AND NOT (can_list_horse(p_subject_horse_id, 'sale')
              OR can_list_horse(p_subject_horse_id, 'lease')) THEN
    RAISE EXCEPTION 'you are not authorized to list this horse';
  END IF;
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
$function$
;
