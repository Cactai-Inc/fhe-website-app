-- OWNER, 2026-09-01 — the flow after signing, in his words:
--   *"the next thing i should see after signing the docs is the offering selection
--   page to pick the thing i want to purchase or, if i have an order already in the
--   system (the way a lead from the website would) i should see my pending order and
--   a calendar to select the date and time i want it scheduled for. then i should
--   click submit. if i have the desire to change my order in any way i should be able
--   to click a button and see the catalog page for whatever category im in the flow
--   for and i should be able to add something to the order and i should be able to
--   remove things from my order from the order overview page, then i can pick the
--   date(s) and time(s) for the thing(s) in my order and submit it."*
--
-- ⚠️ THREE CHANGES, AND THE FIRST ONE IS WHY THE OTHERS ARE NEEDED:
--   1. a request carries a time PER LINE, not one time for the whole order —
--      "the date(s) and time(s) for the thing(s) in my order" is plural twice;
--   2. a person may ADD to their own draft order (the catalog button);
--   3. a person may REMOVE a line from it (`void_purchase_item` is staff-only —
--      it raises 'only staff may cancel a line item' — so a client had no way).

-- ─── 1 · ADD TO MY OWN DRAFT ORDER ───────────────────────────────────────────
-- The item loop is `create_my_purchase`'s, unchanged: the catalog is the price
-- list, a line that does not resolve to a live offering in the caller's own org
-- has no price we will honour, and the incumbent totaller runs at the end.
CREATE OR REPLACE FUNCTION public.add_to_my_purchase(p_purchase_id uuid, p_items jsonb)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_uid     uuid := auth.uid();
  v_contact uuid := current_contact_id();
  v_org     uuid := current_org();
  v_pu      purchases%ROWTYPE;
  v_off     offerings%ROWTYPE;
  v_item    jsonb;
  v_off_id  uuid;
  v_qty     integer;
  v_added   integer := 0;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'authentication required'; END IF;
  IF p_items IS NULL OR jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'nothing to add';
  END IF;

  SELECT * INTO v_pu FROM purchases WHERE id = p_purchase_id AND deleted_at IS NULL;
  IF NOT FOUND THEN RAISE EXCEPTION 'that order does not exist'; END IF;
  IF NOT (v_pu.buyer_user_id = v_uid
          OR (v_contact IS NOT NULL AND v_pu.buyer_contact_id = v_contact)) THEN
    RAISE EXCEPTION 'that order is not yours';
  END IF;
  -- ⚠️ DRAFT ONLY. Once staff open an order it is priced, minted against and
  -- possibly paid; a client adding a line to it would move money silently.
  IF coalesce(v_pu.status, '') <> 'draft' THEN
    RAISE EXCEPTION 'that order can no longer be changed here';
  END IF;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    v_off_id := nullif(btrim(coalesce(v_item->>'offering_id', '')), '')::uuid;
    IF v_off_id IS NULL THEN RAISE EXCEPTION 'every line must name an offering'; END IF;
    SELECT * INTO v_off FROM offerings
     WHERE id = v_off_id AND org_id = v_pu.org_id AND active;
    IF NOT FOUND THEN RAISE EXCEPTION 'that offering is not available'; END IF;

    v_qty := greatest(coalesce((v_item->>'quantity')::integer, 1), 1);
    INSERT INTO purchase_items (purchase_id, org_id, offering_id, label,
                                price_amount, price_unit, quantity)
    VALUES (p_purchase_id, v_pu.org_id, v_off.id, v_off.name,
            coalesce(v_off.price_amount, 0), v_off.price_unit, v_qty);
    v_added := v_added + 1;
  END LOOP;

  PERFORM _recompute_purchase_total(p_purchase_id);
  RETURN v_added;
END;
$function$;

REVOKE ALL ON FUNCTION public.add_to_my_purchase(uuid, jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.add_to_my_purchase(uuid, jsonb) FROM anon;
GRANT EXECUTE ON FUNCTION public.add_to_my_purchase(uuid, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.add_to_my_purchase(uuid, jsonb) TO service_role;

-- ─── 2 · REMOVE A LINE FROM MY OWN DRAFT ORDER ───────────────────────────────
-- ⚠️ VOIDED, NEVER DELETED (D32) — the same column `void_purchase_item` writes,
-- for the same reason: what was asked for is evidence. This is the CLIENT's door
-- onto that act, gated to their own draft; the staff function is untouched.
CREATE OR REPLACE FUNCTION public.remove_from_my_purchase(p_item_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_uid     uuid := auth.uid();
  v_contact uuid := current_contact_id();
  v_pu      purchases%ROWTYPE;
  v_live    integer;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'authentication required'; END IF;

  SELECT p.* INTO v_pu FROM purchase_items pi
    JOIN purchases p ON p.id = pi.purchase_id AND p.deleted_at IS NULL
   WHERE pi.id = p_item_id AND pi.voided_at IS NULL;
  IF NOT FOUND THEN RAISE EXCEPTION 'that item is not on an order you can change'; END IF;
  IF NOT (v_pu.buyer_user_id = v_uid
          OR (v_contact IS NOT NULL AND v_pu.buyer_contact_id = v_contact)) THEN
    RAISE EXCEPTION 'that order is not yours';
  END IF;
  IF coalesce(v_pu.status, '') <> 'draft' THEN
    RAISE EXCEPTION 'that order can no longer be changed here';
  END IF;

  SELECT count(*) INTO v_live FROM purchase_items
   WHERE purchase_id = v_pu.id AND voided_at IS NULL;
  -- ⚠️ NOT THE LAST ONE. `_recompute_purchase_total` VOIDS the order when its last
  -- live line goes, and an order that voids itself underneath somebody who is
  -- mid-flow is a dead end, not an edit. Adding first, then removing, works.
  IF v_live <= 1 THEN
    RAISE EXCEPTION 'an order needs at least one item — add what you want first, then remove this';
  END IF;

  UPDATE purchase_items
     SET voided_at = now(), voided_by = v_uid, void_reason = 'removed by the client during onboarding'
   WHERE id = p_item_id AND voided_at IS NULL;

  PERFORM _recompute_purchase_total(v_pu.id);
  RETURN v_live - 1;
END;
$function$;

REVOKE ALL ON FUNCTION public.remove_from_my_purchase(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.remove_from_my_purchase(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.remove_from_my_purchase(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.remove_from_my_purchase(uuid) TO service_role;

-- ─── 3 · ONE REQUEST, A TIME PER LINE ────────────────────────────────────────
-- ⚠️ DROP FIRST. The four-argument form took ONE start and end for a whole order,
-- which cannot express "the date(s) and time(s) for the thing(s) in my order".
-- Replacing rather than overloading, so no caller can resolve to the old body.
-- Its only caller is the onboarding wizard, which changes with it.
DROP FUNCTION IF EXISTS public.submit_my_booking_request(uuid, timestamptz, timestamptz, text);

CREATE FUNCTION public.submit_my_booking_request(
  p_purchase_id uuid,
  p_slots       jsonb,          -- [{item_id, starts_at, ends_at}, …] — one per line
  p_note        text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_uid      uuid := auth.uid();
  v_contact  uuid := current_contact_id();
  v_org      uuid := current_org();
  v_pu       purchases%ROWTYPE;
  v_slot     jsonb;
  v_item     purchase_items%ROWTYPE;
  v_start    timestamptz;
  v_end      timestamptz;
  v_booking  uuid;
  v_bookings uuid[] := '{}';
  v_first    timestamptz;
  v_request  uuid;
  v_name     text;
  v_email    text;
  v_times    jsonb := '[]'::jsonb;
  v_result   jsonb;
  v_offering uuid;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'authentication required'; END IF;
  IF p_slots IS NULL OR jsonb_typeof(p_slots) <> 'array' OR jsonb_array_length(p_slots) = 0 THEN
    RAISE EXCEPTION 'pick a day and time for what you are booking';
  END IF;

  SELECT * INTO v_pu FROM purchases WHERE id = p_purchase_id AND deleted_at IS NULL;
  IF NOT FOUND THEN RAISE EXCEPTION 'that order does not exist'; END IF;
  IF NOT (v_pu.buyer_user_id = v_uid
          OR (v_contact IS NOT NULL AND v_pu.buyer_contact_id = v_contact)) THEN
    RAISE EXCEPTION 'that order is not yours';
  END IF;
  IF coalesce(v_pu.status, '') <> 'draft' THEN
    RAISE EXCEPTION 'that order has already been submitted';
  END IF;
  IF EXISTS (SELECT 1 FROM bookings b
              WHERE b.purchase_id = p_purchase_id AND b.deleted_at IS NULL) THEN
    RAISE EXCEPTION 'a time has already been requested for that order';
  END IF;

  FOR v_slot IN SELECT * FROM jsonb_array_elements(p_slots) LOOP
    SELECT * INTO v_item FROM purchase_items
     WHERE id = (v_slot->>'item_id')::uuid
       AND purchase_id = p_purchase_id AND voided_at IS NULL;
    IF NOT FOUND THEN RAISE EXCEPTION 'that item is not on this order'; END IF;

    v_start := (v_slot->>'starts_at')::timestamptz;
    v_end   := (v_slot->>'ends_at')::timestamptz;

    -- ⚠️ THE BOOKING WRITER IS `request_open_time` AND IT IS NOT COPIED HERE
    -- (D18/D35 — it is TASK-LIFECYCLE's function). It validates the times,
    -- refuses a past one, opens the staff decision row and raises the in-app
    -- staff notification. This adds the order link it has no argument for.
    v_result  := request_open_time(v_start, v_end, v_item.offering_id, NULL, p_note);
    v_booking := (v_result->>'booking_id')::uuid;
    v_bookings := v_bookings || v_booking;
    IF v_first IS NULL OR v_start < v_first THEN v_first := v_start; END IF;
    IF v_offering IS NULL THEN v_offering := v_item.offering_id; END IF;

    UPDATE bookings SET purchase_id = p_purchase_id WHERE id = v_booking;

    v_times := v_times || jsonb_build_array(jsonb_build_object(
      'label', coalesce(v_item.label, 'A session') || ' — '
               || to_char(v_start, 'FMDay, FMMon FMDD YYYY') || ' at '
               || to_char(v_start, 'FMHH12:MI AM')));
  END LOOP;

  -- The inbound-alert row: one per SUBMISSION, carrying every requested time.
  SELECT nullif(btrim(coalesce(c.first_name,'') || ' ' || coalesce(c.last_name,'')), ''),
         c.email INTO v_name, v_email
    FROM contacts c WHERE c.id = v_contact;

  IF v_email IS NOT NULL AND v_email ~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' THEN
    INSERT INTO requests (
      org_id, contact_id, contact_name, contact_first_name, contact_last_name,
      contact_email, contact_phone, channel, category, entry_location,
      subject, notes, proposed_times, status)
    SELECT v_org, v_contact, coalesce(v_name, v_email), c.first_name, c.last_name, v_email,
           CASE WHEN c.phone ~ '^[-+().0-9[:space:]]{7,32}$' THEN c.phone END,
           'booking',
           CASE WHEN o.segment = 'horse' THEN 'horse_care' ELSE 'lessons' END,
           'onboarding',
           'Booking request — ' || coalesce(v_pu.display_code, 'a new order'),
           nullif(btrim(coalesce(p_note, '')), ''),
           v_times, 'new'
      FROM contacts c
      LEFT JOIN offerings o ON o.id = v_offering
     WHERE c.id = v_contact
    RETURNING id INTO v_request;
  END IF;

  IF v_request IS NOT NULL THEN
    UPDATE bookings SET request_id = v_request WHERE id = ANY(v_bookings);
    UPDATE purchases SET request_id = v_request WHERE id = p_purchase_id;
    INSERT INTO request_selections (request_id, org_id, offering_id, label, origin)
    SELECT v_request, v_org, pi.offering_id, pi.label, 'onboarding'
      FROM purchase_items pi
     WHERE pi.purchase_id = p_purchase_id AND pi.voided_at IS NULL;
  END IF;

  -- CR-98 step 8: release the run held since the sign step and send the ONE
  -- email — documents attached, order and requested times in the body.
  BEGIN
    PERFORM deliver_executed_document_set(
      v_contact, NULL,
      jsonb_build_object('purchaseId', p_purchase_id, 'bookingId', v_bookings[1]));
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'signed-document set not delivered for %: %', v_contact, SQLERRM;
  END;

  RETURN jsonb_build_object(
    'booking_ids', to_jsonb(v_bookings),
    'request_id', v_request,
    'purchase_id', p_purchase_id,
    'first_starts_at', v_first,
    'status', v_result->>'status');
END;
$function$;

REVOKE ALL ON FUNCTION public.submit_my_booking_request(uuid, jsonb, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.submit_my_booking_request(uuid, jsonb, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.submit_my_booking_request(uuid, jsonb, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.submit_my_booking_request(uuid, jsonb, text) TO service_role;
