-- TASK-CREDITGRANT 4 — "comp a lesson credit and GENERATE A LOSS".
--
-- A comped line's own price is 0, so summing `purchase_items.price_amount` reports the
-- comps as costing nothing, which is the opposite of the owner's requirement. The loss
-- is the LIST PRICE AT COMP, captured on the line's config by `grant_lesson_credit` and
-- never re-derived from `offerings` (whose price is editable and would silently
-- restate history).
--
-- D17: this number is REACHABLE today — `LessonCreditsPage` renders it above the ledger
-- as "Comped this period". THE DASHBOARD REACH POINT, named rather than built (task §5):
-- dashboard zone **B1 "Money that has not landed"** (src/lib/dashboard/registry.ts) is
-- where a comps figure belongs on the business board; it currently reads
-- `dashboard_business_zones` and does not call this. That is the follow-up.

CREATE OR REPLACE FUNCTION public.comped_credit_value(
  p_from date DEFAULT NULL,
  p_to   date DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_org  uuid := current_org();
  v_from date := coalesce(p_from, date_trunc('month', current_date)::date);
  v_to   date := coalesce(p_to, (date_trunc('month', current_date) + interval '1 month - 1 day')::date);
  v_out  jsonb;
BEGIN
  IF NOT coalesce(has_staff_access(), false) THEN
    RAISE EXCEPTION 'operator access required';
  END IF;

  WITH comps AS (
    SELECT pi.id,
           pi.offering_id,
           coalesce(o.name, pi.label)                              AS service,
           pi.quantity                                             AS qty,
           coalesce((pi.config->>'list_price')::numeric, 0)         AS list_price,
           coalesce((pi.config->>'list_price')::numeric, 0) * pi.quantity AS loss,
           coalesce(lc.credits_total, 0)                            AS credits,
           pu.created_at
      FROM purchase_items pi
      JOIN purchases pu ON pu.id = pi.purchase_id
 LEFT JOIN offerings  o  ON o.id = pi.offering_id
 LEFT JOIN lesson_credits lc ON lc.purchase_item_id = pi.id AND lc.deleted_at IS NULL
     WHERE pi.org_id = v_org
       AND pi.config->>'grant_mode' = 'comp'
       -- A reversed comp is not a loss: the credit was taken back.
       AND pi.voided_at IS NULL
       AND pu.deleted_at IS NULL
       AND pu.status <> 'void'
       AND pu.created_at >= v_from::timestamptz
       AND pu.created_at <  (v_to + 1)::timestamptz
  )
  SELECT jsonb_build_object(
    'from',           v_from,
    'to',             v_to,
    'comp_count',     count(*),
    'credits_comped', coalesce(sum(credits), 0)::int,
    'list_value',     coalesce(sum(loss), 0),
    'by_service', coalesce((
      SELECT jsonb_agg(x ORDER BY (x->>'list_value')::numeric DESC)
        FROM (SELECT jsonb_build_object(
                       'service',    service,
                       'comp_count', count(*),
                       'credits',    coalesce(sum(credits), 0)::int,
                       'list_value', coalesce(sum(loss), 0)) AS x
                FROM comps GROUP BY service) s), '[]'::jsonb))
    INTO v_out
    FROM comps;

  RETURN v_out;
END;
$function$;

REVOKE ALL ON FUNCTION public.comped_credit_value(date, date) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.comped_credit_value(date, date) TO authenticated;

COMMENT ON FUNCTION public.comped_credit_value(date, date) IS
  'TASK-CREDITGRANT: the dollar value of credits comped in a period, from the list price captured at comp time. Read by LessonCreditsPage today; dashboard zone B1 is the named follow-up reach point.';
