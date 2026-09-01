-- TASK-LIFECYCLE · B — THIRTY DAYS BOOKED, THIRTY DAYS PENDING
--
-- Owner, 2026-08-31, on finding a client booked through 30 November:
--   *"Why did you set 90 days worth when the directive ive instructed is that
--   the schedule should be set every 30 days with the next 30 days shown as
--   pending until payment is confirmed… Once they confirm their payment to us we
--   confirm it was received and the pending bookings for the month flip to
--   booked."*
--
-- ⚠️ TRAP 1: `current_date + 90` IS IN THREE PLACES, AND FIXING THE DEFAULT
-- CHANGES NOTHING. Both callers pass `p_through` explicitly, so
-- `_ensure_plan_horizon`'s `coalesce` default is dead code from their point of
-- view — and `mint_recurring_allotments` runs on the live daily cron, so a fix
-- that misses it is silently undone every morning. All three sites, or none.
-- They now share ONE definition, so there is no fourth place for this to drift to.
--
-- ⚠️ TRAP 8: THIS CHANGES WHAT IS GENERATED FROM NOW ON. It does not
-- retro-withdraw the sessions already scheduled beyond the window (D32, and
-- DSGN's explicit ruling). The BEFORE/AFTER id snapshot below is what makes that
-- true: only rows THIS CALL created are marked pending. A month that was already
-- materialised is left exactly as it is.
--
-- ⚠️ IT IS A SNAPSHOT AND NOT A TIMESTAMP FOR A REASON. The first cut of this
-- fenced on `created_at >= clock_timestamp()-taken-before-the-call`, and it
-- silently matched NOTHING: `bookings.created_at` defaults to `now()`, which is
-- the TRANSACTION timestamp and is therefore always EARLIER than a
-- `clock_timestamp()` read inside that same transaction. The rehearsal caught
-- it — the generator reported `"created": 9` and `"pending": 0`. This is TASK-ROLE
-- §2a exactly: code that reports success while doing nothing.

-- ── 1 · one definition of the horizon ───────────────────────────────────────
CREATE OR REPLACE FUNCTION public.plan_horizon_through()
 RETURNS date
 LANGUAGE sql
 STABLE
 SET search_path TO 'public'
AS $function$
  -- the current month, materialised as it always was, PLUS one month generated
  -- pending. The last day of next month is where generation stops.
  SELECT (date_trunc('month', current_date) + interval '2 months' - interval '1 day')::date;
$function$;

-- ⚠️ BOOKS1 TRAP: default privileges re-grant anon/authenticated on a FRESH
-- function. This one is internal to plan generation; nothing calls it over
-- PostgREST.
REVOKE EXECUTE ON FUNCTION public.plan_horizon_through() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.plan_horizon_through() FROM anon;
REVOKE EXECUTE ON FUNCTION public.plan_horizon_through() FROM authenticated;

-- ── 2 · the generator: this month as it was, next month pending ─────────────
CREATE OR REPLACE FUNCTION public._ensure_plan_horizon(p_purchase_item_id uuid, p_through date DEFAULT NULL::date)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_pi      purchase_items%ROWTYPE;
  v_pu      purchases%ROWTYPE;
  v_through date := coalesce(p_through, plan_horizon_through());
  v_month   date := date_trunc('month', current_date)::date;
  v_this    date := date_trunc('month', current_date)::date;
  v_last    date;
  v_has_time boolean;
  v_gen     jsonb;
  v_before  uuid[];
  v_months  int := 0;
  v_created int := 0;
  v_pended  int := 0;
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

    -- the fence between "what I am about to make" and "what was already there"
    SELECT coalesce(array_agg(b.id), '{}'::uuid[]) INTO v_before
      FROM bookings b
     WHERE b.purchase_id = v_pu.id
       AND b.starts_at >= v_month
       AND b.starts_at <  (v_month + interval '1 month');
    v_gen := _generate_plan_month(
               p_purchase_item_id,
               NULL,                                                  -- per-day times decide
               coalesce((v_pi.config->>'duration_minutes')::int, 60),
               nullif(btrim(coalesce(v_pi.config->>'horse_id', '')), '')::uuid,
               nullif(btrim(coalesce(v_pi.config->>'location_id', '')), '')::uuid,
               NULL,
               v_month);
    v_created := v_created + coalesce((v_gen->>'created')::int, 0);

    -- ⚠️ THE PENDING MONTH. `_generate_plan_month` inserts every row 'scheduled';
    -- a month beyond the current one is not paid for yet, so what it just made
    -- becomes 'pending' — VISIBLE, not withheld (Trap 6 / D23 / D24: a pending
    -- month never blocks anyone from booking). Scoped to rows this call created,
    -- so a month that already existed is untouched (Trap 8).
    IF v_month > v_this AND coalesce((v_gen->>'created')::int, 0) > 0 THEN
      UPDATE bookings
         SET status = 'pending', updated_at = now()
       WHERE purchase_id = v_pu.id
         AND starts_at >= v_month
         AND starts_at <  (v_month + interval '1 month')
         AND NOT (id = ANY (v_before))
         AND status = 'scheduled';
      GET DIAGNOSTICS v_pended = ROW_COUNT;
    END IF;

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
                            'created', v_created, 'pending', v_pended, 'minted', v_minted);
END;
$function$;

-- ── 3 · the two callers that override the default ───────────────────────────
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
  v_target date    := plan_horizon_through();
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

-- ⚠️ THIS ONE IS THE DAILY CRON (`/api/mint-monthly-allotments`,
-- `.github/workflows/scheduled-jobs.yml`, `20 8 * * *`). It is the site that
-- would have undone the fix every morning.
CREATE OR REPLACE FUNCTION public.mint_recurring_allotments()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_month date := date_trunc('month', current_date)::date;
  v_target date := plan_horizon_through();
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
