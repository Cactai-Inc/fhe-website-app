-- CREDITFIX — credits mint from what was bought, not from a regex on the name.
--
-- TASK-FLOWTRACE-REPORT §8 (F8) and §1 (F2), prod-verified, not re-derived here.
-- `_provision_purchase_for_offerings` mints `lesson_credits` with
-- count = a regex on the offering's display name ('(\d+)-Lesson'), else 1 if
-- price_unit='session', else nothing. offerings.unit_count is never read.
-- Since book_open_slot is credit-gated, every 4-Class Pack / monthly buyer got
-- ZERO bookable credits (up to $880/mo), and a horse-segment session SKU
-- (Full Body Clip, a grooming service) minted a bookable LESSON credit it had
-- no business granting (F2).
--
-- THIRD KNOWN INSTANCE of a later migration silently undoing an earlier fix:
--   20260726010000_phase2_service_credits_horse_gate.sql already minted from
--   unit_count and tagged credits with offering_id.
--   20260802020000_u3_payment_notifications.sql:146 re-declared the function
--   from an OLDER body and reverted BOTH the count formula and the tag.
--   20260812T1600_bookwrite_booking_writers_record_relationships.sql then
--   re-declared it AGAIN and restored the offering_id/purchase_id TAGGING
--   (comment: "the credit records the purchase that granted it and the
--   offering it is for") but did NOT touch the count formula — the regex
--   and the missing segment gate rode through BOOKWRITE untouched. So prod
--   today tags credits correctly but still mints the wrong count. This
--   migration is the restoration; the PGlite test below exists so a fourth
--   revert fails loudly.
--
-- SEGMENT GATE — verified against prod rows, NOT service_type='RIDING_LESSON':
--   the task brief's suggested gate looked right but breaks on real data —
--   '4-Class Pack' (expected to mint 4, per the FLOWTRACE mint table) has
--   service_type='HORSEMANSHIP_TRAINING', not 'RIDING_LESSON'. What actually
--   separates "mints a lesson credit" from "mints nothing" in prod is
--   offerings.segment: 'horse' (HORSE_CLIPPING/EXERCISE/TRAINING) vs 'rider'
--   (RIDING_LESSON/HORSEMANSHIP_TRAINING/JUMPER_TRAINING). That is also
--   EXACTLY the predicate book_open_slot already uses to decide 'lesson'
--   (credit-gated) vs 'care' (o.segment = 'horse' THEN 'care' ELSE 'lesson')
--   — so gating the mint on segment <> 'horse' keeps minting and consumption
--   in lockstep by construction, using one existing axis instead of adding a
--   second one that can drift from it.
--
-- RECURRING/MONTHLY SKUs — explicitly out of scope (TASK-BOOKLINK §B4 owns
--   their entitlement model: mint per month, expire at month end, no
--   carryover). Gating on config_kind='scheduled' means they mint nothing
--   after this change too — same zero as today, but now by declared scope,
--   not by an accidental regex/name miss. BOOKLINK inherits a clean seam:
--   no code here assumes anything about what a recurring SKU should grant.
--
-- HORSE-GATE TWIN-KEY BUG (task item 4) — VERIFIED ALREADY FIXED, not touched
--   here. The brief named my_horse_onboarding_state
--   (20260714350000_horse_onboarding_state.sql) as keying on
--   `buyer_user_id = auth.uid()` alone. That was true of the ORIGINAL
--   20260714350000 body, but 20260726010000 §6 already rewrote it to the
--   two-key idiom (`pu.buyer_contact_id = v_contact OR pu.buyer_user_id =
--   auth.uid()`), and pg_get_functiondef confirms that is prod's LIVE body
--   today, byte-identical to that rewrite. Nothing since has reverted it.
--   Re-applying the fix here would be a no-op; the PGlite test below still
--   exercises it as a provisioned (contact-keyed) buyer per the task's own
--   test plan, so a future revert of THIS twin-key check is also caught.
--
-- No BEGIN/COMMIT in this file per repo convention (this journal is
-- hand-replayed via psql, not through a migrations table) — the dry-run
-- wrapper below supplies the transaction.

-- Defensive, not a real prod change: prod already carries this column (added
-- by 20260812T1600_bookwrite_..., which this migration does not otherwise
-- depend on or duplicate) but a function that writes to lesson_credits.
-- purchase_id should not rely on some other migration having added it first.
-- No-op on prod; makes this file correct standalone against any base schema.
ALTER TABLE public.lesson_credits
  ADD COLUMN IF NOT EXISTS purchase_id uuid REFERENCES public.purchases(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS lesson_credits_purchase_idx
  ON public.lesson_credits (purchase_id) WHERE purchase_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public._provision_purchase_for_offerings(p_org_id uuid, p_contact_id uuid, p_client_id uuid, p_offering_ids uuid[], p_mark_paid boolean DEFAULT false, p_payment_method text DEFAULT NULL::text, p_notes text DEFAULT NULL::text, p_partial_amount numeric DEFAULT 0)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_purchase uuid;
  v_total    numeric;
  v_paid     numeric;
  v_item     record;
  v_units    integer;
BEGIN
  IF array_length(p_offering_ids, 1) IS NULL THEN
    RETURN NULL;  -- nothing to purchase
  END IF;

  SELECT coalesce(sum(o.price_amount), 0) INTO v_total
    FROM offerings o WHERE o.id = ANY(p_offering_ids);

  -- amount_paid: full total when marked paid; else the (clamped) partial amount.
  v_paid := CASE
    WHEN p_mark_paid THEN v_total
    ELSE least(greatest(coalesce(p_partial_amount, 0), 0), v_total)
  END;

  -- payment_status CHECK allows unpaid|pending|paid. A partial payment is
  -- 'pending' (some paid, balance owed) with the exact paid figure in amount_paid.
  INSERT INTO purchases (org_id, buyer_contact_id, status, amount, amount_paid,
                         payment_method, payment_status, payment_reference, paid_at, notes)
    VALUES (p_org_id, p_contact_id,
            CASE WHEN p_mark_paid THEN 'paid' ELSE 'awaiting_payment' END,
            v_total, v_paid, p_payment_method,
            CASE WHEN p_mark_paid THEN 'paid'
                 WHEN v_paid > 0  THEN 'pending'
                 ELSE 'unpaid' END,
            CASE WHEN p_mark_paid THEN 'Provisioned — paid in full via ' || coalesce(p_payment_method, 'offline payment')
                 WHEN v_paid > 0  THEN 'Provisioned — partial ' || v_paid::text || ' via ' || coalesce(p_payment_method, 'offline payment') END,
            CASE WHEN p_mark_paid THEN now() END,
            coalesce(p_notes, 'Provisioned invitation'))
    RETURNING id INTO v_purchase;

  INSERT INTO purchase_items (org_id, purchase_id, offering_id, label, price_amount, price_unit, quantity)
  SELECT p_org_id, v_purchase, o.id, o.name, o.price_amount, o.price_unit, 1
    FROM offerings o WHERE o.id = ANY(p_offering_ids);

  -- CREDITFIX: mint = offerings.unit_count * purchase_items.quantity for
  -- scheduled SKUs whose segment isn't 'horse'. The name regex is gone.
  FOR v_item IN
    SELECT o.id AS offering_id, o.name, o.unit_count, pi.quantity
      FROM purchase_items pi
      JOIN offerings o ON o.id = pi.offering_id
     WHERE pi.purchase_id = v_purchase
       AND o.config_kind = 'scheduled'
       AND o.segment <> 'horse'
       AND o.unit_count IS NOT NULL
       AND o.unit_count > 0
  LOOP
    v_units := v_item.unit_count * coalesce(v_item.quantity, 1);
    INSERT INTO lesson_credits (org_id, client_id, offering_id, purchase_id,
                                package_key, credits_total, credits_remaining)
      VALUES (p_org_id, p_client_id, v_item.offering_id, v_purchase,
              v_item.name, v_units, v_units);
  END LOOP;

  -- U3(a): a purchase that owes money raises the standing "payment due" pair
  -- (buyer + staff). The helper no-ops when the purchase was provisioned paid.
  PERFORM notify_purchase_unpaid(v_purchase);

  RETURN v_purchase;
END;
$function$;
