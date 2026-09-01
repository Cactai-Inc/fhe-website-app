/*
  # FHE CRM — Engagements & Horses Backbone (migration 10)

  Phase 1, step 2 of the contract/transaction layer. Additive only; the nine
  prior migrations are untouched. Builds the operational spine the document
  layer hangs off:

  - horse lookups (horse_breeds, horse_colors) — enum strategy: values are
    data, not native PG enums, so admins extend without a migration.
  - horses — the equine record, with a HOR- human identifier and soft deletes.
    Never hard-deletable, including by ADMIN (security model §"never hard-delete"
    overrides the RCUD row in the access matrix — enforced by REVOKE DELETE).
  - engagements — the unit of work a client owns (ENG-YYYY-NNNNNN). A client
    NEVER edits engagement status directly; status moves via writes to other
    tables (intake, signatures) through the workflow engine. Hence no client
    insert/update policy — read-own only.
  - engagement_parties — the people on an engagement and their party role /
    relationship, the source of {{PARTY.*}} merges. Append rows; the contract
    routes to each is_signer party for typed-name signature later.

  Ownership model (per DATABASE_SECURITY_AND_PERMISSION_MODEL.md):
  - engagements: client owns when engagements.client_id = caller's client_id.
  - horses: visible when current_owner_contact_id = caller's contact_id OR the
    horse is referenced by an engagement the caller owns (a client must not see
    a horse merely because it exists).
  Ownership predicates are SECURITY DEFINER helpers so RLS does not recurse into
  the policies of the tables they read (same approach as migration 8).

  Token format ENG-YYYY-NNNNNN is canonical per MERGE_TOKEN_DICTIONARY.md.
*/

-- ============================================================
-- Yearly identifier generator — prefix + YYYY + zero-padded seq
-- (companion to assign_display_code(); used for ENG-2026-000001)
-- ============================================================
CREATE OR REPLACE FUNCTION assign_display_code_yearly()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.display_code IS NULL THEN
    NEW.display_code := TG_ARGV[0]
      || to_char(now(), 'YYYY') || '-'
      || lpad(nextval(TG_ARGV[1]::regclass)::text, 6, '0');
  END IF;
  RETURN NEW;
END;
$$;

CREATE SEQUENCE IF NOT EXISTS horse_code_seq START 1;
CREATE SEQUENCE IF NOT EXISTS engagement_code_seq START 1;

-- ============================================================
-- Lookups: horse_breeds, horse_colors
-- ============================================================
CREATE TABLE IF NOT EXISTS horse_breeds (
  code         text PRIMARY KEY,
  display_name text NOT NULL,
  active       boolean NOT NULL DEFAULT true,
  sort_order   integer NOT NULL DEFAULT 0
);

INSERT INTO horse_breeds (code, display_name, sort_order) VALUES
  ('WARMBLOOD',          'Warmblood (unspecified)', 1),
  ('DUTCH_WARMBLOOD',    'Dutch Warmblood (KWPN)',  2),
  ('HANOVERIAN',         'Hanoverian',              3),
  ('HOLSTEINER',         'Holsteiner',              4),
  ('OLDENBURG',          'Oldenburg',               5),
  ('THOROUGHBRED',       'Thoroughbred',            6),
  ('IRISH_SPORT_HORSE',  'Irish Sport Horse',       7),
  ('QUARTER_HORSE',      'Quarter Horse',           8),
  ('ARABIAN',            'Arabian',                 9),
  ('ANDALUSIAN',         'Andalusian (PRE)',        10),
  ('FRIESIAN',           'Friesian',                11),
  ('WELSH_PONY',         'Welsh Pony',              12),
  ('PONY',               'Pony (other)',            13),
  ('OTHER',              'Other / Crossbred',       99)
ON CONFLICT (code) DO UPDATE SET
  display_name = EXCLUDED.display_name, sort_order = EXCLUDED.sort_order;

CREATE TABLE IF NOT EXISTS horse_colors (
  code         text PRIMARY KEY,
  display_name text NOT NULL,
  active       boolean NOT NULL DEFAULT true,
  sort_order   integer NOT NULL DEFAULT 0
);

INSERT INTO horse_colors (code, display_name, sort_order) VALUES
  ('BAY',       'Bay',       1),
  ('DARK_BAY',  'Dark Bay / Brown', 2),
  ('CHESTNUT',  'Chestnut',  3),
  ('GREY',      'Grey',      4),
  ('BLACK',     'Black',     5),
  ('PALOMINO',  'Palomino',  6),
  ('BUCKSKIN',  'Buckskin',  7),
  ('DUN',       'Dun',       8),
  ('ROAN',      'Roan',      9),
  ('PINTO',     'Pinto / Paint', 10),
  ('CREMELLO',  'Cremello / Perlino', 11),
  ('GRULLA',    'Grulla',    12),
  ('WHITE',     'White',     13),
  ('OTHER',     'Other',     99)
ON CONFLICT (code) DO UPDATE SET
  display_name = EXCLUDED.display_name, sort_order = EXCLUDED.sort_order;

-- Lookups are world-readable (drive UI dropdowns); admin-writable.
ALTER TABLE horse_breeds ENABLE ROW LEVEL SECURITY;
ALTER TABLE horse_colors ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS horse_breeds_read ON horse_breeds;
CREATE POLICY horse_breeds_read ON horse_breeds
  FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS horse_breeds_admin_write ON horse_breeds;
CREATE POLICY horse_breeds_admin_write ON horse_breeds
  FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin());

DROP POLICY IF EXISTS horse_colors_read ON horse_colors;
CREATE POLICY horse_colors_read ON horse_colors
  FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS horse_colors_admin_write ON horse_colors;
CREATE POLICY horse_colors_admin_write ON horse_colors
  FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin());

-- ============================================================
-- horses — the equine record ({{HORSE.*}} merge source)
-- ============================================================
CREATE TABLE IF NOT EXISTS horses (
  id                       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  display_code             text UNIQUE,
  registered_name          text,
  barn_name                text,
  breed                    text REFERENCES horse_breeds(code) ON UPDATE CASCADE,
  color                    text REFERENCES horse_colors(code) ON UPDATE CASCADE,
  sex                      text CHECK (sex IN ('MARE','GELDING','STALLION','FILLY','COLT')),
  date_of_birth            date,
  height                   text,                 -- hands notation, e.g. "16.2hh"
  registration_number      text,
  microchip_id             text,
  current_location         text,
  current_owner_contact_id uuid REFERENCES contacts(id) ON DELETE SET NULL,
  notes                    text,
  created_at               timestamptz NOT NULL DEFAULT now(),
  updated_at               timestamptz NOT NULL DEFAULT now(),
  deleted_at               timestamptz,
  deleted_by               uuid REFERENCES profiles(user_id) ON DELETE SET NULL,
  -- a horse must carry at least one name to be identifiable on a contract
  CONSTRAINT horses_named CHECK (registered_name IS NOT NULL OR barn_name IS NOT NULL)
);

DROP TRIGGER IF EXISTS horses_assign_code ON horses;
CREATE TRIGGER horses_assign_code BEFORE INSERT ON horses
  FOR EACH ROW EXECUTE FUNCTION assign_display_code('HOR-', 'horse_code_seq');

DROP TRIGGER IF EXISTS horses_set_updated_at ON horses;
CREATE TRIGGER horses_set_updated_at BEFORE UPDATE ON horses
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ============================================================
-- engagements — the client's unit of work
-- ============================================================
CREATE TABLE IF NOT EXISTS engagements (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  display_code     text UNIQUE,
  client_id        uuid NOT NULL REFERENCES clients(id) ON DELETE RESTRICT,
  -- nullable today; a TRAINER role (deferred) will own rows where this maps to
  -- their profile. Roles-as-data, so no schema change to activate later.
  assigned_staff_id uuid REFERENCES profiles(user_id) ON DELETE SET NULL,
  service_type     text NOT NULL REFERENCES service_types(code),
  status           text NOT NULL DEFAULT 'LEAD' REFERENCES engagement_status(code),
  primary_horse_id uuid REFERENCES horses(id) ON DELETE SET NULL,
  start_date       date,
  notes            text,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),
  deleted_at       timestamptz,
  deleted_by       uuid REFERENCES profiles(user_id) ON DELETE SET NULL
);

DROP TRIGGER IF EXISTS engagements_assign_code ON engagements;
CREATE TRIGGER engagements_assign_code BEFORE INSERT ON engagements
  FOR EACH ROW EXECUTE FUNCTION assign_display_code_yearly('ENG-', 'engagement_code_seq');

DROP TRIGGER IF EXISTS engagements_set_updated_at ON engagements;
CREATE TRIGGER engagements_set_updated_at BEFORE UPDATE ON engagements
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ============================================================
-- engagement_parties — people on an engagement ({{PARTY.*}} source)
-- ============================================================
CREATE TABLE IF NOT EXISTS engagement_parties (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  engagement_id uuid NOT NULL REFERENCES engagements(id) ON DELETE CASCADE,
  contact_id    uuid NOT NULL REFERENCES contacts(id) ON DELETE RESTRICT,
  party_role    text NOT NULL CHECK (party_role IN (
                  'CLIENT','BUYER','SELLER','LESSOR','LESSEE','OWNER','RIDER',
                  'PARTICIPANT','PARENT','GUARDIAN','EMERGENCY_CONTACT',
                  'CONTRACTOR','FACILITY_CONTACT','FHE')),
  -- {{PARTY.RELATIONSHIP}} — e.g. "parent of participant"
  relationship  text,
  title         text,
  -- the contract routes to each signer party for typed-name signature
  is_signer     boolean NOT NULL DEFAULT false,
  signer_order  integer,
  created_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (engagement_id, contact_id, party_role)
);

-- ============================================================
-- Ownership predicates (SECURITY DEFINER — bypass RLS, no recursion)
-- ============================================================
CREATE OR REPLACE FUNCTION caller_owns_engagement(eng_id uuid)
RETURNS boolean LANGUAGE sql SECURITY DEFINER SET search_path = public STABLE AS $$
  SELECT EXISTS (
    SELECT 1 FROM engagements e
    WHERE e.id = eng_id
      AND e.deleted_at IS NULL
      AND e.client_id = current_client_id()
  );
$$;

CREATE OR REPLACE FUNCTION client_can_read_horse(h_id uuid)
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
-- RLS — horses
-- ============================================================
ALTER TABLE horses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS horses_select ON horses;
CREATE POLICY horses_select ON horses
  FOR SELECT TO authenticated
  USING (is_admin() OR client_can_read_horse(id));

DROP POLICY IF EXISTS horses_admin_write ON horses;
CREATE POLICY horses_admin_write ON horses
  FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin());

-- ============================================================
-- RLS — engagements (client reads own; never edits status directly)
-- ============================================================
ALTER TABLE engagements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS engagements_select ON engagements;
CREATE POLICY engagements_select ON engagements
  FOR SELECT TO authenticated
  USING (is_admin() OR (deleted_at IS NULL AND client_id = current_client_id()));

DROP POLICY IF EXISTS engagements_admin_write ON engagements;
CREATE POLICY engagements_admin_write ON engagements
  FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin());

-- ============================================================
-- RLS — engagement_parties (client reads parties of own engagements)
-- ============================================================
ALTER TABLE engagement_parties ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS engagement_parties_select ON engagement_parties;
CREATE POLICY engagement_parties_select ON engagement_parties
  FOR SELECT TO authenticated
  USING (is_admin() OR caller_owns_engagement(engagement_id));

DROP POLICY IF EXISTS engagement_parties_admin_write ON engagement_parties;
CREATE POLICY engagement_parties_admin_write ON engagement_parties
  FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin());

-- ============================================================
-- Never hard-deletable, including by ADMIN (security model overrides the RCUD
-- matrix row). Archival via deleted_at is the only removal mechanism. Also
-- closes the same gap on clients (created in migration 8 without the REVOKE).
-- ============================================================
REVOKE DELETE ON horses  FROM PUBLIC, anon, authenticated;
REVOKE DELETE ON clients FROM PUBLIC, anon, authenticated;

-- ============================================================
-- Indexes
-- ============================================================
CREATE INDEX IF NOT EXISTS horses_owner_idx        ON horses (current_owner_contact_id);
CREATE INDEX IF NOT EXISTS horses_active_idx        ON horses (deleted_at) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS engagements_client_idx    ON engagements (client_id);
CREATE INDEX IF NOT EXISTS engagements_status_idx     ON engagements (status) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS engagements_staff_idx      ON engagements (assigned_staff_id) WHERE assigned_staff_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS engagements_horse_idx      ON engagements (primary_horse_id) WHERE primary_horse_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS engagement_parties_eng_idx  ON engagement_parties (engagement_id);
CREATE INDEX IF NOT EXISTS engagement_parties_contact_idx ON engagement_parties (contact_id);
CREATE INDEX IF NOT EXISTS engagement_parties_signer_idx ON engagement_parties (engagement_id, signer_order) WHERE is_signer;
