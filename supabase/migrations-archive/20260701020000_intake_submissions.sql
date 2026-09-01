/*
  # FHE Suite — Intake submissions (OPS-INTAKE)

  The staff intake queue: one row per submitted intake form (payload = the
  filled form_definitions schema answers). Status flow:

    NEW → REVIEWED | DISMISSED | CONVERTED

  CONVERTED rows carry converted_engagement_id — the engagement opened from the
  submission via the brokerage RPCs (create_purchase_engagement /
  create_search_engagement / create_lease_engagement). Those RPCs gate on
  mod.brokerage themselves; intake_submissions is a CORE (ungated) table.

  Tenancy (migration-26 recipe, exactly as 20260629190000 / the U7 DO-loop):
    seam 1  RESTRICTIVE org_boundary — org_id NOT NULL DEFAULT current_org(),
            USING/WITH CHECK (org_id = current_org()). Born empty → no backfill.
    seam 3  PERMISSIVE access — staff RCUD (has_staff_access()). Clients never
            read the queue; public submission ingestion happens through the app
            layer / service role, not direct anon table writes.

  form_key references form_definitions.form_key (UNIQUE), so every submission
  points at a real form definition.
*/

CREATE TABLE IF NOT EXISTS intake_submissions (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  form_key                text NOT NULL REFERENCES form_definitions(form_key),
  payload                 jsonb NOT NULL,
  contact_email           text,
  contact_name            text,
  status                  text NOT NULL DEFAULT 'NEW'
                            CHECK (status IN ('NEW','REVIEWED','CONVERTED','DISMISSED')),
  converted_engagement_id uuid REFERENCES engagements(id),
  created_at              timestamptz NOT NULL DEFAULT now(),
  reviewed_at             timestamptz,
  reviewed_by             uuid REFERENCES profiles(user_id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS intake_submissions_status_idx   ON intake_submissions (status);
CREATE INDEX IF NOT EXISTS intake_submissions_form_key_idx ON intake_submissions (form_key);
CREATE INDEX IF NOT EXISTS intake_submissions_created_idx  ON intake_submissions (created_at);

-- ------------------------------------------------------------
-- Seam 1 — tenancy boundary (migration-26 recipe, DO-loop style §8.1).
--   New table is born empty, so no backfill; DEFAULT current_org() + NOT NULL suffice.
-- ------------------------------------------------------------
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['intake_submissions'] LOOP
    EXECUTE format('ALTER TABLE %I ADD COLUMN IF NOT EXISTS org_id uuid REFERENCES organizations(id)', t);
    EXECUTE format('ALTER TABLE %I ALTER COLUMN org_id SET NOT NULL', t);
    EXECUTE format('ALTER TABLE %I ALTER COLUMN org_id SET DEFAULT current_org()', t);
    EXECUTE format('CREATE INDEX IF NOT EXISTS %I ON %I (org_id)', t||'_org_idx', t);
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I', t||'_org_boundary', t);
    EXECUTE format(
      'CREATE POLICY %I ON %I AS RESTRICTIVE FOR ALL TO authenticated '
      'USING (org_id = current_org()) WITH CHECK (org_id = current_org())',
      t||'_org_boundary', t);
  END LOOP;
END $$;

-- ------------------------------------------------------------
-- Seam 3 — access (PERMISSIVE, ORs within the restrictive envelope).
--   Staff of the tenant RCUD the queue.
-- ------------------------------------------------------------
DROP POLICY IF EXISTS intake_submissions_staff_all ON intake_submissions;
CREATE POLICY intake_submissions_staff_all ON intake_submissions
  FOR ALL TO authenticated USING (has_staff_access()) WITH CHECK (has_staff_access());
