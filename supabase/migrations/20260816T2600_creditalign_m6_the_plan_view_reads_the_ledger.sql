-- TASK CREDITALIGN m6 — the monthly-plan panel stops computing its own number.
--
-- BOOKLINK's `_monthly_plan_for_client` derived "entitled this month" on the fly
-- (weekly_frequency × weekday occurrences) and "used this month" by counting bookings.
-- Now that an allotment is a real, spendable row, that is a SECOND opinion about the
-- same quantity — the exact shape COUNTFIX was about. It also disagreed with reality in
-- three measurable ways:
--   * `entitled_this_month` was NULL until a recurring_day was chosen, so a client who
--     had paid saw "—";
--   * `used_this_month` counted only `status IN ('scheduled','completed')`, and since
--     REVIEWQ a claimed slot lands `pending` — so a member who had just booked their
--     whole month still showed the whole month remaining;
--   * it was `LIMIT 1` and `kind = 'lesson'`, so a client with a horse-care plan (prod:
--     Claire Bourdon holds Training 1x Weekly AND Exercise 1x Weekly on PUR-000059) saw
--     one plan at most and never a care one.
--
-- It now reads the ledger and returns ALL of the client's current-month plans, both
-- segments. The number on the screen and the number that gets spent are the same row.
--
-- SHAPE CHANGE: jsonb OBJECT-or-null → jsonb ARRAY (`[]` when there are none). The two
-- callers (`MyLessonsContent`, `CalendarItemPanel`) are updated in the same commit.
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

COMMENT ON FUNCTION public._monthly_plan_for_client(uuid) IS
  'CREDITALIGN: a jsonb ARRAY of the client''s current-month recurring allotments, both '
  'segments, read straight off lesson_credits. entitled/used/remaining are '
  'credits_total, credits_total - credits_remaining and credits_remaining — not a second '
  'computation that can disagree with what gets spent.';

-- my_monthly_plan() and client_monthly_plan() keep their signatures and their
-- authorization; only the shape they pass through changes. Re-declared verbatim so a
-- reader of this file sees exactly what they are.
CREATE OR REPLACE FUNCTION public.my_monthly_plan()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE v_client uuid := current_client_id();
BEGIN
  IF v_client IS NULL THEN RETURN '[]'::jsonb; END IF;
  RETURN _monthly_plan_for_client(v_client);
END;
$function$;

CREATE OR REPLACE FUNCTION public.client_monthly_plan(p_client_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT has_staff_access() THEN RAISE EXCEPTION 'operator access required'; END IF;
  RETURN _monthly_plan_for_client(p_client_id);
END;
$function$;
