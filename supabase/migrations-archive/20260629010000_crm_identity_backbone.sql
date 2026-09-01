/*
  # FHE CRM — Identity Backbone (migration 8)

  The first additive migration of the CRM/contract layer. Establishes the
  decision that the CONTACT (person) is the backbone of the business: every
  engagement, order, document, payment, and communication ultimately hangs off a
  contact, and marketing segments people by what hangs off them.

  Additive only — the seven deployed migrations are untouched. This migration:
  - Adds lookup tables (enum-strategy: values are data, not native PG enums) and
    seeds the finalized 13-service catalog + engagement status vocabulary.
  - Adds the identity spine: contacts, contact_roles, clients — each with a
    human identifier (CON-/CLI-) and soft-delete columns.
  - Bridges auth↔domain by linking profiles.contact_id -> contacts.id.
  - Reconciles the existing offerings catalog onto the 13 canonical service types
    (mapping, not destruction; defensively deactivates any killed-service names).
  - Applies RLS per DATABASE_SECURITY_AND_PERMISSION_MODEL.md: admin full access;
    a CLIENT may read/update only their own contact and read their own client row;
    soft-deleted rows vanish from non-admin reads.

  Canonical authority: the 13-value service catalog (security model §10) overrides
  any superseded service names anywhere.
*/

-- ============================================================
-- Lookup: service_types  (the finalized 13-service catalog)
-- ============================================================
CREATE TABLE IF NOT EXISTS service_types (
  code           text PRIMARY KEY,
  display_name   text NOT NULL,
  description    text,
  segment        text CHECK (segment IN ('rider','horse','support','internal')),
  requires_horse boolean NOT NULL DEFAULT false,
  active         boolean NOT NULL DEFAULT true,
  sort_order     integer NOT NULL DEFAULT 0
);

INSERT INTO service_types (code, display_name, description, segment, requires_horse, active, sort_order) VALUES
  ('HORSE_FINDER',             'Horse Finder',              'Sourcing and shortlisting horses matched to a client''s goals, budget, and experience.', 'support',  false, true, 1),
  ('HORSE_EVALUATION',         'Horse Evaluation',          'On-site evaluation of a horse under consideration: movement, temperament, training, soundness.', 'support', true, true, 2),
  ('HORSE_PURCHASE_ASSISTANCE','Horse Purchase Assistance', 'Representation of a buyer through a horse purchase transaction.', 'support', true, true, 3),
  ('HORSE_SALE_ASSISTANCE',    'Horse Sale Assistance',     'Representation of a seller through a horse sale transaction.', 'support', true, true, 4),
  ('HORSE_LEASE_IN_ASSISTANCE','Horse Lease-In Assistance', 'Representation of a lessee arranging a horse lease.', 'support', true, true, 5),
  ('HORSE_LEASE_OUT_ASSISTANCE','Horse Lease-Out Assistance','Representation of a lessor leasing a horse out.', 'support', true, true, 6),
  ('HORSE_TRAINING',           'Horse Training',            'Horse-specific training performed by FHE: training rides, development, behavioural and performance work.', 'horse', true, true, 7),
  ('HORSE_EXERCISE',           'Horse Exercise',            'Riding, exercising, and turning out a client''s horse on their behalf.', 'horse', true, true, 8),
  ('HORSE_CLIPPING',           'Horse Clipping',            'Specialized coat clipping: full body, trace, blanket, hunter, and custom clips.', 'horse', true, true, 9),
  ('RIDING_LESSON',            'Riding Lesson',             'Mounted instruction: position, flatwork, and riding skills.', 'rider', false, true, 10),
  ('JUMPER_TRAINING',          'Jumper Training',           'Jumping-specific instruction: grids, courses, and competition preparation.', 'rider', false, true, 11),
  ('HORSEMANSHIP_TRAINING',    'Horsemanship Training',     'Participant education in safely understanding and handling horses: handling, safety, grooming, tacking, stable practice.', 'rider', false, true, 12),
  ('INDEPENDENT_CONTRACTOR',   'Independent Contractor',    'Engagement of an independent contractor providing services to FHE.', 'internal', false, true, 13)
ON CONFLICT (code) DO UPDATE SET
  display_name = EXCLUDED.display_name, description = EXCLUDED.description,
  segment = EXCLUDED.segment, requires_horse = EXCLUDED.requires_horse,
  active = EXCLUDED.active, sort_order = EXCLUDED.sort_order;

-- ============================================================
-- Lookup: engagement_status  (the engagement lifecycle vocabulary)
-- ============================================================
CREATE TABLE IF NOT EXISTS engagement_status (
  code        text PRIMARY KEY,
  display_name text NOT NULL,
  is_terminal boolean NOT NULL DEFAULT false,
  sort_order  integer NOT NULL DEFAULT 0
);

INSERT INTO engagement_status (code, display_name, is_terminal, sort_order) VALUES
  ('LEAD',               'Lead',                false, 1),
  ('INTAKE_STARTED',     'Intake Started',      false, 2),
  ('INTAKE_COMPLETE',    'Intake Complete',     false, 3),
  ('CONTRACT_PENDING',   'Contract Pending',    false, 4),
  ('AWAITING_SIGNATURE', 'Awaiting Signature',  false, 5),
  ('ACTIVE',             'Active',              false, 6),
  ('COMPLETED',          'Completed',           true,  7),
  ('CANCELLED',          'Cancelled',           true,  8),
  ('ARCHIVED',           'Archived',            true,  9)
ON CONFLICT (code) DO UPDATE SET
  display_name = EXCLUDED.display_name, is_terminal = EXCLUDED.is_terminal, sort_order = EXCLUDED.sort_order;

-- Lookup tables are world-readable (drive UI dropdowns); admin-writable.
ALTER TABLE service_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE engagement_status ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS service_types_read ON service_types;
CREATE POLICY service_types_read ON service_types
  FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS service_types_admin_write ON service_types;
CREATE POLICY service_types_admin_write ON service_types
  FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin());

DROP POLICY IF EXISTS engagement_status_read ON engagement_status;
CREATE POLICY engagement_status_read ON engagement_status
  FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS engagement_status_admin_write ON engagement_status;
CREATE POLICY engagement_status_admin_write ON engagement_status
  FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin());

-- ============================================================
-- Human identifier sequences (CON-000001, CLI-000001)
-- ============================================================
CREATE SEQUENCE IF NOT EXISTS contact_code_seq START 1;
CREATE SEQUENCE IF NOT EXISTS client_code_seq START 1;

-- Compose a single-line address from structured parts (skips empty parts so there
-- are no stray commas). Declared IMMUTABLE so it can drive a generated column and
-- be reused by the document-merge layer for {{PARTY.ADDRESS}}.
CREATE OR REPLACE FUNCTION compose_address(
  line1 text, line2 text, city text, state text, postal text
) RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT NULLIF(array_to_string(ARRAY[
    NULLIF(trim(coalesce(line1,'') || ' ' || coalesce(line2,'')), ''),
    NULLIF(city, ''),
    NULLIF(trim(coalesce(state,'') || ' ' || coalesce(postal,'')), '')
  ], ', '), '');
$$;

-- ============================================================
-- contacts  — the universal person record (the backbone)
-- ============================================================
CREATE TABLE IF NOT EXISTS contacts (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  display_code   text UNIQUE,
  full_name      text NOT NULL,
  first_name     text,
  last_name      text,
  email          text,
  phone          text,
  address_line1  text,
  address_line2  text,
  city           text,
  state          text,
  postal_code    text,
  country        text DEFAULT 'USA',
  -- single-line composed address for {{PARTY.ADDRESS}} merges
  address_composed text GENERATED ALWAYS AS (
    compose_address(address_line1, address_line2, city, state, postal_code)
  ) STORED,
  date_of_birth  date,
  tags           text[] NOT NULL DEFAULT '{}',   -- marketing/segmentation
  notes          text,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now(),
  deleted_at     timestamptz,
  deleted_by     uuid REFERENCES profiles(user_id) ON DELETE SET NULL
);

-- Reusable identifier generator: prefix + zero-padded sequence value. ONE home for
-- every coded entity (CON-, CLI- now; HOR-, DOC- later) — the trigger supplies the
-- prefix and sequence name as arguments, so a new coded table is a one-line trigger,
-- not a copy-pasted function.
CREATE OR REPLACE FUNCTION assign_display_code()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.display_code IS NULL THEN
    NEW.display_code := TG_ARGV[0] || lpad(nextval(TG_ARGV[1]::regclass)::text, 6, '0');
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS contacts_assign_code ON contacts;
CREATE TRIGGER contacts_assign_code BEFORE INSERT ON contacts
  FOR EACH ROW EXECUTE FUNCTION assign_display_code('CON-', 'contact_code_seq');

DROP TRIGGER IF EXISTS contacts_set_updated_at ON contacts;
CREATE TRIGGER contacts_set_updated_at BEFORE UPDATE ON contacts
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ============================================================
-- contact_roles  — domain relationships (NOT application access)
-- ============================================================
CREATE TABLE IF NOT EXISTS contact_roles (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id uuid NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  role_type  text NOT NULL CHECK (role_type IN (
               'CLIENT','BUYER','SELLER','LESSOR','LESSEE','RIDER','PARTICIPANT',
               'GUARDIAN','PARENT','OWNER','EMERGENCY_CONTACT','CONTRACTOR','FACILITY_CONTACT')),
  title      text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (contact_id, role_type)
);

-- ============================================================
-- clients  — the business relationship record
-- ============================================================
CREATE TABLE IF NOT EXISTS clients (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  display_code text UNIQUE,
  contact_id   uuid NOT NULL UNIQUE REFERENCES contacts(id) ON DELETE CASCADE,
  status       text NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE','INACTIVE','ARCHIVED')),
  source       text,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  deleted_at   timestamptz,
  deleted_by   uuid REFERENCES profiles(user_id) ON DELETE SET NULL
);

DROP TRIGGER IF EXISTS clients_assign_code ON clients;
CREATE TRIGGER clients_assign_code BEFORE INSERT ON clients
  FOR EACH ROW EXECUTE FUNCTION assign_display_code('CLI-', 'client_code_seq');

DROP TRIGGER IF EXISTS clients_set_updated_at ON clients;
CREATE TRIGGER clients_set_updated_at BEFORE UPDATE ON clients
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ============================================================
-- Bridge: profiles.contact_id -> contacts.id
-- A logged-in user (profile) is also a person in the business (contact).
-- ============================================================
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS contact_id uuid REFERENCES contacts(id) ON DELETE SET NULL;

-- Resolve the caller's contact / client. SECURITY DEFINER so RLS policies can use
-- them without recursing into the policies of the tables they read.
CREATE OR REPLACE FUNCTION current_contact_id()
RETURNS uuid LANGUAGE sql SECURITY DEFINER SET search_path = public STABLE AS $$
  SELECT p.contact_id FROM profiles p WHERE p.user_id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION current_client_id()
RETURNS uuid LANGUAGE sql SECURITY DEFINER SET search_path = public STABLE AS $$
  SELECT c.id FROM clients c
  WHERE c.contact_id = current_contact_id() AND c.deleted_at IS NULL;
$$;

-- ============================================================
-- RLS — contacts / contact_roles / clients
-- ============================================================
ALTER TABLE contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE contact_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;

-- contacts: admin full; a client may read/update only their own linked contact.
-- Inserts are made by staff/admin or by SECURITY DEFINER RPCs (service role),
-- never directly by a portal client, so no broad insert policy is granted.
DROP POLICY IF EXISTS contacts_select ON contacts;
CREATE POLICY contacts_select ON contacts
  FOR SELECT TO authenticated
  USING (is_admin() OR (deleted_at IS NULL AND id = current_contact_id()));

DROP POLICY IF EXISTS contacts_admin_write ON contacts;
CREATE POLICY contacts_admin_write ON contacts
  FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin());

DROP POLICY IF EXISTS contacts_update_own ON contacts;
CREATE POLICY contacts_update_own ON contacts
  FOR UPDATE TO authenticated
  USING (id = current_contact_id() AND deleted_at IS NULL)
  WITH CHECK (id = current_contact_id());

-- contact_roles: admin full; owner reads roles on their own contact.
DROP POLICY IF EXISTS contact_roles_select ON contact_roles;
CREATE POLICY contact_roles_select ON contact_roles
  FOR SELECT TO authenticated
  USING (is_admin() OR contact_id = current_contact_id());
DROP POLICY IF EXISTS contact_roles_admin_write ON contact_roles;
CREATE POLICY contact_roles_admin_write ON contact_roles
  FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin());

-- clients: admin full; a client reads only their own client row.
DROP POLICY IF EXISTS clients_select ON clients;
CREATE POLICY clients_select ON clients
  FOR SELECT TO authenticated
  USING (is_admin() OR (deleted_at IS NULL AND contact_id = current_contact_id()));
DROP POLICY IF EXISTS clients_admin_write ON clients;
CREATE POLICY clients_admin_write ON clients
  FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin());

-- ============================================================
-- Catalog reconciliation — map existing offerings onto the 13 service types
-- (mapping, not destruction). Defensively deactivate any killed-service names.
-- ============================================================
ALTER TABLE offerings ADD COLUMN IF NOT EXISTS service_type text REFERENCES service_types(code);

UPDATE offerings SET service_type = m.code FROM (VALUES
  ('riding-lesson',  'RIDING_LESSON'),
  ('hunter-jumper',  'JUMPER_TRAINING'),
  ('horsemanship',   'HORSEMANSHIP_TRAINING'),
  ('horse-training', 'HORSE_TRAINING'),
  ('riding-turnout', 'HORSE_EXERCISE'),
  ('hair-clipping',  'HORSE_CLIPPING'),
  ('horse-locator',  'HORSE_FINDER'),
  ('evaluation',     'HORSE_EVALUATION'),
  ('brokering',      'HORSE_PURCHASE_ASSISTANCE')
) AS m(slug, code)
WHERE offerings.slug = m.slug AND offerings.service_type IS DISTINCT FROM m.code;

-- Belt-and-braces: if any killed-service offering ever exists, deactivate it.
UPDATE offerings SET active = false
WHERE active
  AND (
    lower(name) ~ '(grooming|horse care|bathing|mane pull|tack clean|turnout assist|show prep)'
    OR slug ~ '(grooming|horse-care|bathing|mane-pull|tack-clean|turnout-assist|show-prep)'
  );

-- ============================================================
-- Indexes
-- ============================================================
CREATE INDEX IF NOT EXISTS contacts_email_idx ON contacts (lower(email));
CREATE INDEX IF NOT EXISTS contacts_full_name_idx ON contacts (lower(full_name));
CREATE INDEX IF NOT EXISTS contacts_active_idx ON contacts (deleted_at) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS contact_roles_contact_idx ON contact_roles (contact_id, role_type);
CREATE INDEX IF NOT EXISTS clients_contact_idx ON clients (contact_id);
CREATE INDEX IF NOT EXISTS clients_status_idx ON clients (status) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS profiles_contact_idx ON profiles (contact_id);
CREATE INDEX IF NOT EXISTS offerings_service_type_idx ON offerings (service_type);
