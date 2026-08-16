-- TASK FEECHOICE — staff choose the fee on a reschedule: apply it, pick a
-- different one, or waive it.
--
-- Owner: "we need reschedule options; apply fee, select the fee to apply or no
-- fee." + "for things where they contact us, its not an in app request so its
-- something the staff handle on our side."
--
-- booking_change_fees (the 48h/24h/8h schedule) is NOT touched by this
-- migration — it stays the policy transcription, read-only from this flow.
-- This is the PER-DECISION override: a new table records what was actually
-- charged (or waived) and why, and the charge settles through the ONE existing
-- payment spine — mark_purchase_paid (D6) — the SAME function CASHCONFIRM's
-- claim→confirm and ZELLECLOSE's auto-match both settle through. No second
-- write path: a fee purchase is an ordinary `purchases` row (offering_id NULL
-- on its line item, so none of the fulfillment/credit/affiliation triggers
-- fire — verified against generate_fulfillment_units,
-- _mint_credits_for_purchase_item, promote_buyer_from_offering,
-- attach_first_purchase_policies, all of which no-op on a NULL/unmatched
-- offering) — so it already appears in PaymentReviewPage's Outstanding/Client
-- claims/Recently paid buckets and on the client's own /order/:id page with
-- zero new frontend plumbing for settlement.

-- ── the per-decision record (F4) ─────────────────────────────────────────────
CREATE TABLE booking_fee_charges (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id             uuid NOT NULL REFERENCES organizations(id),
  booking_id         uuid NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  -- set when the charge arose from a reschedule/cancel/defer decision (F1);
  -- NULL for a standalone no-show/late-start charge with no request (F3).
  change_request_id  uuid REFERENCES booking_change_requests(id) ON DELETE SET NULL,
  -- the settlement vehicle — one payment spine (D6). NULL only if the purchase
  -- insert somehow failed to attach, which the RPC below never does in practice.
  purchase_id        uuid REFERENCES purchases(id) ON DELETE SET NULL,
  fee_kind           text NOT NULL CHECK (fee_kind IN
                        ('computed', 'no_show', 'late_start_before', 'late_start_after', 'custom', 'waived')),
  policy_clause      text,          -- '§6' / '§7', NULL for custom/waived
  policy_wording     text NOT NULL, -- what the client/staff see this charge is FOR
  amount             numeric NOT NULL CHECK (amount >= 0),
  -- required for every choice except the computed default (F1: "a reason is
  -- required for anything other than the computed amount").
  reason             text,
  decided_by         uuid NOT NULL REFERENCES profiles(user_id),
  decided_at         timestamptz NOT NULL DEFAULT now(),
  -- D11/D14-style correction: never mutate a settled fee. A correction points
  -- the old row at its replacement instead of editing amount/reason in place.
  superseded_by      uuid REFERENCES booking_fee_charges(id),
  created_at         timestamptz NOT NULL DEFAULT now(),
  CHECK (fee_kind = 'computed' OR (reason IS NOT NULL AND btrim(reason) <> ''))
);
CREATE INDEX booking_fee_charges_booking_idx ON booking_fee_charges (booking_id);
CREATE INDEX booking_fee_charges_change_idx ON booking_fee_charges (change_request_id);
CREATE INDEX booking_fee_charges_purchase_idx ON booking_fee_charges (purchase_id);

ALTER TABLE booking_fee_charges ENABLE ROW LEVEL SECURITY;

CREATE POLICY booking_fee_charges_staff_all ON booking_fee_charges
  FOR ALL TO authenticated
  USING (org_id = current_org() AND has_staff_access())
  WITH CHECK (org_id = current_org() AND has_staff_access());

CREATE POLICY booking_fee_charges_client_read ON booking_fee_charges
  FOR SELECT TO authenticated
  USING (booking_id IN (SELECT b.id FROM bookings b WHERE b.client_id = current_client_id()));

COMMENT ON TABLE booking_fee_charges IS
  'FEECHOICE F4: one row per staff fee decision on a booking — which policy '
  'clause was invoked (or none, for a waiver/custom amount), the amount, the '
  'required reason, who decided and when, and the purchases row it settles '
  'through. Never updated after creation except superseded_by — a correction '
  'is a new row, per D11/D14 (nothing is mutated, corrections supersede).';

-- ── the chooser RPC (F1 default+alternate, F3 standalone) ───────────────────
CREATE OR REPLACE FUNCTION public.apply_booking_fee(
  p_booking_id  uuid,
  p_fee_kind    text,
  p_change_id   uuid    DEFAULT NULL,
  p_amount      numeric DEFAULT NULL,
  p_reason      text    DEFAULT NULL,
  -- correction path: supersede a prior charge instead of leaving two active
  -- charges for the same decision.
  p_supersedes  uuid    DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_b         bookings%ROWTYPE;
  v_contact   uuid;
  v_amount    numeric;
  v_clause    text;
  v_wording   text;
  v_reason    text := nullif(btrim(coalesce(p_reason, '')), '');
  v_purchase  uuid;
  v_charge    uuid;
  v_old       booking_fee_charges%ROWTYPE;
BEGIN
  IF NOT has_staff_access() THEN
    RAISE EXCEPTION 'operator access required';
  END IF;
  IF p_fee_kind NOT IN ('computed', 'no_show', 'late_start_before', 'late_start_after', 'custom', 'waived') THEN
    RAISE EXCEPTION 'unknown fee kind: %', p_fee_kind;
  END IF;

  SELECT * INTO v_b FROM bookings WHERE id = p_booking_id AND org_id = current_org();
  IF NOT FOUND THEN RAISE EXCEPTION 'booking not found'; END IF;

  IF p_change_id IS NOT NULL THEN
    IF NOT EXISTS (SELECT 1 FROM booking_change_requests WHERE id = p_change_id AND booking_id = p_booking_id) THEN
      RAISE EXCEPTION 'change request does not belong to this booking';
    END IF;
  END IF;

  -- F1: a reason is required for anything other than the computed default.
  IF p_fee_kind <> 'computed' AND v_reason IS NULL THEN
    RAISE EXCEPTION 'a reason is required for %', p_fee_kind;
  END IF;

  -- resolve amount + the wording the client/staff will see (TRAPS/F1: every
  -- option carries the policy wording so staff know which clause they invoke)
  IF p_fee_kind = 'computed' THEN
    v_amount := reschedule_fee(v_b.org_id, v_b.starts_at);
    v_clause := '§6';
    SELECT f.label INTO v_wording
      FROM booking_change_fees f
     WHERE f.org_id = v_b.org_id AND f.active
       AND v_b.starts_at - now() < make_interval(hours => f.hours_before)
     ORDER BY f.hours_before ASC LIMIT 1;
    v_wording := coalesce(v_wording, CASE WHEN v_amount > 0 THEN 'Rescheduling fee' ELSE 'No rescheduling fee applies' END);
  ELSIF p_fee_kind = 'no_show' THEN
    v_amount  := 75.00;
    v_clause  := '§6';
    v_wording := 'No-call/no-show — client did not attend and did not contact us before the scheduled start time (Company Policies §6)';
  ELSIF p_fee_kind = 'late_start_before' THEN
    v_amount  := 30.00;
    v_clause  := '§7';
    v_wording := 'Late start — contacted us before the start time, no later slot was available (Company Policies §7)';
  ELSIF p_fee_kind = 'late_start_after' THEN
    v_amount  := 40.00;
    v_clause  := '§7';
    v_wording := 'Late start — contacted us after the start time, we could not accommodate (Company Policies §7)';
  ELSIF p_fee_kind = 'custom' THEN
    IF p_amount IS NULL OR p_amount < 0 THEN RAISE EXCEPTION 'a non-negative amount is required for a custom fee'; END IF;
    v_amount  := p_amount;
    v_clause  := NULL;
    v_wording := v_reason;
  ELSE -- waived
    v_amount  := 0;
    v_clause  := NULL;
    v_wording := 'Fee waived — ' || v_reason;
  END IF;

  -- the billable party: contact first (order/receipt ownership convention
  -- throughout this codebase), account login as the notification target.
  SELECT cl.contact_id INTO v_contact FROM clients cl WHERE cl.id = v_b.client_id AND cl.deleted_at IS NULL;
  IF v_contact IS NULL AND v_b.account_user_id IS NULL THEN
    RAISE EXCEPTION 'this booking has no billable party';
  END IF;

  -- one payment spine (D6): an ordinary purchases row, offering_id NULL so no
  -- fulfillment unit / credit / affiliation trigger fires on the line item.
  INSERT INTO purchases (org_id, buyer_contact_id, buyer_user_id, status, amount, payment_status, notes)
  VALUES (v_b.org_id, v_contact, v_b.account_user_id, 'awaiting_payment', v_amount, 'unpaid',
          coalesce('Booking fee — ' || v_wording, 'Booking fee'))
  RETURNING id INTO v_purchase;

  INSERT INTO purchase_items (org_id, purchase_id, offering_id, label, price_amount, quantity)
  VALUES (v_b.org_id, v_purchase, NULL, left(v_wording, 500), v_amount, 1);

  -- a waiver settles at zero through the SAME function every other charge
  -- settles through — never a second write path, not even for $0.
  IF v_amount = 0 THEN
    PERFORM mark_purchase_paid(v_purchase, 0, v_reason, 'waived');
  ELSE
    PERFORM notify_purchase_unpaid(v_purchase);
  END IF;

  INSERT INTO booking_fee_charges (org_id, booking_id, change_request_id, purchase_id,
                                   fee_kind, policy_clause, policy_wording, amount, reason, decided_by)
  VALUES (v_b.org_id, p_booking_id, p_change_id, v_purchase,
          p_fee_kind, v_clause, v_wording, v_amount, v_reason, auth.uid())
  RETURNING id INTO v_charge;

  IF p_supersedes IS NOT NULL THEN
    SELECT * INTO v_old FROM booking_fee_charges WHERE id = p_supersedes AND org_id = v_b.org_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'the charge being corrected was not found'; END IF;
    IF v_old.superseded_by IS NOT NULL THEN RAISE EXCEPTION 'that charge has already been superseded'; END IF;
    -- an unpaid superseded charge is voided so it stops showing as owed
    -- alongside its replacement; a paid one is left exactly as it is (D11 —
    -- nothing settled is mutated or purged).
    UPDATE purchases SET status = 'void'
     WHERE id = v_old.purchase_id AND payment_status <> 'paid';
    UPDATE booking_fee_charges SET superseded_by = v_charge WHERE id = p_supersedes;
  END IF;

  RETURN jsonb_build_object('charge_id', v_charge, 'purchase_id', v_purchase, 'amount', v_amount, 'fee_kind', p_fee_kind);
END;
$function$;

COMMENT ON FUNCTION public.apply_booking_fee(uuid, text, uuid, numeric, text, uuid) IS
  'FEECHOICE F1/F3: staff choose the fee on a booking — the computed reschedule '
  'amount, a named policy fee (no-show $75, late-start $30/$40), a custom '
  'amount, or a waiver — and it settles through mark_purchase_paid, the same '
  'spine CASHCONFIRM/ZELLECLOSE use. booking_change_fees is read-only here, '
  'never written. p_supersedes corrects a prior charge (D11: never mutate a '
  'settled fee) instead of editing it in place.';

REVOKE ALL ON FUNCTION public.apply_booking_fee(uuid, text, uuid, numeric, text, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.apply_booking_fee(uuid, text, uuid, numeric, text, uuid) TO authenticated, service_role;
