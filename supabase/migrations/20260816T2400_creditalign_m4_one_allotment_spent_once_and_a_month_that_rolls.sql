-- TASK CREDITALIGN m4 — the monthly plan spends ONE allotment, whoever books it, and
-- a plan that is still being paid for gets next month's allotment without a developer.
--
-- ════════════════════════════════════════════════════════════════════════════
-- THE DOUBLE-SPEND QUESTION, ANSWERED (task §A1, last bullet)
-- ════════════════════════════════════════════════════════════════════════════
-- `generate_monthly_lessons` writes bookings directly and mints/spends nothing, so once
-- an allotment exists the two would double-count: staff generate four sessions AND the
-- client still shows four credits to book with.
--
-- CHOSEN: generate_monthly_lessons CONSUMES the entitlement. It is not retired — it is
-- how a barn puts a standing weekly slot on the calendar, and the owner asked for
-- credits to reflect "what was actually bought", not for the calendar feature to go
-- away. Each session it creates debits one allotment credit and carries that credit_id,
-- so the member's remaining balance is what is genuinely still bookable. When the
-- allotment is exhausted it STOPS and says so (`skipped_no_entitlement`) rather than
-- writing sessions nobody paid for.
--
-- The alternative — stop generating and make the client book every session themselves —
-- was rejected because it deletes a working staff feature to fix a bookkeeping bug.
--
-- ════════════════════════════════════════════════════════════════════════════
-- THE MONTH ROLL
-- ════════════════════════════════════════════════════════════════════════════
-- A recurring purchase records ONE billing period; this codebase has no biller, and
-- `generate_fulfillment_units` already says so in its own comment ("later periods roll
-- as they are billed"). So:
--   * the FIRST month's allotment is minted at purchase, prorated (m2) — matching how
--     session packs behave the moment they are bought;
--   * later months are minted by `mint_recurring_allotments()`, a daily idempotent
--     sweep, and ONLY for a plan whose order is actually PAID and whose plan_ends_on
--     has not passed. An unpaid plan gets the month it was bought and does not roll —
--     which is the prepaid-gated model (D9), enforced rather than assumed.
--   * the owner stops a plan from the calendar panel (`set_recurring_plan_end`), never
--     from a migration (D13).

-- ════════════════════════════════════════════════════════════════════════════
-- 1. GENERATING THE MONTH SPENDS THE MONTH
-- ════════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.generate_monthly_lessons(p_client_id uuid, p_purchase_item_id uuid, p_start_time text, p_duration_minutes integer DEFAULT 60, p_horse_id uuid DEFAULT NULL::uuid, p_location_id uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_org   uuid := current_org();
  v_pi    purchase_items%ROWTYPE;
  v_pu    purchases%ROWTYPE;
  v_off   offerings%ROWTYPE;
  v_cl    clients%ROWTYPE;
  v_day   text;
  v_acct_c uuid;
  v_acct_u uuid;
  v_series uuid := gen_random_uuid();
  v_month_end date := (date_trunc('month', current_date) + interval '1 month - 1 day')::date;
  v_kind  text;
  v_credit uuid;
  d       date;
  v_s     timestamptz;
  v_e     timestamptz;
  v_made  int := 0;
  v_skipped int := 0;
  v_no_ent  int := 0;
BEGIN
  IF NOT has_staff_access() THEN RAISE EXCEPTION 'operator access required'; END IF;

  SELECT * INTO v_cl FROM clients WHERE id = p_client_id AND deleted_at IS NULL AND org_id = v_org;
  IF NOT FOUND THEN RAISE EXCEPTION 'client not found in this org'; END IF;

  SELECT * INTO v_pi FROM purchase_items WHERE id = p_purchase_item_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'purchase item not found'; END IF;
  SELECT * INTO v_pu FROM purchases WHERE id = v_pi.purchase_id AND deleted_at IS NULL AND buyer_contact_id = v_cl.contact_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'purchase item % does not belong to this client', p_purchase_item_id; END IF;
  SELECT * INTO v_off FROM offerings WHERE id = v_pi.offering_id;
  IF NOT FOUND OR v_off.config_kind <> 'recurring' THEN
    RAISE EXCEPTION 'purchase item % is not a monthly-plan (recurring) offering', p_purchase_item_id;
  END IF;

  v_day := v_pi.config->>'recurring_day';
  IF v_day IS NULL THEN
    RAISE EXCEPTION 'set the recurring day first (set_recurring_day)';
  END IF;

  -- CREDITALIGN: horse-care plans generate too. All six horse-care recurring SKUs
  -- were as broken as the lesson ones, and book_open_slot has been segment-aware all
  -- along — the only thing that was lesson-only was this generator.
  v_kind := CASE WHEN v_off.segment = 'horse' THEN 'care' ELSE 'lesson' END;

  -- A plan stopped mid-month generates only up to its last day.
  IF v_pi.plan_ends_on IS NOT NULL AND v_pi.plan_ends_on < v_month_end THEN
    v_month_end := v_pi.plan_ends_on;
  END IF;

  v_acct_c := v_cl.contact_id;
  SELECT pr.user_id INTO v_acct_u FROM profiles pr WHERE pr.contact_id = v_acct_c;

  FOR d IN SELECT generate_series(current_date, v_month_end, interval '1 day')::date LOOP
    CONTINUE WHEN to_char(d, 'Dy') <> v_day;
    v_s := d + p_start_time::time;
    v_e := v_s + make_interval(mins => coalesce(p_duration_minutes, 60));

    -- no carryover, structurally: the generate_series bound is v_month_end —
    -- there is no path in this loop that can ever produce a date past it.

    IF EXISTS (
      SELECT 1 FROM bookings b WHERE b.client_id = p_client_id AND b.kind = v_kind
        AND b.purchase_id = v_pu.id AND b.starts_at::date = d AND b.status NOT IN ('cancelled','expired')
    ) THEN
      v_skipped := v_skipped + 1; CONTINUE;
    END IF;

    IF p_horse_id IS NOT NULL AND horse_time_conflict(v_org, p_horse_id, v_s, v_e, NULL, v_series) THEN
      RAISE EXCEPTION 'that horse is already booked in an overlapping time on %', d;
    END IF;

    -- ── THE ANSWER TO THE DOUBLE-SPEND QUESTION ──
    -- One session generated = one allotment credit spent, taken from THIS plan's
    -- own line so a client with two plans can never have one fund the other. When
    -- the month's allotment is gone, so is the generating: no session is written
    -- that the entitlement does not cover.
    UPDATE lesson_credits SET credits_remaining = credits_remaining - 1
     WHERE id = (SELECT lc.id FROM lesson_credits lc
                  WHERE lc.client_id = p_client_id
                    AND lc.purchase_item_id = v_pi.id
                    AND lc.deleted_at IS NULL
                    AND lc.credits_remaining > 0
                    AND (lc.expires_at IS NULL OR lc.expires_at > now())
                  ORDER BY lc.expires_at ASC NULLS LAST, lc.period_start
                  LIMIT 1 FOR UPDATE)
     RETURNING id INTO v_credit;
    IF v_credit IS NULL THEN
      v_no_ent := v_no_ent + 1; CONTINUE;
    END IF;

    INSERT INTO bookings (
      org_id, kind, status, starts_at, ends_at, is_flexible,
      client_id, account_contact_id, account_user_id, instructor_user_id,
      horse_id, purchase_id, offering_id, location_id, price_amount,
      series_id, created_by, credit_id
    ) VALUES (
      v_org, v_kind, 'scheduled', v_s, v_e, false,
      p_client_id, v_acct_c, v_acct_u, auth.uid(),
      p_horse_id, v_pu.id, v_off.id, p_location_id, v_off.price_amount,
      v_series, auth.uid(), v_credit
    );
    v_made := v_made + 1;
    v_credit := NULL;
  END LOOP;

  RETURN jsonb_build_object('series_id', v_series, 'created', v_made,
    'skipped_existing', v_skipped, 'skipped_no_entitlement', v_no_ent,
    'recurring_day', v_day, 'kind', v_kind);
END;
$function$;

-- ════════════════════════════════════════════════════════════════════════════
-- 2. CHOOSING THE DAY RE-TRUES THIS MONTH'S ALLOTMENT
-- ════════════════════════════════════════════════════════════════════════════
-- A plan is almost always bought before its weekday is chosen, so the first mint
-- anchors on the purchase weekday (m2). The moment a real day is set, this month's
-- number must agree with it — otherwise the ledger says 4 and the calendar says 5.
-- Sessions already used are never taken away: the new remaining is the new total minus
-- what was spent, floored at zero.
CREATE OR REPLACE FUNCTION public.set_recurring_day(p_purchase_item_id uuid, p_day text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_pi   purchase_items%ROWTYPE;
  v_pu   purchases%ROWTYPE;
  v_off  offerings%ROWTYPE;
  v_day  text := initcap(btrim(coalesce(p_day, '')));
  v_client uuid;
  v_lc   lesson_credits%ROWTYPE;
  v_from date;
  v_to   date;
  v_new  int;
  v_used int;
BEGIN
  IF v_day NOT IN ('Mon','Tue','Wed','Thu','Fri','Sat','Sun') THEN
    RAISE EXCEPTION 'day must be one of Mon/Tue/Wed/Thu/Fri/Sat/Sun, got %', p_day;
  END IF;

  SELECT * INTO v_pi FROM purchase_items WHERE id = p_purchase_item_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'purchase item not found'; END IF;
  SELECT * INTO v_pu FROM purchases WHERE id = v_pi.purchase_id AND deleted_at IS NULL;
  IF NOT FOUND THEN RAISE EXCEPTION 'purchase not found'; END IF;
  SELECT * INTO v_off FROM offerings WHERE id = v_pi.offering_id;
  IF NOT FOUND OR v_off.config_kind <> 'recurring' THEN
    RAISE EXCEPTION 'purchase item % is not a monthly-plan (recurring) offering', p_purchase_item_id;
  END IF;

  SELECT id INTO v_client FROM clients WHERE contact_id = v_pu.buyer_contact_id AND deleted_at IS NULL;
  IF NOT (has_staff_access() OR (v_client IS NOT NULL AND v_client = current_client_id())) THEN
    RAISE EXCEPTION 'not authorized to set this plan''s day';
  END IF;

  UPDATE purchase_items SET config = coalesce(config, '{}'::jsonb) || jsonb_build_object('recurring_day', v_day)
   WHERE id = p_purchase_item_id;

  -- CREDITALIGN: re-true the CURRENT month's allotment against the day just chosen.
  SELECT * INTO v_lc FROM lesson_credits
   WHERE purchase_item_id = p_purchase_item_id
     AND period_start = date_trunc('month', current_date)::date
     AND deleted_at IS NULL
   FOR UPDATE;
  IF FOUND THEN
    v_from := greatest(v_pu.created_at::date, v_lc.period_start);
    v_to   := (v_lc.period_start + interval '1 month - 1 day')::date;
    IF v_pi.plan_ends_on IS NOT NULL AND v_pi.plan_ends_on < v_to THEN v_to := v_pi.plan_ends_on; END IF;
    v_new  := _recurring_allotment(v_off.weekly_frequency, v_day, v_from, v_to, v_pi.quantity);
    v_used := v_lc.credits_total - v_lc.credits_remaining;
    UPDATE lesson_credits
       SET credits_total = v_new,
           credits_remaining = greatest(v_new - v_used, 0)
     WHERE id = v_lc.id;
  END IF;

  RETURN jsonb_build_object('purchase_item_id', p_purchase_item_id, 'recurring_day', v_day,
                            'entitled_this_month', v_new);
END;
$function$;

-- ════════════════════════════════════════════════════════════════════════════
-- 3. STOPPING A PLAN IS A BUTTON, NOT A MIGRATION (D13)
-- ════════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.set_recurring_plan_end(p_purchase_item_id uuid, p_date date)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_pi  purchase_items%ROWTYPE;
  v_off offerings%ROWTYPE;
BEGIN
  IF NOT has_staff_access() THEN RAISE EXCEPTION 'operator access required'; END IF;
  SELECT * INTO v_pi FROM purchase_items WHERE id = p_purchase_item_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'purchase item not found'; END IF;
  SELECT * INTO v_off FROM offerings WHERE id = v_pi.offering_id;
  IF NOT FOUND OR v_off.config_kind <> 'recurring' THEN
    RAISE EXCEPTION 'purchase item % is not a monthly-plan (recurring) offering', p_purchase_item_id;
  END IF;

  UPDATE purchase_items SET plan_ends_on = p_date WHERE id = p_purchase_item_id;

  -- Ending a plan does NOT claw back the month already paid for — the allotment it
  -- bought stands and expires on its own boundary. It only stops the roll.
  RETURN jsonb_build_object('purchase_item_id', p_purchase_item_id, 'plan_ends_on', p_date);
END;
$function$;

REVOKE ALL ON FUNCTION public.set_recurring_plan_end(uuid, date) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.set_recurring_plan_end(uuid, date) FROM anon;
GRANT EXECUTE ON FUNCTION public.set_recurring_plan_end(uuid, date) TO authenticated, service_role;

-- ════════════════════════════════════════════════════════════════════════════
-- 4. THE MONTH ROLL
-- ════════════════════════════════════════════════════════════════════════════
/** Mint the CURRENT month's allotment for every live, paid, unstopped recurring plan
 *  line. Idempotent — safe to run every day, which is what makes it self-healing if a
 *  run is missed. Returns what it looked at and what it made. */
CREATE OR REPLACE FUNCTION public.mint_recurring_allotments()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_month date := date_trunc('month', current_date)::date;
  v_considered int := 0;
  v_credits    int := 0;
  v_made       int;
  r            record;
BEGIN
  IF NOT (coalesce(auth.role(), '') = 'service_role' OR has_staff_access()) THEN
    RAISE EXCEPTION 'operator access required';
  END IF;

  FOR r IN
    SELECT pi.id
      FROM purchase_items pi
      JOIN offerings o  ON o.id = pi.offering_id AND o.config_kind = 'recurring'
      JOIN purchases pu ON pu.id = pi.purchase_id
     WHERE pu.deleted_at IS NULL
       -- a staff caller rolls their own tenant only; the cron (service_role) rolls all.
       AND (coalesce(auth.role(), '') = 'service_role' OR pu.org_id = current_org())
       -- prepaid-gated (D9): a plan rolls into a new month only while it is paid for.
       AND pu.payment_status = 'paid'
       AND (pi.plan_ends_on IS NULL OR pi.plan_ends_on >= v_month)
       -- nothing to do for a plan bought this month — its allotment already exists.
       AND NOT EXISTS (
         SELECT 1 FROM lesson_credits lc
          WHERE lc.purchase_item_id = pi.id AND lc.period_start = v_month AND lc.deleted_at IS NULL)
  LOOP
    v_considered := v_considered + 1;
    v_made := _mint_credits_for_purchase_item(r.id, NULL, v_month);
    v_credits := v_credits + coalesce(v_made, 0);
  END LOOP;

  RETURN jsonb_build_object('month', v_month, 'plans_considered', v_considered,
                            'credits_minted', v_credits);
END;
$function$;

COMMENT ON FUNCTION public.mint_recurring_allotments() IS
  'CREDITALIGN: the month roll. Mints the current month''s allotment for every paid, '
  'unstopped recurring plan line that has not got one yet. Idempotent (the unique index '
  'on (purchase_item_id, period_start) is the real guard). Run daily from '
  '/api/mint-monthly-allotments; also safe for staff to invoke.';

REVOKE ALL ON FUNCTION public.mint_recurring_allotments() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.mint_recurring_allotments() FROM anon;
GRANT EXECUTE ON FUNCTION public.mint_recurring_allotments() TO authenticated, service_role;
