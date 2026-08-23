-- DASHBOARDBUILD §5 — revenue, correctly. ONE engine, and the calendar adopts it.
--
-- `calendar_revenue` sums `bookings.price_amount` over non-cancelled bookings in
-- the window. That is SCHEDULED VALUE, not revenue, and it is wrong four ways —
-- verified against production 2026-08-22, exactly as DASHBOARDS-GROUND-UP-PLAN §6
-- diagnosed it a day earlier:
--
--   1. It counts bookings whose purchase was never paid. Seven of this tenant's
--      eleven live purchases are unpaid; every session hanging off them is
--      currently counted as money earned.
--   2. It re-counts credit-covered sessions. The punch card WAS the revenue when
--      it was bought; each lesson it pays for is counted again here.
--   3. It counts standing-slot sessions minted into the future (D23: the slot
--      recurs until cancelled). 101 of this tenant's 317 bookings start in the
--      future — the further out the window reaches, the "richer" the barn looks.
--   4. It recognizes at SESSION date rather than PAYMENT date, so money already
--      in the bank shows up months from now.
--
-- The correct engine is one line of thought: revenue is money that was paid, on
-- the day it was paid. `mark_purchase_paid` is the single writer of that fact
-- (`payment_status='paid'`, `paid_at=now()`, `amount_paid=amount`) — CASHCONFIRM
-- and ZELLECLOSE both converged on it — so `purchases.paid_at` IS the
-- recognition date and nothing else needs to be invented.
--
-- D18: this is the ONLY revenue computation in the app after this migration.
-- `src/lib/ops/api-calendar.ts` repoints the calendar's own money strip at it in
-- the same commit, so the dashboard KPI and the calendar tile cannot disagree.
-- `calendar_revenue` is NOT dropped — nothing is removed from this database
-- (D32) — but it keeps no callers, and its meaning ("scheduled value on the
-- calendar") can be resurrected later under an honest name if anyone wants it.
CREATE OR REPLACE FUNCTION public.revenue_summary(p_from timestamptz, p_to timestamptz)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_org   uuid := current_org();
  v_span  interval;
  v_total numeric;
  v_count integer;
  v_prior numeric;
  v_pcount integer;
BEGIN
  IF NOT coalesce(has_staff_access(), false) THEN
    RAISE EXCEPTION 'operator access required';
  END IF;

  v_span := p_to - p_from;

  -- The window itself.
  SELECT coalesce(sum(coalesce(nullif(p.amount_paid, 0), p.amount, 0)), 0), count(*)
    INTO v_total, v_count
    FROM purchases p
   WHERE p.org_id = v_org
     AND p.deleted_at IS NULL
     AND p.payment_status = 'paid'
     AND p.paid_at IS NOT NULL
     AND p.paid_at >= p_from AND p.paid_at < p_to;

  -- The window of the same length immediately before it, so a figure can be
  -- read as up or down without a second call and a second definition.
  SELECT coalesce(sum(coalesce(nullif(p.amount_paid, 0), p.amount, 0)), 0), count(*)
    INTO v_prior, v_pcount
    FROM purchases p
   WHERE p.org_id = v_org
     AND p.deleted_at IS NULL
     AND p.payment_status = 'paid'
     AND p.paid_at IS NOT NULL
     AND p.paid_at >= p_from - v_span AND p.paid_at < p_from;

  RETURN jsonb_build_object(
    'total',       v_total,
    'count',       v_count,
    'prior_total', v_prior,
    'prior_count', v_pcount,
    'delta',       v_total - v_prior,
    'delta_pct',   CASE WHEN v_prior > 0 THEN round(((v_total - v_prior) / v_prior) * 100, 1) ELSE NULL END,
    'from',        p_from,
    'to',          p_to);
END;
$function$;

REVOKE ALL ON FUNCTION public.revenue_summary(timestamptz, timestamptz) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.revenue_summary(timestamptz, timestamptz) TO authenticated, service_role;

COMMENT ON FUNCTION public.revenue_summary(timestamptz, timestamptz) IS
  'DASHBOARDBUILD §5 / D18. THE revenue computation: paid purchases recognized at '
  'payment date (purchases.paid_at), with the prior equal-length window for deltas. '
  'The dashboard KPI and the calendar money strip both call this. Do not add a second one.';

-- Money that is DECLARED but not yet confirmed is deliberately NOT revenue here.
-- D23/D24 say a declaration unblocks the client immediately and staff confirmation
-- governs whether the lesson happens — it is a real operational number, but it is
-- not money received, so it is reported beside revenue (see dash_money_waiting and
-- dash_business_kpis) rather than inside it.
