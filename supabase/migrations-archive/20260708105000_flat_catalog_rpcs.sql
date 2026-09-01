/*
  # Flat catalog — RPC repoint (runs BETWEEN schema-add and data-drop)

  Two RPCs reference offering_tiers and take p_tier_id. Reissue them to use the
  flat offering directly, so the offering_tiers DROP (next migration) is safe.

    1. client_purchases gains offering_id (nullable FK) — the flat reference that
       replaces the dropped tier_id. tier_label/amount snapshot stays.
    2. provision_lesson_invitation(p_offering_id ...) — reads price/service/label/
       org from the flat offering row; also derives lesson count/cadence from the
       offering label + price_unit exactly as before. Old p_tier_id signature is
       DROPPED (callers updated in the same slice).
    3. finalize_order_payment — price-integrity now joins order_items.offering_id
       to offerings.price_amount (order_items.tier_id is dropped; offering_id is
       the flat ref).

  order_items.offering_id already exists (it carried both offering_id and tier_id).
*/

-- 1. flat reference on client_purchases
ALTER TABLE client_purchases ADD COLUMN IF NOT EXISTS offering_id uuid REFERENCES offerings(id) ON DELETE SET NULL;

-- 2. provision_lesson_invitation — flat offering version
DROP FUNCTION IF EXISTS provision_lesson_invitation(text, text, text, uuid, boolean, text, text, uuid);

CREATE OR REPLACE FUNCTION public.provision_lesson_invitation(
  p_email text, p_first_name text, p_last_name text, p_offering_id uuid,
  p_mark_paid boolean DEFAULT false, p_payment_method text DEFAULT NULL,
  p_notes text DEFAULT NULL, p_request_id uuid DEFAULT NULL)
 RETURNS jsonb
 LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  v_off        offerings%ROWTYPE;
  v_org        uuid;
  v_service    text;
  v_contact    uuid;
  v_client     uuid;
  v_eng        uuid;
  v_inv_id     uuid;
  v_token      text;
  v_lessons    integer;
  v_cadence    text;
  v_email      text := lower(trim(p_email));
BEGIN
  IF NOT (coalesce(auth.role(), '') = 'service_role' OR has_staff_access()) THEN
    RAISE EXCEPTION 'not authorized to provision invitations';
  END IF;
  IF v_email IS NULL OR v_email = '' THEN RAISE EXCEPTION 'email is required'; END IF;
  IF NULLIF(trim(coalesce(p_first_name,'')),'') IS NULL OR NULLIF(trim(coalesce(p_last_name,'')),'') IS NULL THEN
    RAISE EXCEPTION 'first and last name are required';
  END IF;

  -- the flat offering tells us tenant + service + price + label
  SELECT o.* INTO v_off FROM offerings o WHERE o.id = p_offering_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'unknown offering: %', p_offering_id; END IF;
  v_org := v_off.org_id;
  v_service := coalesce(v_off.service_type, 'RIDING_LESSON');

  v_lessons := CASE
    WHEN v_off.name ~ '(\d+)-Lesson' THEN (regexp_match(v_off.name, '(\d+)-Lesson'))[1]::int
    WHEN v_off.price_unit = 'session' THEN 1
    ELSE NULL END;
  v_cadence := CASE
    WHEN v_off.price_unit = 'month' AND v_off.name ~ '^(\d+)x' THEN
      (regexp_match(v_off.name, '^(\d+)x'))[1] || ' lesson' ||
      CASE WHEN (regexp_match(v_off.name, '^(\d+)x'))[1]::int > 1 THEN 's' ELSE '' END || '/week'
    ELSE NULL END;

  SELECT c.id INTO v_contact FROM contacts c
    WHERE lower(c.email) = v_email AND c.deleted_at IS NULL
      AND NOT EXISTS (SELECT 1 FROM profiles p WHERE p.contact_id = c.id AND lower(coalesce(p.email,'')) <> v_email)
    ORDER BY c.created_at LIMIT 1;
  IF v_contact IS NULL THEN
    INSERT INTO contacts (org_id, first_name, last_name, email)
      VALUES (v_org, trim(p_first_name), trim(p_last_name), v_email)
      RETURNING id INTO v_contact;
  ELSE
    UPDATE contacts SET
        first_name = CASE WHEN NULLIF(trim(coalesce(first_name,'')),'') IS NULL
                            OR lower(trim(first_name)) = lower(coalesce(email,''))
                          THEN trim(p_first_name) ELSE first_name END,
        last_name  = CASE WHEN NULLIF(trim(coalesce(last_name,'')),'')  IS NULL THEN trim(p_last_name)  ELSE last_name END
      WHERE id = v_contact;
  END IF;

  SELECT cl.id INTO v_client FROM clients cl WHERE cl.contact_id = v_contact AND cl.deleted_at IS NULL;
  IF v_client IS NULL THEN
    INSERT INTO clients (org_id, contact_id, source)
      VALUES (v_org, v_contact, 'provisioned invitation')
      RETURNING id INTO v_client;
  END IF;

  INSERT INTO engagements (org_id, client_id, service_type, status, notes)
    VALUES (v_org, v_client, v_service, 'AWAITING_SIGNATURE',
            coalesce(p_notes, v_off.name || ' (provisioned invitation)'))
    RETURNING id INTO v_eng;

  INSERT INTO engagement_parties (org_id, engagement_id, contact_id, party_role, is_signer, signer_order)
    VALUES (v_org, v_eng, v_contact, 'CLIENT', true, 1);

  INSERT INTO transactions (org_id, engagement_id, txn_type, amount, service_fee, status, payment_terms)
    VALUES (v_org, v_eng, 'INVOICE', v_off.price_amount, v_off.price_amount,
            CASE WHEN p_mark_paid THEN 'PAID' ELSE 'PENDING' END,
            CASE WHEN p_mark_paid THEN 'Paid in full via ' || coalesce(p_payment_method, 'offline payment')
                 ELSE 'Due before first session' END);

  INSERT INTO client_purchases (org_id, engagement_id, offering_id, tier_label, amount,
                                lessons_included, cadence, paid, payment_method, notes)
    VALUES (v_org, v_eng, v_off.id, v_off.name, v_off.price_amount,
            v_lessons, v_cadence, p_mark_paid, p_payment_method, p_notes);

  IF v_lessons IS NOT NULL AND v_lessons > 0 THEN
    INSERT INTO lesson_credits (org_id, client_id, package_key, credits_total, credits_remaining)
      VALUES (v_org, v_client, v_off.name, v_lessons, v_lessons);
  END IF;

  v_token := replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '');
  INSERT INTO invitations (org_id, request_id, email, token, expires_at, status)
    VALUES (v_org, p_request_id, v_email, v_token, now() + interval '14 days', 'sent')
    RETURNING id INTO v_inv_id;

  IF p_request_id IS NOT NULL THEN
    UPDATE requests SET status = 'invited' WHERE id = p_request_id;
  END IF;

  RETURN jsonb_build_object(
    'invitation_id', v_inv_id, 'token', v_token, 'engagement_id', v_eng,
    'contact_id', v_contact, 'offering_label', v_off.name,
    'amount', v_off.price_amount, 'request_id', p_request_id);
END;
$function$;


-- 3. finalize_order_payment — flat-offering price integrity
CREATE OR REPLACE FUNCTION public.finalize_order_payment(p_order_id uuid, p_method text)
 RETURNS TABLE(unique_amount numeric, payment_reference text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_order   orders%ROWTYPE;
  v_total   numeric(10,2);
  v_prefix  text;
  v_ref     text;
  v_cents   int;
  v_try     int;
  v_candidate numeric(10,2);
BEGIN
  IF p_method NOT IN ('zelle', 'stripe') THEN
    RAISE EXCEPTION 'unknown payment method %', p_method;
  END IF;

  SELECT * INTO v_order FROM orders WHERE id = p_order_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'order not found';
  END IF;
  IF auth.uid() IS NOT NULL AND v_order.user_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'not your order';
  END IF;
  IF v_order.status NOT IN ('draft', 'awaiting_payment') THEN
    RAISE EXCEPTION 'order is % â cannot finalize payment', v_order.status;
  END IF;

  -- 2. Price integrity: catalog-linked items take the server-side offering price
  --    (flat catalog), defeating client-side tampering on those rows.
  UPDATE order_items oi
     SET price_amount = o.price_amount
    FROM offerings o
   WHERE oi.order_id = p_order_id
     AND oi.offering_id = o.id
     AND o.price_amount IS NOT NULL
     AND oi.price_amount IS DISTINCT FROM o.price_amount;

  SELECT COALESCE(SUM(oi.price_amount), 0) INTO v_total
    FROM order_items oi WHERE oi.order_id = p_order_id;
  -- An empty/priceless cart keeps the client-set total (inquiry-style orders).
  IF v_total = 0 THEN v_total := COALESCE(v_order.total, 0); END IF;

  -- 3a. unique_amount: assign once; 1â99 cent offset unique among OPEN orders.
  IF v_order.unique_amount IS NULL THEN
    v_cents := 1 + (get_byte(decode(md5(p_order_id::text), 'hex'), 0) % 99);
    v_candidate := NULL;
    FOR v_try IN 0..98 LOOP
      v_candidate := v_total + (((v_cents + v_try - 1) % 99) + 1) / 100.0;
      EXIT WHEN NOT EXISTS (
        SELECT 1 FROM orders o
         WHERE o.status = 'awaiting_payment'
           AND o.unique_amount = v_candidate
           AND o.id <> p_order_id
      );
      v_candidate := NULL;
    END LOOP;
    IF v_candidate IS NULL THEN
      RAISE EXCEPTION 'no unique payment amount available â too many open orders at this total';
    END IF;
  ELSE
    v_candidate := v_order.unique_amount;
  END IF;

  -- 3b. payment_reference: assign once; brand-prefixed from the ORDER's org.
  IF v_order.payment_reference IS NULL THEN
    SELECT cv.value_text INTO v_prefix
      FROM config_values cv
     WHERE cv.org_id = v_order.org_id AND cv.namespace = 'BRAND' AND cv.key = 'SHORT_NAME';
    v_prefix := COALESCE(NULLIF(regexp_replace(upper(v_prefix), '[^A-Z0-9]', '', 'g'), ''), 'ORD');
    v_ref := v_prefix || '-' || upper(substr(md5(p_order_id::text || v_prefix), 1, 6));
  ELSE
    v_ref := v_order.payment_reference;
  END IF;

  UPDATE orders o
     SET subtotal = v_total,
         total = v_total,
         unique_amount = v_candidate,
         payment_reference = v_ref,
         status = 'awaiting_payment',
         payment_method = p_method
   WHERE o.id = p_order_id;

  RETURN QUERY SELECT v_candidate, v_ref;
END;
$function$

;
