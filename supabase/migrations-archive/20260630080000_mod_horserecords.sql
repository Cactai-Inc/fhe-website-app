/*
  # FHE Suite — Horse Records & Health (U9, migration 20260630080000)
                 module mod.horserecords

  Per PLATFORM_ARCHITECTURE.md §3, §7.6, §7.8. Two module tables that model
  tenancy-INDEPENDENT ownership/rights and the health log, but every row still
  carries `org_id` for the boundary (a horse is stabled-at exactly one org; §7.6
  cross-org portability is deliberately out of scope for launch).

    horse_parties        — the ownership/rights ledger AND the payer source the
                           cost-attribution ledger (mod.barnops) resolves against:
                           owner/lessee/trainer/caretaker/boarder + share_pct +
                           effective dates. NEVER hard-deletable (REVOKE DELETE);
                           soft-delete + (U14-attached) audit.
    horse_health_events  — vet/farrier/vaccination/deworming/coggins log, with an
                           optional provider contact and an optional link to a core
                           e-sign document (e.g. emergency vet auth).

  Seams (§2): both tables carry
    seam 1  RESTRICTIVE org_boundary  (org_id = current_org())
    seam 2  RESTRICTIVE module_gate   (has_module('mod.horserecords'))
    seam 3  PERMISSIVE access         — staff RCUD (has_staff_access + admin write);
            client reads where contact_id = current_contact_id() (horse_parties)
            OR caller_owns_horse(horse_id) (both tables).

  caller_owns_horse(h_id): a SECURITY DEFINER ownership predicate in the
  client_can_read_horse style (§7.6). A client "owns" a horse when they are its
  current owner-of-record contact OR they own an engagement referencing the horse.
  DEFINER so the client-read policies do not recurse into horses'/engagements' RLS.

  Payer resolution is org-bounded: caller_owns_horse and current_contact_id() both
  resolve for the caller's own tenant, and the RESTRICTIVE org_boundary ANDs on top,
  so a contact that is also a client of another org never leaks a cross-org party.

  Audit-trigger attachment is U14's sole responsibility (§8.3): this migration
  declares deleted_at/deleted_by + REVOKE DELETE, but attaches NO audit trigger.
*/

-- ============================================================
-- caller_owns_horse(h_id) — SECURITY DEFINER ownership predicate (§7.6).
-- Shaped exactly like client_can_read_horse (migration 10): read PAST RLS so the
-- client-read policies below never recurse into horses'/engagements' policies.
-- Ownership = owner-of-record contact OR owns an engagement referencing the horse.
-- ============================================================
CREATE OR REPLACE FUNCTION caller_owns_horse(h_id uuid)
RETURNS boolean LANGUAGE sql SECURITY DEFINER SET search_path = public STABLE AS $$
  SELECT EXISTS (
    SELECT 1 FROM horses h
    WHERE h.id = h_id
      AND h.deleted_at IS NULL
      AND (
        h.current_owner_contact_id = current_contact_id()
        OR EXISTS (
          SELECT 1 FROM engagements e
          WHERE e.primary_horse_id = h.id
            AND e.deleted_at IS NULL
            AND e.client_id = current_client_id()
        )
      )
  );
$$;

-- ============================================================
-- horse_parties — ownership/rights ledger + payer source (§7.6)
-- ============================================================
CREATE TABLE IF NOT EXISTS horse_parties (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id         uuid NOT NULL DEFAULT current_org() REFERENCES organizations(id),
  horse_id       uuid NOT NULL REFERENCES horses(id) ON DELETE RESTRICT,
  contact_id     uuid NOT NULL REFERENCES contacts(id) ON DELETE RESTRICT,
  role           text NOT NULL CHECK (role IN ('owner','lessee','trainer','caretaker','boarder')),
  share_pct      numeric(6,3),
  effective_from date,
  effective_to   date,
  notes          text,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now(),
  deleted_at     timestamptz,
  deleted_by     uuid REFERENCES profiles(user_id) ON DELETE SET NULL
);

DROP TRIGGER IF EXISTS horse_parties_set_updated_at ON horse_parties;
CREATE TRIGGER horse_parties_set_updated_at BEFORE UPDATE ON horse_parties
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ============================================================
-- horse_health_events — vet/farrier/vaccination/deworming/coggins log (§7.8)
-- ============================================================
CREATE TABLE IF NOT EXISTS horse_health_events (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id              uuid NOT NULL DEFAULT current_org() REFERENCES organizations(id),
  horse_id            uuid NOT NULL REFERENCES horses(id) ON DELETE RESTRICT,
  event_type          text NOT NULL,
  occurred_at         timestamptz NOT NULL DEFAULT now(),
  provider_contact_id uuid REFERENCES contacts(id) ON DELETE SET NULL,
  next_due            date,
  notes               text,
  document_id         uuid REFERENCES documents(id) ON DELETE SET NULL,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  deleted_at          timestamptz,
  deleted_by          uuid REFERENCES profiles(user_id) ON DELETE SET NULL
);

DROP TRIGGER IF EXISTS horse_health_events_set_updated_at ON horse_health_events;
CREATE TRIGGER horse_health_events_set_updated_at BEFORE UPDATE ON horse_health_events
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ============================================================
-- Seam 1 — tenancy boundary (RESTRICTIVE), migration-26 recipe (§8.1).
-- New tables born empty: DEFAULT current_org() + NOT NULL suffice, no backfill.
-- ============================================================
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['horse_parties','horse_health_events'] LOOP
    EXECUTE format('CREATE INDEX IF NOT EXISTS %I ON %I (org_id)', t||'_org_idx', t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I', t||'_org_boundary', t);
    EXECUTE format(
      'CREATE POLICY %I ON %I AS RESTRICTIVE FOR ALL TO authenticated '
      'USING (org_id = current_org()) WITH CHECK (org_id = current_org())',
      t||'_org_boundary', t);
  END LOOP;
END $$;

-- ============================================================
-- Seam 2 — module gate (RESTRICTIVE): mod.horserecords must be ON (§8.2).
-- A disabled module's rows are invisible AND unwritable even to that org's ADMIN.
-- ============================================================
ALTER TABLE horse_parties        ENABLE ROW LEVEL SECURITY;
ALTER TABLE horse_health_events  ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS horse_parties_module_gate ON horse_parties;
CREATE POLICY horse_parties_module_gate ON horse_parties AS RESTRICTIVE FOR ALL TO authenticated
  USING (has_module('mod.horserecords')) WITH CHECK (has_module('mod.horserecords'));

DROP POLICY IF EXISTS horse_health_events_module_gate ON horse_health_events;
CREATE POLICY horse_health_events_module_gate ON horse_health_events AS RESTRICTIVE FOR ALL TO authenticated
  USING (has_module('mod.horserecords')) WITH CHECK (has_module('mod.horserecords'));

-- ============================================================
-- Seam 3 — access (PERMISSIVE): staff RCUD; client reads own (§2, §7.6/§7.8).
-- ============================================================

-- horse_parties: staff of the tenant read all; ADMIN writes. A client reads a row
-- where they are the party contact OR they own the horse (owner/engagement).
DROP POLICY IF EXISTS horse_parties_staff_read ON horse_parties;
CREATE POLICY horse_parties_staff_read ON horse_parties
  FOR SELECT TO authenticated
  USING (has_staff_access());

DROP POLICY IF EXISTS horse_parties_client_read ON horse_parties;
CREATE POLICY horse_parties_client_read ON horse_parties
  FOR SELECT TO authenticated
  USING (deleted_at IS NULL AND (contact_id = current_contact_id() OR caller_owns_horse(horse_id)));

DROP POLICY IF EXISTS horse_parties_admin_write ON horse_parties;
CREATE POLICY horse_parties_admin_write ON horse_parties
  FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin());

-- horse_health_events: staff read all; ADMIN writes. Owner reads own horse's log.
DROP POLICY IF EXISTS horse_health_events_staff_read ON horse_health_events;
CREATE POLICY horse_health_events_staff_read ON horse_health_events
  FOR SELECT TO authenticated
  USING (has_staff_access());

DROP POLICY IF EXISTS horse_health_events_client_read ON horse_health_events;
CREATE POLICY horse_health_events_client_read ON horse_health_events
  FOR SELECT TO authenticated
  USING (deleted_at IS NULL AND caller_owns_horse(horse_id));

DROP POLICY IF EXISTS horse_health_events_admin_write ON horse_health_events;
CREATE POLICY horse_health_events_admin_write ON horse_health_events
  FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin());

-- ============================================================
-- horse_parties is NEVER hard-deletable, including by ADMIN (§7.6). Archival via
-- deleted_at is the only removal mechanism (mirrors horses/clients migration 10).
-- horse_health_events keeps the standard soft-delete without a DELETE revoke.
-- ============================================================
REVOKE DELETE ON horse_parties FROM PUBLIC, anon, authenticated;

-- ============================================================
-- Indexes
-- ============================================================
CREATE INDEX IF NOT EXISTS horse_parties_horse_idx   ON horse_parties (horse_id);
CREATE INDEX IF NOT EXISTS horse_parties_contact_idx ON horse_parties (contact_id);
CREATE INDEX IF NOT EXISTS horse_parties_active_idx   ON horse_parties (deleted_at) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS horse_health_events_horse_idx     ON horse_health_events (horse_id);
CREATE INDEX IF NOT EXISTS horse_health_events_provider_idx  ON horse_health_events (provider_contact_id) WHERE provider_contact_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS horse_health_events_document_idx   ON horse_health_events (document_id) WHERE document_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS horse_health_events_next_due_idx   ON horse_health_events (next_due) WHERE next_due IS NOT NULL;
