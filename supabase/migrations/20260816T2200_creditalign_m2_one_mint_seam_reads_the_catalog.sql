-- TASK CREDITALIGN m2 — ONE place mints entitlement, and it reads the catalog.
--
-- THE MEASURED FACTS THIS FIXES (prod, 2026-08-16):
--   * All ten active recurring SKUs mint ZERO. `_provision_purchase_for_offerings`'s
--     CREDITFIX loop is gated `config_kind = 'scheduled'`, so `1x Weekly Lesson`,
--     `2x Weekly Lessons`, both `(With your horse)` variants and all six horse-care
--     recurring SKUs produce no bookable entitlement at all. A client on a monthly
--     plan has paid and can book nothing.
--   * `_provision_purchase_for_offerings` is not the only way a line is bought, and
--     it is the ONLY thing that has ever minted. `createDraftOrder`
--     (src/lib/api.ts) inserts `purchase_items` straight from the shop checkout and
--     mints NOTHING — verified: `select proname from pg_proc where prosrc ilike
--     '%insert into purchase_items%'` returns exactly one function, and no trigger on
--     `purchase_items` or `purchases` touches `lesson_credits`. So a member buying an
--     8-Lesson Punch Card through the catalog gets zero credits even after CREDITFIX.
--     That is why this migration moves minting off the provisioning function and onto
--     the purchase itself.
--
-- THIS BUG HAS BEEN FIXED AND SILENTLY REVERTED THREE TIMES (20260726010000 →
-- reverted by 20260802020000 → BOOKWRITE restored the tag but not the formula →
-- CREDITFIX). Each revert happened because the mint lived INSIDE a big function that
-- somebody later re-declared from an older body. It now lives in its own small
-- function that nothing else has any reason to re-declare, and
-- test/db/creditalign_recurring_entitlement.test.ts asserts the whole SKU table, so a
-- fourth revert fails loudly.
--
-- NOTHING HERE READS A DISPLAY NAME. The inputs are `config_kind`, `segment`,
-- `unit_count`, `weekly_frequency`, `purchase_items.quantity` and
-- `purchase_items.config->>'recurring_day'`. CREDITFIX removed one name regex the same
-- week the names changed (`1x Weekly` → `1x Weekly Lesson`); nothing reintroduces one.

-- ════════════════════════════════════════════════════════════════════════════
-- 1. THE FORMULA, ALONE, SO IT CAN BE ASSERTED DIRECTLY
-- ════════════════════════════════════════════════════════════════════════════
/** How many sessions a recurring line is worth over a window.
 *
 *  weekly_frequency × (occurrences of the plan's weekday in the window) × quantity.
 *
 *  THE PARTIAL FIRST MONTH is handled by the window, not by a special case: a plan
 *  bought on the 20th is minted over [20th .. month end], so it gets only the
 *  weekday occurrences that are actually left. That is proration by construction, and
 *  it agrees with the prorated amount ONBOARD's payment flow charges — both are
 *  "the part of the month you are buying", counted the same way.
 *
 *  THE ANCHOR WEEKDAY is the plan's chosen day when staff or the member has set one
 *  (`purchase_items.config->>'recurring_day'`, written by set_recurring_day), and
 *  otherwise the weekday the window opens on. A plan is almost always bought before
 *  its day is chosen, so without the fallback the first month would mint nothing. When
 *  the day is later set, set_recurring_day re-trues the current month (m4). */
CREATE OR REPLACE FUNCTION public._recurring_allotment(
  p_weekly_frequency integer,
  p_anchor_day       text,
  p_from             date,
  p_to               date,
  p_quantity         integer DEFAULT 1
) RETURNS integer
LANGUAGE sql
STABLE
SET search_path TO 'public'
AS $function$
  SELECT CASE WHEN p_from > p_to THEN 0 ELSE
    greatest(coalesce(p_weekly_frequency, 1), 1)
    * greatest(coalesce(p_quantity, 1), 1)
    * (SELECT count(*)::int
         FROM generate_series(p_from, p_to, interval '1 day') d
        WHERE to_char(d, 'Dy') = coalesce(nullif(btrim(coalesce(p_anchor_day, '')), ''),
                                          to_char(p_from, 'Dy')))
  END;
$function$;

COMMENT ON FUNCTION public._recurring_allotment(integer, text, date, date, integer) IS
  'CREDITALIGN: weekly_frequency × weekday-occurrences-in-window × quantity. The window '
  'IS the proration — a mid-month purchase is minted over [purchase date .. month end]. '
  'Anchor weekday = the plan''s recurring_day, else the weekday the window opens on.';

-- ════════════════════════════════════════════════════════════════════════════
-- 2. THE ONE MINT
-- ════════════════════════════════════════════════════════════════════════════
/** Mint the entitlement one purchased line is worth. Idempotent — the unique index
 *  from m1 absorbs a second call for the same (line, period), so this is safe to call
 *  from a trigger, from a sweep and from the monthly roll without any of them knowing
 *  about the others.
 *
 *  p_period_start: NULL mints the line's OWN month (the first month, prorated from the
 *  purchase date). The monthly roll passes an explicit month start.
 *
 *  Returns the number of credits minted (0 when there was nothing to mint, or when the
 *  row already existed). */
CREATE OR REPLACE FUNCTION public._mint_credits_for_purchase_item(
  p_item_id      uuid,
  p_client_id    uuid DEFAULT NULL,
  p_period_start date DEFAULT NULL
) RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_it     purchase_items%ROWTYPE;
  v_pu     purchases%ROWTYPE;
  v_off    offerings%ROWTYPE;
  v_client uuid := p_client_id;
  v_units  integer := 0;
  v_period date;
  v_from   date;
  v_to     date;
  v_made   integer := 0;
BEGIN
  SELECT * INTO v_it FROM purchase_items WHERE id = p_item_id;
  IF NOT FOUND THEN RETURN 0; END IF;

  SELECT * INTO v_pu FROM purchases WHERE id = v_it.purchase_id AND deleted_at IS NULL;
  IF NOT FOUND THEN RETURN 0; END IF;

  -- A DRAFT ORDER IS NOT A PURCHASE. Nothing has been committed to, so nothing is
  -- entitled. The companion trigger on `purchases` mints the moment the order leaves
  -- draft, so the shop's build-a-basket flow is covered without handing out bookable
  -- credits for an abandoned cart.
  IF v_pu.status = 'draft' THEN RETURN 0; END IF;

  SELECT * INTO v_off FROM offerings WHERE id = v_it.offering_id;
  IF NOT FOUND OR v_off.config_kind IS NULL THEN RETURN 0; END IF;

  -- Whose entitlement. The caller may name the client (the provisioning spine knows
  -- it); otherwise resolve it from the buyer, contact first then login.
  IF v_client IS NULL THEN
    SELECT cl.id INTO v_client
      FROM clients cl
     WHERE cl.deleted_at IS NULL
       AND (cl.contact_id = v_pu.buyer_contact_id
            OR cl.contact_id = (SELECT pr.contact_id FROM profiles pr WHERE pr.user_id = v_pu.buyer_user_id))
     ORDER BY (cl.contact_id = v_pu.buyer_contact_id) DESC
     LIMIT 1;
  END IF;
  IF v_client IS NULL THEN RETURN 0; END IF;

  IF v_off.config_kind = 'scheduled' THEN
    -- CREDITFIX's ruling, unchanged and re-proven by this task's test: a session pack
    -- mints unit_count × quantity, and a HORSE-segment scheduled SKU mints nothing
    -- (a Full Body Clip is not a lesson credit — FLOWTRACE F2). No period, no expiry.
    IF v_off.segment = 'horse' OR coalesce(v_off.unit_count, 0) <= 0 THEN RETURN 0; END IF;
    v_units := v_off.unit_count * greatest(coalesce(v_it.quantity, 1), 1);

    INSERT INTO lesson_credits (org_id, client_id, offering_id, purchase_id, purchase_item_id,
                                package_key, credits_total, credits_remaining)
    VALUES (v_pu.org_id, v_client, v_off.id, v_pu.id, v_it.id,
            coalesce(v_it.label, v_off.name), v_units, v_units)
    ON CONFLICT DO NOTHING;
    GET DIAGNOSTICS v_made = ROW_COUNT;
    RETURN CASE WHEN v_made > 0 THEN v_units ELSE 0 END;

  ELSIF v_off.config_kind = 'recurring' THEN
    -- BOTH SEGMENTS. The owner named lessons and horse care, and all six horse-care
    -- recurring SKUs were equally broken. book_open_slot is already segment-aware, so
    -- a horse-care allotment is consumed by the same path a lesson allotment is.
    v_period := coalesce(p_period_start, date_trunc('month', v_pu.created_at)::date);
    v_from   := greatest(v_pu.created_at::date, v_period);
    v_to     := (v_period + interval '1 month - 1 day')::date;

    -- A plan that has been stopped is not entitled for a month that starts after it ended.
    IF v_it.plan_ends_on IS NOT NULL AND v_it.plan_ends_on < v_from THEN RETURN 0; END IF;
    IF v_it.plan_ends_on IS NOT NULL AND v_it.plan_ends_on < v_to THEN v_to := v_it.plan_ends_on; END IF;

    v_units := _recurring_allotment(v_off.weekly_frequency, v_it.config->>'recurring_day',
                                    v_from, v_to, v_it.quantity);
    IF v_units <= 0 THEN RETURN 0; END IF;

    INSERT INTO lesson_credits (org_id, client_id, offering_id, purchase_id, purchase_item_id,
                                package_key, credits_total, credits_remaining,
                                period_start, expires_at)
    VALUES (v_pu.org_id, v_client, v_off.id, v_pu.id, v_it.id,
            coalesce(v_it.label, v_off.name), v_units, v_units,
            v_period, (v_period + interval '1 month')::timestamptz)
    ON CONFLICT DO NOTHING;
    GET DIAGNOSTICS v_made = ROW_COUNT;
    RETURN CASE WHEN v_made > 0 THEN v_units ELSE 0 END;
  END IF;

  -- intake_*, document_transaction and inquire produce fulfillment units, not credits.
  RETURN 0;
END;
$function$;

COMMENT ON FUNCTION public._mint_credits_for_purchase_item(uuid, uuid, date) IS
  'CREDITALIGN: THE ONE MINT. Every origin — shop checkout, staff provisioning, gift '
  'redemption, a booking that creates its own order, the monthly roll — reaches '
  'entitlement through this and nothing else. Idempotent via '
  'lesson_credits_one_per_item_period. Reads config_kind/segment/unit_count/'
  'weekly_frequency/quantity/recurring_day; reads NO display name.';

REVOKE ALL ON FUNCTION public._mint_credits_for_purchase_item(uuid, uuid, date) FROM PUBLIC;
REVOKE ALL ON FUNCTION public._mint_credits_for_purchase_item(uuid, uuid, date) FROM anon;
REVOKE ALL ON FUNCTION public._mint_credits_for_purchase_item(uuid, uuid, date) FROM authenticated;
GRANT EXECUTE ON FUNCTION public._mint_credits_for_purchase_item(uuid, uuid, date) TO service_role;

-- ════════════════════════════════════════════════════════════════════════════
-- 3. THE TWO PLACES A PURCHASE BECOMES REAL
-- ════════════════════════════════════════════════════════════════════════════
/** A line lands on an order that is already live (provisioning, gift, calendar). */
CREATE OR REPLACE FUNCTION public.trg_mint_purchase_credits()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  PERFORM _mint_credits_for_purchase_item(NEW.id);
  RETURN NULL;
END;
$function$;

DROP TRIGGER IF EXISTS purchase_items_mint_credits ON purchase_items;
CREATE TRIGGER purchase_items_mint_credits
  AFTER INSERT ON purchase_items
  FOR EACH ROW EXECUTE FUNCTION trg_mint_purchase_credits();

/** A draft order stops being a draft. Its lines were skipped at insert on purpose;
 *  they mint now, all at once, idempotently. */
CREATE OR REPLACE FUNCTION public.trg_mint_credits_when_order_opens()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF coalesce(OLD.status, '') = 'draft' AND coalesce(NEW.status, '') <> 'draft' THEN
    PERFORM _mint_credits_for_purchase_item(pi.id)
       FROM purchase_items pi WHERE pi.purchase_id = NEW.id;
  END IF;
  RETURN NULL;
END;
$function$;

DROP TRIGGER IF EXISTS purchases_mint_credits ON purchases;
CREATE TRIGGER purchases_mint_credits
  AFTER UPDATE OF status ON purchases
  FOR EACH ROW EXECUTE FUNCTION trg_mint_credits_when_order_opens();

-- ════════════════════════════════════════════════════════════════════════════
-- 4. THE PROVISIONING SPINE STOPS MINTING ITS OWN WAY
-- ════════════════════════════════════════════════════════════════════════════
-- Byte-for-byte the shipped body with ONE change: CREDITFIX's inline loop is replaced
-- by a call to the shared mint. The trigger above has already run by this point (the
-- items are inserted a few lines up), so this sweep is normally a no-op — it exists to
-- supply p_client_id in the case where the buyer contact has no `clients` row of its
-- own and the trigger could not resolve one. Idempotent either way.
CREATE OR REPLACE FUNCTION public._provision_purchase_for_offerings(
  p_org_id uuid, p_contact_id uuid, p_client_id uuid, p_offering_ids uuid[],
  p_mark_paid boolean DEFAULT false, p_payment_method text DEFAULT NULL::text,
  p_notes text DEFAULT NULL::text, p_partial_amount numeric DEFAULT 0)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_purchase uuid;
  v_total    numeric;
  v_paid     numeric;
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

  -- CREDITALIGN: minting is no longer this function's business. One seam,
  -- `_mint_credits_for_purchase_item`, fired by the purchase_items trigger; this
  -- call only re-runs it with the client this caller already knows.
  PERFORM _mint_credits_for_purchase_item(pi.id, p_client_id)
     FROM purchase_items pi WHERE pi.purchase_id = v_purchase;

  IF p_mark_paid THEN
    -- ZELLECLOSE: same "payment received" trail mark_purchase_paid gives every
    -- other paid purchase — this one was just paid at creation, not by an UPDATE.
    PERFORM _notify_purchase_paid(v_purchase);
  ELSE
    -- U3(a): a purchase that owes money raises the standing "payment due" pair
    -- (buyer + staff). No-op when paid (handled above instead).
    PERFORM notify_purchase_unpaid(v_purchase);
  END IF;

  RETURN v_purchase;
END;
$function$;

-- ════════════════════════════════════════════════════════════════════════════
-- 5. THE BILLING PERIOD AND THE ALLOTMENT AGREE ON WHERE THE MONTH ENDS
-- ════════════════════════════════════════════════════════════════════════════
-- The shipped body seeded a recurring period unit as [today .. today + 1 month), which
-- disagrees with the owner's month boundary the allotment now enforces. Same function,
-- same behaviour for every other config_kind, calendar month for `recurring`.
CREATE OR REPLACE FUNCTION public.generate_fulfillment_units(p_purchase_item_id uuid)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_it   purchase_items%ROWTYPE;
  v_o    offerings%ROWTYPE;
  v_org  uuid;
  v_kind text;
  v_n    int := 0;
  i      int;
  v_qty  int;
  v_ms   date;
BEGIN
  SELECT * INTO v_it FROM purchase_items WHERE id = p_purchase_item_id;
  IF NOT FOUND THEN RETURN 0; END IF;
  SELECT * INTO v_o FROM offerings WHERE id = v_it.offering_id;
  IF NOT FOUND OR v_o.config_kind IS NULL THEN RETURN 0; END IF;
  SELECT org_id INTO v_org FROM purchases WHERE id = v_it.purchase_id;
  v_qty := greatest(coalesce(v_it.quantity, 1), 1);

  IF v_o.config_kind = 'inquire' THEN
    RETURN 0;                                   -- inquire → no units, by design
  ELSIF v_o.config_kind = 'scheduled' THEN
    v_kind := 'session';
    FOR i IN 1 .. (coalesce(v_o.unit_count, 1) * v_qty) LOOP
      INSERT INTO fulfillment_units (org_id, purchase_id, purchase_item_id, unit_kind, seq, label)
      VALUES (v_org, v_it.purchase_id, v_it.id, v_kind, i,
              coalesce(v_it.label, v_o.name) || ' · session ' || i)
      ON CONFLICT DO NOTHING;
      v_n := v_n + 1;
    END LOOP;
  ELSIF v_o.config_kind = 'recurring' THEN
    -- period units: seed the first period; later periods roll as they are billed.
    -- CREDITALIGN: the period is the CALENDAR MONTH, so this window and the
    -- lesson_credits allotment that funds bookings inside it end on the same day.
    v_kind := 'period';
    v_ms := date_trunc('month', current_date)::date;
    INSERT INTO fulfillment_units (org_id, purchase_id, purchase_item_id, unit_kind, seq, label,
                                   period_start, period_end)
    VALUES (v_org, v_it.purchase_id, v_it.id, v_kind, 1,
            coalesce(v_it.label, v_o.name) || ' · period 1',
            v_ms, (v_ms + interval '1 month - 1 day')::date)
    ON CONFLICT DO NOTHING;
    v_n := 1;
  ELSIF v_o.config_kind IN ('intake_finder','intake_evaluation') THEN
    v_kind := 'milestone';
    FOR i IN 1 .. v_qty LOOP
      INSERT INTO fulfillment_units (org_id, purchase_id, purchase_item_id, unit_kind, seq, label)
      VALUES (v_org, v_it.purchase_id, v_it.id, v_kind, i, coalesce(v_it.label, v_o.name))
      ON CONFLICT DO NOTHING;
      v_n := v_n + 1;
    END LOOP;
  ELSIF v_o.config_kind = 'document_transaction' THEN
    v_kind := 'execution';
    INSERT INTO fulfillment_units (org_id, purchase_id, purchase_item_id, unit_kind, seq, label)
    VALUES (v_org, v_it.purchase_id, v_it.id, v_kind, 1, coalesce(v_it.label, v_o.name))
    ON CONFLICT DO NOTHING;
    v_n := 1;
  END IF;

  RETURN v_n;
END;
$function$;
