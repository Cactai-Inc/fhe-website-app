-- Feed byline: posts by an OWNER/STAFF account show the business name.
--
-- The two owners (admin@ and hello@fhequestrian.com) ARE French Heritage
-- Equestrian, so their posts must be bylined as the business — "French Heritage
-- Equestrian" (full name, per the brand rule) — not their personal names, and
-- regardless of the per-post as_company toggle. Any staff/admin author, or an
-- explicit as_company post, resolves to the org's BRAND.NAME.
--
-- Non-staff members keep their real name + avatar.

DO $mig$
DECLARE v_def text;
BEGIN
  v_def := pg_get_functiondef('feed_get'::regproc);
  v_def := replace(v_def,
$old$      LEFT JOIN LATERAL (
        SELECT coalesce(nullif(btrim(pr.display_name), ''),
                        nullif(btrim(coalesce(pr.first_name,'') || ' ' || coalesce(pr.last_name,'')), ''),
                        'Member') AS author_name,
               pr.avatar_url AS author_avatar
          FROM profiles pr
         WHERE pr.user_id = p.author_id
        LIMIT 1
      ) ap ON true$old$,
$new$      LEFT JOIN LATERAL (
        SELECT
          CASE
            WHEN p.as_company
              OR coalesce(pr.is_admin, false)
              OR coalesce(pr.role, 'USER') IN ('ADMIN','SUPER_ADMIN','MANAGER','EMPLOYEE','OWNER')
            THEN coalesce(
                   nullif(btrim((SELECT value_text FROM config_values
                                  WHERE org_id = p.org_id AND namespace = 'BRAND' AND key = 'NAME')), ''),
                   'French Heritage Equestrian')
            ELSE coalesce(nullif(btrim(pr.display_name), ''),
                          nullif(btrim(coalesce(pr.first_name,'') || ' ' || coalesce(pr.last_name,'')), ''),
                          'Member')
          END AS author_name,
          -- staff/company posts show the brand mark (no personal avatar)
          CASE
            WHEN p.as_company
              OR coalesce(pr.is_admin, false)
              OR coalesce(pr.role, 'USER') IN ('ADMIN','SUPER_ADMIN','MANAGER','EMPLOYEE','OWNER')
            THEN NULL
            ELSE pr.avatar_url
          END AS author_avatar,
          (coalesce(pr.is_admin, false)
             OR coalesce(pr.role, 'USER') IN ('ADMIN','SUPER_ADMIN','MANAGER','EMPLOYEE','OWNER')
             OR p.as_company) AS author_is_company
          FROM profiles pr
         WHERE pr.user_id = p.author_id
        LIMIT 1
      ) ap ON true$new$);

  -- surface the new author_is_company flag in the SELECT list
  v_def := replace(v_def,
$old$           ap.author_name,
           ap.author_avatar,$old$,
$new$           ap.author_name,
           ap.author_avatar,
           coalesce(ap.author_is_company, false) AS author_is_company,$new$);

  IF v_def NOT LIKE '%author_is_company%' THEN
    RAISE EXCEPTION 'feed_get: author LATERAL not found — aborting';
  END IF;
  EXECUTE v_def;
END $mig$;
