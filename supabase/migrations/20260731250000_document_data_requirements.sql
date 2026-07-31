-- ─────────────────────────────────────────────────────────────────────────────
-- DOCUMENT DATA REQUIREMENTS (2026-07-31, owner)
--
-- THE MODEL, working backwards from where the data is actually needed:
--
--   DOCUMENT  a token in a signable document is the REASON a field matters.
--      ↓       Derived, not hand-listed: the tokens below come from scanning the
--              onboarding templates' bodies and the lease's clause bodies, so
--              this cannot drift from the documents it exists to serve.
--   RECORD    the person or horse record is where the data LIVES and where the
--      ↓       requirement is enforced — but only once a document that needs it
--              has actually been assigned. An empty field on a record nobody is
--              asking anything of is not a problem.
--   INTAKE    the form is where data is COLLECTED. Required there means "you
--              will be warned", never "you are blocked": someone should be able
--              to give us what they have today and finish later.
--
-- What the system does about a gap is NOTIFY, never block — and only when an
-- assigned document actually depends on it.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS document_data_requirements (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- 'contact' or 'horse' — which record holds the value.
  subject       text NOT NULL CHECK (subject IN ('contact','horse')),
  column_name   text NOT NULL,
  -- What the person sees. Never a column name.
  label         text NOT NULL,
  -- Which document families need it, for the notification's wording.
  needed_for    text[] NOT NULL DEFAULT '{}',
  -- Ordering within its subject, so a notification lists fields sensibly.
  sort_order    int NOT NULL DEFAULT 100,
  active        boolean NOT NULL DEFAULT true,
  UNIQUE (subject, column_name)
);

COMMENT ON TABLE document_data_requirements IS
  'THE registry of record fields that signable documents depend on. One row per '
  'field, derived from the tokens those documents actually use. Read by the '
  'intake forms (to warn), the record surfaces (to mark required) and the '
  'dashboard (to notify) — so all three agree by construction rather than by '
  'three hand-maintained lists drifting apart.';

ALTER TABLE document_data_requirements ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS ddr_read ON document_data_requirements;
CREATE POLICY ddr_read ON document_data_requirements
  FOR SELECT TO authenticated USING (true);

-- ── The person fields, from the onboarding tokens + the lease's party tokens ──
INSERT INTO document_data_requirements (subject, column_name, label, needed_for, sort_order) VALUES
  ('contact','first_name',                       'First name',                 ARRAY['onboarding','lease'], 10),
  ('contact','last_name',                        'Last name',                  ARRAY['onboarding','lease'], 20),
  ('contact','email',                            'Email',                      ARRAY['onboarding','lease'], 30),
  ('contact','phone',                            'Phone',                      ARRAY['onboarding','lease'], 40),
  ('contact','date_of_birth',                    'Date of birth',              ARRAY['onboarding'],         50),
  ('contact','address_line1',                    'Street address',             ARRAY['onboarding','lease'], 60),
  ('contact','city',                             'City',                       ARRAY['onboarding','lease'], 70),
  ('contact','state',                            'State',                      ARRAY['onboarding','lease'], 80),
  ('contact','postal_code',                      'ZIP',                        ARRAY['onboarding','lease'], 90),
  ('contact','emergency_contact_1_name',         'Emergency contact name',     ARRAY['onboarding'],        100),
  ('contact','emergency_contact_1_phone',        'Emergency contact phone',    ARRAY['onboarding'],        110),
  ('contact','emergency_contact_1_relationship', 'Emergency contact relationship', ARRAY['onboarding'],    120)
ON CONFLICT (subject, column_name) DO NOTHING;

-- ── The horse fields, from the horse-care documents + the lease ──────────────
INSERT INTO document_data_requirements (subject, column_name, label, needed_for, sort_order) VALUES
  ('horse','registered_name',    'Registered name',     ARRAY['onboarding','lease'], 10),
  ('horse','breed',              'Breed',               ARRAY['onboarding','lease'], 20),
  ('horse','color',              'Color',               ARRAY['onboarding','lease'], 30),
  ('horse','sex',                'Sex',                 ARRAY['onboarding','lease'], 40),
  ('horse','date_of_birth',      'Date of birth',       ARRAY['onboarding','lease'], 50),
  ('horse','current_location',   'Current location',    ARRAY['onboarding','lease'], 60),
  ('horse','vet_name',           'Veterinarian',        ARRAY['onboarding','lease'], 70),
  ('horse','vet_phone',          'Vet phone',           ARRAY['onboarding','lease'], 80),
  ('horse','farrier_name',       'Farrier',             ARRAY['onboarding','lease'], 90),
  ('horse','farrier_phone',      'Farrier phone',       ARRAY['onboarding','lease'],100),
  ('horse','fair_market_value',  'Fair market value',   ARRAY['lease'],             110)
ON CONFLICT (subject, column_name) DO NOTHING;
