/*
  # Spine Refactor — Slice 2.3e-5: provision_lesson_invitation onto purchases

  The admin "provision a lesson student + invite" flow (called by the service-role
  api/admin-send-invitation handler) minted its money record as an engagement +
  engagement_parties + INVOICE transaction + client_purchase snapshot. On the
  spine the money record is a `purchases` row (+ purchase_item line) — one
  purchase = the provisioned offering, paid inline when the owner marks it paid.

  Preserved verbatim: auth gate, validation, offering lookup, the lessons/cadence
  parse, contact find/create/heal, the client shell, the lesson_credits grant,
  the invitation + request->invited. Dropped: the engagement/transaction/
  client_purchase inserts. Return swaps engagement_id -> purchase_id and now
  carries tier_label (the handler reads it for the email's "your purchase is
  ready" line — the old return used the wrong key 'offering_label').
*/
CREATE OR REPLACE FUNCTION public.provision_lesson_invitation(
  p_email text, p_first_name text, p_last_name text, p_offering_id uuid,
  p_mark_paid boolean DEFAULT false, p_payment_method text DEFAULT NULL,
  p_notes text DEFAULT NULL, p_request_id uuid DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  v_off       offerings%ROWTYPE;
  v_org       uuid;
  v_service   text;
  v_contact   uuid;
  v_client    uuid;
  v_purchase  uuid;
  v_inv_id    uuid;
  v_token     text;
  v_lessons   integer;
  v_cadence   text;
  v_email     text := lower(trim(p_email));
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

  -- the money record: a spine purchase (paid inline when the owner marks paid),
  -- with the offering as its single line item.
  INSERT INTO purchases (org_id, buyer_contact_id, status, amount, payment_method,
                         payment_status, payment_reference, paid_at, notes)
    VALUES (v_org, v_contact,
            CASE WHEN p_mark_paid THEN 'paid' ELSE 'awaiting_payment' END,
            v_off.price_amount, p_payment_method,
            CASE WHEN p_mark_paid THEN 'paid' ELSE 'unpaid' END,
            CASE WHEN p_mark_paid THEN 'Provisioned — paid in full via ' || coalesce(p_payment_method, 'offline payment') END,
            CASE WHEN p_mark_paid THEN now() END,
            coalesce(p_notes, v_off.name || ' (provisioned invitation)'))
    RETURNING id INTO v_purchase;

  INSERT INTO purchase_items (org_id, purchase_id, offering_id, label, price_amount, price_unit, quantity)
    VALUES (v_org, v_purchase, v_off.id, v_off.name, v_off.price_amount, v_off.price_unit, 1);

  -- a lesson-count offering ALSO grants the punch-card credits the sessions flow debits.
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
    'invitation_id', v_inv_id, 'token', v_token, 'purchase_id', v_purchase,
    'contact_id', v_contact, 'tier_label', v_off.name, 'offering_label', v_off.name,
    'amount', v_off.price_amount, 'request_id', p_request_id);
END;
$function$;
