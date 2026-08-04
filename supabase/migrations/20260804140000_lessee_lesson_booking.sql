-- A13: lessee can book lessons with their leased horse.
--
-- Adds a shared eligibility helper (owner OR lessee-stamp-in-window OR active
-- OWNER/LESSEE horse_relationships row) so attach_booking_horse and
-- book_open_slot's lesson branch can never fork the definition of "may use
-- this horse" again. book_open_slot's lesson branch previously wrote
-- p_horse_id through with no validation at all.

CREATE OR REPLACE FUNCTION public.caller_may_use_horse(p_contact uuid, p_horse uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM horses h
    WHERE h.id = p_horse
      AND (
        h.current_owner_contact_id = p_contact
        OR (h.lessee_contact_id = p_contact AND (h.lease_end IS NULL OR h.lease_end >= current_date))
        OR EXISTS (
          SELECT 1 FROM horse_relationships hr
          WHERE hr.horse_id = h.id AND hr.party_contact_id = p_contact
            AND hr.relationship IN ('OWNER','LESSEE')
            AND hr.active AND (hr.term_end IS NULL OR hr.term_end >= current_date)
        )
      )
  );
$function$;

CREATE OR REPLACE FUNCTION public.attach_booking_horse(p_booking_id uuid, p_horse_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_client  uuid := current_client_id();
  v_contact uuid := current_contact_id();
  v_org     uuid := current_org();
  v_b       bookings%ROWTYPE;
  v_mine    boolean;
  v_gate    jsonb;
BEGIN
  IF v_client IS NULL THEN RAISE EXCEPTION 'no member profile'; END IF;

  SELECT * INTO v_b FROM bookings WHERE id = p_booking_id AND org_id = v_org;
  IF NOT FOUND THEN RAISE EXCEPTION 'booking not found'; END IF;
  IF v_b.client_id IS DISTINCT FROM v_client THEN RAISE EXCEPTION 'not your booking'; END IF;
  IF v_b.kind NOT IN ('lesson','care') THEN RAISE EXCEPTION 'that booking does not take a horse'; END IF;

  SELECT EXISTS (
    SELECT 1 FROM horses h WHERE h.id = p_horse_id AND h.org_id = v_org AND h.deleted_at IS NULL
      AND caller_may_use_horse(v_contact, h.id)
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

CREATE OR REPLACE FUNCTION public.book_open_slot(p_booking_id uuid, p_horse_id uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
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
  IF v_client IS NULL THEN RAISE EXCEPTION 'no member profile'; END IF;
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

  -- lesson branch: an explicit horse must be one the caller may use (owner or
  -- active lease); NULL stays allowed (barn-supplied horse). No care-docs gate
  -- here — that's care-specific.
  IF v_kind = 'lesson' AND p_horse_id IS NOT NULL THEN
    IF NOT caller_may_use_horse(v_contact, p_horse_id) THEN
      RAISE EXCEPTION 'that horse is not yours';
    END IF;
  END IF;

  -- credit-gated: both lessons and care debit one service credit, preferring a
  -- credit tagged with this offering, falling back to any untagged balance.
  UPDATE lesson_credits SET credits_remaining = credits_remaining - 1
   WHERE id = (SELECT id FROM lesson_credits
               WHERE client_id = v_client AND org_id = v_b.org_id
                 AND deleted_at IS NULL AND credits_remaining > 0
                 AND (
                   -- offering-tagged slot: that offering's credits, or untagged
                   (v_offering IS NOT NULL AND (offering_id = v_offering OR offering_id IS NULL))
                   -- GENERIC slot (published from business hours, no offering):
                   -- any untagged credit, or any credit whose offering is not a
                   -- horse-care SKU — the slot is generic time; the credit says
                   -- what was bought. Without this, every real purchase (always
                   -- offering-tagged) was rejected by generic open slots.
                   OR (v_offering IS NULL AND (offering_id IS NULL OR EXISTS (
                        SELECT 1 FROM offerings oc WHERE oc.id = offering_id AND oc.segment <> 'horse')))
                 )
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
