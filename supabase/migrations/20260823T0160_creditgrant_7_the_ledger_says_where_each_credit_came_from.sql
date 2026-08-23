-- TASK-CREDITGRANT 7 — the ledger must not show a comp, a debt and a sale as the
-- same row (task §4).
--
-- `LessonCreditsPage` read `lesson_credits` flat, so every row looked identical: a
-- comped credit, a billed-but-unpaid credit and a normally-purchased one were one
-- column of numbers. This is the one named query behind that page (COUNTFIX's rule:
-- a number on screen has exactly one query that defines it), joining the credit to
-- the line that minted it and the order that owes for it.
--
-- `can_undo` mirrors `revoke_lesson_credit_grant`'s own refusals, so the page never
-- offers a button that would throw — and `undo_blocked` says why in the words a
-- person needs, rather than leaving a disabled control unexplained.

CREATE OR REPLACE FUNCTION public.credit_ledger(p_client_id uuid DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_org uuid := current_org();
BEGIN
  IF NOT coalesce(has_staff_access(), false) THEN
    RAISE EXCEPTION 'operator access required';
  END IF;

  RETURN coalesce((
    SELECT jsonb_agg(row ORDER BY (row->>'purchased_at') DESC)
      FROM (
        SELECT jsonb_build_object(
          'id',                lc.id,
          'client_id',         lc.client_id,
          'client_name',       nullif(btrim(coalesce(c.first_name,'') || ' ' || coalesce(c.last_name,'')), ''),
          'package_key',       lc.package_key,
          'offering_id',       lc.offering_id,
          'offering_name',     o.name,
          'credits_total',     lc.credits_total,
          'credits_remaining', lc.credits_remaining,
          'purchased_at',      lc.purchased_at,
          'expires_at',        lc.expires_at,
          'period_start',      lc.period_start,
          -- WHERE IT CAME FROM. Four real shapes exist on this table, and the page
          -- must not present them as one:
          --   the three staff modes (config->>'grant_mode');
          --   'change'   — _refund_booking_credit's compensating row, minted when a
          --                standing slot was cancelled or rescheduled (package_key
          --                'change_credit'), which was never bought and never comped;
          --   'unknown'  — a credit with no line AND no order behind it. One such row
          --                exists on prod (2026-08-18, no package, no offering, fully
          --                spent) — TASK-AUTHORITY's orphan shape. Calling it
          --                "Purchased" would be the ledger lying, so it says so.
          'origin',            CASE
             WHEN pi.config ? 'grant_mode'      THEN pi.config->>'grant_mode'
             WHEN lc.package_key = 'change_credit' THEN 'change'
             WHEN pi.id IS NULL AND pu.id IS NULL  THEN 'unknown'
             ELSE 'purchase' END,
          'reason',            pi.config->>'grant_reason',
          'granted_by',        (SELECT nullif(btrim(coalesce(gp.first_name,'') || ' ' || coalesce(gp.last_name,'')), '')
                                  FROM profiles gp WHERE gp.user_id = (pi.config->>'granted_by')::uuid),
          'quantity',          coalesce(pi.quantity, 1),
          -- per UNIT, as captured at grant time…
          'list_price',        coalesce((pi.config->>'list_price')::numeric, pi.price_amount),
          -- …and what the whole LINE was worth, which is the figure a ledger row shows.
          'list_value',        coalesce((pi.config->>'list_price')::numeric, pi.price_amount, 0)
                                 * coalesce(pi.quantity, 1),
          'line_amount',       coalesce(pi.price_amount * pi.quantity, 0),
          'purchase_id',       pu.id,
          'display_code',      pu.display_code,
          'order_status',      pu.status,
          'payment_status',    pu.payment_status,
          'amount',            pu.amount,
          'amount_due',        greatest(coalesce(pu.amount,0) - coalesce(pu.amount_paid,0), 0),
          -- coalesce, not a bare `?`: a credit with no line at all (a returned or
          -- orphan row) makes the test NULL, and a nullable can_undo is a contract
          -- every reader has to remember to defend against.
          'can_undo',          coalesce(pi.config ? 'grant_mode', false)
                                 AND coalesce(pu.status,'') <> 'void'
                                 AND lc.credits_remaining >= lc.credits_total
                                 AND coalesce(pu.client_claim_status,'none') <> 'confirmed'
                                 AND NOT EXISTS (SELECT 1 FROM receipt_sends rs
                                                  WHERE rs.purchase_id = pu.id AND rs.succeeded),
          'undo_blocked',      CASE
             WHEN NOT coalesce(pi.config ? 'grant_mode', false) THEN 'This credit did not come from a staff grant.'
             WHEN coalesce(pu.status,'') = 'void' THEN 'Already undone.'
             WHEN lc.credits_remaining < lc.credits_total THEN
               (lc.credits_total - lc.credits_remaining) || ' of these credits have been used.'
             WHEN coalesce(pu.client_claim_status,'none') = 'confirmed'
               OR EXISTS (SELECT 1 FROM receipt_sends rs WHERE rs.purchase_id = pu.id AND rs.succeeded)
               THEN 'A payment on this order has settled — refund it instead.'
             END
        ) AS row
        FROM lesson_credits lc
        JOIN clients cl ON cl.id = lc.client_id
        LEFT JOIN contacts c  ON c.id = cl.contact_id
        LEFT JOIN offerings o ON o.id = lc.offering_id
        LEFT JOIN purchase_items pi ON pi.id = lc.purchase_item_id
        LEFT JOIN purchases pu ON pu.id = lc.purchase_id
       WHERE lc.org_id = v_org
         AND lc.deleted_at IS NULL
         AND (p_client_id IS NULL OR lc.client_id = p_client_id)
      ) s), '[]'::jsonb);
END;
$function$;

REVOKE ALL ON FUNCTION public.credit_ledger(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.credit_ledger(uuid) TO authenticated;

COMMENT ON FUNCTION public.credit_ledger(uuid) IS
  'TASK-CREDITGRANT: the one named query behind LessonCreditsPage. Says where each credit came from (purchase / handwrite / comp / bill), what it was for, why, and whether the grant can still be undone.';

-- The grant form offers only what can actually mint a spendable credit — the same
-- rule grant_lesson_credit enforces, so the picker cannot present a choice the RPC
-- would refuse (D17: a control that cannot work is worse than no control).
CREATE OR REPLACE FUNCTION public.grantable_offerings()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE v_org uuid := current_org();
BEGIN
  IF NOT coalesce(has_staff_access(), false) THEN
    RAISE EXCEPTION 'operator access required';
  END IF;
  RETURN coalesce((
    SELECT jsonb_agg(jsonb_build_object(
             'id', o.id, 'name', o.name, 'segment', o.segment,
             'unit_count', o.unit_count, 'price_amount', coalesce(o.price_amount, 0),
             'active', o.active)
           ORDER BY o.active DESC, o.segment, o.name)
      FROM offerings o
     WHERE o.org_id = v_org
       AND o.config_kind = 'scheduled'
       AND coalesce(o.unit_count, 0) > 0), '[]'::jsonb);
END;
$function$;

REVOKE ALL ON FUNCTION public.grantable_offerings() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.grantable_offerings() TO authenticated;
