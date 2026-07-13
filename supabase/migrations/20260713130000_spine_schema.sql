/*
  # Spine Refactor — Stage 1: additive schema (contracts + purchases)

  The spine (owner-confirmed): Category -> Offering -> Purchase -> Booking;
  Contract top-level; Documents on the client.

  This stage ONLY creates the new top-level tables + their children, behind the
  same org-scope + display-code + RLS conventions the rest of the schema uses.
  NOTHING is dropped and NOTHING is repointed here — the repoint + drop of
  orders / engagements / requests (each old table dropped in the SAME commit that
  wires its replacement) lands in Stage 2.

  `bookings` is deliberately NOT created here: the name collides with the
  pre-existing website-funnel `bookings` table, so the new bookings is born in
  Stage 2's drop commit — never two tables of the same name coexisting.

  Tables:
    contracts        — TOP-LEVEL deal entity (own contract_id). Precedes any
                       purchase; purchase_id NULLABLE, attaches on conversion.
    contract_parties — replaces engagement_parties at the contract level; folds
                       the per-party controls (can_fill/can_edit_deal/can_suggest).
    purchases        — a BASKET of offerings + payment + doc-gate. contract_id
                       NULLABLE (a simple lesson-pack purchase has no contract).
    purchase_items   — one offering line-item per row.

  Org scope: migration-26 recipe on every table — org_id NOT NULL DEFAULT
  current_org() REFERENCES organizations(id), an org_id index, a RESTRICTIVE
  <t>_org_boundary, and a PERMISSIVE staff-access policy. Member reads land later
  via SECURITY DEFINER RPCs (Stage 3); with no member policy these tables read
  EMPTY to non-staff, which is the intended stage-1 posture.
*/

-- ============================================================
-- contracts — the top-level deal (own contract_id, precedes purchase)
-- ============================================================
CREATE SEQUENCE IF NOT EXISTS contract_code_seq START 1;

CREATE TABLE IF NOT EXISTS contracts (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  display_code          text UNIQUE,
  org_id                uuid NOT NULL DEFAULT current_org() REFERENCES organizations(id),
  status                text NOT NULL DEFAULT 'draft'
                          CHECK (status IN ('draft','negotiating','signed','executed','void','declined')),
  segment               text CHECK (segment IN ('rider','horse','acquisition')),
  title                 text,
  horse_id              uuid REFERENCES horses(id) ON DELETE SET NULL,
  purchase_id           uuid,                    -- FK to purchases added at the end (table created below)
  originator_contact_id uuid REFERENCES contacts(id) ON DELETE SET NULL,  -- COMPANY originates
  effective_date        date,
  lease_start           date,
  lease_end             date,
  terms                 jsonb NOT NULL DEFAULT '{}'::jsonb,   -- flexible structured deal fields
  notes                 text,
  signed_at             timestamptz,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now(),
  deleted_at            timestamptz,
  deleted_by            uuid REFERENCES profiles(user_id) ON DELETE SET NULL
);

DROP TRIGGER IF EXISTS contracts_assign_code ON contracts;
CREATE TRIGGER contracts_assign_code BEFORE INSERT ON contracts
  FOR EACH ROW EXECUTE FUNCTION assign_display_code('CTR-', 'contract_code_seq');
DROP TRIGGER IF EXISTS contracts_set_updated_at ON contracts;
CREATE TRIGGER contracts_set_updated_at BEFORE UPDATE ON contracts
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE INDEX IF NOT EXISTS contracts_org_idx ON contracts(org_id);
CREATE INDEX IF NOT EXISTS contracts_horse_idx ON contracts(horse_id);
CREATE INDEX IF NOT EXISTS contracts_purchase_idx ON contracts(purchase_id);

ALTER TABLE contracts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS contracts_staff_all ON contracts;
CREATE POLICY contracts_staff_all ON contracts
  FOR ALL TO authenticated USING (has_staff_access()) WITH CHECK (has_staff_access());
DROP POLICY IF EXISTS contracts_org_boundary ON contracts;
CREATE POLICY contracts_org_boundary ON contracts AS RESTRICTIVE
  FOR ALL TO authenticated USING (org_id = current_org()) WITH CHECK (org_id = current_org());

-- ============================================================
-- contract_parties — deal parties (replaces engagement_parties at the contract
-- level) + the folded per-party controls
-- ============================================================
CREATE TABLE IF NOT EXISTS contract_parties (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id    uuid NOT NULL REFERENCES contracts(id) ON DELETE CASCADE,
  contact_id     uuid NOT NULL REFERENCES contacts(id) ON DELETE RESTRICT,
  party_role     text NOT NULL CHECK (party_role IN (
                   'CLIENT','BUYER','SELLER','LESSOR','LESSEE','OWNER','RIDER',
                   'PARTICIPANT','PARENT','GUARDIAN','EMERGENCY_CONTACT',
                   'CONTRACTOR','FACILITY_CONTACT','FHE')),
  relationship   text,
  title          text,
  is_signer      boolean NOT NULL DEFAULT false,
  signer_order   integer,
  can_fill       boolean NOT NULL DEFAULT false,
  can_edit_deal  boolean NOT NULL DEFAULT false,
  can_suggest    boolean NOT NULL DEFAULT false,
  org_id         uuid NOT NULL DEFAULT current_org() REFERENCES organizations(id),
  created_at     timestamptz NOT NULL DEFAULT now(),
  UNIQUE (contract_id, contact_id, party_role)
);

CREATE INDEX IF NOT EXISTS contract_parties_contract_idx ON contract_parties(contract_id);
CREATE INDEX IF NOT EXISTS contract_parties_contact_idx ON contract_parties(contact_id);
CREATE INDEX IF NOT EXISTS contract_parties_org_idx ON contract_parties(org_id);

ALTER TABLE contract_parties ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS contract_parties_staff_all ON contract_parties;
CREATE POLICY contract_parties_staff_all ON contract_parties
  FOR ALL TO authenticated USING (has_staff_access()) WITH CHECK (has_staff_access());
DROP POLICY IF EXISTS contract_parties_org_boundary ON contract_parties;
CREATE POLICY contract_parties_org_boundary ON contract_parties AS RESTRICTIVE
  FOR ALL TO authenticated USING (org_id = current_org()) WITH CHECK (org_id = current_org());

-- ============================================================
-- purchases — a BASKET of offerings + payment + doc-gate
-- ============================================================
CREATE SEQUENCE IF NOT EXISTS purchase_code_seq START 1;

CREATE TABLE IF NOT EXISTS purchases (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  display_code       text UNIQUE,
  org_id             uuid NOT NULL DEFAULT current_org() REFERENCES organizations(id),
  contract_id        uuid REFERENCES contracts(id) ON DELETE SET NULL,  -- NULL for a simple purchase
  buyer_contact_id   uuid REFERENCES contacts(id) ON DELETE RESTRICT,   -- the client the purchase is for
  buyer_user_id      uuid REFERENCES profiles(user_id) ON DELETE SET NULL,
  status             text NOT NULL DEFAULT 'draft'
                       CHECK (status IN ('draft','sent','awaiting_payment','paid','void')),
  amount             numeric NOT NULL DEFAULT 0,     -- basket total
  payment_method     text,                            -- 'zelle' | 'stripe' (open; matches orders.payment_method)
  payment_status     text NOT NULL DEFAULT 'unpaid'
                       CHECK (payment_status IN ('unpaid','pending','paid')),
  payment_reference  text,                            -- Zelle memo / match key
  unique_amount      numeric,                         -- exact-match amount (carried from the orders model)
  paid_at            timestamptz,
  notes              text,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now(),
  deleted_at         timestamptz,
  deleted_by         uuid REFERENCES profiles(user_id) ON DELETE SET NULL
);

DROP TRIGGER IF EXISTS purchases_assign_code ON purchases;
CREATE TRIGGER purchases_assign_code BEFORE INSERT ON purchases
  FOR EACH ROW EXECUTE FUNCTION assign_display_code('PUR-', 'purchase_code_seq');
DROP TRIGGER IF EXISTS purchases_set_updated_at ON purchases;
CREATE TRIGGER purchases_set_updated_at BEFORE UPDATE ON purchases
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE INDEX IF NOT EXISTS purchases_org_idx ON purchases(org_id);
CREATE INDEX IF NOT EXISTS purchases_contract_idx ON purchases(contract_id);
CREATE INDEX IF NOT EXISTS purchases_buyer_contact_idx ON purchases(buyer_contact_id);
CREATE INDEX IF NOT EXISTS purchases_buyer_user_idx ON purchases(buyer_user_id);

ALTER TABLE purchases ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS purchases_staff_all ON purchases;
CREATE POLICY purchases_staff_all ON purchases
  FOR ALL TO authenticated USING (has_staff_access()) WITH CHECK (has_staff_access());
DROP POLICY IF EXISTS purchases_org_boundary ON purchases;
CREATE POLICY purchases_org_boundary ON purchases AS RESTRICTIVE
  FOR ALL TO authenticated USING (org_id = current_org()) WITH CHECK (org_id = current_org());

-- ============================================================
-- purchase_items — one offering line-item per row
-- ============================================================
CREATE TABLE IF NOT EXISTS purchase_items (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  purchase_id   uuid NOT NULL REFERENCES purchases(id) ON DELETE CASCADE,
  offering_id   uuid REFERENCES offerings(id) ON DELETE SET NULL,
  label         text NOT NULL,                  -- snapshot of the offering name at add time
  price_amount  numeric NOT NULL DEFAULT 0,
  price_unit    text,
  quantity      integer NOT NULL DEFAULT 1 CHECK (quantity > 0),
  org_id        uuid NOT NULL DEFAULT current_org() REFERENCES organizations(id),
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS purchase_items_purchase_idx ON purchase_items(purchase_id);
CREATE INDEX IF NOT EXISTS purchase_items_offering_idx ON purchase_items(offering_id);
CREATE INDEX IF NOT EXISTS purchase_items_org_idx ON purchase_items(org_id);

ALTER TABLE purchase_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS purchase_items_staff_all ON purchase_items;
CREATE POLICY purchase_items_staff_all ON purchase_items
  FOR ALL TO authenticated USING (has_staff_access()) WITH CHECK (has_staff_access());
DROP POLICY IF EXISTS purchase_items_org_boundary ON purchase_items;
CREATE POLICY purchase_items_org_boundary ON purchase_items AS RESTRICTIVE
  FOR ALL TO authenticated USING (org_id = current_org()) WITH CHECK (org_id = current_org());

-- ============================================================
-- Late FK: contracts.purchase_id -> purchases (purchases now exists).
-- The signed deal converts to a paid purchase and stamps this back on the contract.
-- ============================================================
ALTER TABLE contracts DROP CONSTRAINT IF EXISTS contracts_purchase_id_fkey;
ALTER TABLE contracts ADD CONSTRAINT contracts_purchase_id_fkey
  FOREIGN KEY (purchase_id) REFERENCES purchases(id) ON DELETE SET NULL;
