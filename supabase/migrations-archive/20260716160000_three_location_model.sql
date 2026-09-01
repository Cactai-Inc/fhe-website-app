-- THREE-LOCATION MODEL (lease scope). A horse's location was a single free-text
-- current_location; it must be three distinct facts, each referencing the scoped
-- `locations` entity:
--
--   1. Home Location    — where the horse normally resides for boarding.
--                         Set by owner / staff-on-behalf.
--   2. Contract Location — where the horse resides during a contract term; ONE OR
--                         MORE, each with OPTIONAL dates. Set by lessee / staff-on-
--                         behalf (either party in creation). The "locate the horse"
--                         list (boarding only).
--   3. Current Location — where the horse actually is now. Set/updated by lessee /
--                         staff-on-behalf; either party may update. Changes only to
--                         reflect reality, per the lease terms.
--
-- On lease execution: contract locations are recorded on the horse; home is
-- untouched; current is untouched (only moves when the horse physically moves);
-- nothing auto-reverts at term end.

-- Home + Current as single refs on the horse. Legacy free-text current_location
-- is retained (read-only during transition) so nothing is lost.
ALTER TABLE horses
  ADD COLUMN IF NOT EXISTS home_location_id    uuid REFERENCES locations(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS current_location_id uuid REFERENCES locations(id) ON DELETE SET NULL;

-- Contract Location(s): a horse ↔ many locations, each with optional dates and the
-- contract that set them. This is the boarding "locate" list.
CREATE TABLE IF NOT EXISTS horse_contract_locations (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id       uuid NOT NULL DEFAULT current_org() REFERENCES organizations(id) ON DELETE CASCADE,
  horse_id     uuid NOT NULL REFERENCES horses(id) ON DELETE CASCADE,
  location_id  uuid NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  starts_on    date,                 -- optional
  ends_on      date,                 -- optional
  source_document_id uuid REFERENCES documents(id) ON DELETE SET NULL,
  active       boolean NOT NULL DEFAULT true,
  created_at   timestamptz NOT NULL DEFAULT now(),
  created_by_contact_id uuid REFERENCES contacts(id) ON DELETE SET NULL,
  UNIQUE (horse_id, location_id, source_document_id)
);

ALTER TABLE horse_contract_locations ENABLE ROW LEVEL SECURITY;

-- Read: staff org-wide, or a party who owns/leases the horse.
DROP POLICY IF EXISTS hcl_read ON horse_contract_locations;
CREATE POLICY hcl_read ON horse_contract_locations
  FOR SELECT USING (
    org_id = current_org() AND (
      has_staff_access()
      OR EXISTS (SELECT 1 FROM horses h WHERE h.id = horse_id
                 AND current_contact_id() IN (h.current_owner_contact_id, h.lessee_contact_id))
    )
  );

-- Write: staff, or the horse's owner/lessee (either party may maintain the list).
DROP POLICY IF EXISTS hcl_write ON horse_contract_locations;
CREATE POLICY hcl_write ON horse_contract_locations
  FOR ALL USING (
    org_id = current_org() AND (
      has_staff_access()
      OR EXISTS (SELECT 1 FROM horses h WHERE h.id = horse_id
                 AND current_contact_id() IN (h.current_owner_contact_id, h.lessee_contact_id))
    )
  ) WITH CHECK (
    org_id = current_org() AND (
      has_staff_access()
      OR EXISTS (SELECT 1 FROM horses h WHERE h.id = horse_id
                 AND current_contact_id() IN (h.current_owner_contact_id, h.lessee_contact_id))
    )
  );

CREATE INDEX IF NOT EXISTS idx_hcl_horse ON horse_contract_locations(horse_id) WHERE active;

-- ── Backfill: migrate the free-text current_location to a locations row + set the
--    horse's current + home to it (best-effort; unmatched names create a location). ──
DO $backfill$
DECLARE
  h  record;
  v_loc uuid;
BEGIN
  FOR h IN
    SELECT id, org_id, nullif(btrim(current_location), '') AS loc
    FROM horses
    WHERE deleted_at IS NULL AND nullif(btrim(current_location), '') IS NOT NULL
      AND current_location_id IS NULL
  LOOP
    -- reuse an existing barn/matching location by name, else create a barn-wide one
    SELECT id INTO v_loc FROM locations
     WHERE org_id = h.org_id AND lower(name) = lower(h.loc) AND active
     ORDER BY (owner_contact_id IS NULL) DESC LIMIT 1;
    IF v_loc IS NULL THEN
      INSERT INTO locations (org_id, name, is_offsite, is_default, active)
      VALUES (h.org_id, h.loc, false, false, true)
      RETURNING id INTO v_loc;
    END IF;
    UPDATE horses
       SET current_location_id = v_loc,
           home_location_id = coalesce(home_location_id, v_loc)
     WHERE id = h.id;
  END LOOP;
END
$backfill$;
