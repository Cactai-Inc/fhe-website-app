-- SEED / TEST DATA REMOVAL — run this AFTER testing to strip demo rows cleanly.
-- Safe to run multiple times (idempotent). It removes only rows that carry a seed
-- marker or match the known demo fixtures; it never drops tables or touches schema.
--
-- HOW SEED ROWS ARE MARKED (convention for whoever inserts the test data):
--   • Preferred: tag seeded rows with a marker so teardown is exact. If your seed
--     inserts can include it, put  seed_tag = 'demo'  in a column, OR prefix a text
--     field the row owns (e.g. notes/description) with '[SEED]'. This file deletes on
--     those markers first.
--   • Fallback: for the fixture emails/names used in the UI seed (seed.ts), this file
--     also deletes those specific demo records by value. Adjust the lists below if you
--     seeded different values.
--
-- ORDER: children before parents to respect FKs. Wrapped in a transaction so a
-- failure rolls back rather than half-deleting.
--
-- NOTE (UI seed vs DB seed): the front-end also has SEED_ENABLED in src/lib/seed.ts,
-- which shows demo content only where a live list is empty. That is client-side and is
-- turned off separately (set SEED_ENABLED=false, then delete seed.ts). This SQL is only
-- for demo ROWS that were inserted into the database during testing.

BEGIN;

-- ── 1. Marker-based deletes (exact; preferred) ─────────────────────────────
-- Uncomment the block matching how you tagged seed rows.

-- 1a. If a `seed_tag` column exists on these tables:
-- DELETE FROM public.stable_horse_parties WHERE horse_id IN (SELECT id FROM public.stable_horses WHERE seed_tag = 'demo');
-- DELETE FROM public.stable_items   WHERE seed_tag = 'demo';
-- DELETE FROM public.stable_horses  WHERE seed_tag = 'demo';
-- DELETE FROM public.vendors        WHERE seed_tag = 'demo';
-- DELETE FROM public.lesson_sessions WHERE seed_tag = 'demo';
-- DELETE FROM public.events         WHERE seed_tag = 'demo';
-- DELETE FROM public.threads        WHERE seed_tag = 'demo';
-- DELETE FROM public.feed_posts     WHERE seed_tag = 'demo';

-- 1b. If you prefixed a text field with '[SEED]':
DELETE FROM public.stable_horse_parties
  WHERE horse_id IN (SELECT id FROM public.stable_horses WHERE name LIKE '[SEED]%' OR markings LIKE '[SEED]%');
DELETE FROM public.stable_items   WHERE name LIKE '[SEED]%' OR detail LIKE '[SEED]%';
DELETE FROM public.stable_horses  WHERE name LIKE '[SEED]%' OR markings LIKE '[SEED]%';
DELETE FROM public.vendors        WHERE name LIKE '[SEED]%' OR note LIKE '[SEED]%';

-- Guarded for tables that may not exist in every environment:
DO $$ BEGIN
  IF to_regclass('public.lesson_sessions') IS NOT NULL THEN
    EXECUTE $q$ DELETE FROM public.lesson_sessions WHERE notes LIKE '[SEED]%' $q$;
  END IF;
  IF to_regclass('public.events') IS NOT NULL THEN
    EXECUTE $q$ DELETE FROM public.events WHERE title LIKE '[SEED]%' OR description LIKE '[SEED]%' $q$;
  END IF;
  IF to_regclass('public.threads') IS NOT NULL THEN
    EXECUTE $q$ DELETE FROM public.threads WHERE title LIKE '[SEED]%' OR body LIKE '[SEED]%' $q$;
  END IF;
  IF to_regclass('public.feed_posts') IS NOT NULL THEN
    EXECUTE $q$ DELETE FROM public.feed_posts WHERE body LIKE '[SEED]%' $q$;
  END IF;
END $$;

-- ── 2. Fixture-value deletes (fallback for the UI seed.ts demo records) ─────
-- These match the specific demo values used in src/lib/seed.ts. If you seeded the DB
-- with the same fixtures, this removes them. Harmless if none exist.

-- Demo vendors (Resources directory fixtures)
DELETE FROM public.stable_items
  WHERE vendor_id IN (SELECT id FROM public.vendors WHERE name IN (
    'Coastal Equine Vet','North County Farrier Co.','Del Mar Feed & Tack','Pacific Mobile Dentistry'));
DELETE FROM public.vendors WHERE name IN (
  'Coastal Equine Vet','North County Farrier Co.','Del Mar Feed & Tack','Pacific Mobile Dentistry');

-- Demo threads / events / feed posts referencing the fixture titles (guarded)
DO $$ BEGIN
  IF to_regclass('public.events') IS NOT NULL THEN
    EXECUTE $q$ DELETE FROM public.events WHERE title IN ('Summer schooling show','Barn hack day','Tack swap') $q$;
  END IF;
  IF to_regclass('public.threads') IS NOT NULL THEN
    EXECUTE $q$ DELETE FROM public.threads WHERE title IN
      ('Best boots for wide calves?','Trailer recommendations?','Show nerves — how do you cope?') $q$;
  END IF;
END $$;

-- ── 3. Demo accounts (ONLY if you created throwaway test users) ─────────────
-- DANGER: deleting auth users cascades their owned rows. Only run if these emails are
-- disposable test accounts you created for the demo. Left commented by default.
--
-- DO $$
-- DECLARE demo_emails text[] := ARRAY[
--   'jane@example.com','margaux@example.com','sofia@example.com','amelie@example.com',
--   'claire@example.com','elise@example.com','anna@example.com','theo@example.com'];
-- DECLARE uid uuid;
-- BEGIN
--   FOREACH uid IN ARRAY (SELECT array_agg(id) FROM auth.users WHERE email = ANY(demo_emails)) LOOP
--     DELETE FROM public.stable_items  WHERE user_id = uid;
--     DELETE FROM public.stable_horses WHERE user_id = uid;
--     DELETE FROM public.vendors       WHERE created_by = uid;
--     -- add other per-user tables here as needed
--     DELETE FROM auth.users WHERE id = uid;
--   END LOOP;
-- END $$;

COMMIT;

-- After running: verify with e.g.
--   SELECT count(*) FROM public.vendors WHERE name LIKE '[SEED]%';   -- expect 0
--   SELECT count(*) FROM public.stable_horses WHERE name LIKE '[SEED]%'; -- expect 0
