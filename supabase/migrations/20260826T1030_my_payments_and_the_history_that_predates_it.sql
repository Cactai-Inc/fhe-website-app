-- THE LEDGER READ, AND THE HISTORY THAT PREDATES THE LEDGER.
--
-- Owner, 2026-08-25: "My Payments is a history ledger showing every time a payment
-- page was engaged with and what it saved and what its assocaited with, when it was
-- done, all the changes made if any exist, and the fuller picture of the status and
-- timestamps... the entries would show the meta data for things like when the order
-- was submitted, when it was approved, when payment was submitted, when it was
-- marked paid, what payment method was used, and if there were any issues."
--
-- ⚠️ ONE ENTRY SPANS TWO ROWS, AND CR-27 IS WHY. "When the order was submitted"
-- and "when it was approved" are different facts on different records: under CR-27
-- approving IS creating the order, so the SUBMISSION is a `requests` row and the
-- ORDER is the `purchases` row approval creates. The read below stitches them via
-- `purchases.request_id`, which already exists.

BEGIN;

-- ── BACKFILL: every order that has ever carried payment information ─────────
-- Without this the ledger opens empty for people who have already paid, which
-- would read as "we have no record of your money".
INSERT INTO payments (org_id, purchase_id, payer_contact_id, method, amount, reference,
                      status, declared_at, confirmed_at, notes)
SELECT p.org_id, p.id, p.buyer_contact_id,
       lower(btrim(coalesce(nullif(p.client_reported_method,''), nullif(p.payment_method,''), 'zelle'))),
       greatest(coalesce(nullif(p.amount_paid, 0), p.amount, 0), 0.01),
       coalesce(nullif(btrim(coalesce(p.client_reported_reference,'')),''), p.payment_reference),
       CASE WHEN p.payment_status = 'paid' THEN 'paid'
            WHEN coalesce(p.client_claim_status,'') = 'declined' THEN 'declined'
            ELSE 'pending' END,
       coalesce(p.client_reported_at, p.created_at),
       CASE WHEN p.payment_status = 'paid' THEN coalesce(p.paid_at, p.updated_at) END,
       'Backfilled 2026-08-26 from the order''s own payment columns — this order '
       || 'predates payment records, so it has one entry rather than a history.'
  FROM purchases p
 WHERE p.deleted_at IS NULL
   -- an order nobody has chosen a method for is AWAITING PAYMENT, which is the
   -- ABSENCE of an entry, not an entry. Owner: "until they make a selection its
   -- awaiting payment."
   AND coalesce(nullif(btrim(coalesce(p.client_reported_method,'')),''),
                nullif(btrim(coalesce(p.payment_method,'')),'')) IS NOT NULL
   AND NOT EXISTS (SELECT 1 FROM payments x WHERE x.purchase_id = p.id);

-- ── THE READ ────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.my_payments()
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT coalesce(jsonb_agg(e ORDER BY e->>'declared_at' DESC), '[]'::jsonb)
  FROM (
    SELECT jsonb_build_object(
      'payment_id',     pay.id,
      'payment_number', pay.display_code,
      'order_id',       pur.id,
      'order_number',   pur.display_code,
      'status',         pay.status,
      'method',         pay.method,
      'amount',         pay.amount,
      'reference',      pay.reference,
      'declared_at',    pay.declared_at,
      'confirmed_at',   pay.confirmed_at,
      'decline_reason', pay.decline_reason,
      -- ⚠️ EDITABLE ONLY WHILE PENDING, AND ONLY THE METHOD (CR-76). Not the
      -- amount, not who pays.
      'can_change_method', (pay.status = 'pending'),
      'what',           coalesce((SELECT string_agg(pi.label, ', ' ORDER BY pi.created_at)
                                    FROM purchase_items pi WHERE pi.purchase_id = pur.id), 'Order'),
      'order_total',    pur.amount,
      -- the order-side timestamps he listed, stitched across CR-27's two rows
      'submitted_at',   coalesce(req.created_at, pur.created_at),
      'approved_at',    pur.created_at,
      'marked_paid_at', pur.paid_at,
      -- "all the changes made if any exist" — the entry's own audit trail
      'history',        coalesce((
          SELECT jsonb_agg(jsonb_build_object(
                   'at', se.created_at, 'code', se.status,
                   'label', coalesce(v.display_name, se.status), 'detail', se.detail)
                 ORDER BY se.created_at)
            FROM status_events se
            LEFT JOIN status_events_vocab v
              ON v.entity_type = 'payment' AND v.code = se.status
           WHERE se.entity_type = 'payment' AND se.entity_id = pay.id), '[]'::jsonb)
    ) AS e
    FROM payments pay
    JOIN purchases pur ON pur.id = pay.purchase_id
    LEFT JOIN requests req ON req.id = pur.request_id
   WHERE pay.deleted_at IS NULL
     AND pur.deleted_at IS NULL
     AND pay.payer_contact_id = current_contact_id()
  ) q;
$function$;

REVOKE ALL ON FUNCTION public.my_payments() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.my_payments() TO authenticated;

COMMIT;
