-- TASK-BUYANDBOOK §4 — a weekly membership is a STANDING SLOT, not a credit balance.
--
-- D23 corollary (owner, 2026-08-20): "its not like we get paid and then issue them
-- credits and then they have to go schedule them, that would be a monthly riding punch
-- card, not a weekly paid monthly riding slot," and "mint into eternity the weekly
-- schedule and its gated on did they pay at the staff fullfilment level."
--
-- TWO SHAPES. `config_kind='scheduled'` (Single, Evaluation, punch cards) gives CREDITS
-- the client spends. `config_kind='recurring'` (1x/2x Weekly) gives a STANDING WEEKLY
-- SLOT. `weekly_frequency` is slots per week, not credits.
--
-- MEASURED BEFORE (prod, 2026-08-20): all three live recurring purchase_items carry
-- `config = '{}'` — no day was ever chosen for any of them. PUR-000230 (2x Weekly)
-- nevertheless minted FOUR spendable credits, because the recurring branch fell back to
-- `_recurring_allotment(weekly_frequency, …)` when no day was set. That fallback IS the
-- punch card the owner rejected: four credits and no slot.
--
-- THIS MIGRATION CONVERGES ON CAREPLANS AND ADDS NO SECOND MECHANISM. In CAREPLANS the
-- month's allotment is an INTERNAL BUDGET that `_generate_plan_month` spends one credit
-- per generated session, so the month opens with bookings and ZERO spendable credits —
-- the bookings ARE the entitlement. Everything below keeps that spine and closes the
-- four gaps that stopped it working for lessons:
--
--   1. NO DAYS, NO ALLOTMENT. The `weekly_frequency` fallback is removed. A recurring
--      line with no chosen days now mints nothing at all, so a purchase can no longer
--      hand out spendable credits it has no slot for.
--   2. NO RETROACTIVE ALLOTMENT. The month's budget counted chosen-day occurrences from
--      the PURCHASE date while generation only ever writes from TODAY, so days already
--      past were minted as spendable leftovers — the same punch card by another route.
--      Both now start at `greatest(purchase date, month start, today)`.
--   3. A TIME FOR EACH DAY. `_generate_plan_month` took ONE `p_start_time` for every
--      chosen day, so a 2x-weekly client could not have Tuesday at four and Thursday at
--      five. `config.recurring_times` ({"Tue":"16:00","Thu":"17:00"}) is read per day,
--      falling back to the incumbent scalar so every plan set up before this keeps
--      generating exactly what it generated before.
--   4. A HORIZON INSTEAD OF A SCHEDULER. `_generate_plan_month` covered the CURRENT
--      month only and `mint_recurring_allotments` needed a cron to open the next one.
--      `pg_cron` is not installed and the Vercel crons were never created, so month 2
--      never arrived. The month is now a parameter and `_ensure_plan_horizon` rolls a
--      90-day window forward, MATERIALISED ON READ (`ensure_standing_slots`, called
--      when a calendar loads and when a slot is chosen). Nothing wakes up; the next
--      person to look is what extends it. NO SCHEDULER IS ADDED.
--
-- ⚠️ THE PREPAID GATE IS GONE FROM THE ROLL. `mint_recurring_allotments` refused to open
-- a new month unless `payment_status='paid'` (D9). D23 is later and explicit: the
-- standing slot exists regardless, and "did they pay" is answered by STAFF AT
-- FULFILMENT. Flagged in the report as a deliberate D9 override, not an oversight.

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. The allotment: chosen days only, never retroactive.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public._mint_credits_for_purchase_item(p_item_id uuid, p_client_id uuid DEFAULT NULL::uuid, p_period_start date DEFAULT NULL::date)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_it     purchase_items%ROWTYPE;
  v_pu     purchases%ROWTYPE;
  v_off    offerings%ROWTYPE;
  v_client uuid := p_client_id;
  v_units  integer := 0;
  v_period date;
  v_from   date;
  v_to     date;
  v_made   integer := 0;
  v_days   text[];
BEGIN
  SELECT * INTO v_it FROM purchase_items WHERE id = p_item_id;
  IF NOT FOUND THEN RETURN 0; END IF;

  SELECT * INTO v_pu FROM purchases WHERE id = v_it.purchase_id AND deleted_at IS NULL;
  IF NOT FOUND THEN RETURN 0; END IF;

  -- A DRAFT ORDER IS NOT A PURCHASE. Nothing has been committed to, so nothing is
  -- entitled. BUYANDBOOK §2/§3: the buyer's own payment DECLARATION is now what ends
  -- the draft (`report_my_payment` → `finalize_purchase_payment`), so this gate no
  -- longer waits on staff — it only waits on the order actually being placed.
  IF v_pu.status = 'draft' THEN RETURN 0; END IF;

  SELECT * INTO v_off FROM offerings WHERE id = v_it.offering_id;
  IF NOT FOUND OR v_off.config_kind IS NULL THEN RETURN 0; END IF;

  -- Whose entitlement. The caller may name the client (the provisioning spine knows
  -- it); otherwise resolve it from the buyer, contact first then login.
  IF v_client IS NULL THEN
    SELECT cl.id INTO v_client
      FROM clients cl
     WHERE cl.deleted_at IS NULL
       AND (cl.contact_id = v_pu.buyer_contact_id
            OR cl.contact_id = (SELECT pr.contact_id FROM profiles pr WHERE pr.user_id = v_pu.buyer_user_id))
     ORDER BY (cl.contact_id = v_pu.buyer_contact_id) DESC
     LIMIT 1;
  END IF;
  IF v_client IS NULL THEN RETURN 0; END IF;

  IF v_off.config_kind = 'scheduled' THEN
    -- A session pack mints unit_count × quantity. No period, no expiry. Owner
    -- ruling 2026-08-16 (20260816T2900): single-quantity HORSE services mint one
    -- credit each, TAGGED to the offering — a Full Body Clip credit is a
    -- Full-Body-Clip credit, kept apart from lessons by offering_id, not by a
    -- segment gate. Only unit_count <= 0 (inquire / quote-priced rows) mints nothing.
    IF coalesce(v_off.unit_count, 0) <= 0 THEN RETURN 0; END IF;
    v_units := v_off.unit_count * greatest(coalesce(v_it.quantity, 1), 1);

    INSERT INTO lesson_credits (org_id, client_id, offering_id, purchase_id, purchase_item_id,
                                package_key, credits_total, credits_remaining)
    VALUES (v_pu.org_id, v_client, v_off.id, v_pu.id, v_it.id,
            coalesce(v_it.label, v_off.name), v_units, v_units)
    ON CONFLICT DO NOTHING;
    GET DIAGNOSTICS v_made = ROW_COUNT;
    RETURN CASE WHEN v_made > 0 THEN v_units ELSE 0 END;

  ELSIF v_off.config_kind = 'recurring' THEN
    -- BOTH SEGMENTS. The owner named lessons and horse care, and all six horse-care
    -- recurring SKUs were equally broken. book_open_slot is already segment-aware, so
    -- a horse-care allotment is consumed by the same path a lesson allotment is.
    v_period := coalesce(p_period_start, date_trunc('month', v_pu.created_at)::date);

    -- ⚠️ BUYANDBOOK §4.1/§4.2 — THE DAYS ARE THE ENTITLEMENT, AND ONLY THE DAYS.
    -- There is no `weekly_frequency` fallback any more. A recurring line whose days
    -- have not been chosen has no standing slot, and a standing slot is the entire
    -- product: minting a count for it would be the "monthly riding punch card" D23
    -- rejects. Nothing is minted until the client (or staff) picks the days.
    SELECT array_agg(x) INTO v_days
      FROM jsonb_array_elements_text(coalesce(v_it.config->'recurring_days', '[]'::jsonb)) x;
    IF v_days IS NULL OR array_length(v_days, 1) IS NULL THEN
      -- the singular stays readable for every plan written before CAREPLANS
      IF nullif(btrim(coalesce(v_it.config->>'recurring_day', '')), '') IS NOT NULL THEN
        v_days := ARRAY[v_it.config->>'recurring_day'];
      ELSE
        RETURN 0;
      END IF;
    END IF;

    -- ⚠️ NEVER RETROACTIVE. `_generate_plan_month` writes from TODAY forward, so a
    -- budget that counted days already past left the difference behind as SPENDABLE
    -- credits — a slot product quietly paying out as a punch card. The two windows
    -- are now the same window.
    v_from   := greatest(v_pu.created_at::date, v_period, current_date);
    v_to     := (v_period + interval '1 month - 1 day')::date;

    -- A plan that has been stopped is not entitled for a month that starts after it ended.
    IF v_it.plan_ends_on IS NOT NULL AND v_it.plan_ends_on < v_from THEN RETURN 0; END IF;
    IF v_it.plan_ends_on IS NOT NULL AND v_it.plan_ends_on < v_to THEN v_to := v_it.plan_ends_on; END IF;

    -- CAREPLANS: the days staff chose ARE the frequency. Their occurrences in this
    -- window, summed, are the month's budget — and `quantity` is deliberately NOT
    -- applied, because set_recurring_days already reconciled the line's quantity
    -- against the SKU's own weekly frequency.
    v_units := _recurring_allotment_days(v_days, v_from, v_to);
    IF v_units <= 0 THEN RETURN 0; END IF;

    INSERT INTO lesson_credits (org_id, client_id, offering_id, purchase_id, purchase_item_id,
                                package_key, credits_total, credits_remaining,
                                period_start, expires_at)
    VALUES (v_pu.org_id, v_client, v_off.id, v_pu.id, v_it.id,
            coalesce(v_it.label, v_off.name), v_units, v_units,
            v_period, (v_period + interval '1 month')::timestamptz)
    ON CONFLICT DO NOTHING;
    GET DIAGNOSTICS v_made = ROW_COUNT;
    RETURN CASE WHEN v_made > 0 THEN v_units ELSE 0 END;
  END IF;

  -- intake_*, document_transaction and inquire produce fulfillment units, not credits.
  RETURN 0;
END;
$function$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Generation: any month, and a time for each day.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public._generate_plan_month(p_purchase_item_id uuid, p_start_time text, p_duration_minutes integer DEFAULT 60, p_horse_id uuid DEFAULT NULL::uuid, p_location_id uuid DEFAULT NULL::uuid, p_client_id uuid DEFAULT NULL::uuid, p_month date DEFAULT NULL::date)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_pi      purchase_items%ROWTYPE;
  v_pu      purchases%ROWTYPE;
  v_off     offerings%ROWTYPE;
  v_cl      clients%ROWTYPE;
  v_org     uuid;
  v_days    text[];
  v_acct_c  uuid;
  v_acct_u  uuid;
  v_series  uuid := gen_random_uuid();
  v_month   date := date_trunc('month', coalesce(p_month, current_date))::date;
  v_from    date;
  v_month_end date;
  v_kind    text;
  v_credit  uuid;
  v_time    text;
  d         date;
  v_s       timestamptz;
  v_e       timestamptz;
  v_made    int := 0;
  v_skipped int := 0;
  v_no_ent  int := 0;
  v_no_time int := 0;
BEGIN
  SELECT * INTO v_pi FROM purchase_items WHERE id = p_purchase_item_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'purchase item not found'; END IF;
  SELECT * INTO v_pu FROM purchases WHERE id = v_pi.purchase_id AND deleted_at IS NULL;
  IF NOT FOUND THEN RAISE EXCEPTION 'purchase not found'; END IF;
  SELECT * INTO v_off FROM offerings WHERE id = v_pi.offering_id;
  IF NOT FOUND OR v_off.config_kind <> 'recurring' THEN
    RAISE EXCEPTION 'purchase item % is not a monthly-plan (recurring) offering', p_purchase_item_id;
  END IF;

  -- The org comes from the ORDER, not from current_org(): a horizon roll may run
  -- from a session that is not the buyer's.
  v_org := v_pu.org_id;

  IF p_client_id IS NOT NULL THEN
    SELECT * INTO v_cl FROM clients WHERE id = p_client_id AND deleted_at IS NULL;
  ELSE
    SELECT * INTO v_cl FROM clients
     WHERE contact_id = v_pu.buyer_contact_id AND deleted_at IS NULL
     ORDER BY created_at LIMIT 1;
  END IF;
  IF v_cl.id IS NULL THEN RAISE EXCEPTION 'no client for purchase item %', p_purchase_item_id; END IF;

  -- CAREPLANS: the chosen days, plural. The singular `recurring_day` is kept as a
  -- READ FALLBACK so every plan set up before this task keeps generating exactly
  -- what it generated before.
  SELECT array_agg(x) INTO v_days
    FROM jsonb_array_elements_text(coalesce(v_pi.config->'recurring_days', '[]'::jsonb)) x;
  IF v_days IS NULL OR array_length(v_days, 1) IS NULL THEN
    IF v_pi.config->>'recurring_day' IS NULL THEN
      RAISE EXCEPTION 'choose the days of the week first (set_recurring_days)';
    END IF;
    v_days := ARRAY[v_pi.config->>'recurring_day'];
  END IF;

  v_kind := CASE WHEN v_off.segment = 'horse' THEN 'care' ELSE 'lesson' END;

  -- BUYANDBOOK §4.3 — the month is a PARAMETER now, so a rolling horizon can open
  -- months ahead without a scheduler. Nothing is ever written into the past: the
  -- window starts today even when the named month began earlier.
  v_from      := greatest(current_date, v_month);
  v_month_end := (v_month + interval '1 month - 1 day')::date;

  -- A plan stopped mid-month generates only up to its last day.
  IF v_pi.plan_ends_on IS NOT NULL AND v_pi.plan_ends_on < v_month_end THEN
    v_month_end := v_pi.plan_ends_on;
  END IF;

  v_acct_c := v_cl.contact_id;
  SELECT pr.user_id INTO v_acct_u FROM profiles pr WHERE pr.contact_id = v_acct_c;

  FOR d IN SELECT generate_series(v_from, v_month_end, interval '1 day')::date LOOP
    CONTINUE WHEN NOT (to_char(d, 'Dy') = ANY (v_days));

    -- BUYANDBOOK §4 — A TIME FOR EACH DAY. The owner: "they pick the day or days for
    -- their weekly booking along with the time(s) FOR EACH". `recurring_times` names
    -- a time per weekday; the incumbent scalar covers any day it does not name, so a
    -- plan written before this keeps its single time.
    v_time := coalesce(
      nullif(btrim(coalesce(v_pi.config->'recurring_times'->>to_char(d, 'Dy'), '')), ''),
      nullif(btrim(coalesce(p_start_time, '')), ''),
      nullif(btrim(coalesce(v_pi.config->>'recurring_time', '')), ''));
    IF v_time IS NULL THEN v_no_time := v_no_time + 1; CONTINUE; END IF;

    v_s := d + v_time::time;
    v_e := v_s + make_interval(mins => coalesce(p_duration_minutes,
                                                (v_pi.config->>'duration_minutes')::int, 60));

    -- no carryover, structurally: the generate_series bound is v_month_end —
    -- there is no path in this loop that can ever produce a date past it.

    -- ⚠️ ANY booking for this plan on this date means the date is SETTLED —
    -- cancelled and expired included. Generation used to ignore those, which was
    -- harmless while it ran only when staff pressed a button; now that the horizon
    -- rolls on read, ignoring them would quietly RESURRECT a session the client
    -- cancelled and spend the credit the cancellation gave back. Coming back to a
    -- cancelled slot is a rebooking (the client's act), not something generation
    -- gets to redo behind them.
    IF EXISTS (
      SELECT 1 FROM bookings b WHERE b.client_id = v_cl.id AND b.kind = v_kind
        AND b.purchase_id = v_pu.id AND b.starts_at::date = d
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
    -- that the entitlement does not cover. This is also why the month ends up with
    -- ZERO spendable credits: the bookings ARE the entitlement.
    UPDATE lesson_credits SET credits_remaining = credits_remaining - 1
     WHERE id = (SELECT lc.id FROM lesson_credits lc
                  WHERE lc.client_id = v_cl.id
                    AND lc.purchase_item_id = v_pi.id
                    AND lc.deleted_at IS NULL
                    AND lc.credits_remaining > 0
                    AND (lc.expires_at IS NULL OR lc.expires_at > now())
                    -- the budget for THIS month, not some other month's leftovers
                    AND (lc.period_start IS NULL OR lc.period_start = v_month)
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
      v_cl.id, v_acct_c, v_acct_u, auth.uid(),
      coalesce(p_horse_id, nullif(btrim(coalesce(v_pi.config->>'horse_id','')),'')::uuid),
      v_pu.id, v_off.id,
      coalesce(p_location_id, nullif(btrim(coalesce(v_pi.config->>'location_id','')),'')::uuid),
      v_off.price_amount,
      v_series, auth.uid(), v_credit
    );
    v_made := v_made + 1;
    v_credit := NULL;
  END LOOP;

  -- Remember HOW this plan is delivered, so a later month opens the same way without
  -- anyone repeating themselves. Only written when the CALLER named a time — a
  -- horizon roll passes none, and writing NULL over the template would destroy the
  -- very thing the roll reads.
  IF v_made > 0 AND nullif(btrim(coalesce(p_start_time, '')), '') IS NOT NULL THEN
    UPDATE purchase_items
       SET config = coalesce(config, '{}'::jsonb) || jsonb_build_object(
             'recurring_time',   p_start_time,
             'duration_minutes', coalesce(p_duration_minutes, 60),
             'horse_id',         p_horse_id,
             'location_id',      p_location_id)
     WHERE id = p_purchase_item_id;
  END IF;

  RETURN jsonb_build_object('series_id', v_series, 'created', v_made,
    'month', v_month,
    'skipped_existing', v_skipped, 'skipped_no_entitlement', v_no_ent,
    'skipped_no_time', v_no_time,
    'recurring_day', v_days[1], 'recurring_days', to_jsonb(v_days), 'kind', v_kind);
END;
$function$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. The quantity a plan bills, reconciled against the SKU's own weekly frequency.
-- ─────────────────────────────────────────────────────────────────────────────
-- MEASURED: "2x Weekly Lessons" is $880 with `weekly_frequency = 2`, i.e. 2 × the
-- $460 1x rate — the SKU already IS two lessons a week. `set_recurring_days` set
-- `quantity = array_length(days)`, so choosing the two days that SKU exists to sell
-- re-priced an $880 order to $1,760. The owner's rule ("we typically dont discount if
-- they buy 2x or 3x per week vs 1x") is about days ABOVE what the SKU covers, and
-- that is what this now counts. Every live horse-care recurring SKU has
-- weekly_frequency = 1, so their arithmetic is unchanged.
CREATE OR REPLACE FUNCTION public.set_recurring_days(p_purchase_item_id uuid, p_days text[], p_weeks integer DEFAULT NULL::integer, p_indefinite boolean DEFAULT NULL::boolean)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_pi     purchase_items%ROWTYPE;
  v_pu     purchases%ROWTYPE;
  v_off    offerings%ROWTYPE;
  v_days   text[];
  v_client uuid;
  v_lc     lesson_credits%ROWTYPE;
  v_from   date;
  v_to     date;
  v_start  date;
  v_ends   date;
  v_new    int;
  v_used   int;
  v_qty    int;
  v_freq   int;
  v_qty_locked boolean := false;
BEGIN
  v_days := _normalize_recurring_days(p_days);

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
    RAISE EXCEPTION 'not authorized to set this plan''s days';
  END IF;

  -- ── how long: N weeks, or indefinitely until cancelled ──
  -- "Indefinite" is plan_ends_on IS NULL — the same column, the same meaning, and
  -- the same stop button (set_recurring_plan_end). No second lifecycle store.
  v_start := greatest(v_pu.created_at::date, current_date);
  IF coalesce(p_indefinite, false) THEN
    v_ends := NULL;
  ELSIF p_weeks IS NOT NULL THEN
    IF p_weeks < 1 THEN RAISE EXCEPTION 'a plan runs for at least one week'; END IF;
    v_ends := v_start + (p_weeks * 7 - 1);
  ELSE
    v_ends := v_pi.plan_ends_on;   -- unchanged when the caller says nothing
  END IF;

  -- ── the quantity FOLLOWS the days ABOVE THE SKU'S OWN FREQUENCY (owner, 2026-08-16
  -- as corrected by BUYANDBOOK §4) ── Two chosen days on a 1x weekly SKU is quantity 2,
  -- because there is no volume discount in this business. Two chosen days on the 2x
  -- SKU is quantity 1, because that SKU already sells two. A PAID order is not
  -- re-priced by a scheduling action — that would change what someone already paid;
  -- it is reported back instead.
  v_freq := greatest(coalesce(v_off.weekly_frequency, 1), 1);
  v_qty  := greatest(ceil(array_length(v_days, 1)::numeric / v_freq)::int, 1);
  IF coalesce(v_pu.payment_status, '') = 'paid' AND coalesce(v_pi.quantity, 1) <> v_qty THEN
    v_qty_locked := true;
    v_qty := v_pi.quantity;
  END IF;

  UPDATE purchase_items
     SET config = coalesce(config, '{}'::jsonb)
                  || jsonb_build_object(
                       'recurring_days', to_jsonb(v_days),
                       -- the singular stays in sync as the first day so every reader
                       -- written before this task still resolves to something true.
                       'recurring_day',  v_days[1],
                       'plan_weeks',     CASE WHEN coalesce(p_indefinite, false) THEN NULL
                                              ELSE p_weeks END,
                       'plan_starts_on', v_start),
         quantity = v_qty,
         plan_ends_on = v_ends
   WHERE id = p_purchase_item_id;

  PERFORM _recompute_purchase_total(v_pu.id);

  -- ── re-true THIS month's allotment against the days just chosen ──
  -- Same shape as set_recurring_day's re-true: a new total, reduced by whatever the
  -- client has already used, floored at zero. Sessions already taken are never
  -- clawed back. BUYANDBOOK §4.2: the window starts TODAY, never at the purchase
  -- date — days already gone are not entitlement, they are leftovers.
  SELECT * INTO v_lc FROM lesson_credits
   WHERE purchase_item_id = p_purchase_item_id
     AND period_start = date_trunc('month', current_date)::date
     AND deleted_at IS NULL
   FOR UPDATE;
  IF FOUND THEN
    v_from := greatest(v_pu.created_at::date, v_lc.period_start, current_date);
    v_to   := (v_lc.period_start + interval '1 month - 1 day')::date;
    IF v_ends IS NOT NULL AND v_ends < v_to THEN v_to := v_ends; END IF;
    v_new  := _recurring_allotment_days(v_days, v_from, v_to);
    v_used := v_lc.credits_total - v_lc.credits_remaining;
    UPDATE lesson_credits
       SET credits_total = v_new,
           credits_remaining = greatest(v_new - v_used, 0)
     WHERE id = v_lc.id;
  END IF;

  RETURN jsonb_build_object(
    'purchase_item_id',    p_purchase_item_id,
    'recurring_days',      to_jsonb(v_days),
    'plan_ends_on',        v_ends,
    'plan_weeks',          CASE WHEN coalesce(p_indefinite, false) THEN NULL ELSE p_weeks END,
    'indefinite',          v_ends IS NULL,
    'quantity',            v_qty,
    'quantity_locked',     v_qty_locked,
    'catalog_default',     v_off.weekly_frequency,
    -- Surfaced, never corrected quietly (owner, 2026-08-17): staff may deliberately
    -- give a 2x SKU three days. The UI shows the difference; nothing blocks it.
    'differs_from_catalog', v_freq <> array_length(v_days, 1),
    'entitled_this_month', v_new);
END;
$function$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. The horizon — what replaces the scheduler that does not exist.
-- ─────────────────────────────────────────────────────────────────────────────
-- One plan, rolled forward to `p_through`. Idempotent by construction: the month's
-- budget is protected by `lesson_credits_one_per_item_period` and each day is skipped
-- when a live booking for this plan already sits on it.
--
-- ⚠️ IT REFUSES TO RUN WITHOUT A TIME, AND THAT IS THE POINT. Minting a month's budget
-- for a plan that cannot generate bookings would leave the whole budget behind as
-- SPENDABLE credits — the punch card again. No time ⇒ no slot ⇒ no allotment.
CREATE OR REPLACE FUNCTION public._ensure_plan_horizon(p_purchase_item_id uuid, p_through date DEFAULT NULL::date)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_pi      purchase_items%ROWTYPE;
  v_pu      purchases%ROWTYPE;
  v_through date := coalesce(p_through, current_date + 90);
  v_month   date := date_trunc('month', current_date)::date;
  v_last    date;
  v_has_time boolean;
  v_gen     jsonb;
  v_months  int := 0;
  v_created int := 0;
  v_minted  int := 0;
BEGIN
  SELECT * INTO v_pi FROM purchase_items WHERE id = p_purchase_item_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'purchase item not found'; END IF;
  SELECT * INTO v_pu FROM purchases WHERE id = v_pi.purchase_id AND deleted_at IS NULL;
  IF NOT FOUND THEN RAISE EXCEPTION 'purchase not found'; END IF;

  -- A draft order has not been placed. D23 moved the moment of placing it to the
  -- buyer's own declaration, so this is no longer a staff gate — but a basket is
  -- still a basket.
  IF v_pu.status = 'draft' THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'draft');
  END IF;

  v_has_time :=
       nullif(btrim(coalesce(v_pi.config->>'recurring_time', '')), '') IS NOT NULL
    OR (jsonb_typeof(v_pi.config->'recurring_times') = 'object'
        AND (SELECT count(*) FROM jsonb_object_keys(v_pi.config->'recurring_times')) > 0);
  IF NOT v_has_time THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'needs_time');
  END IF;

  v_last := date_trunc('month', v_through)::date;
  WHILE v_month <= v_last LOOP
    EXIT WHEN v_pi.plan_ends_on IS NOT NULL AND v_pi.plan_ends_on < v_month;
    v_minted := v_minted + coalesce(_mint_credits_for_purchase_item(p_purchase_item_id, NULL, v_month), 0);
    v_gen := _generate_plan_month(
               p_purchase_item_id,
               NULL,                                                  -- per-day times decide
               coalesce((v_pi.config->>'duration_minutes')::int, 60),
               nullif(btrim(coalesce(v_pi.config->>'horse_id', '')), '')::uuid,
               nullif(btrim(coalesce(v_pi.config->>'location_id', '')), '')::uuid,
               NULL,
               v_month);
    v_created := v_created + coalesce((v_gen->>'created')::int, 0);
    v_months  := v_months + 1;
    v_month   := (v_month + interval '1 month')::date;
  END LOOP;

  -- How far this plan is materialised. `ensure_standing_slots` reads it to skip a
  -- plan that is already out to the horizon, so a calendar load costs one index
  -- lookup per plan rather than a generation pass.
  UPDATE purchase_items
     SET config = coalesce(config, '{}'::jsonb)
                  || jsonb_build_object('horizon_through', to_char(v_through, 'YYYY-MM-DD'))
   WHERE id = p_purchase_item_id;

  RETURN jsonb_build_object('ok', true, 'through', v_through, 'months', v_months,
                            'created', v_created, 'minted', v_minted);
END;
$function$;

-- MATERIALISED ON READ. Called when a calendar loads and when a slot is chosen.
-- Nothing wakes up: the next person to look is what extends the horizon.
CREATE OR REPLACE FUNCTION public.ensure_standing_slots(p_client_id uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_staff  boolean := has_staff_access();
  v_client uuid    := p_client_id;
  v_org    uuid    := current_org();
  v_target date    := current_date + 90;
  v_res    jsonb;
  v_plans  int := 0;
  v_created int := 0;
  r        record;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'authentication required'; END IF;
  IF v_client IS NULL AND NOT v_staff THEN
    v_client := current_client_id();
    IF v_client IS NULL THEN RETURN jsonb_build_object('plans', 0, 'created', 0); END IF;
  END IF;
  IF v_client IS NOT NULL AND NOT v_staff AND v_client <> coalesce(current_client_id(), '00000000-0000-0000-0000-000000000000'::uuid) THEN
    RAISE EXCEPTION 'not your plans';
  END IF;

  FOR r IN
    SELECT pi.id
      FROM purchase_items pi
      JOIN offerings  o  ON o.id  = pi.offering_id AND o.config_kind = 'recurring'
      JOIN purchases  pu ON pu.id = pi.purchase_id
      JOIN clients    cl ON cl.contact_id = pu.buyer_contact_id AND cl.deleted_at IS NULL
     WHERE pu.deleted_at IS NULL
       AND pi.voided_at IS NULL
       AND pu.status <> 'draft'
       AND pu.org_id = v_org
       AND (v_client IS NULL OR cl.id = v_client)
       AND (pi.plan_ends_on IS NULL OR pi.plan_ends_on >= current_date)
       -- already materialised out to the horizon: nothing to do
       AND coalesce(nullif(pi.config->>'horizon_through', '')::date, DATE '0001-01-01') < v_target
  LOOP
    v_res := _ensure_plan_horizon(r.id, v_target);
    IF coalesce((v_res->>'ok')::boolean, false) THEN
      v_plans   := v_plans + 1;
      v_created := v_created + coalesce((v_res->>'created')::int, 0);
    END IF;
  END LOOP;

  RETURN jsonb_build_object('plans', v_plans, 'created', v_created, 'through', v_target);
END;
$function$;

REVOKE ALL ON FUNCTION public.ensure_standing_slots(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.ensure_standing_slots(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.ensure_standing_slots(uuid) TO authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. The client chooses their day(s) and time(s) — during onboarding.
-- ─────────────────────────────────────────────────────────────────────────────
-- Owner, 2026-08-20: "they pick the day or days for their weekly booking along with
-- the time(s) for each at the time they onboard." Not at checkout, not left to staff.
--
-- ⚠️ THIS IS NOT A SECOND WRITER. It is a thin, client-authorised front door onto the
-- incumbent pair — `set_recurring_days` (which already authorises the buyer, not only
-- staff) writes the days, `_ensure_plan_horizon` → `_generate_plan_month` writes the
-- bookings. Staff's `CalendarItemPanel` reaches the same two functions. There is one
-- standing-slot writer and both surfaces call it.
--
-- ⚠️ AND IT IS NOT `p_agreed_lesson`. That path books ONE session through
-- `schedule_lesson_session` — the first lesson agreed on a phone call. A standing
-- weekly slot is a different fact with a different home (`purchase_items.config`), and
-- routing this through it would book one lesson and leave the membership with no slot
-- at all. Reported, not silently diverged.
--
-- The number of slots is the SKU's own `weekly_frequency`: a 2x Weekly buyer picks
-- exactly two days, each with its own time. Staff keep `set_recurring_days` for the
-- deliberate exceptions the owner reserved ("staff may give a 2x SKU three days").
CREATE OR REPLACE FUNCTION public.set_my_standing_schedule(p_purchase_item_id uuid, p_slots jsonb, p_duration_minutes integer DEFAULT 60, p_horse_id uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_pi     purchase_items%ROWTYPE;
  v_pu     purchases%ROWTYPE;
  v_off    offerings%ROWTYPE;
  v_client uuid;
  v_freq   int;
  v_slot   jsonb;
  v_day    text;
  v_time   text;
  v_days   text[] := '{}';
  v_times  jsonb  := '{}'::jsonb;
  v_res    jsonb;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'authentication required'; END IF;

  SELECT * INTO v_pi FROM purchase_items WHERE id = p_purchase_item_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'purchase item not found'; END IF;
  SELECT * INTO v_pu FROM purchases WHERE id = v_pi.purchase_id AND deleted_at IS NULL;
  IF NOT FOUND THEN RAISE EXCEPTION 'purchase not found'; END IF;
  SELECT * INTO v_off FROM offerings WHERE id = v_pi.offering_id;
  IF NOT FOUND OR v_off.config_kind <> 'recurring' THEN
    RAISE EXCEPTION 'that purchase is not a weekly plan';
  END IF;

  SELECT id INTO v_client FROM clients WHERE contact_id = v_pu.buyer_contact_id AND deleted_at IS NULL;
  IF NOT (has_staff_access() OR (v_client IS NOT NULL AND v_client = current_client_id())) THEN
    RAISE EXCEPTION 'not your plan';
  END IF;

  IF p_slots IS NULL OR jsonb_typeof(p_slots) <> 'array' THEN
    RAISE EXCEPTION 'pick a day and a time for each weekly session';
  END IF;

  v_freq := greatest(coalesce(v_off.weekly_frequency, 1), 1);
  IF jsonb_array_length(p_slots) <> v_freq THEN
    RAISE EXCEPTION 'this plan is % session(s) a week — pick a day and time for each',
      v_freq;
  END IF;

  FOR v_slot IN SELECT * FROM jsonb_array_elements(p_slots) LOOP
    v_day  := initcap(btrim(coalesce(v_slot->>'day', '')));
    v_time := btrim(coalesce(v_slot->>'time', ''));
    IF v_day NOT IN ('Mon','Tue','Wed','Thu','Fri','Sat','Sun') THEN
      RAISE EXCEPTION 'day must be one of Mon/Tue/Wed/Thu/Fri/Sat/Sun, got %', v_slot->>'day';
    END IF;
    IF v_time !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' THEN
      RAISE EXCEPTION 'a time looks like 16:00, got %', v_slot->>'time';
    END IF;
    IF v_day = ANY (v_days) THEN
      RAISE EXCEPTION 'pick a different day for each weekly session — % is already taken', v_day;
    END IF;
    v_days  := v_days || v_day;
    v_times := v_times || jsonb_build_object(v_day, v_time);
  END LOOP;

  -- the incumbent day writer (it also re-prices the line and re-trues this month)
  PERFORM set_recurring_days(p_purchase_item_id, v_days, NULL, true);

  UPDATE purchase_items
     SET config = coalesce(config, '{}'::jsonb) || jsonb_build_object(
           'recurring_times',  v_times,
           -- the incumbent scalar keeps pointing at the first day's time, so every
           -- reader written before per-day times still resolves to something true
           'recurring_time',   v_times->>v_days[1],
           'duration_minutes', greatest(coalesce(p_duration_minutes, 60), 15),
           'horse_id',         p_horse_id)
   WHERE id = p_purchase_item_id;

  -- and materialise it, out to the rolling horizon
  v_res := _ensure_plan_horizon(p_purchase_item_id);

  RETURN jsonb_build_object(
    'purchase_item_id', p_purchase_item_id,
    'offering_name',    v_off.name,
    'weekly_frequency', v_freq,
    'slots',            p_slots,
    'horizon',          v_res);
END;
$function$;

REVOKE ALL ON FUNCTION public.set_my_standing_schedule(uuid, jsonb, integer, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.set_my_standing_schedule(uuid, jsonb, integer, uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.set_my_standing_schedule(uuid, jsonb, integer, uuid) TO authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- 6. What the member is told they have.
-- ─────────────────────────────────────────────────────────────────────────────
-- The order page told a recurring buyer no count, no period, no expiry, no renewal
-- terms. For a standing slot the honest statement is WHICH DAYS AND TIMES ARE THEIRS
-- AND THAT IT RECURS UNTIL CANCELLED — never a lesson count, which is the punch card
-- this product is not.
CREATE OR REPLACE FUNCTION public.my_standing_slots(p_purchase_id uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_contact uuid := current_contact_id();
  v_client  uuid := current_client_id();
BEGIN
  IF auth.uid() IS NULL THEN RETURN '[]'::jsonb; END IF;
  RETURN coalesce((
    SELECT jsonb_agg(jsonb_build_object(
        'purchase_id',      pu.id,
        'purchase_item_id', pi.id,
        'offering_id',      o.id,
        'offering_name',    o.name,
        'segment',          o.segment,
        'weekly_frequency', o.weekly_frequency,
        'recurring_days',   coalesce(pi.config->'recurring_days', '[]'::jsonb),
        'recurring_times',  coalesce(pi.config->'recurring_times', '{}'::jsonb),
        'duration_minutes', coalesce((pi.config->>'duration_minutes')::int, 60),
        'chosen',           coalesce(jsonb_array_length(coalesce(pi.config->'recurring_days','[]'::jsonb)), 0) > 0
                            AND coalesce(pi.config->'recurring_times', '{}'::jsonb) <> '{}'::jsonb,
        'indefinite',       pi.plan_ends_on IS NULL,
        'plan_ends_on',     pi.plan_ends_on,
        'horizon_through',  pi.config->>'horizon_through',
        'booked_ahead',     (SELECT count(*) FROM bookings b
                              WHERE b.purchase_id = pu.id
                                AND b.offering_id = o.id
                                AND b.starts_at >= now()
                                AND b.status NOT IN ('cancelled','expired')))
      ORDER BY pu.created_at DESC, o.name)
      FROM purchase_items pi
      JOIN offerings o  ON o.id  = pi.offering_id AND o.config_kind = 'recurring'
      JOIN purchases pu ON pu.id = pi.purchase_id
     WHERE pu.deleted_at IS NULL
       AND pi.voided_at IS NULL
       AND (p_purchase_id IS NULL OR pu.id = p_purchase_id)
       AND (pu.buyer_user_id = auth.uid()
            OR (v_contact IS NOT NULL AND pu.buyer_contact_id = v_contact))
       AND (pi.plan_ends_on IS NULL OR pi.plan_ends_on >= current_date)
  ), '[]'::jsonb);
END;
$function$;

REVOKE ALL ON FUNCTION public.my_standing_slots(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.my_standing_slots(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.my_standing_slots(uuid) TO authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- 7. The monthly roll delegates to the horizon, so the two cannot disagree.
-- ─────────────────────────────────────────────────────────────────────────────
-- `mint_recurring_allotments` is the entry point `api/mint-monthly-allotments.ts`
-- calls — from a Vercel cron that WAS NEVER CREATED. It is kept and made harmless
-- rather than deleted: if the owner ever wires the cron, it must do exactly what a
-- calendar load does, not a second thing.
--
-- ⚠️ THE `payment_status = 'paid'` GATE IS GONE. It was D9's prepaid rule. D23 is
-- later and specific to this product: the standing slot exists regardless of payment,
-- and "did they pay" is answered by STAFF AT FULFILMENT. A slot that vanishes because
-- a Zelle transfer has not been confirmed yet is precisely the block the owner ruled out.
CREATE OR REPLACE FUNCTION public.mint_recurring_allotments()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_month date := date_trunc('month', current_date)::date;
  v_target date := current_date + 90;
  v_considered int := 0;
  v_credits    int := 0;
  v_booked     int := 0;
  v_plans_gen  int := 0;
  v_res        jsonb;
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
       AND pi.voided_at IS NULL
       AND pu.status <> 'draft'
       -- a staff caller rolls their own tenant only; a service_role caller rolls all.
       AND (coalesce(auth.role(), '') = 'service_role' OR pu.org_id = current_org())
       -- a FIXED-WEEK plan stops when its weeks are up; an INDEFINITE one
       -- (plan_ends_on IS NULL) keeps rolling until someone stops it.
       AND (pi.plan_ends_on IS NULL OR pi.plan_ends_on >= v_month)
  LOOP
    v_considered := v_considered + 1;
    v_res := _ensure_plan_horizon(r.id, v_target);
    IF coalesce((v_res->>'ok')::boolean, false) THEN
      v_credits   := v_credits + coalesce((v_res->>'minted')::int, 0);
      v_booked    := v_booked  + coalesce((v_res->>'created')::int, 0);
      v_plans_gen := v_plans_gen + 1;
    END IF;
  END LOOP;

  RETURN jsonb_build_object('month', v_month, 'through', v_target,
                            'plans_considered', v_considered,
                            'credits_minted', v_credits,
                            'plans_generated', v_plans_gen,
                            'sessions_booked', v_booked);
END;
$function$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 8. One generator, not two — and the internals stay internal.
-- ─────────────────────────────────────────────────────────────────────────────
-- `_generate_plan_month` gained a seventh parameter, so `CREATE OR REPLACE` created an
-- OVERLOAD rather than replacing anything: the six-argument predecessor was still
-- there, and `generate_monthly_lessons` passes exactly six, so staff's "generate this
-- month" button would have kept calling a generator that knows nothing about per-day
-- times or the month parameter. That is D18 inside a single function name. The 7-arg
-- version defaults `p_month`, so every six-argument call now resolves to it.
DROP FUNCTION IF EXISTS public._generate_plan_month(uuid, text, integer, uuid, uuid, uuid);

-- These two are engine internals reached only from SECURITY DEFINER callers that do
-- their own authorisation. `anon` holds EXECUTE on new functions by the default PUBLIC
-- grant, and the predecessor was revoked — match it.
REVOKE ALL ON FUNCTION public._generate_plan_month(uuid, text, integer, uuid, uuid, uuid, date) FROM PUBLIC;
REVOKE ALL ON FUNCTION public._generate_plan_month(uuid, text, integer, uuid, uuid, uuid, date) FROM anon;
REVOKE ALL ON FUNCTION public._generate_plan_month(uuid, text, integer, uuid, uuid, uuid, date) FROM authenticated;
REVOKE ALL ON FUNCTION public._ensure_plan_horizon(uuid, date) FROM PUBLIC;
REVOKE ALL ON FUNCTION public._ensure_plan_horizon(uuid, date) FROM anon;
REVOKE ALL ON FUNCTION public._ensure_plan_horizon(uuid, date) FROM authenticated;
