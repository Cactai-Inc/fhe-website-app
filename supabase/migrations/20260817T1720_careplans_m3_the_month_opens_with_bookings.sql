-- CAREPLANS m3 — the month opens with BOOKINGS, and a credit is only ever the
-- residue of a cancellation.
--
-- Owner, 2026-08-17: "so the month starts with applied bookings auto generated and NO
-- CREDITS. if they cancel a booking they get a credit that expires at the end of the
-- month. they can reschedule it at any time until then."
--
-- HOW THAT IS ACHIEVED HERE, AND WHY THERE IS STILL ONE ALLOTMENT ROW:
--   The allotment row minted by m2 is the CAP. Generation debits it once per booking
--   it writes, so a freshly provisioned month ends up with N bookings and ZERO
--   SPENDABLE credits — which is the state the owner described. The row survives at
--   `credits_total = N, credits_remaining = 0` because `_refund_booking_credit`
--   restores INTO it, capped at its own total: that cap is what makes "the month's
--   total can never grow" true no matter how many times a client cancels and
--   rebooks. Delete the row and the refund seam falls back to compensating with a
--   fresh, uncapped credit — which is precisely how a reschedule loop could
--   manufacture a tenth lesson.
--
--   So: ONE minting seam (m2's `_mint_credits_for_purchase_item`), ONE generator
--   (below), and the generator SPENDS what the seam minted. They never both hand out
--   entitlement — that is the double-mint hazard, and this is the answer to it.
--
-- THE OTHER HALF: the chosen days are an ENTITLEMENT BASIS, NOT A SCHEDULE.
--   Owner: "it needs to allow moving any monthly plan to any day in the month. it
--   cannot restrict to a specific number of days per week." Once the bookings exist
--   the client may move any of them anywhere — nothing below writes a weekday rule
--   that a later booking has to satisfy. The weekday is used ONCE, to decide how
--   many sessions to lay down.

-- ── 1. the generator, factored out of the staff RPC ─────────────────────────
-- `generate_monthly_lessons` keeps its signature, its staff gate and its
-- client-ownership checks; the body moves here so the monthly roll (service_role,
-- no staff session, no current_org()) can produce a new month's sessions through the
-- SAME writer. §C7: do not write a second booking writer.
CREATE OR REPLACE FUNCTION public._generate_plan_month(
  p_purchase_item_id uuid,
  p_start_time       text,
  p_duration_minutes integer DEFAULT 60,
  p_horse_id         uuid DEFAULT NULL,
  p_location_id      uuid DEFAULT NULL,
  p_client_id        uuid DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public'
AS $$
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
  v_month_end date := (date_trunc('month', current_date) + interval '1 month - 1 day')::date;
  v_kind    text;
  v_credit  uuid;
  d         date;
  v_s       timestamptz;
  v_e       timestamptz;
  v_made    int := 0;
  v_skipped int := 0;
  v_no_ent  int := 0;
BEGIN
  SELECT * INTO v_pi FROM purchase_items WHERE id = p_purchase_item_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'purchase item not found'; END IF;
  SELECT * INTO v_pu FROM purchases WHERE id = v_pi.purchase_id AND deleted_at IS NULL;
  IF NOT FOUND THEN RAISE EXCEPTION 'purchase not found'; END IF;
  SELECT * INTO v_off FROM offerings WHERE id = v_pi.offering_id;
  IF NOT FOUND OR v_off.config_kind <> 'recurring' THEN
    RAISE EXCEPTION 'purchase item % is not a monthly-plan (recurring) offering', p_purchase_item_id;
  END IF;

  -- The org comes from the ORDER, not from current_org(): the cron has no session.
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

  -- A plan stopped mid-month generates only up to its last day.
  IF v_pi.plan_ends_on IS NOT NULL AND v_pi.plan_ends_on < v_month_end THEN
    v_month_end := v_pi.plan_ends_on;
  END IF;

  v_acct_c := v_cl.contact_id;
  SELECT pr.user_id INTO v_acct_u FROM profiles pr WHERE pr.contact_id = v_acct_c;

  FOR d IN SELECT generate_series(current_date, v_month_end, interval '1 day')::date LOOP
    CONTINUE WHEN NOT (to_char(d, 'Dy') = ANY (v_days));
    v_s := d + p_start_time::time;
    v_e := v_s + make_interval(mins => coalesce(p_duration_minutes, 60));

    -- no carryover, structurally: the generate_series bound is v_month_end —
    -- there is no path in this loop that can ever produce a date past it.

    IF EXISTS (
      SELECT 1 FROM bookings b WHERE b.client_id = v_cl.id AND b.kind = v_kind
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
    -- that the entitlement does not cover. This is also why the month ends up with
    -- ZERO spendable credits: the bookings ARE the entitlement.
    UPDATE lesson_credits SET credits_remaining = credits_remaining - 1
     WHERE id = (SELECT lc.id FROM lesson_credits lc
                  WHERE lc.client_id = v_cl.id
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
      v_cl.id, v_acct_c, v_acct_u, auth.uid(),
      p_horse_id, v_pu.id, v_off.id, p_location_id, v_off.price_amount,
      v_series, auth.uid(), v_credit
    );
    v_made := v_made + 1;
    v_credit := NULL;
  END LOOP;

  -- Remember HOW this plan is delivered, so the monthly roll can open the next month
  -- the same way without staff repeating themselves. This is the plan's schedule
  -- template, not a schedule rule: it decides where the auto-generated sessions land
  -- on day one, and the client may move any of them afterwards.
  IF v_made > 0 THEN
    UPDATE purchase_items
       SET config = coalesce(config, '{}'::jsonb) || jsonb_build_object(
             'recurring_time',   p_start_time,
             'duration_minutes', coalesce(p_duration_minutes, 60),
             'horse_id',         p_horse_id,
             'location_id',      p_location_id)
     WHERE id = p_purchase_item_id;
  END IF;

  RETURN jsonb_build_object('series_id', v_series, 'created', v_made,
    'skipped_existing', v_skipped, 'skipped_no_entitlement', v_no_ent,
    'recurring_day', v_days[1], 'recurring_days', to_jsonb(v_days), 'kind', v_kind);
END;
$$;

REVOKE ALL ON FUNCTION public._generate_plan_month(uuid, text, integer, uuid, uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public._generate_plan_month(uuid, text, integer, uuid, uuid, uuid) FROM anon;
REVOKE ALL ON FUNCTION public._generate_plan_month(uuid, text, integer, uuid, uuid, uuid) FROM authenticated;
GRANT EXECUTE ON FUNCTION public._generate_plan_month(uuid, text, integer, uuid, uuid, uuid) TO service_role;

-- ── 2. the staff RPC keeps its contract and delegates ───────────────────────
CREATE OR REPLACE FUNCTION public.generate_monthly_lessons(p_client_id uuid, p_purchase_item_id uuid, p_start_time text, p_duration_minutes integer DEFAULT 60, p_horse_id uuid DEFAULT NULL::uuid, p_location_id uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_org uuid := current_org();
  v_pi  purchase_items%ROWTYPE;
  v_pu  purchases%ROWTYPE;
  v_cl  clients%ROWTYPE;
BEGIN
  IF NOT has_staff_access() THEN RAISE EXCEPTION 'operator access required'; END IF;

  SELECT * INTO v_cl FROM clients WHERE id = p_client_id AND deleted_at IS NULL AND org_id = v_org;
  IF NOT FOUND THEN RAISE EXCEPTION 'client not found in this org'; END IF;

  SELECT * INTO v_pi FROM purchase_items WHERE id = p_purchase_item_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'purchase item not found'; END IF;
  SELECT * INTO v_pu FROM purchases WHERE id = v_pi.purchase_id AND deleted_at IS NULL AND buyer_contact_id = v_cl.contact_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'purchase item % does not belong to this client', p_purchase_item_id; END IF;

  RETURN _generate_plan_month(p_purchase_item_id, p_start_time, p_duration_minutes,
                              p_horse_id, p_location_id, p_client_id);
END;
$function$;

-- ── 3. the month roll opens the month the same way the first one opened ─────
-- CREDITALIGN made the roll mint. Under this ruling minting alone would leave a
-- client holding a pile of spendable credits and an empty calendar, which is the
-- opposite of "the month starts with applied bookings auto generated". So the roll
-- now mints AND lays the sessions down, in that order, through the one seam and the
-- one writer — the bookings consume the mint and the month opens at zero spendable.
--
-- A plan that has never been generated (no stored time) is minted only. That is the
-- deliberate safe direction: under-scheduled, never over-entitled.
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
  v_booked     int := 0;
  v_plans_gen  int := 0;
  v_made       int;
  v_gen        jsonb;
  r            record;
BEGIN
  IF NOT (coalesce(auth.role(), '') = 'service_role' OR has_staff_access()) THEN
    RAISE EXCEPTION 'operator access required';
  END IF;

  FOR r IN
    SELECT pi.id, pi.config
      FROM purchase_items pi
      JOIN offerings o  ON o.id = pi.offering_id AND o.config_kind = 'recurring'
      JOIN purchases pu ON pu.id = pi.purchase_id
     WHERE pu.deleted_at IS NULL
       AND pi.voided_at IS NULL
       -- a staff caller rolls their own tenant only; the cron (service_role) rolls all.
       AND (coalesce(auth.role(), '') = 'service_role' OR pu.org_id = current_org())
       -- prepaid-gated (D9): a plan rolls into a new month only while it is paid for.
       AND pu.payment_status = 'paid'
       -- a FIXED-WEEK plan stops when its weeks are up; an INDEFINITE one
       -- (plan_ends_on IS NULL) keeps rolling until someone stops it.
       AND (pi.plan_ends_on IS NULL OR pi.plan_ends_on >= v_month)
       -- nothing to do for a plan bought this month — its allotment already exists.
       AND NOT EXISTS (
         SELECT 1 FROM lesson_credits lc
          WHERE lc.purchase_item_id = pi.id AND lc.period_start = v_month AND lc.deleted_at IS NULL)
  LOOP
    v_considered := v_considered + 1;
    v_made := _mint_credits_for_purchase_item(r.id, NULL, v_month);
    v_credits := v_credits + coalesce(v_made, 0);

    IF coalesce(v_made, 0) > 0 AND r.config ? 'recurring_time' THEN
      v_gen := _generate_plan_month(
        r.id,
        r.config->>'recurring_time',
        coalesce((r.config->>'duration_minutes')::int, 60),
        nullif(r.config->>'horse_id', '')::uuid,
        nullif(r.config->>'location_id', '')::uuid,
        NULL);
      v_booked := v_booked + coalesce((v_gen->>'created')::int, 0);
      v_plans_gen := v_plans_gen + 1;
    END IF;
  END LOOP;

  RETURN jsonb_build_object('month', v_month, 'plans_considered', v_considered,
                            'credits_minted', v_credits,
                            'plans_generated', v_plans_gen,
                            'sessions_booked', v_booked);
END;
$function$;
