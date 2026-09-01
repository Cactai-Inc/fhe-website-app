/*
  # FHE CRM → Suite — Org-scope the tenant data (migration 26)

  The tenant isolation layer. Every operational table gets org_id and a single
  RESTRICTIVE policy — the tenant boundary — that ANDs with the existing
  within-org access policies. Clean separation:
    boundary (this migration):  org_id = current_org()   — which tenant
    access  (existing policies): role / ownership         — who, within the tenant

  No OR-union, no coalesce-to-default-org. org_id defaults to current_org() (the
  caller's own org from their session) and is NOT NULL, so a write that forgets it
  fails loudly instead of silently cross-wiring tenants. Existing rows are adopted
  onto tenant #1 by an explicit one-time backfill.

  current_org() is refined: authenticated users resolve to THEIR profile's org
  (an outsider with no membership → NULL → sees nothing); only the seed/service
  context (auth.uid() IS NULL, e.g. migrations/service-role) may fall back to the
  app.current_org GUC.
*/

CREATE OR REPLACE FUNCTION current_org()
RETURNS uuid LANGUAGE sql SECURITY DEFINER SET search_path = public STABLE AS $$
  SELECT CASE
    WHEN auth.uid() IS NULL THEN nullif(current_setting('app.current_org', true), '')::uuid
    ELSE (SELECT org_id FROM profiles WHERE user_id = auth.uid())
  END
$$;

-- ============================================================
-- org_id + tenant-boundary policy on each operational table
-- ============================================================
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'contacts','clients','horses','engagements','engagement_parties',
    'transactions','documents','signatures'
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
-- business_config — one config row PER ORG (was a singleton)
-- ============================================================
ALTER TABLE business_config ADD COLUMN IF NOT EXISTS org_id uuid REFERENCES organizations(id);
UPDATE business_config SET org_id = (SELECT id FROM organizations ORDER BY created_at LIMIT 1) WHERE org_id IS NULL;
ALTER TABLE business_config ALTER COLUMN org_id SET NOT NULL;
ALTER TABLE business_config ALTER COLUMN org_id SET DEFAULT current_org();

-- retire the singleton; enforce one config per org instead
DROP INDEX IF EXISTS business_config_singleton;
CREATE UNIQUE INDEX IF NOT EXISTS business_config_per_org ON business_config (org_id);

DROP POLICY IF EXISTS business_config_org_boundary ON business_config;
CREATE POLICY business_config_org_boundary ON business_config AS RESTRICTIVE FOR ALL TO authenticated
  USING (org_id = current_org()) WITH CHECK (org_id = current_org());
