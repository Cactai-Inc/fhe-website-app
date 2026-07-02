/*
  # FHE Suite — Boarding & Facility (U10, migration 20260630090000)
                 module mod.boarding

  Per PLATFORM_ARCHITECTURE.md §3, §7.5, §8. Four module tables modeling the
  per-tenant boarding operation. Ships day one; FHE (tier.lesson_brokerage) leaves
  mod.boarding DISABLED, so on tenant #1 these tables are present-but-gated-off.

    facilities        — the physical property: org_id, name, address_value_key
                        (a registry key resolving the address via config_value).
    stalls            — a stall within a facility: facility_id, code, stall_type,
                        active.
    board_agreements  — the per-horse boarding contract: horse_id, stall_id,
                        boarder_contact_id, board_rate (DEFAULTED from the registry
                        config_value('BOARDING','DEFAULT_BOARD_RATE')), board_type,
                        start_date, end_date, status. NEVER hard-deletable
                        (REVOKE DELETE); soft-delete + (U14-attached) audit only.
    board_charges     — recurring/period charges: board_agreement_id, period_start,
                        period_end, amount, billable_line_id → billable_lines(id).
                        Deterministic (rate × period); EMITS into billable_lines
                        (source_kind='board') so board billing flows through the one
                        universal charge primitive (§7.2, §7.11).

  Seams (§2): all four tables carry
    seam 1  RESTRICTIVE org_boundary  (org_id = current_org())
    seam 2  RESTRICTIVE module_gate   (has_module('mod.boarding'))
    seam 3  PERMISSIVE access         — staff RCUD (has_staff_access + admin write);
            the boarder reads OWN board_agreement / board_charges
            (boarder_contact_id = current_contact_id()).

  Depends on U2 (module gate + has_module()) and U5 (billable_lines, config_value
  via U3). Audit-trigger attachment is U14's sole responsibility (§8.3): this
  migration declares deleted_at/deleted_by + REVOKE DELETE on board_agreements, but
  attaches NO audit trigger.
*/

-- ============================================================
-- facilities — the physical property (parent of stalls/agreements)
-- ============================================================
CREATE TABLE IF NOT EXISTS facilities (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id            uuid NOT NULL DEFAULT current_org() REFERENCES organizations(id),
  name              text NOT NULL,
  address_value_key text,                                       -- registry key (CONTACT/ADDRESS.*)
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),
  deleted_at        timestamptz,
  deleted_by        uuid REFERENCES profiles(user_id) ON DELETE SET NULL
);

DROP TRIGGER IF EXISTS facilities_set_updated_at ON facilities;
CREATE TRIGGER facilities_set_updated_at BEFORE UPDATE ON facilities
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ============================================================
-- stalls — a stall within a facility
-- ============================================================
CREATE TABLE IF NOT EXISTS stalls (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id       uuid NOT NULL DEFAULT current_org() REFERENCES organizations(id),
  facility_id  uuid NOT NULL REFERENCES facilities(id) ON DELETE RESTRICT,
  code         text NOT NULL,
  stall_type   text,
  active       boolean NOT NULL DEFAULT true,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  deleted_at   timestamptz,
  deleted_by   uuid REFERENCES profiles(user_id) ON DELETE SET NULL,
  UNIQUE (facility_id, code)
);

DROP TRIGGER IF EXISTS stalls_set_updated_at ON stalls;
CREATE TRIGGER stalls_set_updated_at BEFORE UPDATE ON stalls
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ============================================================
-- board_agreements — the per-horse boarding contract.
--   board_rate DEFAULTS from the registry (§7.5): config_value('BOARDING',
--   'DEFAULT_BOARD_RATE') is SECURITY DEFINER + STABLE and resolves for the
--   inserting tenant's current_org(), so a write that omits board_rate picks up the
--   tenant's default rate — GLOBAL-VALUE-CHANGES-RULE-THE-DAY (§1.2). NULL when the
--   tenant has not set the key (an explicit board_rate always overrides).
-- ============================================================
CREATE TABLE IF NOT EXISTS board_agreements (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id             uuid NOT NULL DEFAULT current_org() REFERENCES organizations(id),
  horse_id           uuid NOT NULL REFERENCES horses(id) ON DELETE RESTRICT,
  stall_id           uuid REFERENCES stalls(id) ON DELETE SET NULL,
  boarder_contact_id uuid NOT NULL REFERENCES contacts(id) ON DELETE RESTRICT,
  board_rate         numeric(12,2) DEFAULT NULLIF(config_value('BOARDING','DEFAULT_BOARD_RATE'), '')::numeric,
  board_type         text,
  start_date         date,
  end_date           date,
  status             text NOT NULL DEFAULT 'ACTIVE'
                       CHECK (status IN ('ACTIVE','ENDED','SUSPENDED','CANCELLED')),
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now(),
  deleted_at         timestamptz,
  deleted_by         uuid REFERENCES profiles(user_id) ON DELETE SET NULL
);

DROP TRIGGER IF EXISTS board_agreements_set_updated_at ON board_agreements;
CREATE TRIGGER board_agreements_set_updated_at BEFORE UPDATE ON board_agreements
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ============================================================
-- board_charges — recurring/period charges emitted into billable_lines.
--   billable_line_id references the core universal charge primitive (source_kind
--   'board'); a charge is deterministic (rate × period). RESTRICT the delete of a
--   linked billable_line so a settled charge cannot orphan its ledger line.
-- ============================================================
CREATE TABLE IF NOT EXISTS board_charges (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id             uuid NOT NULL DEFAULT current_org() REFERENCES organizations(id),
  board_agreement_id uuid NOT NULL REFERENCES board_agreements(id) ON DELETE RESTRICT,
  period_start       date NOT NULL,
  period_end         date NOT NULL,
  amount             numeric(12,2) NOT NULL DEFAULT 0,
  billable_line_id   uuid REFERENCES billable_lines(id) ON DELETE SET NULL,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now(),
  deleted_at         timestamptz,
  deleted_by         uuid REFERENCES profiles(user_id) ON DELETE SET NULL
);

DROP TRIGGER IF EXISTS board_charges_set_updated_at ON board_charges;
CREATE TRIGGER board_charges_set_updated_at BEFORE UPDATE ON board_charges
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ============================================================
-- Seam 1 — tenancy boundary (RESTRICTIVE), migration-26 recipe (§8.1).
-- New tables born empty: DEFAULT current_org() + NOT NULL suffice, no backfill.
-- ============================================================
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['facilities','stalls','board_agreements','board_charges'] LOOP
    EXECUTE format('CREATE INDEX IF NOT EXISTS %I ON %I (org_id)', t||'_org_idx', t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I', t||'_org_boundary', t);
    EXECUTE format(
      'CREATE POLICY %I ON %I AS RESTRICTIVE FOR ALL TO authenticated '
      'USING (org_id = current_org()) WITH CHECK (org_id = current_org())',
      t||'_org_boundary', t);
  END LOOP;
END $$;

-- ============================================================
-- Seam 2 — module gate (RESTRICTIVE): mod.boarding must be ON (§8.2).
-- A disabled module's rows are invisible AND unwritable even to that org's ADMIN.
-- ============================================================
ALTER TABLE facilities       ENABLE ROW LEVEL SECURITY;
ALTER TABLE stalls           ENABLE ROW LEVEL SECURITY;
ALTER TABLE board_agreements ENABLE ROW LEVEL SECURITY;
ALTER TABLE board_charges    ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['facilities','stalls','board_agreements','board_charges'] LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I', t||'_module_gate', t);
    EXECUTE format(
      'CREATE POLICY %I ON %I AS RESTRICTIVE FOR ALL TO authenticated '
      'USING (has_module(''mod.boarding'')) WITH CHECK (has_module(''mod.boarding''))',
      t||'_module_gate', t);
  END LOOP;
END $$;

-- ============================================================
-- Seam 3 — access (PERMISSIVE): staff RCUD; boarder reads own (§2, §7.5).
-- ============================================================

-- ---- facilities: staff-only operational surface (no client read path) ----
DROP POLICY IF EXISTS facilities_staff_all ON facilities;
CREATE POLICY facilities_staff_all ON facilities
  FOR ALL TO authenticated USING (has_staff_access()) WITH CHECK (has_staff_access());
DROP POLICY IF EXISTS facilities_admin_write ON facilities;
CREATE POLICY facilities_admin_write ON facilities
  FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin());

-- ---- stalls: staff-only ----
DROP POLICY IF EXISTS stalls_staff_all ON stalls;
CREATE POLICY stalls_staff_all ON stalls
  FOR ALL TO authenticated USING (has_staff_access()) WITH CHECK (has_staff_access());
DROP POLICY IF EXISTS stalls_admin_write ON stalls;
CREATE POLICY stalls_admin_write ON stalls
  FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin());

-- ---- board_agreements: staff read/write; the boarder reads OWN agreement ----
DROP POLICY IF EXISTS board_agreements_staff_read ON board_agreements;
CREATE POLICY board_agreements_staff_read ON board_agreements
  FOR SELECT TO authenticated USING (has_staff_access());
DROP POLICY IF EXISTS board_agreements_client_read ON board_agreements;
CREATE POLICY board_agreements_client_read ON board_agreements
  FOR SELECT TO authenticated
  USING (deleted_at IS NULL AND boarder_contact_id = current_contact_id());
DROP POLICY IF EXISTS board_agreements_admin_write ON board_agreements;
CREATE POLICY board_agreements_admin_write ON board_agreements
  FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin());

-- ---- board_charges: staff read/write; the boarder reads OWN charges (via the
--      owning agreement's boarder_contact_id) ----
DROP POLICY IF EXISTS board_charges_staff_read ON board_charges;
CREATE POLICY board_charges_staff_read ON board_charges
  FOR SELECT TO authenticated USING (has_staff_access());
DROP POLICY IF EXISTS board_charges_client_read ON board_charges;
CREATE POLICY board_charges_client_read ON board_charges
  FOR SELECT TO authenticated
  USING (deleted_at IS NULL AND EXISTS (
    SELECT 1 FROM board_agreements ba
    WHERE ba.id = board_charges.board_agreement_id
      AND ba.boarder_contact_id = current_contact_id()
  ));
DROP POLICY IF EXISTS board_charges_admin_write ON board_charges;
CREATE POLICY board_charges_admin_write ON board_charges
  FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin());

-- ============================================================
-- board_agreements is NEVER hard-deletable, including by ADMIN (§7.5). Archival via
-- deleted_at / status is the only removal mechanism (mirrors horses/board contract
-- pattern). The other three keep the standard soft-delete without a DELETE revoke.
-- ============================================================
REVOKE DELETE ON board_agreements FROM PUBLIC, anon, authenticated;

-- ============================================================
-- Indexes
-- ============================================================
CREATE INDEX IF NOT EXISTS stalls_facility_idx            ON stalls (facility_id);
CREATE INDEX IF NOT EXISTS board_agreements_horse_idx     ON board_agreements (horse_id);
CREATE INDEX IF NOT EXISTS board_agreements_boarder_idx   ON board_agreements (boarder_contact_id);
CREATE INDEX IF NOT EXISTS board_agreements_stall_idx     ON board_agreements (stall_id) WHERE stall_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS board_agreements_active_idx     ON board_agreements (deleted_at) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS board_charges_agreement_idx     ON board_charges (board_agreement_id);
CREATE INDEX IF NOT EXISTS board_charges_billable_idx      ON board_charges (billable_line_id) WHERE billable_line_id IS NOT NULL;
