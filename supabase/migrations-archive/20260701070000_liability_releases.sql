/*
  # FHE Suite — Liability releases + signing-requirements matrix

  Loads the four owner liability releases into the contract engine and builds
  the SIGNING REQUIREMENTS MATRIX: which documents a purchase of each service
  requires signed. Companion pass: the embedded release / assumption-of-risk /
  hold-harmless sections were STRIPPED from the service agreements
  (RIDER_LESSON_JUMPER, MINOR_RIDER, HORSE_EXERCISE, HORSE_TRAINING,
  HORSEMANSHIP_TRAINING, HORSE_SEARCH_RETAINER, HORSE_REPRESENTATION) and
  replaced with an incorporation-by-reference clause — those protections now
  live exclusively in the standalone RELEASE_* documents (loaded by the
  regenerated 20260629100000_load_contract_bodies.sql).

  1. contract_templates — four new NON-SERVICE rows (service_type NULL, per the
     migration-11 schema comment: "NULL for non-service docs (releases…)").
     contract_templates is GLOBAL (no org_id — same as the 17 canonical rows).
     Party-role note: the general release is a VISITOR-facing document, but
     'VISITOR' is NOT in the engagement_parties / signatures party_role CHECKs
     (re-added by 20260701000000 §3), so the general release deliberately uses
     the PARTICIPANT role/namespace for its counterparty (the visitor).

  2. contract_requirements — NEW org-scoped matrix: (service_type, template_key)
     means "a purchase of this service requires this document signed".
     Tenancy per the migration-26 recipe (RESTRICTIVE org_boundary, exactly as
     20260701020000_intake_submissions.sql); reads for any authenticated org
     member (the generate-document picker), writes staff-only. Seeded for
     tenant #1 with org_id set EXPLICITLY from the first organization
     (current_org() is NULL at migration time — same pattern as
     20260701060000_owner_pricing_2026_07.sql).

  3. required_documents_for(p_service_type) — SECURITY INVOKER helper returning
     the required template_keys (RLS applies → org-scoped).
*/

-- ============================================================
-- 1. The four release templates (bodies land via the regenerated loader)
-- ============================================================
INSERT INTO contract_templates (template_key, title, service_type, party_namespaces) VALUES
  ('RELEASE_GENERAL',        'General Visitor Liability Release',                 NULL, ARRAY['PARTICIPANT','GUARDIAN','COMPANY']),
  ('RELEASE_PARTICIPANT',    'Participant Liability Release',                     NULL, ARRAY['PARTICIPANT','GUARDIAN','COMPANY']),
  ('RELEASE_HORSE_EXERCISE', 'Horse Exercise Liability Release',                  NULL, ARRAY['OWNER','COMPANY']),
  ('RELEASE_HORSE_CARE',     'Horse Handling and Routine Care Liability Release', NULL, ARRAY['OWNER','COMPANY'])
ON CONFLICT (template_key) DO NOTHING;

-- ============================================================
-- 2. contract_requirements — the signing-requirements matrix
-- ============================================================
CREATE TABLE IF NOT EXISTS contract_requirements (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  service_type text NOT NULL REFERENCES service_types(code),
  template_key text NOT NULL REFERENCES contract_templates(template_key),
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS contract_requirements_service_idx
  ON contract_requirements (service_type);

-- Seam 1 — tenancy boundary (migration-26 recipe, DO-loop style, exactly as
-- 20260701020000_intake_submissions.sql). Born empty → no backfill.
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['contract_requirements'] LOOP
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

-- One requirement per (org, service, document).
CREATE UNIQUE INDEX IF NOT EXISTS contract_requirements_uniq
  ON contract_requirements (org_id, service_type, template_key);

-- Seam 3 — access (PERMISSIVE, inside the restrictive envelope): any
-- authenticated org member may read (the generate-document picker shows the
-- required signing set); staff write.
DROP POLICY IF EXISTS contract_requirements_read ON contract_requirements;
CREATE POLICY contract_requirements_read ON contract_requirements
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS contract_requirements_staff_write ON contract_requirements;
CREATE POLICY contract_requirements_staff_write ON contract_requirements
  FOR ALL TO authenticated USING (has_staff_access()) WITH CHECK (has_staff_access());

-- ------------------------------------------------------------
-- Seed tenant #1's matrix (org_id EXPLICIT — current_org() is NULL in
-- migrations). Owner's rules, applied to the 13-value catalog (20260629010000):
--
--   R1  Every ON-PROPERTY service → its pool's RELEASE_* variant + FACILITY_RULES.
--       On-property = conducted at the facility: the rider segment
--       (RIDING_LESSON, JUMPER_TRAINING, HORSEMANSHIP_TRAINING — pool
--       RELEASE_PARTICIPANT; no RIDER_* codes exist) and the horse segment
--       (HORSE_TRAINING, HORSE_EXERCISE — pool RELEASE_HORSE_EXERCISE;
--       HORSE_CLIPPING — pool RELEASE_HORSE_CARE; no boarding/care codes exist).
--       The support/brokerage codes are representation work, not conducted
--       on-property, and INDEPENDENT_CONTRACTOR is internal → no R1 rows.
--   R2  Anything ACTIVE / interacting with horses (the client rides/handles) →
--       + HUMAN_EMERGENCY_MEDICAL. That is the rider segment; the horse-segment
--       services are performed on the horse BY staff (client not participating).
--   R3  Services on the client's OWN/leased horse (service_types.requires_horse)
--       → + HORSE_EMERGENCY_VET; if also active/human-participating,
--       + HUMAN_EMERGENCY_MEDICAL (none of the requires_horse codes are
--       client-active, so R3 adds only the vet authorization).
--   RELEASE_GENERAL is the standalone visitor document → no matrix rows.
-- ------------------------------------------------------------
INSERT INTO contract_requirements (org_id, service_type, template_key)
SELECT (SELECT id FROM organizations ORDER BY created_at LIMIT 1), v.service_type, v.template_key
FROM (VALUES
  -- R1 + R2 — rider segment (on-property, client-active):
  --           RELEASE_PARTICIPANT + FACILITY_RULES + HUMAN_EMERGENCY_MEDICAL
  ('RIDING_LESSON',              'RELEASE_PARTICIPANT'),
  ('RIDING_LESSON',              'FACILITY_RULES'),
  ('RIDING_LESSON',              'HUMAN_EMERGENCY_MEDICAL'),
  ('JUMPER_TRAINING',            'RELEASE_PARTICIPANT'),
  ('JUMPER_TRAINING',            'FACILITY_RULES'),
  ('JUMPER_TRAINING',            'HUMAN_EMERGENCY_MEDICAL'),
  ('HORSEMANSHIP_TRAINING',      'RELEASE_PARTICIPANT'),
  ('HORSEMANSHIP_TRAINING',      'FACILITY_RULES'),
  ('HORSEMANSHIP_TRAINING',      'HUMAN_EMERGENCY_MEDICAL'),
  -- R1 + R3 — horse segment (on-property, client's own horse in our custody,
  --           staff-performed): RELEASE variant + FACILITY_RULES + HORSE_EMERGENCY_VET
  ('HORSE_TRAINING',             'RELEASE_HORSE_EXERCISE'),
  ('HORSE_TRAINING',             'FACILITY_RULES'),
  ('HORSE_TRAINING',             'HORSE_EMERGENCY_VET'),
  ('HORSE_EXERCISE',             'RELEASE_HORSE_EXERCISE'),
  ('HORSE_EXERCISE',             'FACILITY_RULES'),
  ('HORSE_EXERCISE',             'HORSE_EMERGENCY_VET'),
  ('HORSE_CLIPPING',             'RELEASE_HORSE_CARE'),
  ('HORSE_CLIPPING',             'FACILITY_RULES'),
  ('HORSE_CLIPPING',             'HORSE_EMERGENCY_VET'),
  -- R3 — support/brokerage codes with requires_horse = true (we handle the
  --      client's horse during evaluation/representation, off-property):
  --      HORSE_EMERGENCY_VET only
  ('HORSE_EVALUATION',           'HORSE_EMERGENCY_VET'),
  ('HORSE_PURCHASE_ASSISTANCE',  'HORSE_EMERGENCY_VET'),
  ('HORSE_SALE_ASSISTANCE',      'HORSE_EMERGENCY_VET'),
  ('HORSE_LEASE_IN_ASSISTANCE',  'HORSE_EMERGENCY_VET'),
  ('HORSE_LEASE_OUT_ASSISTANCE', 'HORSE_EMERGENCY_VET')
  -- HORSE_FINDER (consulting, no horse yet) and INDEPENDENT_CONTRACTOR
  -- (internal) require no signing set.
) AS v(service_type, template_key)
ON CONFLICT DO NOTHING;

-- ============================================================
-- 3. required_documents_for — the matrix lookup (SECURITY INVOKER: RLS applies,
--    so callers only ever see their own org's requirements)
-- ============================================================
CREATE OR REPLACE FUNCTION required_documents_for(p_service_type text)
RETURNS SETOF text
LANGUAGE sql STABLE SECURITY INVOKER
AS $fn$
  SELECT template_key FROM contract_requirements
  WHERE service_type = p_service_type
  ORDER BY template_key;
$fn$;

COMMENT ON FUNCTION required_documents_for(text) IS
  'Template_keys a purchase of the service requires signed (contract_requirements matrix; SECURITY INVOKER — org-scoped by RLS).';
