-- TASK-FIX2 §2 — THE STAFF PICKER MUST BE ABLE TO TELL TWO PLANS APART.
--
-- Madeline Do holds TWO live `2x Weekly Lessons` plans. One is `PUR-000319`,
-- PAID $880 on 2026-08-26, which placed nothing. The other is `PUR-000230`,
-- unpaid, awaiting payment, and it is the one her four booked sessions hang off.
-- `client_standing_slots` returned only the offering NAME, so staff — and the
-- client, through `my_standing_slots`, which has the same shape — were shown two
-- identical rows reading "2x Weekly Lessons · not chosen" with no way to tell
-- which one the money is on.
--
-- ⚠️ THIS IS A READ ONLY. No purchase is changed, no booking placed, nothing
-- expunged: the owner does that pass with his own timestamps AFTER this lands
-- (his ruling). What this migration does is make the pass POSSIBLE — it puts the
-- order code, its status and its payment status on the row Claire clicks.
--
-- D19: an action that moves value states itself first. Placing 26 sessions
-- against the wrong one of two identical-looking orders is exactly that.

CREATE OR REPLACE FUNCTION public.client_standing_slots(p_contact_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT coalesce(has_staff_access(), false) THEN
    RAISE EXCEPTION 'operator access required';
  END IF;
  RETURN coalesce((
    SELECT jsonb_agg(jsonb_build_object(
        'purchase_id',      pu.id,
        'purchase_item_id', pi.id,
        -- ⚠️ FIX2 §2: which ORDER this plan belongs to, and whether it is paid.
        'purchase_code',    pu.display_code,
        'purchase_status',  pu.status,
        'payment_status',   pu.payment_status,
        'purchase_amount',  pu.amount,
        'purchased_at',     pu.created_at,
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
       AND pu.org_id = current_org()
       AND pu.buyer_contact_id = p_contact_id
       AND (pi.plan_ends_on IS NULL OR pi.plan_ends_on >= current_date)
  ), '[]'::jsonb);
END;
$function$;
