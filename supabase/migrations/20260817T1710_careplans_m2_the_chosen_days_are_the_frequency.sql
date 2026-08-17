-- CAREPLANS m2 — the days staff choose ARE the frequency.
--
-- Owner, 2026-08-17: "a person needs to be able to schedule any amount of days per
-- week but not exceed their monthly total calculated based on the number of their
-- selected days in the month. so if there are 5 sundays and 4 saturdays in the month
-- and those are their selected days they get 9 lessons that month."
--
-- THE ONE FORMULA, TWO CONFIGURATIONS (§P0):
--   ONE-TIME   credits = unit_count x quantity, window = expiry from the purchase date
--   RECURRING  credits = SUM over each chosen weekday of its occurrences in the month
--
-- 5 Sundays + 4 Saturdays = 9. It is a SUM, not a product: a calendar month holds
-- four OR FIVE of any given weekday, and the site promises "you can ride every week
-- even when there's a 5th week." Never replace the count with a constant 4.
--
-- WHAT IS NOT CHANGED, DELIBERATELY:
--   * `offerings.weekly_frequency` still exists, is still populated, and is still the
--     catalog default (owner: "we cant let it do that"). It now PRE-FILLS the staff
--     picker instead of deciding the entitlement.
--   * `_recurring_allotment` (the weekly_frequency x anchor-weekday formula) is left
--     BYTE-IDENTICAL and is still the path for every plan that has no chosen day set.
--     That is what makes an existing plan — every lesson plan included — compute
--     exactly what it computed before. The new arithmetic engages only for a plan
--     that carries `config.recurring_days`, which nothing in prod does today
--     (measured 2026-08-17: zero purchase_items rows carry ANY config key).
--   * `set_recurring_day` (singular) keeps working, unchanged, for the same reason.

-- ── 1. the day-set allotment: a SUM over the chosen weekdays ────────────────
CREATE OR REPLACE FUNCTION public._recurring_allotment_days(
  p_days text[], p_from date, p_to date
) RETURNS integer
LANGUAGE sql STABLE
SET search_path TO 'public'
AS $$
  SELECT CASE
    WHEN p_days IS NULL OR array_length(p_days, 1) IS NULL OR p_from > p_to THEN 0
    ELSE (SELECT count(*)::int
            FROM generate_series(p_from, p_to, interval '1 day') d
           WHERE to_char(d, 'Dy') = ANY (p_days))
  END;
$$;

COMMENT ON FUNCTION public._recurring_allotment_days(text[], date, date) IS
  'CAREPLANS: the month''s entitlement for a plan whose days staff chose. Counts the '
  'occurrences of EVERY chosen weekday in the window and adds them up — Sat+Sun in a '
  'month with 5 Sundays and 4 Saturdays is 9, not 8. Quantity is NOT a multiplier '
  'here: under this model the chosen day count IS the quantity (set_recurring_days '
  'writes it onto the line), so multiplying again would double the entitlement.';

REVOKE ALL ON FUNCTION public._recurring_allotment_days(text[], date, date) FROM PUBLIC;
REVOKE ALL ON FUNCTION public._recurring_allotment_days(text[], date, date) FROM anon;
GRANT EXECUTE ON FUNCTION public._recurring_allotment_days(text[], date, date) TO authenticated, service_role;

-- ── 2. normalise a day list: valid, de-duplicated, in week order ────────────
CREATE OR REPLACE FUNCTION public._normalize_recurring_days(p_days text[])
RETURNS text[]
LANGUAGE plpgsql IMMUTABLE
SET search_path TO 'public'
AS $$
DECLARE
  v_in  text;
  v_day text;
  v_out text[] := '{}';
BEGIN
  IF p_days IS NULL OR array_length(p_days, 1) IS NULL THEN
    RAISE EXCEPTION 'choose at least one day of the week';
  END IF;
  FOREACH v_in IN ARRAY p_days LOOP
    v_day := initcap(btrim(coalesce(v_in, '')));
    IF v_day NOT IN ('Mon','Tue','Wed','Thu','Fri','Sat','Sun') THEN
      RAISE EXCEPTION 'day must be one of Mon/Tue/Wed/Thu/Fri/Sat/Sun, got %', v_in;
    END IF;
    IF NOT (v_day = ANY (v_out)) THEN v_out := v_out || v_day; END IF;
  END LOOP;
  IF array_length(v_out, 1) IS NULL THEN
    RAISE EXCEPTION 'choose at least one day of the week';
  END IF;
  -- week order, so a stored set reads Mon..Sun however staff clicked it.
  SELECT array_agg(d ORDER BY array_position(ARRAY['Mon','Tue','Wed','Thu','Fri','Sat','Sun'], d))
    INTO v_out FROM unnest(v_out) d;
  RETURN v_out;
END;
$$;

REVOKE ALL ON FUNCTION public._normalize_recurring_days(text[]) FROM PUBLIC;
REVOKE ALL ON FUNCTION public._normalize_recurring_days(text[]) FROM anon;
GRANT EXECUTE ON FUNCTION public._normalize_recurring_days(text[]) TO authenticated, service_role;

-- ── 3. the ONE mint seam learns the day set ─────────────────────────────────
-- Reissued from the LIVE body (pg_get_functiondef, 2026-08-17). The scheduled
-- branch, the draft gate, the client resolution and the row shape are unchanged;
-- the ONLY change is which formula the recurring branch uses.
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
  -- entitled. The companion trigger on `purchases` mints the moment the order leaves
  -- draft, so the shop's build-a-basket flow is covered without handing out bookable
  -- credits for an abandoned cart.
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
    -- CREDITFIX's ruling, unchanged and re-proven by this task's test: a session pack
    -- mints unit_count × quantity, and a HORSE-segment scheduled SKU mints nothing
    -- (a Full Body Clip is not a lesson credit — FLOWTRACE F2). No period, no expiry.
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
    v_from   := greatest(v_pu.created_at::date, v_period);
    v_to     := (v_period + interval '1 month - 1 day')::date;

    -- A plan that has been stopped is not entitled for a month that starts after it ended.
    IF v_it.plan_ends_on IS NOT NULL AND v_it.plan_ends_on < v_from THEN RETURN 0; END IF;
    IF v_it.plan_ends_on IS NOT NULL AND v_it.plan_ends_on < v_to THEN v_to := v_it.plan_ends_on; END IF;

    -- CAREPLANS: the days staff chose ARE the frequency. Their occurrences in this
    -- window, summed, are the month's entitlement — and `quantity` is deliberately
    -- NOT applied, because set_recurring_days already wrote the day count onto the
    -- line as the quantity. A plan with no chosen days falls back to the shipped
    -- weekly_frequency formula, byte-identical, so nothing already sold moves.
    SELECT array_agg(x) INTO v_days
      FROM jsonb_array_elements_text(coalesce(v_it.config->'recurring_days', '[]'::jsonb)) x;

    IF v_days IS NOT NULL AND array_length(v_days, 1) > 0 THEN
      v_units := _recurring_allotment_days(v_days, v_from, v_to);
    ELSE
      v_units := _recurring_allotment(v_off.weekly_frequency, v_it.config->>'recurring_day',
                                      v_from, v_to, v_it.quantity);
    END IF;
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

-- ── 4. staff choose the days, and how long ──────────────────────────────────
CREATE OR REPLACE FUNCTION public.set_recurring_days(
  p_purchase_item_id uuid,
  p_days             text[],
  p_weeks            integer DEFAULT NULL,
  p_indefinite       boolean DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public'
AS $$
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

  -- ── the quantity FOLLOWS the days (owner, 2026-08-16) ──
  -- Two chosen days is quantity 2, so the line bills two weekly rates: there is no
  -- volume discount in this business ("we typically dont discount if they buy 2x or
  -- 3x per week vs 1x"). A PAID order is not re-priced by a scheduling action —
  -- that would change what someone already paid; it is reported back instead.
  v_qty := array_length(v_days, 1);
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
  -- clawed back.
  SELECT * INTO v_lc FROM lesson_credits
   WHERE purchase_item_id = p_purchase_item_id
     AND period_start = date_trunc('month', current_date)::date
     AND deleted_at IS NULL
   FOR UPDATE;
  IF FOUND THEN
    v_from := greatest(v_pu.created_at::date, v_lc.period_start);
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
    'differs_from_catalog', coalesce(v_off.weekly_frequency, 1) <> array_length(v_days, 1),
    'entitled_this_month', v_new);
END;
$$;

COMMENT ON FUNCTION public.set_recurring_days(uuid, text[], integer, boolean) IS
  'CAREPLANS §P3: staff choose the days of the week and how long the plan runs; the '
  'quantity follows from the days. The days are an ENTITLEMENT BASIS, not a schedule '
  '— they decide HOW MANY sessions the month holds, and the client may then book them '
  'on any dates they like.';

REVOKE ALL ON FUNCTION public.set_recurring_days(uuid, text[], integer, boolean) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.set_recurring_days(uuid, text[], integer, boolean) FROM anon;
GRANT EXECUTE ON FUNCTION public.set_recurring_days(uuid, text[], integer, boolean) TO authenticated, service_role;

-- ── 5. the plan view tells staff and the member what was chosen ─────────────
CREATE OR REPLACE FUNCTION public._monthly_plan_for_client(p_client_id uuid)
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT coalesce(jsonb_agg(jsonb_build_object(
      'credit_id',            lc.id,
      'purchase_id',          lc.purchase_id,
      'purchase_item_id',     lc.purchase_item_id,
      'offering_id',          o.id,
      'offering_name',        o.name,
      'segment',              o.segment,
      'weekly_frequency',     o.weekly_frequency,
      'recurring_day',        pi.config->>'recurring_day',
      'recurring_days',       coalesce(pi.config->'recurring_days', '[]'::jsonb),
      'plan_weeks',           (pi.config->>'plan_weeks')::int,
      'indefinite',           pi.plan_ends_on IS NULL,
      'period_start',         lc.period_start,
      'expires_at',           lc.expires_at,
      'plan_ends_on',         pi.plan_ends_on,
      'month_label',          to_char(lc.period_start, 'FMMonth YYYY'),
      'entitled_this_month',  lc.credits_total,
      'used_this_month',      lc.credits_total - lc.credits_remaining,
      'remaining_this_month', lc.credits_remaining)
    ORDER BY o.segment, o.name), '[]'::jsonb)
  FROM lesson_credits lc
  JOIN purchase_items pi ON pi.id = lc.purchase_item_id
  JOIN offerings o       ON o.id = pi.offering_id AND o.config_kind = 'recurring'
  WHERE lc.client_id = p_client_id
    AND lc.deleted_at IS NULL
    AND lc.period_start = date_trunc('month', current_date)::date;
$function$;
