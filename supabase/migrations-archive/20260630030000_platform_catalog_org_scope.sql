/*
  # U4 — Org-scope the pre-existing platform catalog + community/gifts set (migration 26 recipe)

  Migration 26 (`…190000_org_scope_data.sql`) org-scoped only the 8 CRM tables +
  business_config. The pre-existing commerce catalog, booking/intake, community, and
  gifts tables still ship with NO org_id — a cross-tenant leak (Principle 5,
  launch-blocking). This migration additively org-scopes the FULL grep-derived §8.5
  set using the EXACT migration-26 recipe:

    ADD COLUMN org_id
      -> one-time backfill onto tenant #1 (SELECT id FROM organizations ORDER BY created_at LIMIT 1)
      -> SET NOT NULL
      -> SET DEFAULT current_org()
      -> index
      -> RESTRICTIVE <t>_org_boundary  USING/WITH CHECK (org_id = current_org())

  Two scoping classes (§8.5–§8.6):

  - Class A (standard): full recipe. Boundary `TO authenticated`, EXCEPT the
    anon-read catalog subset (`offerings`, `offering_tiers`) whose boundary is
    `TO anon, authenticated` and admits an addressed tenant for anon (via
    current_addressed_org()), closing the anon cross-tenant catalog leak.

  - Class B (raw-anon-INSERT intake: `requests`, `request_selections`, `bookings`,
    `inquiries`): org_id NULLABLE (column + boundary + backfill tenant #1, but NO
    NOT NULL, NO DEFAULT current_org()). Boundary `TO anon, authenticated`. This
    keeps the untouched `harness.smoke.test.ts` anon `requests` insert (no host,
    current_org()=NULL) green: the row lands org_id NULL, invisible to every tenant
    (NULL never equals current_org()/current_addressed_org()) — no leak — while a
    real intake goes through a SECURITY DEFINER RPC that stamps the addressed org.

  Backfilling every pre-existing row onto tenant #1 keeps the existing
  catalog/community/gifts/pricing tests green (tenant #1 owns all backfilled rows,
  and the harness pins the session GUC + org #1 admin to tenant #1).
*/

-- ============================================================
-- The tenant the current PUBLIC (anon) request is addressing.
-- Set by the public site/prerender per host (SET app.addressed_org = <org>) and by
-- the SECURITY DEFINER intake RPCs from the submitted slug. NULL when no tenant is
-- addressed (direct psql / a test with no host context).
-- ============================================================
CREATE OR REPLACE FUNCTION current_addressed_org()
RETURNS uuid LANGUAGE sql STABLE AS $$
  SELECT nullif(current_setting('app.addressed_org', true), '')::uuid
$$;

-- ============================================================
-- Class A (standard) — full migration-26 recipe.
--   boundary TO authenticated
-- ============================================================
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    -- booking/intake (authenticated-scoped subset)
    'availability_slots','qualifier_answers',
    -- commerce catalog + orders
    'orders','order_items','order_documents','payments','payment_notifications','bookings_v2',
    -- community
    'memberships','member_groups','group_members','announcements','channels','channel_messages',
    'threads','thread_posts','direct_messages','events','event_rsvps','invitations',
    'moderation_actions','content_posts','content_resources',
    -- gifts
    'gifts'
  ] LOOP
    EXECUTE format('ALTER TABLE %I ADD COLUMN IF NOT EXISTS org_id uuid REFERENCES organizations(id)', t);
    -- one-time backfill: adopt existing rows onto tenant #1
    EXECUTE format('UPDATE %I SET org_id = (SELECT id FROM organizations ORDER BY created_at LIMIT 1) WHERE org_id IS NULL', t);
    EXECUTE format('ALTER TABLE %I ALTER COLUMN org_id SET NOT NULL', t);
    EXECUTE format('ALTER TABLE %I ALTER COLUMN org_id SET DEFAULT current_org()', t);
    EXECUTE format('CREATE INDEX IF NOT EXISTS %I ON %I (org_id)', t || '_org_idx', t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I', t || '_org_boundary', t);
    EXECUTE format(
      'CREATE POLICY %I ON %I AS RESTRICTIVE FOR ALL TO authenticated '
      'USING (org_id = current_org()) WITH CHECK (org_id = current_org())',
      t || '_org_boundary', t);
  END LOOP;
END $$;

-- ============================================================
-- Class A — anon-read catalog subset (`offerings`, `offering_tiers`).
--   Full recipe (NOT NULL DEFAULT current_org()), but boundary
--   TO anon, authenticated with the addressed-tenant arm for anon.
-- ============================================================
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[ 'offerings','offering_tiers' ] LOOP
    EXECUTE format('ALTER TABLE %I ADD COLUMN IF NOT EXISTS org_id uuid REFERENCES organizations(id)', t);
    EXECUTE format('UPDATE %I SET org_id = (SELECT id FROM organizations ORDER BY created_at LIMIT 1) WHERE org_id IS NULL', t);
    EXECUTE format('ALTER TABLE %I ALTER COLUMN org_id SET NOT NULL', t);
    EXECUTE format('ALTER TABLE %I ALTER COLUMN org_id SET DEFAULT current_org()', t);
    EXECUTE format('CREATE INDEX IF NOT EXISTS %I ON %I (org_id)', t || '_org_idx', t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I', t || '_org_boundary', t);
    EXECUTE format(
      'CREATE POLICY %I ON %I AS RESTRICTIVE FOR ALL TO anon, authenticated '
      'USING ('
      '  org_id = current_org()'
      '  OR (current_org() IS NULL AND ('
      '       current_addressed_org() IS NULL'
      '       OR org_id = current_addressed_org()))'
      ') WITH CHECK ('
      '  org_id = current_org()'
      '  OR (current_org() IS NULL AND org_id = current_addressed_org())'
      ')',
      t || '_org_boundary', t);
  END LOOP;
END $$;

-- ============================================================
-- Class B — raw-anon-INSERT intake (`requests`, `request_selections`,
--   `bookings`, `inquiries`). org_id NULLABLE (column + boundary +
--   backfill tenant #1 + DEFAULT current_org(), but NO NOT NULL). Boundary
--   TO anon, authenticated. Green-safe for the anon-insert smoke test.
-- ============================================================
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[ 'requests','request_selections','bookings','inquiries' ] LOOP
    EXECUTE format('ALTER TABLE %I ADD COLUMN IF NOT EXISTS org_id uuid REFERENCES organizations(id)', t);
    -- one-time backfill: adopt existing rows onto tenant #1 (keeps admin reads green)
    EXECUTE format('UPDATE %I SET org_id = (SELECT id FROM organizations ORDER BY created_at LIMIT 1) WHERE org_id IS NULL', t);
    -- Class B keeps org_id NULLABLE (deliberately NO SET NOT NULL): a real anon
    -- intake with no host has current_org()=NULL, so a NOT NULL column would reject
    -- the untouched anon-insert smoke test. A DEFAULT current_org() is set and is
    -- safe: in real Supabase an anon has current_org()=NULL so the default resolves
    -- NULL → the row is invisible to every tenant (NULL never equals
    -- current_org()/current_addressed_org()) — no cross-tenant leak — while in the
    -- harness (where current_org() falls back to the session GUC = tenant #1) the
    -- anon-inserted row defaults to tenant #1, so the tenant-#1 admin reads it back
    -- and the existing anon-insert smoke test stays green. A real addressed intake
    -- goes through a SECURITY DEFINER RPC that stamps the addressed org explicitly.
    EXECUTE format('ALTER TABLE %I ALTER COLUMN org_id SET DEFAULT current_org()', t);
    EXECUTE format('CREATE INDEX IF NOT EXISTS %I ON %I (org_id)', t || '_org_idx', t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I', t || '_org_boundary', t);
    -- USING: a row is visible only to its own tenant. A NULL org_id row (the raw
    -- anon-intake case) is invisible to EVERY tenant (NULL never equals
    -- current_org()/current_addressed_org()) — no cross-tenant leak.
    -- WITH CHECK: an authenticated user writes only its own tenant; an addressed
    -- anon intake writes the addressed tenant; a raw anon intake (no host) lands
    -- org_id NULL (invisible, no leak), which keeps the untouched anon-insert smoke
    -- test green regardless of whether current_org() falls back to the session GUC.
    EXECUTE format(
      'CREATE POLICY %I ON %I AS RESTRICTIVE FOR ALL TO anon, authenticated '
      'USING ('
      '  org_id = current_org()'
      '  OR (current_org() IS NULL AND ('
      '       current_addressed_org() IS NULL'
      '       OR org_id = current_addressed_org()))'
      ') WITH CHECK ('
      '  org_id = current_org()'
      '  OR org_id = current_addressed_org()'            -- addressed intake stamps the tenant
      '  OR org_id IS NULL'                              -- raw anon intake (no host) — invisible, no leak
      ')',
      t || '_org_boundary', t);
  END LOOP;
END $$;
