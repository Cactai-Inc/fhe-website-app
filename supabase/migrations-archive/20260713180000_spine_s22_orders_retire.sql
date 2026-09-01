/*
  # Spine Refactor — Slice 2.2 (finalizing): retire orders + bookings_v2 onto the spine

  One atomic change (no-parallel-systems): `purchases` replaces `orders` as the
  basket, the new spine `bookings` replaces the legacy funnel `bookings` AND
  `bookings_v2`, the slot machinery is rewritten once onto purchases+bookings, and
  the whole orders family is dropped. Volume is test-only (orders=2, order_items=2,
  everything else 0), so this is a clean rebuild, not a data migration.

  Sections: A prep (transitional links) · B new bookings · C slot machinery ·
  D bridge + admin reader · E drops.
*/

-- ── A. transitional links ────────────────────────────────────────────────────
ALTER TABLE request_selections ADD COLUMN IF NOT EXISTS purchase_id uuid REFERENCES purchases(id) ON DELETE SET NULL;

-- payment_notifications (Zelle email audit) matched a payments row; it now matches
-- a purchase directly (payments is retired below).
ALTER TABLE payment_notifications DROP CONSTRAINT IF EXISTS payment_notifications_matched_payment_id_fkey;
ALTER TABLE payment_notifications RENAME COLUMN matched_payment_id TO matched_purchase_id;
ALTER TABLE payment_notifications
  ADD CONSTRAINT payment_notifications_matched_purchase_id_fkey
  FOREIGN KEY (matched_purchase_id) REFERENCES purchases(id) ON DELETE SET NULL;

-- ── B. new spine bookings (legacy funnel bookings: 0 rows, no code refs) ──────
DROP TABLE IF EXISTS bookings CASCADE;

CREATE SEQUENCE IF NOT EXISTS booking_code_seq START 1;

CREATE TABLE bookings (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  display_code       text UNIQUE,
  org_id             uuid NOT NULL DEFAULT current_org() REFERENCES organizations(id),
  purchase_id        uuid REFERENCES purchases(id) ON DELETE CASCADE,   -- the booking is off a purchase
  contract_id        uuid REFERENCES contracts(id) ON DELETE SET NULL,
  account_user_id    uuid REFERENCES profiles(user_id) ON DELETE SET NULL,
  account_contact_id uuid REFERENCES contacts(id) ON DELETE SET NULL,
  offering_id        uuid REFERENCES offerings(id) ON DELETE SET NULL,
  slot_id            uuid REFERENCES availability_slots(id) ON DELETE SET NULL,
  starts_at          timestamptz,
  ends_at            timestamptz,
  location           text,
  status             text NOT NULL DEFAULT 'pending_slot'
                       CHECK (status IN ('pending_slot','pending_payment','confirmed','cancelled','expired','completed')),
  hold_expires_at    timestamptz,
  notes              text,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now()
);

DROP TRIGGER IF EXISTS bookings_assign_code ON bookings;
CREATE TRIGGER bookings_assign_code BEFORE INSERT ON bookings
  FOR EACH ROW EXECUTE FUNCTION assign_display_code('BKG-', 'booking_code_seq');
DROP TRIGGER IF EXISTS bookings_set_updated_at ON bookings;
CREATE TRIGGER bookings_set_updated_at BEFORE UPDATE ON bookings
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE INDEX IF NOT EXISTS bookings_org_idx      ON bookings(org_id);
CREATE INDEX IF NOT EXISTS bookings_purchase_idx ON bookings(purchase_id);
CREATE INDEX IF NOT EXISTS bookings_slot_idx     ON bookings(slot_id);
CREATE INDEX IF NOT EXISTS bookings_account_idx  ON bookings(account_user_id);

ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS bookings_staff_all ON bookings;
CREATE POLICY bookings_staff_all ON bookings
  FOR ALL TO authenticated USING (has_staff_access()) WITH CHECK (has_staff_access());
DROP POLICY IF EXISTS bookings_self_read ON bookings;
CREATE POLICY bookings_self_read ON bookings
  FOR SELECT TO authenticated USING (account_user_id = auth.uid());
DROP POLICY IF EXISTS bookings_org_boundary ON bookings;
CREATE POLICY bookings_org_boundary ON bookings AS RESTRICTIVE
  FOR ALL TO authenticated USING (org_id = current_org()) WITH CHECK (org_id = current_org());

-- ── C. slot machinery on purchases + bookings ────────────────────────────────
DROP FUNCTION IF EXISTS hold_slot(uuid, uuid);
CREATE OR REPLACE FUNCTION hold_slot(p_purchase_id uuid, p_slot_id uuid)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_user    uuid := auth.uid();
  v_owns    boolean;
  v_buyer   uuid;
  v_booking uuid;
  v_start   timestamptz;
  v_end     timestamptz;
BEGIN
  SELECT (p.buyer_user_id = v_user OR is_admin()), p.buyer_user_id
    INTO v_owns, v_buyer
    FROM purchases p WHERE p.id = p_purchase_id AND p.deleted_at IS NULL;
  IF NOT COALESCE(v_owns, false) THEN
    RAISE EXCEPTION 'not authorized for this purchase';
  END IF;

  PERFORM 1 FROM availability_slots WHERE id = p_slot_id AND status = 'open' FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'slot is not available';
  END IF;
  SELECT start_at, end_at INTO v_start, v_end FROM availability_slots WHERE id = p_slot_id;

  -- release any prior hold this purchase had on a different slot
  UPDATE availability_slots s SET status = 'open'
   WHERE s.id IN (
     SELECT b.slot_id FROM bookings b
      WHERE b.purchase_id = p_purchase_id AND b.slot_id <> p_slot_id
        AND b.status IN ('pending_slot','pending_payment')
   ) AND s.status = 'held';

  UPDATE availability_slots SET status = 'held' WHERE id = p_slot_id;

  SELECT id INTO v_booking FROM bookings WHERE purchase_id = p_purchase_id LIMIT 1;
  IF v_booking IS NULL THEN
    INSERT INTO bookings (purchase_id, account_user_id, slot_id, starts_at, ends_at, status)
    VALUES (p_purchase_id, v_buyer, p_slot_id, v_start, v_end, 'pending_slot')
    RETURNING id INTO v_booking;
  ELSE
    UPDATE bookings SET slot_id = p_slot_id, starts_at = v_start, ends_at = v_end, status = 'pending_slot'
     WHERE id = v_booking;
  END IF;

  RETURN v_booking;
END;
$$;
GRANT EXECUTE ON FUNCTION hold_slot(uuid, uuid) TO authenticated, service_role;

-- release_booking_hold: same signature, now over bookings
CREATE OR REPLACE FUNCTION release_booking_hold(p_booking_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_slot uuid; v_owns boolean;
BEGIN
  SELECT b.slot_id, (b.account_user_id = auth.uid() OR is_admin())
    INTO v_slot, v_owns FROM bookings b WHERE b.id = p_booking_id;
  IF NOT COALESCE(v_owns, false) THEN
    RAISE EXCEPTION 'not authorized';
  END IF;
  UPDATE availability_slots SET status = 'open' WHERE id = v_slot AND status = 'held';
  UPDATE bookings SET status = 'cancelled', slot_id = NULL WHERE id = p_booking_id;
END;
$$;

DROP FUNCTION IF EXISTS confirm_booking_for_order(uuid);
CREATE OR REPLACE FUNCTION confirm_booking_for_purchase(p_purchase_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_slot uuid;
BEGIN
  SELECT slot_id INTO v_slot FROM bookings WHERE purchase_id = p_purchase_id LIMIT 1;
  IF v_slot IS NOT NULL THEN
    UPDATE availability_slots SET status = 'booked' WHERE id = v_slot;
  END IF;
  UPDATE bookings SET status = 'confirmed' WHERE purchase_id = p_purchase_id;
END;
$$;
GRANT EXECUTE ON FUNCTION confirm_booking_for_purchase(uuid) TO authenticated, service_role;

-- release_expired_holds was orders-based and unused (the live reaper is
-- reap_expired_holds, request_selections-based). Drop it.
DROP FUNCTION IF EXISTS release_expired_holds();

-- ── D. bridge + admin reader ─────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION create_purchase_from_engagement(p_engagement_id uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $fn$
DECLARE
  v_uid      uuid := auth.uid();
  v_eng      engagements%ROWTYPE;
  v_cp       client_purchases%ROWTYPE;
  v_contact  uuid;
  v_purchase uuid;
  v_own      boolean;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'authentication required'; END IF;
  SELECT * INTO v_eng FROM engagements WHERE id = p_engagement_id AND deleted_at IS NULL;
  IF NOT FOUND THEN RAISE EXCEPTION 'unknown engagement'; END IF;
  SELECT cl.contact_id INTO v_contact FROM clients cl WHERE cl.id = v_eng.client_id;
  SELECT EXISTS (SELECT 1 FROM clients cl JOIN profiles p ON p.contact_id = cl.contact_id
                 WHERE cl.id = v_eng.client_id AND p.id = v_uid) INTO v_own;
  IF NOT v_own THEN RAISE EXCEPTION 'not your engagement'; END IF;

  SELECT rs.purchase_id INTO v_purchase FROM request_selections rs
    WHERE rs.engagement_id = p_engagement_id AND rs.purchase_id IS NOT NULL LIMIT 1;
  IF v_purchase IS NOT NULL THEN
    PERFORM 1 FROM purchases WHERE id = v_purchase AND status <> 'void' AND deleted_at IS NULL;
    IF FOUND THEN RETURN v_purchase; END IF;
  END IF;

  SELECT * INTO v_cp FROM client_purchases WHERE engagement_id = p_engagement_id
    ORDER BY created_at DESC LIMIT 1;

  INSERT INTO purchases (org_id, buyer_user_id, buyer_contact_id, status, amount)
    VALUES (v_eng.org_id, v_uid, v_contact, 'draft', coalesce(v_cp.amount, 0))
    RETURNING id INTO v_purchase;
  INSERT INTO purchase_items (purchase_id, offering_id, label, price_amount, org_id)
    VALUES (v_purchase, v_cp.offering_id, coalesce(v_cp.tier_label, v_eng.service_type, 'Service'),
            coalesce(v_cp.amount, 0), v_eng.org_id);
  UPDATE request_selections SET purchase_id = v_purchase
    WHERE engagement_id = p_engagement_id AND purchase_id IS NULL;
  RETURN v_purchase;
END;
$fn$;
REVOKE ALL ON FUNCTION create_purchase_from_engagement(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION create_purchase_from_engagement(uuid) TO authenticated, service_role;

-- admin_client_overview: only the orders count changes (documents count keeps its
-- engagement join, still valid via the shim's engagement_id backlink until S2.3).
CREATE OR REPLACE FUNCTION admin_client_overview(p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $fn$
DECLARE
  v_org uuid := current_org();
  v jsonb;
BEGIN
  IF NOT is_admin() THEN
    RAISE EXCEPTION 'admin access required';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM profiles WHERE user_id = p_user_id AND org_id = v_org) THEN
    RAISE EXCEPTION 'account not found in your organization';
  END IF;

  SELECT jsonb_build_object(
    'profile', (SELECT jsonb_build_object(
        'user_id', p.user_id, 'email', p.email, 'first_name', p.first_name,
        'last_name', p.last_name, 'display_name', p.display_name,
        'phone', p.phone, 'mobile', p.mobile, 'whatsapp', p.whatsapp,
        'riding_level', p.riding_level, 'bio', p.bio, 'role', p.role,
        'is_suspended', p.is_suspended, 'created_at', p.created_at,
        'contact_id', p.contact_id,
        'client_id', (SELECT c.id FROM clients c WHERE c.contact_id = p.contact_id AND c.deleted_at IS NULL))
      FROM profiles p WHERE p.user_id = p_user_id),
    'login', (SELECT jsonb_build_object(
        'providers', coalesce((SELECT jsonb_agg(DISTINCT i.provider)
          FROM auth.identities i WHERE i.user_id = p_user_id), '[]'::jsonb),
        'last_sign_in_at', u.last_sign_in_at,
        'created_at', u.created_at,
        'email_confirmed_at', u.email_confirmed_at)
      FROM auth.users u WHERE u.id = p_user_id),
    'membership', (SELECT jsonb_build_object('tier', m.tier, 'status', m.status,
        'started_at', m.started_at)
      FROM memberships m WHERE m.user_id = p_user_id LIMIT 1),
    'counts', jsonb_build_object(
      'orders',    (SELECT count(*) FROM purchases WHERE buyer_user_id = p_user_id AND deleted_at IS NULL),
      'posts',     (SELECT count(*) FROM feed_posts WHERE author_id = p_user_id),
      'documents', (SELECT count(*) FROM documents d
                     JOIN engagements e ON e.id = d.engagement_id
                     JOIN clients c ON c.id = e.client_id
                     JOIN profiles p ON p.contact_id = c.contact_id
                     WHERE p.user_id = p_user_id AND d.deleted_at IS NULL),
      'bookings',  (SELECT count(*) FROM lesson_sessions ls
                     JOIN clients c ON c.id = ls.client_id
                     JOIN profiles p ON p.contact_id = c.contact_id
                     WHERE p.user_id = p_user_id AND ls.deleted_at IS NULL))
  ) INTO v;
  RETURN v;
END;
$fn$;

-- ── E. drop the orders family ────────────────────────────────────────────────
DROP FUNCTION IF EXISTS finalize_order_payment(uuid, text);
DROP FUNCTION IF EXISTS create_order_from_engagement(uuid);

DROP TABLE IF EXISTS order_documents CASCADE;
DROP TABLE IF EXISTS qualifier_answers CASCADE;
DROP TABLE IF EXISTS payments CASCADE;
DROP TABLE IF EXISTS bookings_v2 CASCADE;
DROP TABLE IF EXISTS order_items CASCADE;
DROP TABLE IF EXISTS orders CASCADE;
