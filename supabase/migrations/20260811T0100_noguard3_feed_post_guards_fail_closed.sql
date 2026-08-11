-- TASK NOGUARD3 / PHASE A — make the feed post ownership guard FAIL CLOSED.
--
-- CONFIRMED against production 2026-08-11, by evaluating the predicate only
-- (no function was executed, no row was written).
--
-- Both functions read:
--
--   IF v_author <> auth.uid() AND NOT is_admin() THEN
--     RAISE EXCEPTION 'not your post';
--   END IF;
--
-- feed_posts.author_id is NULLABLE and 9 of the 18 live posts have author_id
-- IS NULL. For those rows `NULL <> auth.uid()` is NULL, `NULL AND true` is
-- NULL, and an IF on NULL does not execute its body. The guard reads like a
-- deny and behaves like an allow: ANY signed-in account can delete or rewrite
-- any post whose author_id is NULL. Measured live as a signed-in non-admin:
--
--   total posts 18 | guard returns NULL (skipped) 9 | guard denies 9
--
-- This is NOT the anon hole NOGUARD1/2 addressed — auth.uid() IS NOT NULL is
-- already asserted at the top of both bodies, so an anonymous caller is
-- refused. The NULL enters through the stored author_id, which is why it
-- survives a correctly-behaving auth.uid().
--
-- The fix restates the same rule as an allow-list and coalesces it to false,
-- so an indeterminate authorisation is a denial. Truth table, with auth.uid()
-- non-NULL (guaranteed by the check above):
--
--   author_id        is_admin | before          | after
--   -----------------+---------+-----------------+--------
--   = caller         | f       | allow           | allow
--   = caller         | t       | allow           | allow
--   <> caller        | f       | DENY            | DENY
--   <> caller        | t       | allow           | allow
--   NULL             | f       | *** allow ***   | DENY   <- the only change
--   NULL             | t       | allow           | allow
--
-- Only the undetermined case moves, and only to denied. Admins keep access to
-- the 9 orphan posts, so nothing is stranded and no moderation path is lost.
--
-- Callers, listed before choosing the repair:
--   src/lib/feed.ts:123  feedPostUpdate()  -> feed_post_update
--   src/lib/feed.ts:134  feedPostDelete()  -> feed_post_delete
--   api/      : none
--   pg_proc   : none (no in-database caller)
-- Both src/ helpers already document the intent as "author or admin only";
-- this makes the body match its own stated contract.
--
-- Grants are deliberately NOT touched. Both have real browser callers; the
-- repair is to the check, not to the grant.
--
-- This migration carries NO transaction control of its own, so it is safe to
-- wrap in an outer BEGIN … ROLLBACK for a dry run. Do not add BEGIN/COMMIT.
--
-- The DO block asserts each replacement actually happened: this repo has ~31
-- migrations that rewrite bodies by string replacement, and a replacement
-- matching nothing silently no-ops and reports success.

DO $mig$
DECLARE
  r       record;
  v_src   text;
  v_new   text;
  v_count int := 0;
BEGIN
  FOR r IN
    SELECT p.oid, p.proname
      FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = 'public'
       AND p.proname IN ('feed_post_delete', 'feed_post_update')
       AND p.prorettype::regtype::text <> 'trigger'
  LOOP
    v_src := pg_get_functiondef(r.oid);

    v_new := replace(
      v_src,
      'IF v_author <> auth.uid() AND NOT is_admin() THEN',
      'IF NOT coalesce(v_author = auth.uid() OR is_admin(), false) THEN');

    IF v_new = v_src THEN
      RAISE EXCEPTION
        'NOGUARD3: guard text not matched in %(); refusing to report a no-op as success', r.proname;
    END IF;

    EXECUTE v_new;
    v_count := v_count + 1;
  END LOOP;

  IF v_count <> 2 THEN
    RAISE EXCEPTION 'NOGUARD3: expected to rewrite 2 functions, rewrote %', v_count;
  END IF;

  RAISE NOTICE 'NOGUARD3: % feed guards rewritten', v_count;
END
$mig$;

-- Prove the new text is in place, and that the old NULL-prone text is gone,
-- in the same transaction. Re-read from pg_proc rather than trusting the above.
DO $verify$
DECLARE
  v_missing int := 0;
  v_stale   int := 0;
BEGIN
  SELECT count(*) INTO v_missing
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname = 'public'
     AND p.proname IN ('feed_post_delete', 'feed_post_update')
     AND pg_get_functiondef(p.oid) NOT LIKE '%coalesce(v_author = auth.uid() OR is_admin(), false)%';

  SELECT count(*) INTO v_stale
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname = 'public'
     AND p.proname IN ('feed_post_delete', 'feed_post_update')
     AND pg_get_functiondef(p.oid) LIKE '%v_author <> auth.uid() AND NOT is_admin()%';

  IF v_missing > 0 THEN
    RAISE EXCEPTION 'NOGUARD3: % function(s) still lack the coalesce guard', v_missing;
  END IF;
  IF v_stale > 0 THEN
    RAISE EXCEPTION 'NOGUARD3: % function(s) still carry the NULL-prone guard', v_stale;
  END IF;
END
$verify$;
