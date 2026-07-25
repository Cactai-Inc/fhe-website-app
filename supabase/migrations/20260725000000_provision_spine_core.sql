-- Offering-attachment spine — core.
--
-- Establishes the ONE canonical provisioning core and its shared purchase helper.
--   * purchases.amount_paid: tracks a partial payment made at provision time so
--     the balance shown on the payer's modal = amount - amount_paid.
--   * _provision_purchase_for_offerings(...): the single place that writes a
--     purchase + its items + lesson_credits from a set of offerings. Both the
--     invite core and attach_offerings_to_client (next migration) call it, so the
--     price/credit logic lives in exactly one function (no duplication).
--   * provision_client_invitation: rewritten to call the helper. Name is now
--     OPTIONAL (email-only invites); when absent the contact is created nameless
--     and the real name is captured at first-login intake before any document is
--     signed. Payment status supports paid / unpaid / partial (p_partial_amount).
--     Returns offering `labels` for the invite email.
--
-- This migration captures provision_client_invitation into version control for
-- the first time (it previously existed only as a hand-applied prod object).

-- ---------------------------------------------------------------------------
-- 0. Drop the prior 11-arg provision_client_invitation so only the canonical
--    12-arg version (with p_partial_amount) remains — no orphaned overload.
-- ---------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.provision_client_invitation(
  text,text,text,text[],uuid[],text[],boolean,text,text,uuid,uuid);

-- ---------------------------------------------------------------------------
-- 1. purchases.amount_paid — partial-payment tracking (balance = amount - paid)
-- ---------------------------------------------------------------------------
ALTER TABLE public.purchases
  ADD COLUMN IF NOT EXISTS amount_paid numeric NOT NULL DEFAULT 0;

-- ---------------------------------------------------------------------------
-- 1b. Guest is now a first-class account category — seed its onboarding-doc
--     defaults (a visitor/gift-cert client signs only the general set).
--     Idempotent via the unique (org_id, category, template_key) constraint.
-- ---------------------------------------------------------------------------
INSERT INTO public.category_document_requirements (org_id, category, template_key)
SELECT o.id, 'Guest', k
FROM (SELECT id FROM public.organizations ORDER BY created_at LIMIT 1) o
CROSS JOIN (VALUES ('COMPANY_POLICIES'), ('RELEASE_GENERAL')) AS v(k)
ON CONFLICT (org_id, category, template_key) DO NOTHING;

-- ---------------------------------------------------------------------------
-- 2. Shared helper: write ONE purchase + N items + per-offering lesson_credits.
--    Returns the new purchase id. The single source of truth for the money +
--    credits write; callers own contact/client/category/doc concerns.
--
--    Payment semantics:
--      p_mark_paid = true              -> status 'paid',            amount_paid = total
--      p_mark_paid = false, partial>0  -> status 'awaiting_payment', amount_paid = partial (balance = total - partial)
--      p_mark_paid = false, partial=0  -> status 'awaiting_payment', amount_paid = 0
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public._provision_purchase_for_offerings(
  p_org_id         uuid,
  p_contact_id     uuid,
  p_client_id      uuid,
  p_offering_ids   uuid[],
  p_mark_paid      boolean DEFAULT false,
  p_payment_method text    DEFAULT NULL,
  p_notes          text    DEFAULT NULL,
  p_partial_amount numeric DEFAULT 0
) RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_purchase uuid;
  v_total    numeric;
  v_paid     numeric;
  v_off      offerings%ROWTYPE;
  v_lessons  integer;
BEGIN
  IF array_length(p_offering_ids, 1) IS NULL THEN
    RETURN NULL;  -- nothing to purchase
  END IF;

  SELECT coalesce(sum(o.price_amount), 0) INTO v_total
    FROM offerings o WHERE o.id = ANY(p_offering_ids);

  -- amount_paid: full total when marked paid; else the (clamped) partial amount.
  v_paid := CASE
    WHEN p_mark_paid THEN v_total
    ELSE least(greatest(coalesce(p_partial_amount, 0), 0), v_total)
  END;

  -- payment_status CHECK allows unpaid|pending|paid. A partial payment is
  -- 'pending' (some paid, balance owed) with the exact paid figure in amount_paid.
  INSERT INTO purchases (org_id, buyer_contact_id, status, amount, amount_paid,
                         payment_method, payment_status, payment_reference, paid_at, notes)
    VALUES (p_org_id, p_contact_id,
            CASE WHEN p_mark_paid THEN 'paid' ELSE 'awaiting_payment' END,
            v_total, v_paid, p_payment_method,
            CASE WHEN p_mark_paid THEN 'paid'
                 WHEN v_paid > 0  THEN 'pending'
                 ELSE 'unpaid' END,
            CASE WHEN p_mark_paid THEN 'Provisioned — paid in full via ' || coalesce(p_payment_method, 'offline payment')
                 WHEN v_paid > 0  THEN 'Provisioned — partial ' || v_paid::text || ' via ' || coalesce(p_payment_method, 'offline payment') END,
            CASE WHEN p_mark_paid THEN now() END,
            coalesce(p_notes, 'Provisioned invitation'))
    RETURNING id INTO v_purchase;

  INSERT INTO purchase_items (org_id, purchase_id, offering_id, label, price_amount, price_unit, quantity)
  SELECT p_org_id, v_purchase, o.id, o.name, o.price_amount, o.price_unit, 1
    FROM offerings o WHERE o.id = ANY(p_offering_ids);

  -- each lesson-count offering also grants its punch-card credits
  FOR v_off IN SELECT o.* FROM offerings o WHERE o.id = ANY(p_offering_ids) LOOP
    v_lessons := CASE
      WHEN v_off.name ~ '(\d+)-Lesson' THEN (regexp_match(v_off.name, '(\d+)-Lesson'))[1]::int
      WHEN v_off.price_unit = 'session' THEN 1
      ELSE NULL END;
    IF v_lessons IS NOT NULL AND v_lessons > 0 THEN
      INSERT INTO lesson_credits (org_id, client_id, package_key, credits_total, credits_remaining)
        VALUES (p_org_id, p_client_id, v_off.name, v_lessons, v_lessons);
    END IF;
  END LOOP;

  RETURN v_purchase;
END;
$function$;

REVOKE ALL ON FUNCTION public._provision_purchase_for_offerings(uuid,uuid,uuid,uuid[],boolean,text,text,numeric) FROM public, anon;
GRANT EXECUTE ON FUNCTION public._provision_purchase_for_offerings(uuid,uuid,uuid,uuid[],boolean,text,text,numeric) TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 3. provision_client_invitation — canonical invite core (name OPTIONAL,
--    partial payment, labels in return, purchase via the shared helper).
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.provision_client_invitation(
  p_email          text,
  p_first_name     text,
  p_last_name      text,
  p_categories     text[],
  p_offering_ids   uuid[]  DEFAULT '{}',
  p_template_keys  text[]  DEFAULT NULL,
  p_mark_paid      boolean DEFAULT false,
  p_payment_method text    DEFAULT NULL,
  p_notes          text    DEFAULT NULL,
  p_request_id     uuid    DEFAULT NULL,
  p_org_id         uuid    DEFAULT NULL,
  p_partial_amount numeric DEFAULT 0
) RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_org       uuid;
  v_contact   uuid;
  v_client    uuid;
  v_purchase  uuid;
  v_inv_id    uuid;
  v_token     text;
  v_total     numeric := 0;
  v_labels    text[];
  v_has_off   boolean := (array_length(p_offering_ids, 1) IS NOT NULL);
  v_cats      text[];
  v_email     text := lower(trim(p_email));
  v_fn        text := nullif(trim(coalesce(p_first_name, '')), '');
  v_ln        text := nullif(trim(coalesce(p_last_name,  '')), '');
BEGIN
  -- auth fence: staff session or service-role only
  IF NOT (coalesce(auth.role(), '') = 'service_role' OR has_staff_access()) THEN
    RAISE EXCEPTION 'not authorized to provision invitations';
  END IF;
  IF v_email IS NULL OR v_email = '' THEN RAISE EXCEPTION 'email is required'; END IF;
  -- Name is OPTIONAL here (email-only invites). When absent, the contact is
  -- created nameless; the real name is captured at first-login intake and
  -- document signing is gated on a present name (generate_document refuses a
  -- blank printed name).

  -- normalize + validate categories to the standing account set
  SELECT array_agg(DISTINCT upper(btrim(c)))
    INTO v_cats
    FROM unnest(coalesce(p_categories, '{}')) c
   WHERE btrim(c) <> '';
  IF v_cats IS NULL OR array_length(v_cats, 1) IS NULL THEN
    RAISE EXCEPTION 'at least one category is required';
  END IF;
  IF EXISTS (SELECT 1 FROM unnest(v_cats) c WHERE c NOT IN ('GUEST','RIDER','HORSE_OWNER')) THEN
    RAISE EXCEPTION 'categories must be a subset of GUEST/RIDER/HORSE_OWNER';
  END IF;

  -- org resolution: explicit p_org_id -> an offering's org -> current_org()
  v_org := p_org_id;
  IF v_org IS NULL AND v_has_off THEN
    SELECT o.org_id INTO v_org FROM offerings o WHERE o.id = p_offering_ids[1];
  END IF;
  v_org := coalesce(v_org, current_org());
  IF v_org IS NULL THEN RAISE EXCEPTION 'could not resolve org for this invitation'; END IF;

  -- contact: reuse by email (not bound to a foreign profile) or create.
  -- TOKENIZED EMAIL: contacts.email is the canonical per-person email home —
  -- every surface reads it from here rather than keeping its own copy.
  SELECT c.id INTO v_contact FROM contacts c
    WHERE lower(c.email) = v_email AND c.deleted_at IS NULL
      AND NOT EXISTS (SELECT 1 FROM profiles p WHERE p.contact_id = c.id AND lower(coalesce(p.email,'')) <> v_email)
    ORDER BY c.created_at LIMIT 1;
  IF v_contact IS NULL THEN
    INSERT INTO contacts (org_id, first_name, last_name, email)
      VALUES (v_org, v_fn, v_ln, v_email)
      RETURNING id INTO v_contact;
  ELSE
    -- fill name only when we HAVE one and the contact is nameless/placeholder
    UPDATE contacts SET
        first_name = CASE WHEN v_fn IS NOT NULL AND (NULLIF(trim(coalesce(first_name,'')),'') IS NULL
                            OR lower(trim(first_name)) = lower(coalesce(email,'')))
                          THEN v_fn ELSE first_name END,
        last_name  = CASE WHEN v_ln IS NOT NULL AND NULLIF(trim(coalesce(last_name,'')),'') IS NULL
                          THEN v_ln ELSE last_name END
      WHERE id = v_contact;
  END IF;

  SELECT cl.id INTO v_client FROM clients cl WHERE cl.contact_id = v_contact AND cl.deleted_at IS NULL;
  IF v_client IS NULL THEN
    INSERT INTO clients (org_id, contact_id, source)
      VALUES (v_org, v_contact, 'provisioned invitation')
      RETURNING id INTO v_client;
  END IF;

  -- standing categories -> contact_roles
  INSERT INTO contact_roles (contact_id, role_type)
  SELECT v_contact, c FROM unnest(v_cats) c
  ON CONFLICT ON CONSTRAINT contact_roles_contact_id_role_type_key DO NOTHING;

  -- onboarding documents: explicit staff selection if given, else derive from
  -- categories. apply_category_documents uses a per-txn TEMP TABLE, so it must
  -- be called at most once per transaction — the branch guarantees that.
  IF p_template_keys IS NOT NULL THEN
    DELETE FROM contact_required_documents WHERE contact_id = v_contact;
    INSERT INTO contact_required_documents (contact_id, template_key, org_id)
    SELECT v_contact, k, v_org
      FROM unnest(p_template_keys) k
     WHERE btrim(k) <> ''
    ON CONFLICT DO NOTHING;
  ELSE
    PERFORM apply_category_documents(v_contact);
  END IF;

  -- purchase via the shared helper (single source of truth for money + credits)
  IF v_has_off THEN
    v_purchase := _provision_purchase_for_offerings(
      v_org, v_contact, v_client, p_offering_ids,
      p_mark_paid, p_payment_method, p_notes, p_partial_amount);
    SELECT coalesce(sum(o.price_amount), 0), array_agg(o.name)
      INTO v_total, v_labels
      FROM offerings o WHERE o.id = ANY(p_offering_ids);
  END IF;

  -- invitation carrying the full selection
  v_token := replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '');
  INSERT INTO invitations (org_id, request_id, email, token, expires_at, status,
                           first_name, last_name, contact_id,
                           categories, offering_ids, template_keys)
    VALUES (v_org, p_request_id, v_email, v_token, now() + interval '14 days', 'sent',
            v_fn, v_ln, v_contact,
            v_cats, nullif(p_offering_ids, '{}'), p_template_keys)
    RETURNING id INTO v_inv_id;

  IF p_request_id IS NOT NULL THEN
    UPDATE requests SET status = 'invited' WHERE id = p_request_id;
  END IF;

  RETURN jsonb_build_object(
    'invitation_id', v_inv_id, 'token', v_token,
    'contact_id', v_contact, 'purchase_id', v_purchase,
    'categories', v_cats, 'amount', coalesce(v_total, 0),
    'labels', coalesce(v_labels, ARRAY[]::text[]),
    'request_id', p_request_id);
END;
$function$;

REVOKE ALL ON FUNCTION public.provision_client_invitation(text,text,text,text[],uuid[],text[],boolean,text,text,uuid,uuid,numeric) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.provision_client_invitation(text,text,text,text[],uuid[],text[],boolean,text,text,uuid,uuid,numeric) TO authenticated, service_role;

COMMENT ON FUNCTION public.provision_client_invitation(text,text,text,text[],uuid[],text[],boolean,text,text,uuid,uuid,numeric) IS
  'Canonical client-provisioning core: contact (canonical email) + client + '
  'standing categories (GUEST/RIDER/HORSE_OWNER) + onboarding docs + optional '
  '0..N offering purchase (via _provision_purchase_for_offerings) + invitation. '
  'Name optional (captured at first-login intake). Payment paid/unpaid/partial.';
