-- TASK-BUYANDBOOK §9 — a declared order NAMES its payment type in its status.
--
-- Owner, 2026-08-21: "When a client declares their payment type the order should show
-- a state of pending for payment type, so payment-pending-Zelle and payment-pending-cash."
--
-- MEASURED BEFORE. A declared order read `submitted` — the SAME true status as an
-- order nobody has said anything about. The declaration existed only as an EVENT
-- (`payment_reported`, `is_true_status = false`) and as three columns
-- (`client_reported_method`, `client_claim_status`, `client_reported_at`) that every
-- surface had to reassemble for itself. So the state of the order did not say the one
-- thing that had just changed about it, and staff had to read the "Client says" column
-- to find out.
--
-- ⚠️ AND THE TRIGGER COULD NOT HAVE SEEN IT ANYWAY. `status_purchases` is
-- `BEFORE INSERT OR UPDATE OF status, payment_status`. `UPDATE OF` fires on the
-- statement's TARGET LIST (PARTYEMAIL X4), and `report_my_payment`'s claim UPDATE sets
-- neither of those columns — so on an order already past draft, declaring a payment
-- changed no status at all and wrote no status event. The trigger's column list now
-- includes the two claim columns.
--
-- WHERE IT SITS IN THE LADDER: below `paid` (a settled order reads paid, whatever was
-- claimed) and above `submitted` (a declared order is further along than a silent one).
-- A DECLINED claim falls back to `submitted` on its own, because the CASE only matches
-- `client_claim_status = 'pending'` — there is no second rule to keep in step.

INSERT INTO status_events_vocab (entity_type, code, display_name, is_true_status, is_terminal, sort_order)
VALUES
  ('order', 'payment_pending_zelle', 'Payment pending — Zelle', true, false, 25),
  ('order', 'payment_pending_cash',  'Payment pending — Cash',  true, false, 25)
ON CONFLICT (entity_type, code) DO UPDATE
  SET display_name   = EXCLUDED.display_name,
      is_true_status = EXCLUDED.is_true_status,
      sort_order     = EXCLUDED.sort_order;

-- The two-argument mapper is REPLACED, not overloaded. Adding defaulted parameters
-- with CREATE OR REPLACE would leave the old signature in place and every existing
-- two-argument call would keep resolving to it — the exact trap `_generate_plan_month`
-- fell into earlier in this task. One mapper, one place.
DROP FUNCTION IF EXISTS public.order_status_code(text, text);

CREATE OR REPLACE FUNCTION public.order_status_code(
  p_status text,
  p_payment text,
  p_claim_status text DEFAULT NULL,
  p_claim_method text DEFAULT NULL)
 RETURNS text
 LANGUAGE sql
 IMMUTABLE
AS $function$
  SELECT CASE
    WHEN p_status = 'void' THEN 'void'
    WHEN p_status = 'paid' OR p_payment = 'paid' THEN 'paid'
    -- D23 — the client has SAID how they are paying. That is a state of the order,
    -- not a footnote on it, and it names the method because the method is what staff
    -- have to go and check.
    WHEN coalesce(p_claim_status, '') = 'pending'
     AND lower(coalesce(p_claim_method, '')) = 'zelle' THEN 'payment_pending_zelle'
    WHEN coalesce(p_claim_status, '') = 'pending'
     AND lower(coalesce(p_claim_method, '')) = 'cash'  THEN 'payment_pending_cash'
    WHEN p_status = 'awaiting_payment' THEN 'submitted'
    WHEN p_status = 'sent' THEN 'submitted'
    ELSE 'pending' END;
$function$;

CREATE OR REPLACE FUNCTION public.trg_status_purchases()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE v_code text; v_old text;
BEGIN
  v_code := order_status_code(NEW.status, NEW.payment_status,
                              NEW.client_claim_status, NEW.client_reported_method);
  v_old  := CASE WHEN TG_OP = 'UPDATE'
                 THEN order_status_code(OLD.status, OLD.payment_status,
                                        OLD.client_claim_status, OLD.client_reported_method) END;
  IF TG_OP = 'INSERT' OR v_code IS DISTINCT FROM v_old THEN
    NEW.current_status := v_code;
    INSERT INTO status_events (org_id, entity_type, entity_id, status, actor_user_id)
      VALUES (NEW.org_id, 'order', NEW.id, v_code, auth.uid());
  END IF;
  RETURN NEW;
END;
$function$;

-- ⚠️ THE COLUMN LIST IS THE FIX, not the function body. Without the two claim columns
-- here, declaring a payment on an order that has already left draft updates neither
-- `status` nor `payment_status`, the trigger never fires, and the new state never
-- appears. `client_reported_method` is listed too so switching Zelle ⇄ cash on an open
-- claim ("Actually, I'll pay cash") moves the order between the two states.
DROP TRIGGER IF EXISTS status_purchases ON public.purchases;
CREATE TRIGGER status_purchases
  BEFORE INSERT OR UPDATE OF status, payment_status, client_claim_status, client_reported_method
  ON public.purchases
  FOR EACH ROW EXECUTE FUNCTION public.trg_status_purchases();

-- Backfill: `current_status` is a denormalisation, so an order whose claim predates
-- this migration must be re-derived rather than left saying `submitted`. No status
-- EVENT is written for the backfill — nothing happened to these orders today; the
-- denormalised column is simply being corrected.
UPDATE purchases p
   SET current_status = order_status_code(p.status, p.payment_status,
                                          p.client_claim_status, p.client_reported_method)
 WHERE p.deleted_at IS NULL
   AND p.current_status IS DISTINCT FROM order_status_code(p.status, p.payment_status,
                                                           p.client_claim_status, p.client_reported_method);
