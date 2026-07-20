-- The member_joined post body was frozen at join time (before the profile name filled
-- in), leaving a generic "A member just joined the community." Backfill with the real
-- name. (The card also resolves the name live now, so this is cosmetic for the stored body.)
UPDATE public.feed_posts
   SET body = member_display_name(author_id) || ' just joined the community.'
 WHERE post_type = 'member_joined'
   AND author_id IS NOT NULL
   AND coalesce(nullif(btrim(member_display_name(author_id)),''),'') <> ''
   AND body = 'A member just joined the community.';
