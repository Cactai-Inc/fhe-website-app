-- Stage 5 (REMEDIATION_PLAN, D6): the deliverable spine — the ledger of
-- promises made and kept, with provable money events.
--
-- 5a  fulfillment_units generated from purchase_items by config_kind:
--       scheduled            → session units  (unit_count, default 1)
--       recurring            → period units   (one per billing period; the
--                              first period is seeded, later ones roll)
--       intake_finder /
--       intake_evaluation    → milestone units
--       document_transaction → one execution unit
--       inquire              → NONE
--     status_events drives unit state (vocab EXTENDED for entity_type
--     'fulfillment', not forked). Bookings, lesson_credits and evaluation
--     delivery connect to units. Everything degrades gracefully empty
--     (purchases is at 0 rows today).
-- 5b  receipt_sends: one row per send ATTEMPT with an idempotency key; a
--     receipt is provable and single.
-- 5c  dunning fires off the existing 3-day payment-reminder preference;
--     welcome fires on account activation. No invented cadence.
-- 5d  mirror/company copies logged in document_deliveries like party copies;
--     OPS_INBOX + the tenant link move to org-level config.
-- 5e  calendar gains real payment-due / expiration / confirmation sources.

-- ── 5a-1. The unit table ────────────────────────────────────────────────────
CREATE TABLE fulfillment_units (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id           uuid NOT NULL,
  purchase_id      uuid NOT NULL REFERENCES purchases(id) ON DELETE CASCADE,
  purchase_item_id uuid NOT NULL REFERENCES purchase_items(id) ON DELETE CASCADE,
  unit_kind        text NOT NULL CHECK (unit_kind IN ('session','period','milestone','execution')),
  seq              int  NOT NULL DEFAULT 1,
  label            text,
  -- what consumed/satisfied this unit (exactly one, or none while open)
  booking_id       uuid REFERENCES bookings(id) ON DELETE SET NULL,
  document_id      uuid REFERENCES documents(id) ON DELETE SET NULL,
  report_id        uuid REFERENCES evaluation_reports(id) ON DELETE SET NULL,
  period_start     date,
  period_end       date,
  current_status   text NOT NULL DEFAULT 'open',
  consumed_at      timestamptz,
  created_at       timestamptz NOT NULL DEFAULT now(),
  deleted_at       timestamptz,
  UNIQUE (purchase_item_id, unit_kind, seq)
);
CREATE INDEX fulfillment_units_purchase_idx ON fulfillment_units (purchase_id) WHERE deleted_at IS NULL;
CREATE INDEX fulfillment_units_open_idx ON fulfillment_units (purchase_item_id, current_status) WHERE deleted_at IS NULL;

ALTER TABLE fulfillment_units ENABLE ROW LEVEL SECURITY;
CREATE POLICY fulfillment_units_org ON fulfillment_units FOR ALL
  USING (org_id = current_org()) WITH CHECK (org_id = current_org());
CREATE POLICY fulfillment_units_read ON fulfillment_units FOR SELECT
  USING (org_id = current_org() AND (
    has_staff_access()
    OR EXISTS (SELECT 1 FROM purchases p WHERE p.id = purchase_id
                AND (p.buyer_user_id = auth.uid() OR p.buyer_contact_id = current_contact_id()))));
REVOKE DELETE ON fulfillment_units FROM anon, authenticated;

-- ── 5a-2. Status vocabulary (extend, don't fork) ────────────────────────────
-- The entity_type CHECK on both the vocab and the events table is widened to
-- admit 'fulfillment' — the same model, one more entity kind.
ALTER TABLE status_events_vocab DROP CONSTRAINT status_events_vocab_entity_type_check;
ALTER TABLE status_events_vocab ADD CONSTRAINT status_events_vocab_entity_type_check
  CHECK (entity_type IN ('account','document','order','offering','fulfillment'));
ALTER TABLE status_events DROP CONSTRAINT status_events_entity_type_check;
ALTER TABLE status_events ADD CONSTRAINT status_events_entity_type_check
  CHECK (entity_type IN ('account','document','order','offering','fulfillment'));

INSERT INTO status_events_vocab (entity_type, code, display_name, is_true_status, is_terminal, sort_order)
VALUES ('fulfillment','open','Open',true,false,10),
       ('fulfillment','scheduled','Scheduled',true,false,20),
       ('fulfillment','delivered','Delivered',true,true,30),
       ('fulfillment','consumed','Consumed',true,true,40),
       ('fulfillment','expired','Expired',true,true,50),
       ('fulfillment','void','Void',true,true,60)
ON CONFLICT DO NOTHING;

CREATE OR REPLACE FUNCTION public.set_unit_status(p_unit_id uuid, p_status text, p_detail text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE v_u fulfillment_units%ROWTYPE;
BEGIN
  SELECT * INTO v_u FROM fulfillment_units WHERE id = p_unit_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'unit not found'; END IF;
  UPDATE fulfillment_units
     SET current_status = p_status,
         consumed_at = CASE WHEN p_status IN ('consumed','delivered') THEN now() ELSE consumed_at END
   WHERE id = p_unit_id;
  PERFORM log_status_event('fulfillment', p_unit_id, p_status, p_detail, v_u.org_id);
END;
$function$;

-- ── 5a-3. Generation from purchase_items by config_kind ─────────────────────
CREATE OR REPLACE FUNCTION public.generate_fulfillment_units(p_purchase_item_id uuid)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  v_it   purchase_items%ROWTYPE;
  v_o    offerings%ROWTYPE;
  v_org  uuid;
  v_kind text;
  v_n    int := 0;
  i      int;
  v_qty  int;
BEGIN
  SELECT * INTO v_it FROM purchase_items WHERE id = p_purchase_item_id;
  IF NOT FOUND THEN RETURN 0; END IF;
  SELECT * INTO v_o FROM offerings WHERE id = v_it.offering_id;
  IF NOT FOUND OR v_o.config_kind IS NULL THEN RETURN 0; END IF;
  SELECT org_id INTO v_org FROM purchases WHERE id = v_it.purchase_id;
  v_qty := greatest(coalesce(v_it.quantity, 1), 1);

  IF v_o.config_kind = 'inquire' THEN
    RETURN 0;                                   -- inquire → no units, by design
  ELSIF v_o.config_kind = 'scheduled' THEN
    v_kind := 'session';
    FOR i IN 1 .. (coalesce(v_o.unit_count, 1) * v_qty) LOOP
      INSERT INTO fulfillment_units (org_id, purchase_id, purchase_item_id, unit_kind, seq, label)
      VALUES (v_org, v_it.purchase_id, v_it.id, v_kind, i,
              coalesce(v_it.label, v_o.name) || ' · session ' || i)
      ON CONFLICT DO NOTHING;
      v_n := v_n + 1;
    END LOOP;
  ELSIF v_o.config_kind = 'recurring' THEN
    -- period units: seed the first period; later periods roll as they are billed
    v_kind := 'period';
    INSERT INTO fulfillment_units (org_id, purchase_id, purchase_item_id, unit_kind, seq, label,
                                   period_start, period_end)
    VALUES (v_org, v_it.purchase_id, v_it.id, v_kind, 1,
            coalesce(v_it.label, v_o.name) || ' · period 1',
            current_date, (current_date + interval '1 month')::date)
    ON CONFLICT DO NOTHING;
    v_n := 1;
  ELSIF v_o.config_kind IN ('intake_finder','intake_evaluation') THEN
    v_kind := 'milestone';
    FOR i IN 1 .. v_qty LOOP
      INSERT INTO fulfillment_units (org_id, purchase_id, purchase_item_id, unit_kind, seq, label)
      VALUES (v_org, v_it.purchase_id, v_it.id, v_kind, i, coalesce(v_it.label, v_o.name))
      ON CONFLICT DO NOTHING;
      v_n := v_n + 1;
    END LOOP;
  ELSIF v_o.config_kind = 'document_transaction' THEN
    v_kind := 'execution';
    INSERT INTO fulfillment_units (org_id, purchase_id, purchase_item_id, unit_kind, seq, label)
    VALUES (v_org, v_it.purchase_id, v_it.id, v_kind, 1, coalesce(v_it.label, v_o.name))
    ON CONFLICT DO NOTHING;
    v_n := 1;
  END IF;

  RETURN v_n;
END;
$function$;

CREATE OR REPLACE FUNCTION public.trg_generate_fulfillment_units()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
BEGIN
  PERFORM generate_fulfillment_units(NEW.id);
  RETURN NEW;
END;
$function$;
CREATE TRIGGER purchase_items_generate_units
  AFTER INSERT ON purchase_items
  FOR EACH ROW EXECUTE FUNCTION trg_generate_fulfillment_units();

-- ── 5a-4. Consumption: bookings, credits, evaluation delivery ───────────────
/** Consume the next open session/period unit on a purchase for this booking. */
CREATE OR REPLACE FUNCTION public.consume_unit_for_booking(p_booking_id uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  v_b bookings%ROWTYPE;
  v_u uuid;
BEGIN
  SELECT * INTO v_b FROM bookings WHERE id = p_booking_id;
  IF NOT FOUND OR v_b.purchase_id IS NULL THEN RETURN NULL; END IF;

  SELECT id INTO v_u FROM fulfillment_units
   WHERE purchase_id = v_b.purchase_id AND deleted_at IS NULL
     AND current_status = 'open' AND unit_kind IN ('session','period')
   ORDER BY seq LIMIT 1;
  IF v_u IS NULL THEN RETURN NULL; END IF;

  UPDATE fulfillment_units SET booking_id = p_booking_id WHERE id = v_u;
  PERFORM set_unit_status(v_u, 'scheduled', 'Booking ' || p_booking_id::text);
  RETURN v_u;
END;
$function$;

CREATE OR REPLACE FUNCTION public.trg_booking_unit_link()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
BEGIN
  IF TG_OP = 'INSERT' AND NEW.purchase_id IS NOT NULL THEN
    PERFORM consume_unit_for_booking(NEW.id);
  ELSIF TG_OP = 'UPDATE' AND NEW.status IS DISTINCT FROM OLD.status THEN
    -- a completed booking consumes its unit; a cancelled one releases it
    IF NEW.status = 'completed' THEN
      PERFORM set_unit_status(u.id, 'consumed', 'Booking completed')
        FROM fulfillment_units u WHERE u.booking_id = NEW.id AND u.current_status <> 'consumed';
    ELSIF NEW.status = 'cancelled' THEN
      UPDATE fulfillment_units SET booking_id = NULL WHERE booking_id = NEW.id;
      PERFORM set_unit_status(u.id, 'open', 'Booking cancelled — unit returned')
        FROM fulfillment_units u WHERE u.id IN (
          SELECT id FROM fulfillment_units WHERE booking_id IS NULL AND purchase_id = NEW.purchase_id
             AND current_status = 'scheduled');
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;
CREATE TRIGGER bookings_unit_link
  AFTER INSERT OR UPDATE ON bookings
  FOR EACH ROW EXECUTE FUNCTION trg_booking_unit_link();

/** Evaluation delivery satisfies the milestone unit for its purchase item. */
CREATE OR REPLACE FUNCTION public.trg_evaluation_unit_link()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE v_u uuid;
BEGIN
  IF NEW.status = 'delivered' AND OLD.status IS DISTINCT FROM 'delivered'
     AND NEW.purchase_item_id IS NOT NULL THEN
    SELECT id INTO v_u FROM fulfillment_units
     WHERE purchase_item_id = NEW.purchase_item_id AND deleted_at IS NULL
       AND unit_kind = 'milestone' AND current_status = 'open'
     ORDER BY seq LIMIT 1;
    IF v_u IS NOT NULL THEN
      UPDATE fulfillment_units SET report_id = NEW.id WHERE id = v_u;
      PERFORM set_unit_status(v_u, 'delivered', 'Evaluation report delivered');
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;
CREATE TRIGGER evaluation_reports_unit_link
  AFTER UPDATE ON evaluation_reports
  FOR EACH ROW EXECUTE FUNCTION trg_evaluation_unit_link();

/** The member-facing ledger: what was promised and what is left. */
CREATE OR REPLACE FUNCTION public.my_fulfillment()
RETURNS TABLE(purchase_id uuid, label text, unit_kind text, total int, open int, consumed int)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
  SELECT u.purchase_id,
         coalesce(min(u.label), 'Purchase'),
         u.unit_kind,
         count(*)::int,
         count(*) FILTER (WHERE u.current_status IN ('open','scheduled'))::int,
         count(*) FILTER (WHERE u.current_status IN ('consumed','delivered'))::int
    FROM fulfillment_units u
    JOIN purchases p ON p.id = u.purchase_id
   WHERE u.deleted_at IS NULL
     AND (p.buyer_user_id = auth.uid() OR p.buyer_contact_id = current_contact_id())
   GROUP BY u.purchase_id, u.unit_kind;
$function$;
GRANT EXECUTE ON FUNCTION public.my_fulfillment() TO authenticated;

-- ── 5b. Receipt logging + idempotency ───────────────────────────────────────
CREATE TABLE receipt_sends (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id          uuid NOT NULL,
  purchase_id     uuid NOT NULL REFERENCES purchases(id) ON DELETE CASCADE,
  idempotency_key text NOT NULL,
  recipient_email text,
  succeeded       boolean NOT NULL,
  error           text,
  message_id      text,
  attempted_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (idempotency_key)
);
CREATE INDEX receipt_sends_purchase_idx ON receipt_sends (purchase_id);
ALTER TABLE receipt_sends ENABLE ROW LEVEL SECURITY;
CREATE POLICY receipt_sends_staff ON receipt_sends FOR SELECT USING (has_staff_access());

/** Claim the right to send exactly one receipt for (purchase, key). Returns
 *  true when THIS caller may send; false when a successful send already
 *  exists. Failed attempts stay as evidence and do not block a retry. */
CREATE OR REPLACE FUNCTION public.claim_receipt_send(p_purchase_id uuid, p_key text)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
BEGIN
  IF EXISTS (SELECT 1 FROM receipt_sends
              WHERE purchase_id = p_purchase_id AND succeeded) THEN
    RETURN false;                                   -- provable and single
  END IF;
  RETURN NOT EXISTS (SELECT 1 FROM receipt_sends WHERE idempotency_key = p_key);
END;
$function$;

CREATE OR REPLACE FUNCTION public.log_receipt_send(
  p_purchase_id uuid, p_key text, p_recipient text,
  p_succeeded boolean, p_error text DEFAULT NULL, p_message_id text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE v_org uuid;
BEGIN
  SELECT org_id INTO v_org FROM purchases WHERE id = p_purchase_id;
  INSERT INTO receipt_sends (org_id, purchase_id, idempotency_key, recipient_email,
                             succeeded, error, message_id)
  VALUES (v_org, p_purchase_id, p_key, p_recipient, p_succeeded, p_error, p_message_id)
  ON CONFLICT (idempotency_key) DO NOTHING;
END;
$function$;

-- ── 5c. Dunning (3-day preference) + welcome (account activation) ───────────
/** Purchases overdue for a reminder: unpaid, and the member has payment
 *  reminders ON, and the existing 3-day window has elapsed since the last
 *  reminder (or since the purchase when none was sent). Cadence is the
 *  EXISTING preference — nothing invented here. */
ALTER TABLE purchases ADD COLUMN IF NOT EXISTS last_dunning_at timestamptz;

CREATE OR REPLACE FUNCTION public.dunning_due()
RETURNS TABLE(purchase_id uuid, org_id uuid, buyer_user_id uuid, email text, amount numeric)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
  SELECT p.id, p.org_id, p.buyer_user_id, u.email, p.amount
    FROM purchases p
    JOIN profiles pr ON pr.user_id = p.buyer_user_id
    JOIN auth.users u ON u.id = p.buyer_user_id
   WHERE p.deleted_at IS NULL
     AND p.payment_status <> 'paid'
     AND p.status <> 'void'
     AND coalesce(pr.payment_reminders, true)
     AND coalesce(p.last_dunning_at, p.created_at) < now() - interval '3 days'
$function$;

CREATE OR REPLACE FUNCTION public.mark_dunning_sent(p_purchase_id uuid)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path TO 'public'
AS $function$
  UPDATE purchases SET last_dunning_at = now() WHERE id = p_purchase_id;
$function$;

/** Welcome fires on ACCOUNT ACTIVATION — the members row going active. The
 *  notification is the durable trigger the email worker reads. */
ALTER TABLE members ADD COLUMN IF NOT EXISTS welcomed_at timestamptz;

CREATE OR REPLACE FUNCTION public.trg_member_welcome()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.status = 'active'
     AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM 'active')
     AND NEW.welcomed_at IS NULL THEN
    UPDATE members SET welcomed_at = now() WHERE id = NEW.id;
    INSERT INTO notifications (org_id, user_id, kind, title, body, link)
    VALUES (NEW.org_id, NEW.user_id, 'welcome',
            'Welcome to the barn',
            'Your account is active — here is everything you can do.',
            '/app');
  END IF;
  RETURN NEW;
END;
$function$;
CREATE TRIGGER members_welcome AFTER INSERT OR UPDATE ON members
  FOR EACH ROW EXECUTE FUNCTION trg_member_welcome();

-- ── 5d. Mirror-copy logging + org-level config ─────────────────────────────
-- Company/ops mirror copies now log like party copies. recipient_contact_id
-- nullable already? enforce a mirror marker instead of a fake contact.
ALTER TABLE document_deliveries ADD COLUMN IF NOT EXISTS is_mirror boolean NOT NULL DEFAULT false;
ALTER TABLE document_deliveries ALTER COLUMN recipient_contact_id DROP NOT NULL;

CREATE OR REPLACE FUNCTION public.log_mirror_delivery(p_document_id uuid, p_channel text, p_copy_url text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE v_org uuid;
BEGIN
  SELECT org_id INTO v_org FROM documents WHERE id = p_document_id;
  INSERT INTO document_deliveries (org_id, document_id, recipient_contact_id, channel, copy_url, is_mirror)
  VALUES (v_org, p_document_id, company_contact_id(), p_channel, p_copy_url, true)
  ON CONFLICT DO NOTHING;
END;
$function$;

-- org-level config for the ops inbox + the tenant's public link (5d)
INSERT INTO config_values (org_id, namespace, key, value_text)
SELECT o.id, 'CONTACT', 'OPS_INBOX', 'hello@fhequestrian.com'
  FROM organizations o
 WHERE NOT EXISTS (SELECT 1 FROM config_values c
                    WHERE c.org_id = o.id AND c.namespace='CONTACT' AND c.key='OPS_INBOX');
INSERT INTO config_values (org_id, namespace, key, value_text)
SELECT o.id, 'BRAND', 'SITE_URL', 'https://fhequestrian.com'
  FROM organizations o
 WHERE NOT EXISTS (SELECT 1 FROM config_values c
                    WHERE c.org_id = o.id AND c.namespace='BRAND' AND c.key='SITE_URL');

-- ── 5e. Calendar: real payment / expiration / confirmation sources ──────────
/** Member-readable dated items the calendar overlays on bookings: payments
 *  due (from the spine's unpaid purchases), gift expirations, and pending
 *  confirmations. Empty-safe. */
CREATE OR REPLACE FUNCTION public.calendar_money_items(p_from timestamptz, p_to timestamptz)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
  SELECT coalesce(jsonb_agg(x ORDER BY x->>'at'), '[]'::jsonb) FROM (
    -- payment due
    SELECT jsonb_build_object(
      'kind','payment','at', p.created_at, 'label',
      'Payment due · $' || round(coalesce(p.amount,0))::text,
      'ref', p.id, 'status', p.payment_status) AS x
      FROM purchases p
     WHERE p.deleted_at IS NULL AND p.payment_status <> 'paid' AND p.status <> 'void'
       AND p.created_at BETWEEN p_from AND p_to
       AND (has_staff_access() OR p.buyer_user_id = auth.uid() OR p.buyer_contact_id = current_contact_id())
    UNION ALL
    -- gift expirations
    SELECT jsonb_build_object(
      'kind','expiration','at', g.expires_at, 'label',
      'Gift expires · ' || coalesce(g.item_label,'gift'), 'ref', g.id, 'status', g.status)
      FROM gifts g
     WHERE g.expires_at BETWEEN p_from AND p_to AND g.status <> 'redeemed'
       AND (has_staff_access() OR g.buyer_user_id = auth.uid()
            OR lower(g.recipient_email) = lower((SELECT email FROM auth.users WHERE id = auth.uid())))
    UNION ALL
    -- confirmations pending (holds about to lapse)
    SELECT jsonb_build_object(
      'kind','confirmation','at', b.hold_expires_at, 'label',
      'Confirm your booking', 'ref', b.id, 'status', b.status)
      FROM bookings b
     WHERE b.hold_expires_at BETWEEN p_from AND p_to
       AND b.status IN ('hold','pending')
       AND (has_staff_access() OR b.account_user_id = auth.uid() OR b.account_contact_id = current_contact_id())
  ) s;
$function$;
GRANT EXECUTE ON FUNCTION public.calendar_money_items(timestamptz, timestamptz) TO authenticated;
