-- Phase 2 — service credits (generalized), per-horse care gate, purchase
-- unification for horse-onboarding state, and horse-add consolidation.
--
-- Discovery established the ground truth this migration is built on:
--   * lesson_credits has 0 rows, so generalizing it is a schema change, not a
--     data migration. We generalize IN PLACE (add offering_id) and expose a
--     service_credits VIEW rather than a destructive rename that would break the
--     ~4 FE files reading `.from('lesson_credits')` directly.
--   * The booking-grain horse link already exists and is wired end to end:
--     bookings.horse_id, attach_booking_horse() (ownership-validated, called
--     from api-calendar.ts) and book_open_slot(p_booking_id, p_horse_id) which
--     already branches lesson (credit-gated) vs care. We do NOT rebuild these;
--     we EXTEND them — care now debits a credit and both are gated per horse.
--   * documents.horse_id + generate_document(...p_horse_id...) already exist, so
--     the per-horse gate keys on EXECUTED docs whose horse_id = the booked horse.
--   * my_horse_onboarding_state reads pu.buyer_user_id (misses provisioned
--     buyer_contact_id purchases) and pu.horse_id (retired grain) — reconciled.
--   * my_stable_add_horse is a thin duplicate writing horse_parties; the rich
--     canonical path is create_horse_record (microchip dedup, reconciliation,
--     horse_relationships). Consolidated by delegation.

BEGIN;

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. service_credits: generalize lesson_credits per offering, keep the name.
-- ─────────────────────────────────────────────────────────────────────────────
-- offering_id makes a credit ledger row service-specific (a care package vs a
-- lesson package). NULL = legacy/general lesson credit (back-compatible).
ALTER TABLE public.lesson_credits
  ADD COLUMN IF NOT EXISTS offering_id uuid REFERENCES public.offerings(id);

CREATE INDEX IF NOT EXISTS lesson_credits_offering_idx
  ON public.lesson_credits (offering_id);

-- Forward-looking alias so new code can speak in service terms without a rename
-- sweep. Reads/writes both hit the same rows.
CREATE OR REPLACE VIEW public.service_credits AS
  SELECT id, org_id, client_id, offering_id,
         package_key,
         credits_total     AS total,
         credits_remaining AS remaining,
         credits_total, credits_remaining,
         purchased_at, created_at, updated_at, deleted_at, deleted_by
    FROM public.lesson_credits;

GRANT SELECT ON public.service_credits TO authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Grant credits for ANY multi-unit offering (not just lessons), tagged with
--    the offering so per-service balances are legible.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public._provision_purchase_for_offerings(
  p_org_id uuid, p_contact_id uuid, p_client_id uuid, p_offering_ids uuid[],
  p_payment_method text, p_mark_paid boolean, p_amount_paid numeric, p_notes text)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  v_purchase uuid;
  v_total    numeric := 0;
  v_paid     numeric := 0;
  v_off      offerings%ROWTYPE;
  v_units    int;
BEGIN
  SELECT coalesce(sum(o.price_amount), 0) INTO v_total
    FROM offerings o WHERE o.id = ANY(p_offering_ids);
  v_paid := CASE WHEN p_mark_paid THEN v_total ELSE coalesce(p_amount_paid, 0) END;

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

  -- each multi-unit / per-session offering grants a service-credit ledger row,
  -- tagged with the offering so lesson vs care balances stay distinct.
  FOR v_off IN SELECT o.* FROM offerings o WHERE o.id = ANY(p_offering_ids) LOOP
    v_units := CASE
      WHEN v_off.name ~ '(\d+)-(Lesson|Session|Pack|Visit)' THEN (regexp_match(v_off.name, '(\d+)-(?:Lesson|Session|Pack|Visit)'))[1]::int
      WHEN v_off.price_unit IN ('session', 'visit') THEN 1
      ELSE NULL END;
    IF v_units IS NOT NULL AND v_units > 0 THEN
      INSERT INTO lesson_credits (org_id, client_id, offering_id, package_key, credits_total, credits_remaining)
        VALUES (p_org_id, p_client_id, v_off.id, v_off.name, v_units, v_units);
    END IF;
  END LOOP;

  RETURN v_purchase;
END;
$function$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. Per-horse care gate. First care booking for a horse generates the two
--    releases for THAT horse; subsequent bookings require both EXECUTED.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.assert_horse_care_eligible(
  p_contact_id uuid, p_horse_id uuid)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  v_org        uuid;
  v_release    documents%ROWTYPE;
  v_vet        documents%ROWTYPE;
  v_generated  boolean := false;
  v_parties    jsonb;
  v_missing    text[] := ARRAY[]::text[];
BEGIN
  IF p_horse_id IS NULL THEN
    RAISE EXCEPTION 'a horse is required for a care booking';
  END IF;
  SELECT org_id INTO v_org FROM contacts WHERE id = p_contact_id;
  IF v_org IS NULL THEN RAISE EXCEPTION 'unknown contact'; END IF;
  IF NOT EXISTS (SELECT 1 FROM horses WHERE id = p_horse_id AND deleted_at IS NULL) THEN
    RAISE EXCEPTION 'unknown horse: %', p_horse_id;
  END IF;

  -- Look for THIS horse's care docs owned by THIS contact.
  SELECT d.* INTO v_release FROM documents d
    JOIN contract_templates t ON t.id = d.template_id
   WHERE d.contact_id = p_contact_id AND d.horse_id = p_horse_id
     AND d.deleted_at IS NULL AND t.template_key = 'RELEASE_HORSE_CARE'
   ORDER BY d.created_at DESC LIMIT 1;

  SELECT d.* INTO v_vet FROM documents d
    JOIN contract_templates t ON t.id = d.template_id
   WHERE d.contact_id = p_contact_id AND d.horse_id = p_horse_id
     AND d.deleted_at IS NULL AND t.template_key = 'HORSE_EMERGENCY_VET'
   ORDER BY d.created_at DESC LIMIT 1;

  -- First care booking for this horse: generate whichever of the two is absent.
  -- generate_document reads e->>'role' for document_parties.party_role, which is
  -- constrained; horse-care releases use CLIENT as the signing party.
  v_parties := jsonb_build_array(jsonb_build_object(
    'contact_id', p_contact_id, 'role', 'CLIENT',
    'is_signer', true, 'signer_order', 1));

  IF v_release.id IS NULL THEN
    PERFORM generate_document(p_contact_id, 'RELEASE_HORSE_CARE', NULL::uuid, p_horse_id, v_parties, 'horse');
    v_generated := true;
  END IF;
  IF v_vet.id IS NULL THEN
    PERFORM generate_document(p_contact_id, 'HORSE_EMERGENCY_VET', NULL::uuid, p_horse_id, v_parties, 'horse');
    v_generated := true;
  END IF;

  IF v_generated THEN
    -- re-read after generation
    SELECT d.* INTO v_release FROM documents d JOIN contract_templates t ON t.id = d.template_id
     WHERE d.contact_id = p_contact_id AND d.horse_id = p_horse_id AND d.deleted_at IS NULL
       AND t.template_key = 'RELEASE_HORSE_CARE' ORDER BY d.created_at DESC LIMIT 1;
    SELECT d.* INTO v_vet FROM documents d JOIN contract_templates t ON t.id = d.template_id
     WHERE d.contact_id = p_contact_id AND d.horse_id = p_horse_id AND d.deleted_at IS NULL
       AND t.template_key = 'HORSE_EMERGENCY_VET' ORDER BY d.created_at DESC LIMIT 1;
  END IF;

  IF coalesce(v_release.status, '') <> 'EXECUTED' THEN v_missing := array_append(v_missing, 'RELEASE_HORSE_CARE'); END IF;
  IF coalesce(v_vet.status, '') <> 'EXECUTED' THEN v_missing := array_append(v_missing, 'HORSE_EMERGENCY_VET'); END IF;

  RETURN jsonb_build_object(
    'eligible', (array_length(v_missing, 1) IS NULL),
    'generated', v_generated,
    'missing', to_jsonb(v_missing),
    'release_document_id', v_release.id,
    'vet_document_id', v_vet.id);
END;
$function$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. book_open_slot: care now debits a credit AND is gated per horse.
--    Lessons unchanged. Care: require a horse, enforce the gate, debit a credit
--    scoped to the offering when one exists.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.book_open_slot(p_booking_id uuid, p_horse_id uuid DEFAULT NULL::uuid)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  v_client  uuid := current_client_id();
  v_contact uuid := current_contact_id();
  v_b       bookings%ROWTYPE;
  v_kind    text;
  v_offering uuid;
  v_credit  uuid;
  v_gate    jsonb;
BEGIN
  IF v_client IS NULL THEN RAISE EXCEPTION 'no client profile'; END IF;
  SELECT * INTO v_b FROM bookings WHERE id = p_booking_id FOR UPDATE;
  IF NOT FOUND OR NOT v_b.is_flexible OR v_b.status <> 'available' THEN
    RAISE EXCEPTION 'that time is no longer open';
  END IF;

  SELECT CASE WHEN o.segment = 'horse' THEN 'care' ELSE 'lesson' END, o.id
    INTO v_kind, v_offering
    FROM offerings o WHERE o.id = v_b.offering_id;
  v_kind := coalesce(v_kind, 'lesson');

  IF v_kind = 'care' THEN
    IF p_horse_id IS NULL THEN RAISE EXCEPTION 'a horse is required for a care booking'; END IF;
    v_gate := assert_horse_care_eligible(v_contact, p_horse_id);
    IF NOT (v_gate->>'eligible')::boolean THEN
      RAISE EXCEPTION 'HORSE_CARE_DOCS_REQUIRED: %', v_gate->>'missing'
        USING ERRCODE = 'check_violation';
    END IF;
  END IF;

  -- credit-gated: both lessons and care debit one service credit, preferring a
  -- credit tagged with this offering, falling back to any untagged balance.
  UPDATE lesson_credits SET credits_remaining = credits_remaining - 1
   WHERE id = (SELECT id FROM lesson_credits
               WHERE client_id = v_client AND org_id = v_b.org_id
                 AND deleted_at IS NULL AND credits_remaining > 0
                 AND (offering_id = v_offering OR offering_id IS NULL)
               ORDER BY (offering_id = v_offering) DESC NULLS LAST, purchased_at, created_at
               LIMIT 1 FOR UPDATE)
   RETURNING id INTO v_credit;
  IF v_credit IS NULL THEN RAISE EXCEPTION 'NO_CREDITS'; END IF;

  UPDATE bookings SET
    kind = v_kind, status = 'scheduled', is_flexible = false,
    client_id = v_client,
    account_user_id = auth.uid(),
    horse_id = coalesce(p_horse_id, horse_id),
    credit_id = v_credit,
    updated_at = now()
  WHERE id = p_booking_id;

  RETURN jsonb_build_object('booking_id', p_booking_id, 'status', 'scheduled', 'kind', v_kind);
END;
$function$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. attach_booking_horse: enforce the same gate when a client attaches a horse
--    to an existing care booking (the intake path from the calendar).
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.attach_booking_horse(p_booking_id uuid, p_horse_id uuid)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  v_client  uuid := current_client_id();
  v_contact uuid := current_contact_id();
  v_org     uuid := current_org();
  v_b       bookings%ROWTYPE;
  v_mine    boolean;
  v_gate    jsonb;
BEGIN
  IF v_client IS NULL THEN RAISE EXCEPTION 'no client profile'; END IF;

  SELECT * INTO v_b FROM bookings WHERE id = p_booking_id AND org_id = v_org;
  IF NOT FOUND THEN RAISE EXCEPTION 'booking not found'; END IF;
  IF v_b.client_id IS DISTINCT FROM v_client THEN RAISE EXCEPTION 'not your booking'; END IF;
  IF v_b.kind NOT IN ('lesson','care') THEN RAISE EXCEPTION 'that booking does not take a horse'; END IF;

  SELECT EXISTS (
    SELECT 1 FROM horses h WHERE h.id = p_horse_id AND h.org_id = v_org AND h.deleted_at IS NULL
      AND (
        h.current_owner_contact_id = v_contact
        OR EXISTS (SELECT 1 FROM horse_parties hp WHERE hp.horse_id = h.id AND hp.contact_id = v_contact
                     AND hp.deleted_at IS NULL AND (hp.effective_to IS NULL OR hp.effective_to >= current_date))
        OR EXISTS (SELECT 1 FROM horse_relationships hr WHERE hr.horse_id = h.id AND hr.party_contact_id = v_contact
                     AND hr.active)
      )
  ) INTO v_mine;
  IF NOT v_mine THEN RAISE EXCEPTION 'that horse is not yours'; END IF;

  -- care bookings gate on the two per-horse releases (generating them on first).
  IF v_b.kind = 'care' THEN
    v_gate := assert_horse_care_eligible(v_contact, p_horse_id);
    IF NOT (v_gate->>'eligible')::boolean THEN
      RAISE EXCEPTION 'HORSE_CARE_DOCS_REQUIRED: %', v_gate->>'missing'
        USING ERRCODE = 'check_violation';
    END IF;
  END IF;

  UPDATE bookings SET horse_id = p_horse_id, updated_at = now() WHERE id = p_booking_id;

  PERFORM notify_staff(v_org, 'horse_intake_completed',
    'A client added their horse to their session', '/app/calendar');

  RETURN jsonb_build_object('ok', true, 'horse_id', p_horse_id);
END;
$function$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 6. Reconcile my_horse_onboarding_state to the unified purchase grain
--    (buyer_contact_id OR buyer_user_id) and the booking horse-link grain
--    (needs_horse = a paid care service with no booking carrying a horse yet).
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.my_horse_onboarding_state()
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  v_contact uuid := current_contact_id();
  v_pending jsonb;
  v_care_unsigned boolean;
  v_care_purchase boolean;
  v_needs_horse boolean;
BEGIN
  IF v_contact IS NULL THEN
    RETURN jsonb_build_object('pending_horse_docs','[]'::jsonb,'needs_horse',false,'service_blocked',false);
  END IF;

  SELECT coalesce(jsonb_agg(jsonb_build_object(
           'document_id', d.id, 'template_key', t.template_key,
           'title', d.title, 'link', '/app/contracts/' || d.id) ORDER BY d.created_at), '[]'::jsonb)
    INTO v_pending
    FROM document_parties dp
    JOIN documents d ON d.id = dp.document_id AND d.deleted_at IS NULL
    JOIN contract_templates t ON t.id = d.template_id
    WHERE dp.contact_id = v_contact
      AND t.template_key IN ('HORSE_EMERGENCY_VET','RELEASE_HORSE_CARE')
      AND d.status <> 'EXECUTED'
      AND NOT EXISTS (SELECT 1 FROM signatures sg
                       WHERE sg.document_id = d.id AND sg.signer_contact_id = v_contact
                         AND sg.deleted_at IS NULL);

  SELECT EXISTS (
    SELECT 1 FROM document_parties dp
    JOIN documents d ON d.id = dp.document_id AND d.deleted_at IS NULL
    JOIN contract_templates t ON t.id = d.template_id
    WHERE dp.contact_id = v_contact AND t.template_key = 'RELEASE_HORSE_CARE'
      AND d.status <> 'EXECUTED'
  ) INTO v_care_unsigned;

  -- a non-cancelled horse (care) purchase by this buyer — contact OR user grain.
  SELECT EXISTS (
    SELECT 1 FROM purchases pu
    JOIN purchase_items pi ON pi.purchase_id = pu.id
    JOIN offerings o ON o.id = pi.offering_id
    WHERE (pu.buyer_contact_id = v_contact OR pu.buyer_user_id = auth.uid())
      AND o.segment = 'horse'
      AND coalesce(pu.status, '') <> 'cancelled'
  ) INTO v_care_purchase;

  -- has a paid care service but no booking yet carrying a horse (booking grain).
  SELECT v_care_purchase AND NOT EXISTS (
    SELECT 1 FROM bookings b
    WHERE b.client_id = current_client_id()
      AND b.kind = 'care' AND b.horse_id IS NOT NULL
      AND b.status NOT IN ('cancelled','available')
  ) INTO v_needs_horse;

  RETURN jsonb_build_object(
    'pending_horse_docs', v_pending,
    'needs_horse', v_needs_horse,
    'service_blocked', v_care_purchase AND v_care_unsigned
  );
END;
$function$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 7. Consolidate horse-add: my_stable_add_horse delegates to the canonical
--    create_horse_record (microchip dedup, reconciliation, horse_relationships).
--    Signature preserved so the FE (stable.ts) needs no change.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.my_stable_add_horse(
  p_name text, p_barn_name text DEFAULT NULL, p_breed text DEFAULT NULL,
  p_sex text DEFAULT NULL, p_height text DEFAULT NULL, p_dob date DEFAULT NULL,
  p_color text DEFAULT NULL, p_location text DEFAULT NULL, p_notes text DEFAULT NULL)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  v_res jsonb;
BEGIN
  v_res := create_horse_record(jsonb_strip_nulls(jsonb_build_object(
    'registered_name', p_name,
    'nickname', p_barn_name,
    'breed', p_breed,
    'sex', p_sex,
    'height', p_height,
    'date_of_birth', p_dob,
    'color', p_color,
    'current_location', coalesce(p_location, 'Carmel Creek Ranch'),
    'medical_history', p_notes
  )));
  -- return the horse id for both created + matched outcomes (back-compat).
  RETURN (v_res->>'horse_id')::uuid;
END;
$function$;

COMMIT;
