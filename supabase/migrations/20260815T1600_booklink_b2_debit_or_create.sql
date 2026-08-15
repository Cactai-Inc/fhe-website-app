-- BOOKLINK B2 — staff picks the item; the system does the accounting.
--
-- Owner (2026-08-15, verbatim, see docs/tasks/TASK-BOOKLINK-…md):
--   "the booking should have a picker for the user to select what item from
--   their list of purchased items they are booking and the staff should pick
--   both the client and the item they are booking for that client and then it
--   should either debit that clients credits or create an order for that
--   client and staff needs to then mark it as needing to be paid via zelle or
--   cash or already paid via zelle or cash."
--
-- MEASURED: save_calendar_item already resolves an unambiguous purchase
-- (BOOKWRITE, 20260812T1600) but never decrements lesson_credits — the ledger
-- clients actually see (myLessonsOverview / MyLessonsContent) — and never
-- creates an order when nothing exists to debit. `purchases.payment_method`
-- has no CHECK constraint (verified live: only payment_status/status do), so
-- 'cash' needs no schema change — it only needed a code path that writes it.
--
-- CONVERGENCE, not greenfield: the new helper calls the existing
-- _provision_purchase_for_offerings (the same spine provision_client_invitation
-- uses — FLOWTRACE's "order origins") rather than inserting purchases/
-- purchase_items itself. It is prefixed `_` and revoked from authenticated,
-- exactly like _provision_purchase_for_offerings and _unambiguous_purchase_for_
-- client — reachable only from another postgres-owned SECURITY DEFINER
-- function (NOGUARD3's pattern), never as a direct RPC.

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. _debit_or_create_for_booking — the accounting decision, once.
--
-- Given a client + the offering being booked (+ an optional staff-chosen
-- purchase to scope to), returns the purchase/credit this booking should be
-- linked to:
--   1. RECURRING (config_kind='recurring', i.e. a monthly plan): the purchase
--      of that offering by that client IS the assignment (owner's B4 rule —
--      "don't invent a parallel table"). Reuse the client's existing purchase
--      of this offering if one exists; otherwise this purchase creation IS the
--      assignment. Never decrements a credit — monthly entitlement is a
--      calendar-window query (B4), not a ledger row, so this cannot collide
--      with the pending credit-ledger fix (FLOWTRACE §8).
--   2. Otherwise: debit an existing lesson_credits row if one is open for this
--      offering (mirrors book_open_slot's own preference order: offering-
--      tagged first, then untagged). Falls back to a purchase with an open
--      fulfillment unit for this offering but no credit row (e.g. F2's Full
--      Body Clip case). Only when NEITHER exists does it create a new order —
--      via the provisioning spine, with the staff-chosen payment method/state.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public._debit_or_create_for_booking(
  p_client_id uuid, p_offering_id uuid, p_purchase_id uuid,
  p_payment_method text DEFAULT NULL::text, p_mark_paid boolean DEFAULT false
) RETURNS TABLE(purchase_id uuid, credit_id uuid)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_client   clients%ROWTYPE;
  v_kind     text;
  v_credit   uuid;
  v_cr_pur   uuid;
  v_purchase uuid;
BEGIN
  IF p_offering_id IS NULL THEN
    RETURN QUERY SELECT p_purchase_id, NULL::uuid; RETURN;
  END IF;

  SELECT * INTO v_client FROM clients WHERE id = p_client_id AND deleted_at IS NULL;
  IF NOT FOUND THEN
    RETURN QUERY SELECT p_purchase_id, NULL::uuid; RETURN;
  END IF;

  SELECT config_kind INTO v_kind FROM offerings WHERE id = p_offering_id;

  -- ── monthly plan: the purchase IS the assignment, never a credit debit ──
  IF v_kind = 'recurring' THEN
    SELECT pu.id INTO v_purchase
      FROM purchases pu
      JOIN purchase_items pi ON pi.purchase_id = pu.id AND pi.offering_id = p_offering_id
     WHERE pu.buyer_contact_id = v_client.contact_id AND pu.deleted_at IS NULL
     ORDER BY pu.created_at DESC LIMIT 1;
    IF v_purchase IS NULL THEN
      v_purchase := _provision_purchase_for_offerings(
        v_client.org_id, v_client.contact_id, p_client_id, ARRAY[p_offering_id],
        coalesce(p_mark_paid, false), p_payment_method, 'Monthly plan assigned from calendar');
    END IF;
    RETURN QUERY SELECT v_purchase, NULL::uuid; RETURN;
  END IF;

  -- ── 1. an open credit for this offering, optionally scoped to a
  --      staff-chosen purchase (mirrors book_open_slot's own preference) ──
  UPDATE lesson_credits SET credits_remaining = credits_remaining - 1
   WHERE id = (
     SELECT lc.id FROM lesson_credits lc
      WHERE lc.client_id = p_client_id AND lc.deleted_at IS NULL AND lc.credits_remaining > 0
        AND (p_purchase_id IS NULL OR lc.purchase_id = p_purchase_id)
        AND (lc.offering_id = p_offering_id OR lc.offering_id IS NULL)
      ORDER BY (lc.offering_id = p_offering_id) DESC NULLS LAST, lc.purchased_at, lc.created_at
      LIMIT 1 FOR UPDATE
   )
   RETURNING lesson_credits.id, lesson_credits.purchase_id INTO v_credit, v_cr_pur;
  IF v_credit IS NOT NULL THEN
    RETURN QUERY SELECT v_cr_pur, v_credit; RETURN;
  END IF;

  -- ── 2. staff explicitly named a purchase and there was nothing on it to
  --      debit — respect their choice; the booking trigger still claims a
  --      fulfillment unit on it if one is open ──
  IF p_purchase_id IS NOT NULL THEN
    RETURN QUERY SELECT p_purchase_id, NULL::uuid; RETURN;
  END IF;

  -- ── 3. an existing purchase with an open unit for this offering but no
  --      credit row (F2: a session-priced offering whose name doesn't match
  --      the credit-minting regex) ──
  SELECT pu.id INTO v_purchase
    FROM purchases pu
    JOIN purchase_items pi ON pi.purchase_id = pu.id AND pi.offering_id = p_offering_id
    JOIN fulfillment_units u ON u.purchase_item_id = pi.id
   WHERE pu.buyer_contact_id = v_client.contact_id AND pu.deleted_at IS NULL
     AND u.deleted_at IS NULL AND u.current_status = 'open' AND u.unit_kind IN ('session','period')
   ORDER BY pu.created_at LIMIT 1;
  IF v_purchase IS NOT NULL THEN
    RETURN QUERY SELECT v_purchase, NULL::uuid; RETURN;
  END IF;

  -- ── 4. nothing to debit anywhere — create the order, through the spine ──
  v_purchase := _provision_purchase_for_offerings(
    v_client.org_id, v_client.contact_id, p_client_id, ARRAY[p_offering_id],
    coalesce(p_mark_paid, false), p_payment_method, 'Booked from calendar');

  -- that mint just created exactly one lesson_credits row for this offering
  -- (session-priced SKUs only); this booking consumes it right now.
  UPDATE lesson_credits SET credits_remaining = credits_remaining - 1
   WHERE id = (SELECT lc.id FROM lesson_credits lc
                WHERE lc.purchase_id = v_purchase AND lc.offering_id = p_offering_id
                  AND lc.credits_remaining > 0
                LIMIT 1 FOR UPDATE)
   RETURNING lesson_credits.id INTO v_credit;

  RETURN QUERY SELECT v_purchase, v_credit;
END;
$function$;

REVOKE ALL ON FUNCTION public._debit_or_create_for_booking(uuid, uuid, uuid, text, boolean) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public._debit_or_create_for_booking(uuid, uuid, uuid, text, boolean) TO service_role;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. save_calendar_item — wire the accounting into the one writer.
--
-- Byte-identical to BOOKWRITE (20260812T1600) except: the v_pur resolution
-- step now goes through _debit_or_create_for_booking when an offering is
-- picked (falling back to the old any-unambiguous-purchase behavior only when
-- it isn't), a new v_credit is threaded through and written to bookings.credit_id
-- (a column BOOKWRITE left unpopulated), and two new payload fields are read:
-- payment_method / payment_state ('needs_payment' | 'paid'), used only when
-- this call ends up creating a brand-new order. Never runs on a draft — a
-- draft must not create real financial consequences. Never runs when the
-- payload already carries a purchase_id — a re-save of an already-accounted
-- booking (the panel round-trips item.purchase_id back on every edit) or an
-- explicit staff re-assignment, both of which must not re-debit.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.save_calendar_item(p jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_org     uuid := current_org();
  v_id      uuid := nullif(p->>'id','')::uuid;
  v_kind    text := coalesce(p->>'kind','block');
  v_status  text := coalesce(p->>'status','draft');
  v_start   timestamptz := (p->>'starts_at')::timestamptz;
  v_end     timestamptz := (p->>'ends_at')::timestamptz;
  v_horse   uuid := nullif(p->>'horse_id','')::uuid;
  v_offer   uuid := nullif(p->>'offering_id','')::uuid;
  v_price   numeric := nullif(p->>'price_amount','')::numeric;
  v_weeks   int := coalesce(nullif(p->>'recurrence_weeks','')::int, 1);
  v_scope   text := coalesce(p->>'scope','one');
  v_client  uuid := nullif(p->>'client_id','')::uuid;
  v_pur     uuid := nullif(p->>'purchase_id','')::uuid;
  v_instr   uuid := nullif(p->>'instructor_user_id','')::uuid;
  v_flex    boolean := coalesce((p->>'is_flexible')::boolean, false);
  v_pay_method text := nullif(btrim(coalesce(p->>'payment_method','')), '');
  v_mark_paid  boolean := (p->>'payment_state') = 'paid';
  v_credit  uuid;
  v_acct_c  uuid;
  v_acct_u  uuid;
  v_series  uuid;
  v_row     bookings%ROWTYPE;
  v_delta   interval;
  v_dur     interval;
  i         int;
  v_s       timestamptz;
  v_e       timestamptz;
  v_new_id  uuid;
BEGIN
  IF NOT has_staff_access() THEN RAISE EXCEPTION 'operator access required'; END IF;
  IF v_start IS NULL OR v_end IS NULL OR v_end <= v_start THEN
    RAISE EXCEPTION 'a calendar item needs a start and a later end';
  END IF;
  IF v_price IS NULL AND v_offer IS NOT NULL THEN
    SELECT price_amount INTO v_price FROM offerings WHERE id = v_offer;
  END IF;

  -- BOOKWRITE: everything the item already knows, resolved once.
  IF v_client IS NOT NULL THEN
    SELECT cl.contact_id INTO v_acct_c FROM clients cl
     WHERE cl.id = v_client AND cl.deleted_at IS NULL;
    IF v_acct_c IS NOT NULL THEN
      SELECT pr.user_id INTO v_acct_u FROM profiles pr WHERE pr.contact_id = v_acct_c;
    END IF;
    -- BOOKLINK B2: the paying item, only on a real (non-draft) commit where
    -- nothing was already resolved for it.
    IF v_pur IS NULL AND NOT v_flex AND v_kind IN ('lesson','care') AND v_status <> 'draft' THEN
      IF v_offer IS NOT NULL THEN
        SELECT d.purchase_id, d.credit_id INTO v_pur, v_credit
          FROM _debit_or_create_for_booking(v_client, v_offer, NULL, v_pay_method, v_mark_paid) d;
      ELSE
        v_pur := _unambiguous_purchase_for_client(v_client);
      END IF;
    END IF;
    -- who is delivering it: the acting staff member unless one was named
    IF v_instr IS NULL AND v_kind IN ('lesson','care') THEN
      v_instr := auth.uid();
    END IF;
  END IF;

  -- ── EDIT ──────────────────────────────────────────────────────────────────
  IF v_id IS NOT NULL THEN
    SELECT * INTO v_row FROM bookings WHERE id = v_id AND org_id = v_org;
    IF NOT FOUND THEN RAISE EXCEPTION 'item not found in this org'; END IF;

    v_delta := v_start - v_row.starts_at;
    v_dur   := v_end - v_start;

    -- which rows the edit touches (series scope)
    FOR v_row IN
      SELECT * FROM bookings
      WHERE org_id = v_org
        AND (CASE
          WHEN v_scope = 'one' OR v_row.series_id IS NULL THEN id = v_id
          WHEN v_scope = 'future' THEN series_id = v_row.series_id AND starts_at >= v_row.starts_at
          ELSE series_id = v_row.series_id  -- 'all'
        END)
    LOOP
      v_s := v_row.starts_at + v_delta;
      v_e := v_s + v_dur;
      IF v_horse IS NOT NULL AND horse_time_conflict(v_org, v_horse, v_s, v_e, v_row.id, v_row.series_id) THEN
        RAISE EXCEPTION 'that horse is already booked in an overlapping time';
      END IF;
      UPDATE bookings SET
        kind = v_kind, status = v_status, starts_at = v_s, ends_at = v_e,
        is_flexible = coalesce((p->>'is_flexible')::boolean, is_flexible),
        client_id = v_client,
        account_contact_id = v_acct_c,
        account_user_id = v_acct_u,
        instructor_user_id = v_instr,
        horse_id = v_horse,
        purchase_id = v_pur,
        credit_id = coalesce(v_credit, credit_id),
        offering_id = v_offer,
        location_id = nullif(p->>'location_id','')::uuid,
        address = nullif(p->>'address',''),
        travel_before_minutes = coalesce((p->>'travel_before_minutes')::int, 0),
        travel_after_minutes = coalesce((p->>'travel_after_minutes')::int, 0),
        price_amount = v_price,
        all_day = coalesce((p->>'all_day')::boolean, false),
        notes = nullif(p->>'notes',''),
        updated_at = now()
      WHERE id = v_row.id;
    END LOOP;
    RETURN jsonb_build_object('id', v_id, 'series_id', v_row.series_id);
  END IF;

  -- ── CREATE (single or recurring) ────────────────────────────────────────────
  v_dur := v_end - v_start;
  IF v_weeks > 1 THEN v_series := gen_random_uuid(); END IF;

  FOR i IN 0 .. (greatest(v_weeks,1) - 1) LOOP
    v_s := v_start + make_interval(weeks => i);
    v_e := v_s + v_dur;
    IF v_horse IS NOT NULL AND horse_time_conflict(v_org, v_horse, v_s, v_e, NULL, v_series) THEN
      RAISE EXCEPTION 'that horse is already booked in an overlapping time (week %)', i + 1;
    END IF;
    INSERT INTO bookings (
      org_id, kind, status, starts_at, ends_at, all_day, is_flexible,
      client_id, account_contact_id, account_user_id, instructor_user_id,
      horse_id, purchase_id, credit_id, offering_id, location_id, address,
      travel_before_minutes, travel_after_minutes, price_amount, notes,
      series_id, created_by
    ) VALUES (
      v_org, v_kind, v_status, v_s, v_e,
      coalesce((p->>'all_day')::boolean, false),
      v_flex,
      v_client, v_acct_c, v_acct_u, v_instr,
      v_horse, v_pur, v_credit, v_offer,
      nullif(p->>'location_id','')::uuid, nullif(p->>'address',''),
      coalesce((p->>'travel_before_minutes')::int, 0),
      coalesce((p->>'travel_after_minutes')::int, 0),
      v_price, nullif(p->>'notes',''), v_series, auth.uid()
    ) RETURNING id INTO v_new_id;
  END LOOP;

  RETURN jsonb_build_object('id', v_new_id, 'series_id', v_series);
END;
$function$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. mark_purchase_paid — FLOWTRACE item 13: zero callers in src/, granted to
--    service_role only, so no staff surface could ever mark an order paid.
--    Byte-identical body, plus the staff guard it was missing (it trusted the
--    grant alone — the grant is now widening, so the guard has to move inside).
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.mark_purchase_paid(p_purchase_id uuid, p_amount numeric, p_reference text DEFAULT NULL::text, p_method text DEFAULT 'zelle'::text)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_pur purchases%ROWTYPE;
  v_user  uuid;
  v_label text;
  v_paid  text;
BEGIN
  IF NOT (coalesce(auth.role(), '') = 'service_role' OR has_staff_access()) THEN
    RAISE EXCEPTION 'operator access required';
  END IF;

  SELECT * INTO v_pur FROM purchases WHERE id = p_purchase_id AND deleted_at IS NULL;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'unknown purchase: %', p_purchase_id;
  END IF;
  IF v_pur.payment_status = 'paid' THEN
    RETURN 'already_paid';
  END IF;

  UPDATE purchases p
     SET payment_status    = 'paid',
         status            = 'paid',
         paid_at           = now(),
         amount_paid       = COALESCE(p.amount, 0),
         payment_method    = p_method,
         payment_reference = COALESCE(p.payment_reference, p_reference)
   WHERE p.id = p_purchase_id;

  SELECT string_agg(pi.label, ', ' ORDER BY pi.created_at) INTO v_label
    FROM purchase_items pi WHERE pi.purchase_id = p_purchase_id;
  v_label := coalesce(nullif(btrim(v_label), ''), 'Your order');
  v_paid  := fmt_money(coalesce(v_pur.amount, p_amount, 0));

  PERFORM resolve_notifications_for_link('/app/orders', NULL, 'purchase_unpaid');
  PERFORM resolve_notifications_for_link('/app/ops/payments/review', NULL, 'purchase_unpaid');

  SELECT pr.user_id INTO v_user
    FROM profiles pr WHERE pr.contact_id = v_pur.buyer_contact_id LIMIT 1;
  IF v_user IS NOT NULL THEN
    PERFORM notify_user(v_user, 'payment_received',
      'Payment received — ' || v_label,
      'We received your payment of ' || v_paid || '. Thank you.',
      '/app/orders');
  END IF;

  PERFORM notify_staff(v_pur.org_id, 'payment_received',
    'Payment received — ' || v_label || ' (' || v_paid || ')',
    '/app/ops/payments/review');

  RETURN 'paid';
END;
$function$;

REVOKE ALL ON FUNCTION public.mark_purchase_paid(uuid, numeric, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.mark_purchase_paid(uuid, numeric, text, text) TO authenticated, service_role;

COMMENT ON FUNCTION public.mark_purchase_paid(uuid, numeric, text, text) IS
  'BOOKLINK B2 (2026-08-15): widened from service_role-only to authenticated, '
  'guarded internally by has_staff_access() — FLOWTRACE item 13, no staff '
  'surface could previously mark an order paid.';
