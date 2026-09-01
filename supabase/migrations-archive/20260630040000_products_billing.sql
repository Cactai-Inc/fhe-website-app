/*
  # FHE Suite — Products / Product Prices + billable_lines (U5, migration 29)
  Module: core.payments.  Depends on U2 (modules(module_key) FK + has_module()).

  Per PLATFORM_ARCHITECTURE.md §7.2: the per-tenant sellable catalog + the universal
  roll-up charge primitive. `service_types` (the 13-value catalog) is the taxonomy;
  `products` are the per-org sellable SKUs layered on top; prices reference the
  registry key, never literals. `billable_lines` is the ONE charge primitive that
  board / lessons / consumption / fees all emit into — it lives in CORE (not a
  module) because every module rolls up into it (§7.2 note).

  Seams (§2):
    products         — CORE with a per-row module gate: boundary (seam 1) + a
                       module_gate on `module_key` applied ONLY where module_key is
                       set (`module_key IS NULL OR has_module(module_key)`), so a
                       product owned by a disabled module is invisible/unwritable
                       while a plain core product (module_key NULL) is always visible.
    product_prices   — CORE: boundary (seam 1) + staff access. Effective-dated
                       price history; sales snapshot the amount at sale time.
    billable_lines   — CORE: boundary (seam 1) + staff RCUD + client read of own
                       lines (payer_contact_id = current_contact_id()). APPEND-ONLY
                       once settled — a per-row seal trigger mirroring signatures'
                       seal (§7.2 / §8.3): once status='SETTLED', substantive fields
                       are immutable and the row cannot be deleted, for everyone.

  Every table carries deleted_at/deleted_by (soft delete) and the mig-13 audit
  trigger (audit_row_change) so the §4.3 audit meta-test (e) passes; the trigger is
  attached idempotently (DROP TRIGGER IF EXISTS) so U14's fresh business_tables loop
  re-attaching it is a no-op double-attach, not a duplicate.
*/

-- ============================================================
-- products — per-org sellable SKUs (layered on service_types taxonomy)
--   module_key gates VISIBILITY (product follows its owning module); NULL = a
--   plain core product visible to every tenant that owns the row.
-- ============================================================
CREATE TABLE IF NOT EXISTS products (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id         uuid NOT NULL DEFAULT current_org() REFERENCES organizations(id),
  product_key    text NOT NULL,
  name           text NOT NULL,
  service_type   text REFERENCES service_types(code),         -- nullable taxonomy link
  module_key     text REFERENCES modules(module_key),         -- nullable; gates visibility
  price_value_key text,                                        -- registry key (PRICING.*)
  active         boolean NOT NULL DEFAULT true,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now(),
  deleted_at     timestamptz,
  deleted_by     uuid REFERENCES profiles(user_id) ON DELETE SET NULL,
  UNIQUE (org_id, product_key)
);

CREATE INDEX IF NOT EXISTS products_org_idx        ON products (org_id);
CREATE INDEX IF NOT EXISTS products_module_idx     ON products (module_key);
CREATE INDEX IF NOT EXISTS products_active_idx     ON products (deleted_at) WHERE deleted_at IS NULL;

DROP TRIGGER IF EXISTS products_set_updated_at ON products;
CREATE TRIGGER products_set_updated_at BEFORE UPDATE ON products
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ============================================================
-- product_prices — effective-dated price history (snapshotted at sale time)
-- ============================================================
CREATE TABLE IF NOT EXISTS product_prices (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id         uuid NOT NULL DEFAULT current_org() REFERENCES organizations(id),
  product_id     uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  amount         numeric(12,2) NOT NULL,
  effective_from timestamptz NOT NULL DEFAULT now(),
  effective_to   timestamptz,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now(),
  deleted_at     timestamptz,
  deleted_by     uuid REFERENCES profiles(user_id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS product_prices_org_idx     ON product_prices (org_id);
CREATE INDEX IF NOT EXISTS product_prices_product_idx ON product_prices (product_id, effective_from);

DROP TRIGGER IF EXISTS product_prices_set_updated_at ON product_prices;
CREATE TRIGGER product_prices_set_updated_at BEFORE UPDATE ON product_prices
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ============================================================
-- billable_lines — the universal charge primitive (core.payments)
--   board / lessons / consumption / fees all emit here, tagged by source_kind.
--   Rolls up into transactions via settle_billable_lines() (U17). APPEND-ONLY once
--   settled (seal trigger below), mirroring signatures.
-- ============================================================
CREATE TABLE IF NOT EXISTS billable_lines (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id           uuid NOT NULL DEFAULT current_org() REFERENCES organizations(id),
  payer_contact_id uuid NOT NULL REFERENCES contacts(id) ON DELETE RESTRICT,
  source_kind      text NOT NULL CHECK (source_kind IN ('consumption','board','lesson','fee')),
  source_id        uuid,
  horse_id         uuid REFERENCES horses(id) ON DELETE SET NULL,
  qty              numeric(12,4) NOT NULL DEFAULT 1,
  unit_amount      numeric(12,2) NOT NULL DEFAULT 0,
  amount           numeric(12,2) NOT NULL DEFAULT 0,
  status           text NOT NULL DEFAULT 'OPEN'
                     CHECK (status IN ('OPEN','SETTLED','VOID')),
  period           tstzrange,
  transaction_id   uuid REFERENCES transactions(id) ON DELETE SET NULL,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),
  deleted_at       timestamptz,
  deleted_by       uuid REFERENCES profiles(user_id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS billable_lines_org_idx      ON billable_lines (org_id);
CREATE INDEX IF NOT EXISTS billable_lines_payer_idx    ON billable_lines (payer_contact_id);
CREATE INDEX IF NOT EXISTS billable_lines_txn_idx      ON billable_lines (transaction_id);
CREATE INDEX IF NOT EXISTS billable_lines_source_idx   ON billable_lines (source_kind, source_id);

DROP TRIGGER IF EXISTS billable_lines_set_updated_at ON billable_lines;
CREATE TRIGGER billable_lines_set_updated_at BEFORE UPDATE ON billable_lines
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Append-only once SETTLED: mirroring signatures' seal (§7.2). Once a line is
-- SETTLED, its substantive fields are immutable and it cannot be deleted — even
-- for an ADMIN. The only permitted UPDATE on a SETTLED line is the archival
-- soft-delete columns changing (kept mutable for retention jobs); everything money
-- or attribution related is frozen. Re-settling is a no-op (status stays SETTLED).
CREATE OR REPLACE FUNCTION block_settled_billable_line_update()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.status = 'SETTLED' AND (
       NEW.payer_contact_id IS DISTINCT FROM OLD.payer_contact_id
    OR NEW.source_kind      IS DISTINCT FROM OLD.source_kind
    OR NEW.source_id        IS DISTINCT FROM OLD.source_id
    OR NEW.horse_id         IS DISTINCT FROM OLD.horse_id
    OR NEW.qty              IS DISTINCT FROM OLD.qty
    OR NEW.unit_amount      IS DISTINCT FROM OLD.unit_amount
    OR NEW.amount           IS DISTINCT FROM OLD.amount
    OR NEW.status           IS DISTINCT FROM OLD.status
    OR NEW.period           IS DISTINCT FROM OLD.period
    OR NEW.transaction_id   IS DISTINCT FROM OLD.transaction_id
    OR NEW.org_id           IS DISTINCT FROM OLD.org_id
  ) THEN
    RAISE EXCEPTION 'billable_line % is settled and append-only; it cannot be modified', OLD.id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS billable_lines_seal_after_settle ON billable_lines;
CREATE TRIGGER billable_lines_seal_after_settle BEFORE UPDATE ON billable_lines
  FOR EACH ROW EXECUTE FUNCTION block_settled_billable_line_update();

-- A SETTLED line is never hard-deletable (append-only). Void/archive via
-- status='VOID' or deleted_at instead. Fires only when OLD.status='SETTLED'.
CREATE OR REPLACE FUNCTION block_settled_billable_line_delete()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.status = 'SETTLED' THEN
    RAISE EXCEPTION 'billable_line % is settled and append-only; it cannot be deleted', OLD.id;
  END IF;
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS billable_lines_block_settled_delete ON billable_lines;
CREATE TRIGGER billable_lines_block_settled_delete BEFORE DELETE ON billable_lines
  FOR EACH ROW EXECUTE FUNCTION block_settled_billable_line_delete();

-- ============================================================
-- Audit triggers (mig-13 audit_row_change). Idempotent (DROP TRIGGER IF EXISTS)
-- so U14's fresh business_tables loop re-attaching them is a harmless no-op.
-- ============================================================
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['products','product_prices','billable_lines'] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS audit_%1$s ON %1$s', t);
    EXECUTE format(
      'CREATE TRIGGER audit_%1$s AFTER INSERT OR UPDATE OR DELETE ON %1$s '
      'FOR EACH ROW EXECUTE FUNCTION audit_row_change()', t);
  END LOOP;
END $$;

-- ============================================================
-- RLS
-- ============================================================
ALTER TABLE products       ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_prices ENABLE ROW LEVEL SECURITY;
ALTER TABLE billable_lines ENABLE ROW LEVEL SECURITY;

-- ---- products ----
-- seam 1: RESTRICTIVE tenancy boundary.
DROP POLICY IF EXISTS products_org_boundary ON products;
CREATE POLICY products_org_boundary ON products AS RESTRICTIVE FOR ALL TO authenticated
  USING (org_id = current_org()) WITH CHECK (org_id = current_org());

-- seam 2: RESTRICTIVE module gate applied ONLY where module_key is set — a product
-- owned by a disabled module is invisible AND unwritable; a plain core product
-- (module_key NULL) is unaffected. Written as a single RESTRICTIVE policy so it ANDs
-- with the boundary (never widens visibility).
DROP POLICY IF EXISTS products_module_gate ON products;
CREATE POLICY products_module_gate ON products AS RESTRICTIVE FOR ALL TO authenticated
  USING (module_key IS NULL OR has_module(module_key))
  WITH CHECK (module_key IS NULL OR has_module(module_key));

-- seam 3: access — staff RCUD; active/public rows also readable by any member of
-- the tenant (the boundary already scopes them to current_org()).
DROP POLICY IF EXISTS products_staff_all ON products;
CREATE POLICY products_staff_all ON products
  FOR ALL TO authenticated USING (has_staff_access()) WITH CHECK (has_staff_access());
DROP POLICY IF EXISTS products_member_read ON products;
CREATE POLICY products_member_read ON products
  FOR SELECT TO authenticated USING (active AND deleted_at IS NULL);

-- ---- product_prices ----
DROP POLICY IF EXISTS product_prices_org_boundary ON product_prices;
CREATE POLICY product_prices_org_boundary ON product_prices AS RESTRICTIVE FOR ALL TO authenticated
  USING (org_id = current_org()) WITH CHECK (org_id = current_org());

-- staff RCUD; any member of the tenant reads (prices drive pages/checkout).
DROP POLICY IF EXISTS product_prices_staff_all ON product_prices;
CREATE POLICY product_prices_staff_all ON product_prices
  FOR ALL TO authenticated USING (has_staff_access()) WITH CHECK (has_staff_access());
DROP POLICY IF EXISTS product_prices_member_read ON product_prices;
CREATE POLICY product_prices_member_read ON product_prices
  FOR SELECT TO authenticated USING (deleted_at IS NULL);

-- ---- billable_lines ----
DROP POLICY IF EXISTS billable_lines_org_boundary ON billable_lines;
CREATE POLICY billable_lines_org_boundary ON billable_lines AS RESTRICTIVE FOR ALL TO authenticated
  USING (org_id = current_org()) WITH CHECK (org_id = current_org());

-- staff RCUD (create/read/update/delete of open lines within the seal rules).
DROP POLICY IF EXISTS billable_lines_staff_all ON billable_lines;
CREATE POLICY billable_lines_staff_all ON billable_lines
  FOR ALL TO authenticated USING (has_staff_access()) WITH CHECK (has_staff_access());

-- a client reads ONLY their own lines (payer_contact_id = their contact).
DROP POLICY IF EXISTS billable_lines_client_read ON billable_lines;
CREATE POLICY billable_lines_client_read ON billable_lines
  FOR SELECT TO authenticated
  USING (deleted_at IS NULL AND payer_contact_id = current_contact_id());

-- Ledger hygiene: never bulk-DELETE at the grant level for anon/authenticated on a
-- settled ledger — the per-row seal trigger enforces append-only after settle, but
-- also block anon from any DELETE (they have no policy anyway; belt-and-braces
-- matching the signatures pattern).
REVOKE DELETE ON billable_lines FROM anon;
