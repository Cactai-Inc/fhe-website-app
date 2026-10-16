-- Horse records overhaul, phase 1: additive schema. New tables and columns only;
-- nothing is removed here (removals follow once every reader is re-pointed).

-- ── Designations (item 4) ───────────────────────────────────────────────────
-- A person carries zero or more designations per org; a designation is what puts
-- them on a staff picker. One contact record per person regardless of roles.
CREATE TABLE IF NOT EXISTS public.staff_designations (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id       uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  contact_id   uuid NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  designation  text NOT NULL CHECK (designation IN
                 ('trainer','groom','care_giver','instructor','support_staff','outside_provider')),
  created_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (org_id, contact_id, designation)
);
ALTER TABLE public.staff_designations ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS staff_designations_org_desig ON public.staff_designations (org_id, designation);
CREATE POLICY staff_designations_read ON public.staff_designations FOR SELECT
  USING (org_id = current_org() AND has_staff_access());
CREATE POLICY staff_designations_write ON public.staff_designations FOR ALL
  USING (org_id = current_org() AND has_staff_access())
  WITH CHECK (org_id = current_org() AND has_staff_access());

-- ── Care providers on horse_relationships (item 5) ──────────────────────────
-- Vet, farrier, trainer, groom, care giver, emergency contact, other — any number
-- per type, each linked to a contact when known or carrying the entered details.
ALTER TABLE public.horse_relationships
  DROP CONSTRAINT IF EXISTS horse_relationships_relationship_check;
ALTER TABLE public.horse_relationships
  ADD CONSTRAINT horse_relationships_relationship_check CHECK (relationship IN
    ('OWNER','LESSEE','BOARDER',
     'VET','FARRIER','TRAINER','GROOM','CARE_GIVER','EMERGENCY_CONTACT','OTHER'));
ALTER TABLE public.horse_relationships
  ADD COLUMN IF NOT EXISTS provider_role text
    CHECK (provider_role IS NULL OR provider_role IN ('primary','alternate','current','specialist')),
  ADD COLUMN IF NOT EXISTS role_label    text,
  ADD COLUMN IF NOT EXISTS business_name text,
  ADD COLUMN IF NOT EXISTS phone         text,
  ADD COLUMN IF NOT EXISTS email         text,
  ADD COLUMN IF NOT EXISTS address_line1 text,
  ADD COLUMN IF NOT EXISTS city          text,
  ADD COLUMN IF NOT EXISTS state         text,
  ADD COLUMN IF NOT EXISTS postal        text;
CREATE INDEX IF NOT EXISTS horse_relationships_horse_rel_active
  ON public.horse_relationships (horse_id, relationship, active);

-- ── Horse-owned locations with history (item 6) ─────────────────────────────
-- The horse owns its address. The open row (end_on IS NULL) is the current
-- location; changing location ends it and opens a new one. The shared locations
-- table stays only as the known-location option list for the picker.
CREATE TABLE IF NOT EXISTS public.horse_locations (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id        uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  horse_id      uuid NOT NULL REFERENCES horses(id) ON DELETE CASCADE,
  name          text,
  address_line1 text,
  city          text,
  state         text,
  postal        text,
  keeping_spots jsonb NOT NULL DEFAULT '[]'::jsonb,
  notes         text,
  start_on      date,
  end_on        date,
  created_at    timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.horse_locations ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS horse_locations_horse_open
  ON public.horse_locations (horse_id) WHERE end_on IS NULL;
CREATE POLICY horse_locations_read ON public.horse_locations FOR SELECT
  USING (org_id = current_org() AND (has_staff_access() OR client_can_read_horse(horse_id)));
CREATE POLICY horse_locations_write ON public.horse_locations FOR ALL
  USING (org_id = current_org() AND has_staff_access())
  WITH CHECK (org_id = current_org() AND has_staff_access());

-- ── Pending fields + narrative lists + injuries (items 2, 7) ────────────────
ALTER TABLE public.horses
  ADD COLUMN IF NOT EXISTS pending_fields     jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS medical_history_list    jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS behavioral_history_list jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS known_conditions_list   jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS training_history_list    jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS competition_history_list jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS injuries_to_humans       jsonb NOT NULL DEFAULT '[]'::jsonb;
