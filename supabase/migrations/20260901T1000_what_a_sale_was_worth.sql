-- TASK-BOOKS1 — what a sale was worth, what was collected, and what was given away
-- (CR-89 + the revenue half of CR-86, gaps 2 and 4)
--
-- THE MECHANISM (owner, 2026-08-31): the order is built like any other — real lines,
-- real prices, a real total. The comp or discount is a DISPOSITION APPLIED WHEN THE
-- ORDER IS MARKED PAID. The customer sees the full price AND that they owe $0. The
-- shortfall is recorded as a write-down against collected revenue — two figures on
-- one sale. A discount to $0 IS a comp: one mechanism on a spectrum, not two features.
--
-- R1: the disposition lives on the ORDER, at settlement. `amount` stays the FULL
--     price and `amount_paid` stays what was COLLECTED. The write-down is STORED,
--     not re-derived, so a later price edit cannot move a closed month's books.
-- R2: the LIST PRICE is captured on the LINE at the time of sale
--     (purchase_items.list_price_amount) — never re-derive a past loss from
--     today's catalogue.
-- R5: revenue_summary recognises what was COLLECTED. nullif(amount_paid, 0) goes:
--     an explicit zero on a paid order is zero revenue. amount_paid IS NULL keeps
--     its old meaning (fall back to amount). One period read — revenue_period_lines —
--     feeds both the summary and the export, so two figures cannot disagree.
-- D19: no reason, no give-away; the write-down states itself, records who/why/when
--     (status_events), and can be undone (revert_purchase_writedown), which refuses
--     an order whose credits are already spent.
--
-- ⚠️ mark_purchase_paid grows two DEFAULTED parameters. CREATE OR REPLACE would
-- OVERLOAD, leaving every old 5-arg call on the old body — so the old signature is
-- DROPPED explicitly and the grants restored explicitly (DROP+CREATE resets ACLs).

-- ── 1 · the disposition on the order ────────────────────────────────────────────

ALTER TABLE purchases
  ADD COLUMN IF NOT EXISTS payment_disposition text NOT NULL DEFAULT 'paid',
  ADD COLUMN IF NOT EXISTS write_down_amount numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS write_down_reason text;

-- Three tokens exactly; 'COMP', 'comped ' and 'free' are refused here.
ALTER TABLE purchases
  ADD CONSTRAINT purchases_payment_disposition_check
    CHECK (payment_disposition IN ('paid', 'discounted', 'comped'));

-- A give-away carries an amount and a reason; an ordinary sale carries neither.
ALTER TABLE purchases
  ADD CONSTRAINT purchases_write_down_shape_check
    CHECK (
      (payment_disposition = 'paid' AND write_down_amount = 0)
      OR (payment_disposition <> 'paid'
          AND write_down_amount > 0
          AND write_down_reason IS NOT NULL)
    );

-- ── 2 · the list price on the line, at the time of sale (R2) ───────────────────

ALTER TABLE purchase_items
  ADD COLUMN IF NOT EXISTS list_price_amount numeric;

-- Existing lines: price_amount came straight from the catalogue at sale time on
-- every creation path (verified: all 17 purchases' amounts equal their line sums),
-- so it IS the list price for history written before this column existed.
UPDATE purchase_items SET list_price_amount = price_amount
 WHERE list_price_amount IS NULL;

-- Every creation path (create_my_purchase, _provision_purchase_for_offerings,
-- apply_booking_fee, grant_lesson_credit, submit_public_request) prices lines
-- from the catalogue at insert. ONE seam captures the list price for all of
-- them — a path that someday inserts a pre-reduced price passes its own
-- list_price_amount explicitly and this trigger keeps its hands off.
CREATE OR REPLACE FUNCTION trg_capture_list_price()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.list_price_amount := coalesce(NEW.list_price_amount, NEW.price_amount);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS purchase_items_capture_list_price ON purchase_items;
CREATE TRIGGER purchase_items_capture_list_price
  BEFORE INSERT ON purchase_items
  FOR EACH ROW EXECUTE FUNCTION trg_capture_list_price();

-- ── 3 · the ledger vocabulary for a write-down ─────────────────────────────────

INSERT INTO status_events_vocab (entity_type, code, display_name, is_true_status, is_terminal, sort_order)
VALUES
  ('order', 'write_down',          'Revenue written down (discount or comp)', false, false, 28),
  ('order', 'write_down_reverted', 'Write-down undone by staff',              false, false, 28)
ON CONFLICT DO NOTHING;

-- ── 4 · mark_purchase_paid learns the disposition ──────────────────────────────
-- ⚠️ ACL before this block (pg_proc.proacl, measured 2026-09-01):
--   mark_purchase_paid: {postgres=X/postgres,authenticated=X/postgres,service_role=X/postgres}
-- The DROP erases that; the GRANTs below restore it exactly.

DROP FUNCTION IF EXISTS public.mark_purchase_paid(uuid, numeric, text, text, timestamp with time zone);

CREATE FUNCTION public.mark_purchase_paid(
  p_purchase_id uuid,
  p_amount numeric,
  p_reference text DEFAULT NULL,
  p_method text DEFAULT 'zelle',
  p_paid_at timestamp with time zone DEFAULT NULL,
  p_disposition text DEFAULT 'paid',
  p_write_down_reason text DEFAULT NULL)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_pur       purchases%ROWTYPE;
  v_this      numeric;
  v_settled   numeric;
  v_covers    boolean;
  v_disp      text := lower(btrim(coalesce(p_disposition, 'paid')));
  v_reason    text := nullif(btrim(coalesce(p_write_down_reason, '')), '');
  v_down      numeric;
BEGIN
  IF NOT (coalesce(auth.role(), '') = 'service_role' OR has_staff_access()) THEN
    RAISE EXCEPTION 'operator access required';
  END IF;

  IF v_disp NOT IN ('paid', 'discounted', 'comped') THEN
    RAISE EXCEPTION 'unknown disposition: % (paid, discounted or comped)', p_disposition;
  END IF;
  -- D19: no reason, no give-away.
  IF v_disp <> 'paid' AND v_reason IS NULL THEN
    RAISE EXCEPTION 'a % order needs a reason — what was this given for?', v_disp;
  END IF;

  SELECT * INTO v_pur FROM purchases WHERE id = p_purchase_id AND deleted_at IS NULL;
  IF NOT FOUND THEN RAISE EXCEPTION 'unknown purchase: %', p_purchase_id; END IF;
  IF v_pur.payment_status = 'paid' THEN RETURN 'already_paid'; END IF;

  -- What was already settled BEFORE this act, from the payment records.
  SELECT coalesce(sum(amount), 0) INTO v_settled
    FROM payments
   WHERE purchase_id = p_purchase_id AND status = 'paid' AND deleted_at IS NULL;

  -- ── COMPED: the full price is written down; no money moves, so no payment
  --    record is written (payments.amount is CHECKed > 0 — there is nothing to
  --    record). The order keeps its full price; the customer owes $0.
  IF v_disp = 'comped' THEN
    IF coalesce(p_amount, 0) <> 0 THEN
      RAISE EXCEPTION 'a comp collects nothing — money collected is a discounted settlement';
    END IF;
    IF v_settled > 0 THEN
      RAISE EXCEPTION 'money was already collected on this order (%). Settle the remainder as discounted, not comped',
        to_char(v_settled, 'FM999999990.00');
    END IF;
    v_down := coalesce(v_pur.amount, 0);
    IF v_down <= 0 THEN
      RAISE EXCEPTION 'this order has no price to write down';
    END IF;

    UPDATE purchases p
       SET amount_paid         = 0,
           payment_method      = 'comp',
           payment_status      = 'paid',
           status              = 'paid',
           paid_at             = coalesce(p_paid_at, now()),
           payment_disposition = 'comped',
           write_down_amount   = v_down,
           write_down_reason   = v_reason
     WHERE p.id = p_purchase_id;

    PERFORM log_status_event('order', p_purchase_id, 'write_down',
      'Comped — ' || to_char(v_down, 'FM999999990.00')
        || ' written down; the full price stays on the order — ' || v_reason, v_pur.org_id);
    PERFORM _notify_purchase_paid(p_purchase_id);
    RETURN 'paid';
  END IF;

  -- ── DISCOUNTED: what arrives is recorded as an ordinary payment; the order
  --    then CLOSES with the shortfall stored as the write-down. This is what
  --    distinguishes a discount from a part payment: a part payment leaves the
  --    order open with a balance owed; a discount says the books are closed.
  IF v_disp = 'discounted' THEN
    v_this := coalesce(p_amount, 0);
    IF v_this <= 0 THEN
      RAISE EXCEPTION 'a discount that collects nothing is a comp — use the comped disposition';
    END IF;
    IF v_settled + v_this >= coalesce(v_pur.amount, 0) - 0.005 THEN
      RAISE EXCEPTION 'that collects the full % — nothing is being written down; mark it paid',
        to_char(coalesce(v_pur.amount, 0), 'FM999999990.00');
    END IF;

    PERFORM _payment_settle(p_purchase_id, coalesce(p_method, 'zelle'), p_reference, v_this, p_paid_at);
    v_down := coalesce(v_pur.amount, 0) - (v_settled + v_this);

    UPDATE purchases p
       SET amount_paid         = v_settled + v_this,
           payment_method      = lower(btrim(coalesce(p_method, 'zelle'))),
           payment_reference   = COALESCE(p.payment_reference, p_reference),
           payment_status      = 'paid',
           status              = 'paid',
           paid_at             = coalesce(p_paid_at, now()),
           payment_disposition = 'discounted',
           write_down_amount   = v_down,
           write_down_reason   = v_reason
     WHERE p.id = p_purchase_id;

    PERFORM log_status_event('order', p_purchase_id, 'write_down',
      'Discounted — collected ' || to_char(v_settled + v_this, 'FM999999990.00')
        || ' of ' || to_char(coalesce(v_pur.amount, 0), 'FM999999990.00')
        || '; ' || to_char(v_down, 'FM999999990.00') || ' written down — ' || v_reason, v_pur.org_id);
    PERFORM _notify_purchase_paid(p_purchase_id);
    RETURN 'paid';
  END IF;

  -- ── PAID: the pre-existing behaviour, unchanged — except that a ZERO-TOTAL
  --    order (a waived booking fee) now settles instead of raising: there is no
  --    money to record and nothing written down. apply_booking_fee has called
  --    this with (id, 0, reason, 'waived') since ZELLECLOSE; the >0 guard below
  --    made that call raise ever since the payments ledger arrived.
  v_this := coalesce(p_amount, greatest(coalesce(v_pur.amount, 0) - v_settled, 0));
  IF v_this <= 0 AND coalesce(v_pur.amount, 0) - v_settled <= 0 THEN
    UPDATE purchases p
       SET amount_paid       = v_settled,
           payment_method    = lower(btrim(coalesce(p_method, 'zelle'))),
           payment_reference = COALESCE(p.payment_reference, p_reference),
           payment_status    = 'paid',
           status            = 'paid',
           paid_at           = coalesce(p_paid_at, now())
     WHERE p.id = p_purchase_id;
    PERFORM _notify_purchase_paid(p_purchase_id);
    RETURN 'paid';
  END IF;
  IF v_this <= 0 THEN RAISE EXCEPTION 'a payment amount must be greater than zero'; END IF;
  IF v_settled + v_this > coalesce(v_pur.amount, 0) + 0.005 THEN
    RAISE EXCEPTION 'that would settle %, more than the order total of %',
      v_settled + v_this, v_pur.amount;
  END IF;

  -- the entry that says WHEN this money was marked paid, by WHOM, and HOW
  PERFORM _payment_settle(p_purchase_id, coalesce(p_method,'zelle'), p_reference, v_this, p_paid_at);

  v_covers := (v_settled + v_this) >= coalesce(v_pur.amount, 0) - 0.005;

  UPDATE purchases p
     SET amount_paid       = v_settled + v_this,
         payment_method    = lower(btrim(coalesce(p_method, 'zelle'))),
         payment_reference = COALESCE(p.payment_reference, p_reference),
         -- ⚠️ ONLY when the money is all in. A part-paid order is still open, and
         -- its entitlements are still gated on payment exactly as before.
         -- TASK-ORIGIN §4.3: the date a monthly report reads (revenue_summary
         -- filters on paid_at) — a backfilled sale states when it really
         -- happened, or this stays today's default exactly as before.
         payment_status    = CASE WHEN v_covers THEN 'paid' ELSE p.payment_status END,
         status            = CASE WHEN v_covers THEN 'paid' ELSE p.status END,
         paid_at           = CASE WHEN v_covers THEN coalesce(p_paid_at, now()) ELSE p.paid_at END
   WHERE p.id = p_purchase_id;

  IF NOT v_covers THEN
    PERFORM log_status_event('order', p_purchase_id, 'partial_payment',
      'Part payment of ' || to_char(v_this, 'FM999999990.00')
        || ' by ' || lower(btrim(coalesce(p_method,'zelle')))
        || ' — ' || to_char(coalesce(v_pur.amount,0) - (v_settled + v_this), 'FM999999990.00')
        || ' still outstanding', v_pur.org_id);
    RETURN 'part_paid';
  END IF;

  PERFORM _notify_purchase_paid(p_purchase_id);
  RETURN 'paid';
END;
$function$;

-- DROP+CREATE reset the ACL — restore it to exactly what the old signature held.
-- ⚠️ The database's default privileges hand EXECUTE to anon on every fresh
-- function; the old signature had no anon grant, so it is revoked explicitly.
REVOKE ALL ON FUNCTION public.mark_purchase_paid(uuid, numeric, text, text, timestamp with time zone, text, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.mark_purchase_paid(uuid, numeric, text, text, timestamp with time zone, text, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.mark_purchase_paid(uuid, numeric, text, text, timestamp with time zone, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.mark_purchase_paid(uuid, numeric, text, text, timestamp with time zone, text, text) TO service_role;

-- ── 5 · the undo (D19: a value-moving action can be backed out) ────────────────

CREATE OR REPLACE FUNCTION public.revert_purchase_writedown(
  p_purchase_id uuid,
  p_reason text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_pur     purchases%ROWTYPE;
  v_settled numeric;
  v_covers  boolean;
  v_prior   text;
BEGIN
  IF NOT (coalesce(auth.role(), '') = 'service_role' OR has_staff_access()) THEN
    RAISE EXCEPTION 'operator access required';
  END IF;

  SELECT * INTO v_pur FROM purchases
   WHERE id = p_purchase_id AND deleted_at IS NULL
   FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'unknown purchase: %', p_purchase_id; END IF;
  IF v_pur.payment_disposition = 'paid' THEN
    RAISE EXCEPTION 'nothing to revert — this order carries no write-down';
  END IF;

  -- The value the write-down granted may already be consumed. An undo would then
  -- bill for something already delivered under the comp — refuse it.
  IF EXISTS (SELECT 1 FROM lesson_credits lc
              WHERE lc.purchase_id = p_purchase_id
                AND lc.deleted_at IS NULL
                AND lc.credits_remaining < lc.credits_total) THEN
    RAISE EXCEPTION 'credits from this order have already been used — the write-down cannot be undone';
  END IF;

  SELECT coalesce(sum(amount), 0) INTO v_settled
    FROM payments
   WHERE purchase_id = p_purchase_id AND status = 'paid' AND deleted_at IS NULL;
  v_covers := v_settled >= coalesce(v_pur.amount, 0) - 0.005;

  v_prior := v_pur.payment_disposition;

  -- Money that actually arrived stays recorded (payments rows untouched). Only
  -- the disposition and the closed state come off: the order reopens owing the
  -- difference, exactly as a declared-but-unconfirmed order does (D23).
  UPDATE purchases p
     SET payment_disposition = 'paid',
         write_down_amount   = 0,
         write_down_reason   = NULL,
         amount_paid         = v_settled,
         payment_method      = CASE WHEN p.payment_method = 'comp' THEN NULL ELSE p.payment_method END,
         payment_status      = CASE WHEN v_covers THEN 'paid'
                                    WHEN v_settled > 0 THEN 'pending'
                                    ELSE 'unpaid' END,
         status              = CASE WHEN v_covers THEN 'paid' ELSE 'awaiting_payment' END,
         paid_at             = CASE WHEN v_covers THEN p.paid_at ELSE NULL END
   WHERE p.id = p_purchase_id;

  PERFORM log_status_event('order', p_purchase_id, 'write_down_reverted',
    'Write-down of ' || to_char(v_pur.write_down_amount, 'FM999999990.00')
      || ' (' || v_prior || ') undone — the order reopens owing '
      || to_char(greatest(coalesce(v_pur.amount, 0) - v_settled, 0), 'FM999999990.00')
      || coalesce(' — ' || nullif(btrim(coalesce(p_reason, '')), ''), ''), v_pur.org_id);

  RETURN jsonb_build_object(
    'reverted',        true,
    'was',             v_prior,
    'write_down_was',  v_pur.write_down_amount,
    'now_owing',       greatest(coalesce(v_pur.amount, 0) - v_settled, 0),
    'payment_status',  CASE WHEN v_covers THEN 'paid' WHEN v_settled > 0 THEN 'pending' ELSE 'unpaid' END);
END;
$function$;

REVOKE ALL ON FUNCTION public.revert_purchase_writedown(uuid, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.revert_purchase_writedown(uuid, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.revert_purchase_writedown(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.revert_purchase_writedown(uuid, text) TO service_role;

-- ── 6 · ONE period read: the lines feed the summary AND the export (R5/R6) ─────

CREATE OR REPLACE FUNCTION public.revenue_period_lines(
  p_from timestamp with time zone,
  p_to timestamp with time zone)
RETURNS TABLE (
  purchase_id uuid,
  display_code text,
  paid_at timestamp with time zone,
  client text,
  full_price numeric,
  collected numeric,
  write_down numeric,
  disposition text,
  reason text)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- Refuse rather than return an empty set that looks like a quiet month.
  IF NOT (coalesce(auth.role(), '') = 'service_role' OR coalesce(has_staff_access(), false)) THEN
    RAISE EXCEPTION 'operator access required';
  END IF;

  RETURN QUERY
  SELECT p.id,
         p.display_code,
         p.paid_at,
         coalesce(nullif(btrim(concat_ws(' ', c.first_name, c.last_name)), ''),
                  pr.email, c.email, '—'),
         coalesce(p.amount, 0),
         -- R5: an explicit zero on a paid order is ZERO collected (a comp).
         -- Only NULL falls back to `amount` — rows written before amount_paid
         -- existed keep exactly the meaning they had.
         coalesce(p.amount_paid, p.amount, 0),
         coalesce(p.write_down_amount, 0),
         p.payment_disposition,
         p.write_down_reason
    FROM purchases p
    LEFT JOIN contacts  c  ON c.id = p.buyer_contact_id
    LEFT JOIN profiles  pr ON pr.user_id = p.buyer_user_id
   WHERE p.org_id = current_org()
     AND p.deleted_at IS NULL
     AND p.payment_status = 'paid'
     AND p.paid_at IS NOT NULL
     AND p.paid_at >= p_from AND p.paid_at < p_to
   ORDER BY p.paid_at;
END;
$function$;

REVOKE ALL ON FUNCTION public.revenue_period_lines(timestamp with time zone, timestamp with time zone) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.revenue_period_lines(timestamp with time zone, timestamp with time zone) FROM anon;
GRANT EXECUTE ON FUNCTION public.revenue_period_lines(timestamp with time zone, timestamp with time zone) TO authenticated;
GRANT EXECUTE ON FUNCTION public.revenue_period_lines(timestamp with time zone, timestamp with time zone) TO service_role;

-- ── 7 · revenue_summary recognises what was COLLECTED (R5) ─────────────────────
-- Same signature — CREATE OR REPLACE, no overload, ACL untouched. All existing
-- keys keep their meaning for the ribbon/calendar; four write-down keys are added.
-- The figures aggregate revenue_period_lines — the summary and the export cannot
-- disagree because they are the same read.

CREATE OR REPLACE FUNCTION public.revenue_summary(
  p_from timestamp with time zone,
  p_to timestamp with time zone)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_span    interval;
  v_total   numeric;
  v_count   integer;
  v_down    numeric;
  v_dcount  integer;
  v_prior   numeric;
  v_pcount  integer;
  v_pdown   numeric;
  v_pdcount integer;
BEGIN
  IF NOT coalesce(has_staff_access(), false) THEN
    RAISE EXCEPTION 'operator access required';
  END IF;

  v_span := p_to - p_from;

  -- The window itself.
  SELECT coalesce(sum(l.collected), 0), count(*),
         coalesce(sum(l.write_down), 0), count(*) FILTER (WHERE l.disposition <> 'paid')
    INTO v_total, v_count, v_down, v_dcount
    FROM revenue_period_lines(p_from, p_to) l;

  -- The window of the same length immediately before it, so a figure can be
  -- read as up or down without a second call and a second definition.
  SELECT coalesce(sum(l.collected), 0), count(*),
         coalesce(sum(l.write_down), 0), count(*) FILTER (WHERE l.disposition <> 'paid')
    INTO v_prior, v_pcount, v_pdown, v_pdcount
    FROM revenue_period_lines(p_from - v_span, p_from) l;

  RETURN jsonb_build_object(
    'total',                  v_total,
    'count',                  v_count,
    'prior_total',            v_prior,
    'prior_count',            v_pcount,
    'delta',                  v_total - v_prior,
    'delta_pct',              CASE WHEN v_prior > 0 THEN round(((v_total - v_prior) / v_prior) * 100, 1) ELSE NULL END,
    'write_down_total',       v_down,
    'write_down_count',       v_dcount,
    'prior_write_down_total', v_pdown,
    'prior_write_down_count', v_pdcount,
    'from',                   p_from,
    'to',                     p_to);
END;
$function$;

-- ── 8 · the customer's copy (R4): full price · the reduction · $0 owed ─────────
-- The receipt template gains a conditional write-down paragraph. Done as data
-- (D13 — the owner edits this in the email template editor), with a version row
-- exactly as email_template_publish would write (D34's rule: a migration that
-- changes template wording saves a version — save_email_template_version is
-- admin-gated, so its two writes are made directly here, edited_by NULL).

UPDATE email_templates
   SET body = '{{#if TXN.WRITE_DOWN}}<p>Your order total was {{TXN.AMOUNT}}. {{TXN.REDUCTION_LABEL}} — {{TXN.WRITE_DOWN}} was taken off{{#if TXN.COLLECTED}}, and we received your payment of {{TXN.COLLECTED}}{{/if}}. Nothing further is owed: your balance on this order is $0.00. Thank you.</p>{{else}}<p>We received your payment{{#if TXN.AMOUNT}} of {{TXN.AMOUNT}}{{/if}}. Thank you.</p>{{/if}}
<hr/><pre style="font-family:inherit">{{ORG.FOOTER}}</pre>',
       version = version + 1,
       updated_at = now()
 WHERE email_key = 'ORDER_RECEIPT' AND deleted_at IS NULL;

INSERT INTO email_template_versions (template_id, email_key, version, title, subject, body, edited_by)
SELECT id, email_key, version, title, subject, body, NULL
  FROM email_templates
 WHERE email_key = 'ORDER_RECEIPT' AND deleted_at IS NULL;

-- The token dictionary (TOKENS ARE THE ONE LIBRARY — the picker must list them).
INSERT INTO template_tokens (template_id, namespace, field, token, kind, computed, required, party_scoped, notes)
VALUES
  (NULL, 'TXN', 'COLLECTED', '{{TXN.COLLECTED}}', 'system', true, false, false,
   'What was actually collected on the order, formatted as dollars. Empty when nothing was ($0 on a comp), so {{#if}} can hide the payment sentence. Resolved by the receipt sender from purchases.amount_paid.'),
  (NULL, 'TXN', 'WRITE_DOWN', '{{TXN.WRITE_DOWN}}', 'system', true, false, false,
   'The written-down dollars on a discounted or comped order (purchases.write_down_amount). Empty on an ordinary paid order, so {{#if TXN.WRITE_DOWN}} selects the reduced-price receipt wording.'),
  (NULL, 'TXN', 'REDUCTION_LABEL', '{{TXN.REDUCTION_LABEL}}', 'system', true, false, false,
   'The customer-facing word for the write-down: "Discount" on a discounted order, "Complimentary" on a comped one. Empty on an ordinary paid order.')
ON CONFLICT DO NOTHING;
