-- Feed byline: respect the per-post "Post as the company" toggle.
--
-- The previous migration forced EVERY staff/admin post to byline as the business,
-- which made the composer's "Post as the company" checkbox meaningless (admins
-- could no longer post as themselves). Owners want the choice back: post as
-- French Heritage Equestrian OR as themselves, per post. So the byline is driven
-- purely by as_company again (which the toggle sets) — but the company name is the
-- full BRAND.NAME, not the old abbreviated "French Heritage", and the toggle is
-- only offered to admins (the create surfaces already gate it that way).

DO $mig$
DECLARE v_def text;
BEGIN
  v_def := pg_get_functiondef('feed_get'::regproc);
  v_def := replace(v_def,
$old$      LEFT JOIN LATERAL (
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
      ) ap ON true$old$,
$new$      LEFT JOIN LATERAL (
        SELECT
          CASE WHEN p.as_company
            THEN coalesce(
                   nullif(btrim((SELECT value_text FROM config_values
                                  WHERE org_id = p.org_id AND namespace = 'BRAND' AND key = 'NAME')), ''),
                   'French Heritage Equestrian')
            ELSE coalesce(nullif(btrim(pr.display_name), ''),
                          nullif(btrim(coalesce(pr.first_name,'') || ' ' || coalesce(pr.last_name,'')), ''),
                          'Member')
          END AS author_name,
          -- a company post shows the brand mark; a personal post keeps the avatar
          CASE WHEN p.as_company THEN NULL ELSE pr.avatar_url END AS author_avatar,
          p.as_company AS author_is_company
          FROM profiles pr
         WHERE pr.user_id = p.author_id
        LIMIT 1
      ) ap ON true$new$);

  IF v_def LIKE '%coalesce(pr.is_admin, false)%OR coalesce(pr.role%' THEN
    RAISE EXCEPTION 'feed_get: old admin-forcing CASE still present — replace failed';
  END IF;
  EXECUTE v_def;
END $mig$;
