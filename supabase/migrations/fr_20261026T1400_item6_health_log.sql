-- Fix round 3, item 6 — health log on the horse record.
--
-- Builds on the existing horse_relationships (providers) and horse_health_events
-- (events) and the horse-health storage bucket. Extends all three to item 6's
-- shape and widens write access to the horse's owner and active lessee, not just
-- staff.
--
--  1. Provider roles: VET, FARRIER, DENTIST, BODYWORK, ACUPUNCTURE, MASSAGE,
--     CHIROPRACTIC, OTHER (free-text role_label for OTHER). A provider row is a
--     company (business_name + company phone/email) with a person under it
--     (party_contact_id / party_name_text + person phone/email). Several companies
--     per role and several people per company = several rows.
--  2. horse_health_events: event_date, structured jsonb (type-specific fields),
--     created_by, and a provider COMPANY + PERSON reference (provider_company_id /
--     provider_person_id, plus the existing provider_contact_id kept for the CARE
--     clauses). next_due already exists.
--  3. horse_health_event_files: one or more files per event, in the horse-health
--     bucket, horse-scoped.
--  4. RLS: the owner and active lessee may read AND write events + files + provider
--     rows for their horse; deleting an event stays staff-only.

BEGIN;

-- ── 1. provider roles ────────────────────────────────────────────────────────
ALTER TABLE horse_relationships DROP CONSTRAINT IF EXISTS horse_relationships_relationship_check;
ALTER TABLE horse_relationships ADD CONSTRAINT horse_relationships_relationship_check
  CHECK (relationship = ANY (ARRAY[
    'OWNER','LESSEE','BOARDER','EMERGENCY_CONTACT','CARE_GIVER','GROOM','TRAINER',
    'VET','FARRIER','DENTIST','BODYWORK','ACUPUNCTURE','MASSAGE','CHIROPRACTIC','OTHER']));

-- the person's own phone/email (the existing phone/email are the COMPANY's).
ALTER TABLE horse_relationships ADD COLUMN IF NOT EXISTS person_phone text;
ALTER TABLE horse_relationships ADD COLUMN IF NOT EXISTS person_email text;

-- ── 2. horse_health_events columns ───────────────────────────────────────────
ALTER TABLE horse_health_events ADD COLUMN IF NOT EXISTS event_date date;
ALTER TABLE horse_health_events ADD COLUMN IF NOT EXISTS structured jsonb NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE horse_health_events ADD COLUMN IF NOT EXISTS created_by uuid;
ALTER TABLE horse_health_events ADD COLUMN IF NOT EXISTS provider_company_id uuid REFERENCES horse_relationships(id) ON DELETE SET NULL;
ALTER TABLE horse_health_events ADD COLUMN IF NOT EXISTS provider_person_id uuid REFERENCES horse_relationships(id) ON DELETE SET NULL;
-- backfill event_date from occurred_at for any pre-existing rows.
UPDATE horse_health_events SET event_date = occurred_at::date WHERE event_date IS NULL AND occurred_at IS NOT NULL;

-- ── 3. attachments table ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS horse_health_event_files (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL,
  horse_id uuid NOT NULL REFERENCES horses(id) ON DELETE CASCADE,
  event_id uuid NOT NULL REFERENCES horse_health_events(id) ON DELETE CASCADE,
  storage_path text NOT NULL,
  file_name text,
  content_type text,
  size_bytes bigint,
  uploaded_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);
CREATE INDEX IF NOT EXISTS idx_hhef_event ON horse_health_event_files(event_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_hhef_horse ON horse_health_event_files(horse_id) WHERE deleted_at IS NULL;
ALTER TABLE horse_health_event_files ENABLE ROW LEVEL SECURITY;

-- ── 4. RLS — owner/active-lessee may read AND write; delete stays staff-only ──
-- Events: add a client WRITE policy (insert/update) for the horse's owner or active
-- lessee. The existing admin_write (*) and client_read (r) stay; the org boundary
-- and module gate stay. Deletes are gated separately below.
DROP POLICY IF EXISTS horse_health_events_client_write ON horse_health_events;
CREATE POLICY horse_health_events_client_write ON horse_health_events
  FOR INSERT TO authenticated
  WITH CHECK (org_id = current_org() AND caller_owns_horse(horse_id));
DROP POLICY IF EXISTS horse_health_events_client_update ON horse_health_events;
CREATE POLICY horse_health_events_client_update ON horse_health_events
  FOR UPDATE TO authenticated
  USING (deleted_at IS NULL AND caller_owns_horse(horse_id))
  WITH CHECK (caller_owns_horse(horse_id));

-- Attachment files: owner/lessee and staff read+write; follows the horse.
DROP POLICY IF EXISTS hhef_org_boundary ON horse_health_event_files;
CREATE POLICY hhef_org_boundary ON horse_health_event_files
  FOR ALL TO authenticated USING (org_id = current_org()) WITH CHECK (org_id = current_org());
DROP POLICY IF EXISTS hhef_read ON horse_health_event_files;
CREATE POLICY hhef_read ON horse_health_event_files
  FOR SELECT TO authenticated
  USING (deleted_at IS NULL AND (has_staff_access() OR caller_owns_horse(horse_id)));
DROP POLICY IF EXISTS hhef_write ON horse_health_event_files;
CREATE POLICY hhef_write ON horse_health_event_files
  FOR INSERT TO authenticated
  WITH CHECK (has_staff_access() OR caller_owns_horse(horse_id));
DROP POLICY IF EXISTS hhef_update ON horse_health_event_files;
CREATE POLICY hhef_update ON horse_health_event_files
  FOR UPDATE TO authenticated
  USING (has_staff_access() OR caller_owns_horse(horse_id))
  WITH CHECK (has_staff_access() OR caller_owns_horse(horse_id));

GRANT SELECT, INSERT, UPDATE ON horse_health_event_files TO authenticated;

COMMIT;
