/*
  # French Heritage Equestrian — Platform Data Model

  Builds the full request → invitation → purchase → booking → payment model from
  architecture-flow-spec.md. Additive: the existing `bookings` and `inquiries`
  tables are left intact (the marketing inquiry funnel keeps working unchanged).

  ## New objects
  - is_admin() helper (SECURITY DEFINER) — reads profiles.is_admin for the caller
  - profiles, offerings, offering_tiers
  - requests, request_selections, invitations
  - availability_slots, orders, order_items, qualifier_answers
  - order_documents, bookings_v2, payments, payment_notifications
  - updated_at trigger helper

  ## Security model
  - RLS on every table.
  - User-scoped tables (orders, order_items, order_documents, bookings_v2,
    qualifier_answers, payments, profiles): a user may read/write only their own rows.
    Admins may read all (via is_admin()).
  - Public read: active offerings + tiers, and open availability_slots only.
  - requests + inquiries: anyone may INSERT (public forms); only admins may read.
  - invitations: readable by anyone holding the token (validated server-side / via
    a token lookup RPC); writable only by admins.
  - payment_notifications + reconciliation are written by server-only functions
    (service role bypasses RLS); no anon/auth policy grants access.
*/

-- ============================================================
-- Helpers
-- ============================================================

-- updated_at maintenance
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- ============================================================
-- profiles  (1:1 with auth.users)
-- ============================================================
CREATE TABLE IF NOT EXISTS profiles (
  user_id                 uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  first_name              text,
  last_name               text,
  email                   text,
  phone                   text,
  address_line1           text,
  address_line2           text,
  city                    text,
  state                   text,
  postal_code             text,
  is_admin                boolean NOT NULL DEFAULT false,
  created_from_request_id uuid,
  created_at              timestamptz NOT NULL DEFAULT now(),
  updated_at              timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

DROP TRIGGER IF EXISTS profiles_set_updated_at ON profiles;
CREATE TRIGGER profiles_set_updated_at BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Admin check. SECURITY DEFINER so the policy can read profiles without recursing
-- into profiles' own RLS. Returns false for anon.
CREATE OR REPLACE FUNCTION is_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT COALESCE(
    (SELECT p.is_admin FROM profiles p WHERE p.user_id = auth.uid()),
    false
  );
$$;

-- Profiles policies
DROP POLICY IF EXISTS profiles_select_own ON profiles;
CREATE POLICY profiles_select_own ON profiles
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR is_admin());

DROP POLICY IF EXISTS profiles_insert_own ON profiles;
CREATE POLICY profiles_insert_own ON profiles
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS profiles_update_own ON profiles;
CREATE POLICY profiles_update_own ON profiles
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid() OR is_admin())
  WITH CHECK (user_id = auth.uid() OR is_admin());

-- ============================================================
-- offerings + offering_tiers  (public catalog)
-- ============================================================
CREATE TABLE IF NOT EXISTS offerings (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  segment     text NOT NULL CHECK (segment IN ('rider', 'horse', 'support')),
  name        text NOT NULL,
  tagline     text,
  description text,
  slug        text UNIQUE NOT NULL,
  active      boolean NOT NULL DEFAULT true,
  sort_order  integer NOT NULL DEFAULT 0,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS offering_tiers (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  offering_id  uuid NOT NULL REFERENCES offerings(id) ON DELETE CASCADE,
  label        text NOT NULL,
  description  text,
  price_amount numeric(10,2) NOT NULL DEFAULT 0,
  price_unit   text NOT NULL CHECK (price_unit IN ('session','week','month','flat','percent')),
  price_min    numeric(10,2),
  note         text,
  is_popular   boolean NOT NULL DEFAULT false,
  sort_order   integer NOT NULL DEFAULT 0
);

ALTER TABLE offerings ENABLE ROW LEVEL SECURITY;
ALTER TABLE offering_tiers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS offerings_public_read ON offerings;
CREATE POLICY offerings_public_read ON offerings
  FOR SELECT TO anon, authenticated
  USING (active OR is_admin());

DROP POLICY IF EXISTS offering_tiers_public_read ON offering_tiers;
CREATE POLICY offering_tiers_public_read ON offering_tiers
  FOR SELECT TO anon, authenticated
  USING (
    is_admin() OR EXISTS (
      SELECT 1 FROM offerings o WHERE o.id = offering_tiers.offering_id AND o.active
    )
  );

-- Admin write on catalog
DROP POLICY IF EXISTS offerings_admin_write ON offerings;
CREATE POLICY offerings_admin_write ON offerings
  FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin());
DROP POLICY IF EXISTS offering_tiers_admin_write ON offering_tiers;
CREATE POLICY offering_tiers_admin_write ON offering_tiers
  FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin());

-- ============================================================
-- requests + request_selections  (unauthenticated inquiry)
-- ============================================================
CREATE TABLE IF NOT EXISTS requests (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at     timestamptz NOT NULL DEFAULT now(),
  status         text NOT NULL DEFAULT 'new'
                   CHECK (status IN ('new','contacted','invited','expired','converted')),
  contact_name   text NOT NULL,
  contact_email  text NOT NULL,
  contact_phone  text,
  contact_method text CHECK (contact_method IN ('text','call','email')),
  proposed_times jsonb NOT NULL DEFAULT '[]',
  notes          text
);

CREATE TABLE IF NOT EXISTS request_selections (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id  uuid NOT NULL REFERENCES requests(id) ON DELETE CASCADE,
  offering_id uuid REFERENCES offerings(id) ON DELETE SET NULL,
  offering_slug text,
  tier_id     uuid REFERENCES offering_tiers(id) ON DELETE SET NULL,
  label       text
);

ALTER TABLE requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE request_selections ENABLE ROW LEVEL SECURITY;

-- Anyone may submit a request (public form); only admins may read.
DROP POLICY IF EXISTS requests_anon_insert ON requests;
CREATE POLICY requests_anon_insert ON requests
  FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS requests_admin_read ON requests;
CREATE POLICY requests_admin_read ON requests
  FOR SELECT TO authenticated USING (is_admin());
DROP POLICY IF EXISTS requests_admin_update ON requests;
CREATE POLICY requests_admin_update ON requests
  FOR UPDATE TO authenticated USING (is_admin()) WITH CHECK (is_admin());

DROP POLICY IF EXISTS request_selections_anon_insert ON request_selections;
CREATE POLICY request_selections_anon_insert ON request_selections
  FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS request_selections_admin_read ON request_selections;
CREATE POLICY request_selections_admin_read ON request_selections
  FOR SELECT TO authenticated USING (is_admin());

-- ============================================================
-- invitations
-- ============================================================
CREATE TABLE IF NOT EXISTS invitations (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id      uuid REFERENCES requests(id) ON DELETE SET NULL,
  email           text NOT NULL,
  token           text UNIQUE NOT NULL,
  created_at      timestamptz NOT NULL DEFAULT now(),
  expires_at      timestamptz NOT NULL,
  status          text NOT NULL DEFAULT 'sent'
                    CHECK (status IN ('sent','accepted','expired','revoked')),
  loaded_slot_ids jsonb  -- null => show all open slots
);

ALTER TABLE invitations ENABLE ROW LEVEL SECURITY;

-- Token validation happens through a SECURITY DEFINER RPC (below), not direct
-- table reads, so no anon SELECT policy is granted. Admins manage invitations.
DROP POLICY IF EXISTS invitations_admin_all ON invitations;
CREATE POLICY invitations_admin_all ON invitations
  FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin());

-- Validate an invitation token without exposing the table. Returns the row if the
-- token is valid and unexpired, else nothing. Marks nothing — read-only check.
CREATE OR REPLACE FUNCTION validate_invitation(p_token text)
RETURNS TABLE (id uuid, email text, status text, expires_at timestamptz, request_id uuid)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT i.id, i.email, i.status, i.expires_at, i.request_id
  FROM invitations i
  WHERE i.token = p_token
    AND i.status = 'sent'
    AND i.expires_at > now();
$$;

-- ============================================================
-- availability_slots
-- ============================================================
CREATE TABLE IF NOT EXISTS availability_slots (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  start_at      timestamptz NOT NULL,
  end_at        timestamptz NOT NULL,
  slot_type     text NOT NULL DEFAULT 'consultation'
                  CHECK (slot_type IN ('consultation','onsite_visit','lesson','training','other')),
  capacity      integer NOT NULL DEFAULT 1,
  location_mode text NOT NULL DEFAULT 'onsite' CHECK (location_mode IN ('onsite','mobile')),
  status        text NOT NULL DEFAULT 'open' CHECK (status IN ('open','held','booked','blocked')),
  created_by    uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at    timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE availability_slots ENABLE ROW LEVEL SECURITY;

-- Public may read OPEN slots only; admins read all.
DROP POLICY IF EXISTS slots_public_read_open ON availability_slots;
CREATE POLICY slots_public_read_open ON availability_slots
  FOR SELECT TO anon, authenticated
  USING (status = 'open' OR is_admin());
DROP POLICY IF EXISTS slots_admin_write ON availability_slots;
CREATE POLICY slots_admin_write ON availability_slots
  FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin());

-- ============================================================
-- orders + order_items + qualifier_answers
-- ============================================================
CREATE TABLE IF NOT EXISTS orders (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),
  status            text NOT NULL DEFAULT 'draft'
                      CHECK (status IN ('draft','awaiting_payment','paid','confirmed','cancelled','expired')),
  payment_method    text CHECK (payment_method IN ('zelle','stripe')),
  subtotal          numeric(10,2) NOT NULL DEFAULT 0,
  fee               numeric(10,2) NOT NULL DEFAULT 0,
  total             numeric(10,2) NOT NULL DEFAULT 0,
  payment_reference text,
  unique_amount     numeric(10,2),
  paid_at           timestamptz,
  confirmed_at      timestamptz,
  expires_at        timestamptz
);

CREATE TABLE IF NOT EXISTS order_items (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id    uuid NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  offering_id uuid REFERENCES offerings(id) ON DELETE SET NULL,
  tier_id     uuid REFERENCES offering_tiers(id) ON DELETE SET NULL,
  label       text NOT NULL,
  price_amount numeric(10,2) NOT NULL DEFAULT 0,
  price_unit  text NOT NULL DEFAULT 'flat'
                CHECK (price_unit IN ('session','week','month','flat','percent')),
  price_min   numeric(10,2)
);

CREATE TABLE IF NOT EXISTS qualifier_answers (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id     uuid NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  question_key text NOT NULL,
  answer       text
);

ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE qualifier_answers ENABLE ROW LEVEL SECURITY;

DROP TRIGGER IF EXISTS orders_set_updated_at ON orders;
CREATE TRIGGER orders_set_updated_at BEFORE UPDATE ON orders
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Helper: does the current user own this order?
CREATE OR REPLACE FUNCTION owns_order(p_order_id uuid)
RETURNS boolean
LANGUAGE sql SECURITY DEFINER SET search_path = public STABLE AS $$
  SELECT EXISTS (
    SELECT 1 FROM orders o
    WHERE o.id = p_order_id AND (o.user_id = auth.uid() OR is_admin())
  );
$$;

-- Orders: owner read/write. NOTE: clients may never set paid/confirmed — those
-- transitions are made only by server-side functions (service role bypasses RLS).
DROP POLICY IF EXISTS orders_owner_select ON orders;
CREATE POLICY orders_owner_select ON orders
  FOR SELECT TO authenticated USING (user_id = auth.uid() OR is_admin());
DROP POLICY IF EXISTS orders_owner_insert ON orders;
CREATE POLICY orders_owner_insert ON orders
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS orders_owner_update ON orders;
CREATE POLICY orders_owner_update ON orders
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid() OR is_admin())
  WITH CHECK (
    is_admin() OR (
      user_id = auth.uid()
      -- clients may only move within pre-payment states
      AND status IN ('draft','awaiting_payment','cancelled')
    )
  );

DROP POLICY IF EXISTS order_items_owner_all ON order_items;
CREATE POLICY order_items_owner_all ON order_items
  FOR ALL TO authenticated
  USING (owns_order(order_id)) WITH CHECK (owns_order(order_id));

DROP POLICY IF EXISTS qualifier_answers_owner_all ON qualifier_answers;
CREATE POLICY qualifier_answers_owner_all ON qualifier_answers
  FOR ALL TO authenticated
  USING (owns_order(order_id)) WITH CHECK (owns_order(order_id));

-- ============================================================
-- order_documents
-- ============================================================
CREATE TABLE IF NOT EXISTS order_documents (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id      uuid NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  document_type text NOT NULL,
  signer_name   text,
  agreed_at     timestamptz,
  extra_fields  jsonb NOT NULL DEFAULT '{}'
);

ALTER TABLE order_documents ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS order_documents_owner_all ON order_documents;
CREATE POLICY order_documents_owner_all ON order_documents
  FOR ALL TO authenticated
  USING (owns_order(order_id)) WITH CHECK (owns_order(order_id));

-- ============================================================
-- bookings_v2  (slot booking tied to an order; distinct from legacy `bookings`)
-- ============================================================
CREATE TABLE IF NOT EXISTS bookings_v2 (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id   uuid NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  user_id    uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  slot_id    uuid REFERENCES availability_slots(id) ON DELETE SET NULL,
  status     text NOT NULL DEFAULT 'pending_slot'
               CHECK (status IN ('pending_slot','pending_payment','confirmed','cancelled','expired')),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE bookings_v2 ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS bookings_v2_owner_all ON bookings_v2;
CREATE POLICY bookings_v2_owner_all ON bookings_v2
  FOR ALL TO authenticated
  USING (user_id = auth.uid() OR is_admin())
  WITH CHECK (user_id = auth.uid() OR is_admin());

-- ============================================================
-- payments + payment_notifications  (server-managed)
-- ============================================================
CREATE TABLE IF NOT EXISTS payments (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id       uuid NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  method         text NOT NULL CHECK (method IN ('zelle','stripe')),
  amount         numeric(10,2) NOT NULL DEFAULT 0,
  reference_code text,
  status         text NOT NULL DEFAULT 'pending'
                   CHECK (status IN ('pending','matched','confirmed','review','failed','refunded')),
  match_confidence text,
  matched_at     timestamptz,
  created_at     timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS payment_notifications (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  received_at       timestamptz NOT NULL DEFAULT now(),
  source_inbox      text,
  raw_subject       text,
  raw_body          text,
  parsed_sender     text,
  parsed_amount     numeric(10,2),
  parsed_reference  text,
  matched_payment_id uuid REFERENCES payments(id) ON DELETE SET NULL,
  status            text NOT NULL DEFAULT 'unmatched'
                      CHECK (status IN ('unmatched','matched','review'))
);

ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_notifications ENABLE ROW LEVEL SECURITY;

-- Owners may READ their own payments (to render status); they may never write them.
DROP POLICY IF EXISTS payments_owner_read ON payments;
CREATE POLICY payments_owner_read ON payments
  FOR SELECT TO authenticated USING (owns_order(order_id));
-- No insert/update policy for authenticated → only the service role (server
-- reconciliation / Stripe webhook) can write payments. Admins read via is_admin.
DROP POLICY IF EXISTS payments_admin_read ON payments;
CREATE POLICY payments_admin_read ON payments
  FOR SELECT TO authenticated USING (is_admin());

-- payment_notifications: admins read; only service role writes (no anon/auth write).
DROP POLICY IF EXISTS payment_notifications_admin_read ON payment_notifications;
CREATE POLICY payment_notifications_admin_read ON payment_notifications
  FOR SELECT TO authenticated USING (is_admin());

-- ============================================================
-- Indexes
-- ============================================================
CREATE INDEX IF NOT EXISTS offerings_segment_idx ON offerings (segment, sort_order);
CREATE INDEX IF NOT EXISTS offering_tiers_offering_idx ON offering_tiers (offering_id, sort_order);
CREATE INDEX IF NOT EXISTS requests_status_idx ON requests (status, created_at DESC);
CREATE INDEX IF NOT EXISTS invitations_token_idx ON invitations (token);
CREATE INDEX IF NOT EXISTS invitations_status_idx ON invitations (status, expires_at);
CREATE INDEX IF NOT EXISTS slots_status_start_idx ON availability_slots (status, start_at);
CREATE INDEX IF NOT EXISTS orders_user_idx ON orders (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS orders_status_idx ON orders (status);
CREATE INDEX IF NOT EXISTS orders_unique_amount_idx ON orders (unique_amount);
CREATE INDEX IF NOT EXISTS order_items_order_idx ON order_items (order_id);
CREATE INDEX IF NOT EXISTS payments_order_idx ON payments (order_id);
CREATE INDEX IF NOT EXISTS payments_reference_idx ON payments (reference_code);
CREATE INDEX IF NOT EXISTS payment_notifications_status_idx ON payment_notifications (status, received_at DESC);
