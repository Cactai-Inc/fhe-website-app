-- CAREPATH §C5 / §C5b / §C5c — ONE SUBMISSION OPENS AN ORDER, AND STAFF CAN
-- SPLIT IT OR HOLD IT.
--
-- Owner, 2026-08-16:
--   "everything is considered an order. and a canceled order for anything just
--    voids that item from the order unless its the only order. the selections
--    themselves dont create anything until the user submits and since we
--    capture their name and email address with the order its not anonymous,
--    its just classified as a lead until we promote it to customer so there is
--    nothing owed until the order is confirmed and the lead is promoted."
--
-- ⚠️ THE SECURITY BOUNDARY. A signed-out visitor must be able to open a DRAFT
-- order, and `createDraftOrder` (src/lib/api.ts) is NOT the way: it is the
-- authenticated purchase path and weakening its auth check would expose order
-- creation to anonymous callers. Instead the order is opened INSIDE
-- `submit_public_request`, which is already SECURITY DEFINER, already resolves
-- the tenant, and already receives the selections. Chosen over a second definer
-- RPC because one submission must produce one request AND one order atomically
-- — two RPCs can half-succeed, and the half that fails is the money one.
--
-- ⚠️ `anon` holds a table-level INSERT grant on `purchases`/`purchase_items`.
-- That is the repo-wide Supabase default on every table and is NOT changed
-- here: RLS is what denies it. `purchases_org_boundary` is RESTRICTIVE and
-- reads `org_id = current_org()`, which is NULL for an anonymous browser, so
-- every direct anon insert is filtered to zero rows. The definer function is
-- the only path that lands one. Both halves are proven in the report with
-- `has_function_privilege()` and a real `SET ROLE anon` insert attempt.
--
-- ⚠️ NO NEW `purchases.status` VALUE (§C5b, test 12g). The constraint stays
-- draft/sent/awaiting_payment/paid/void. The ops-board distinction rides on a
-- STATUS EVENT, because every surface that switches on purchase status would
-- otherwise have to learn a new word.

-- ── 1. The inquiry ↔ order link ─────────────────────────────────────────────
-- §C5c: one `requests` row, possibly TWO orders. Without this column the story
-- of why order B exists is lost the moment staff split.
ALTER TABLE purchases
  ADD COLUMN IF NOT EXISTS request_id uuid REFERENCES requests(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS purchases_request_idx ON purchases (request_id);
COMMENT ON COLUMN purchases.request_id IS
  'CAREPATH C5: the inquiry this order came from. Both halves of a split order '
  'carry the same value, so staff never lose why order B exists.';

-- ── 2. A line item can be voided ────────────────────────────────────────────
-- §C5b rule 6: "Cancelling any item voids that line item and the order total
-- recomputes. Cancelling the only item voids the whole order." purchase_items
-- had no status or void column at all, so a cancelled line could only be
-- DELETED — which destroys the record of what was asked for.
ALTER TABLE purchase_items
  ADD COLUMN IF NOT EXISTS voided_at timestamptz,
  ADD COLUMN IF NOT EXISTS voided_by uuid,
  ADD COLUMN IF NOT EXISTS void_reason text;
CREATE INDEX IF NOT EXISTS purchase_items_live_idx
  ON purchase_items (purchase_id) WHERE voided_at IS NULL;
COMMENT ON COLUMN purchase_items.voided_at IS
  'CAREPATH C5b: a cancelled line is voided, never deleted — the record of what '
  'was asked for is evidence. A voided line is excluded from the order total.';

-- ── 3. The two status events this task needs ────────────────────────────────
-- Both are TRUE statuses, so `log_status_event` denormalises them onto
-- `purchases.current_status` and the ops board can filter on them. That is what
-- makes an enquiry order visibly distinct from a staff-made draft, whose
-- current_status is NULL — with no new `purchases.status` value.
INSERT INTO status_events_vocab (entity_type, code, display_name, is_true_status, is_terminal, sort_order)
VALUES
  ('order', 'enquiry',        'Enquiry — awaiting call', true, false,  5),
  ('order', 'awaiting_horse', 'Awaiting the horse',      true, false, 15),
  ('order', 'split',          'Split from another order', false, false, 6),
  ('order', 'items_moved',    'Items moved to another order', false, false, 7),
  ('order', 'item_voided',    'Line item voided',        false, false,  8)
ON CONFLICT (entity_type, code) DO UPDATE
  SET display_name = EXCLUDED.display_name,
      is_true_status = EXCLUDED.is_true_status,
      is_terminal = EXCLUDED.is_terminal,
      sort_order = EXCLUDED.sort_order;

-- ── 4. Recompute an order's total from its LIVE lines ───────────────────────
-- One writer for the arithmetic, called by every path that voids or moves a
-- line, so "the order total recomputes" cannot be implemented three ways.
-- ⚠️ It voids the ORDER when the last live line goes (§C5b rule 6) — but never
-- an order that has already been paid, because a paid order is a settled fact.
CREATE OR REPLACE FUNCTION public._recompute_purchase_total(p_purchase_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_total numeric;
  v_live  integer;
  v_status text;
BEGIN
  SELECT coalesce(sum(pi.price_amount * pi.quantity), 0), count(*)
    INTO v_total, v_live
    FROM purchase_items pi
   WHERE pi.purchase_id = p_purchase_id AND pi.voided_at IS NULL;

  SELECT status INTO v_status FROM purchases WHERE id = p_purchase_id;

  UPDATE purchases SET amount = v_total, updated_at = now() WHERE id = p_purchase_id;

  IF v_live = 0 AND coalesce(v_status, '') NOT IN ('paid', 'void') THEN
    UPDATE purchases SET status = 'void' WHERE id = p_purchase_id;
    PERFORM log_status_event('order', p_purchase_id, 'void',
      'Every line item was voided', NULL);
  END IF;
END;
$function$;

-- ── 5. THE SUBMISSION OPENS THE ORDER ───────────────────────────────────────
CREATE OR REPLACE FUNCTION public.submit_public_request(
  p_first_name text, p_last_name text, p_email text,
  p_phone text DEFAULT NULL::text, p_contact_method text DEFAULT NULL::text,
  p_notes text DEFAULT NULL::text, p_proposed_times jsonb DEFAULT '[]'::jsonb,
  p_category text DEFAULT NULL::text, p_channel text DEFAULT 'contact'::text,
  p_entry_location text DEFAULT NULL::text, p_intent text DEFAULT NULL::text,
  p_selections jsonb DEFAULT '[]'::jsonb, p_details jsonb DEFAULT '{}'::jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_org   uuid := coalesce(current_org(), current_addressed_org(), sole_org());
  v_first text := NULLIF(btrim(coalesce(p_first_name, '')), '');
  v_last  text := NULLIF(btrim(coalesce(p_last_name, '')), '');
  v_email text := lower(NULLIF(btrim(coalesce(p_email, '')), ''));
  v_phone text := NULLIF(btrim(coalesce(p_phone, '')), '');
  v_notes text := NULLIF(btrim(coalesce(p_notes, '')), '');
  v_details jsonb := CASE WHEN jsonb_typeof(p_details) = 'object' THEN p_details ELSE '{}'::jsonb END;
  v_id    uuid;
  v_sel   jsonb;
  v_contact  uuid;
  v_purchase uuid;
  v_lines    integer := 0;
BEGIN
  IF v_org IS NULL THEN
    RAISE EXCEPTION 'could not resolve an organization for this request';
  END IF;
  IF v_first IS NULL THEN RAISE EXCEPTION 'first name is required'; END IF;
  IF v_last  IS NULL THEN RAISE EXCEPTION 'last name is required'; END IF;
  IF v_email IS NULL THEN RAISE EXCEPTION 'email is required'; END IF;
  IF v_email !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' THEN
    RAISE EXCEPTION 'that email address does not look valid';
  END IF;
  IF v_phone IS NOT NULL AND v_phone !~ '^[-+().0-9[:space:]]{7,32}$' THEN
    RAISE EXCEPTION 'that phone number does not look valid';
  END IF;
  IF v_notes IS NOT NULL AND char_length(v_notes) > 4000 THEN
    RAISE EXCEPTION 'your message is too long (max 4000 characters)';
  END IF;
  IF p_contact_method IS NOT NULL AND p_contact_method NOT IN ('text','call','email') THEN
    RAISE EXCEPTION 'invalid contact method';
  END IF;

  INSERT INTO requests (
    org_id, status, contact_name, contact_first_name, contact_last_name,
    contact_email, contact_phone, contact_method, proposed_times, notes,
    category, channel, entry_location, intent, details
  ) VALUES (
    v_org, 'new', v_first || ' ' || v_last, v_first, v_last,
    v_email, v_phone, p_contact_method, coalesce(p_proposed_times, '[]'::jsonb), v_notes,
    p_category, coalesce(p_channel, 'contact'), p_entry_location, p_intent, v_details
  )
  RETURNING id INTO v_id;

  -- cart selections (Checkout) — resolve each offering to its row in-tenant.
  --
  -- ⚠️ ASKRIGHT F3, FIXED HERE. This loop matched on `o.slug` alone while the
  -- checkout sent the offering UUID in the slug key, so it never matched, fell
  -- into the IF NOT FOUND branch, and wrote a row with a UUID in the slug
  -- column and a NULL offering_id — every one of the 7 production selections
  -- looks like that. An inquiry's offerings were linked to the catalog by label
  -- TEXT only. §C5's order needs the real id, so both keys are now accepted and
  -- offering_id is the truth.
  FOR v_sel IN SELECT * FROM jsonb_array_elements(coalesce(p_selections, '[]'::jsonb))
  LOOP
    INSERT INTO request_selections (request_id, org_id, offering_id, offering_slug, label)
    SELECT v_id, v_org, o.id, o.slug, (v_sel->>'label')
      FROM offerings o
      WHERE o.org_id = v_org
        AND (o.id = nullif(v_sel->>'offering_id', '')::uuid
             OR o.slug = nullif(v_sel->>'offering_slug', ''))
      LIMIT 1;
    IF NOT FOUND THEN
      INSERT INTO request_selections (request_id, org_id, offering_slug, label)
        VALUES (v_id, v_org, (v_sel->>'offering_slug'), (v_sel->>'label'));
    END IF;
  END LOOP;

  -- The `requests_capture_contact` AFTER INSERT trigger has already run by now:
  -- it deduped or created the LEAD contact and stamped requests.contact_id.
  -- THAT contact is the lead (owner taxonomy: identity + intent, no account),
  -- and it is who the order belongs to.
  SELECT r.contact_id INTO v_contact FROM requests r WHERE r.id = v_id;

  -- ── §C5b — THE ORDER ─────────────────────────────────────────────────────
  -- Opened only when at least one selection resolved to a real catalog row. A
  -- /contact-form message carries no selections and must not manufacture an
  -- empty order; "everything is an order" is about what people BUY.
  SELECT count(*) INTO v_lines
    FROM request_selections rs WHERE rs.request_id = v_id AND rs.offering_id IS NOT NULL;

  IF v_lines > 0 THEN
    -- draft + unpaid. NOTHING IS OWED (rule 4): no payment surface, receipt,
    -- reminder or balance may treat this as payable until the one act in §C8
    -- confirms it. `buyer_user_id` stays NULL — there is no account yet, which
    -- is precisely what "lead" means.
    INSERT INTO purchases (org_id, request_id, buyer_contact_id, status, amount, payment_status)
    SELECT v_org, v_id, v_contact, 'draft',
           coalesce(sum(o.price_amount), 0), 'unpaid'
      FROM request_selections rs
      JOIN offerings o ON o.id = rs.offering_id
     WHERE rs.request_id = v_id
    RETURNING id INTO v_purchase;

    INSERT INTO purchase_items (purchase_id, org_id, offering_id, label, price_amount, price_unit)
    SELECT v_purchase, v_org, o.id, coalesce(rs.label, o.name), coalesce(o.price_amount, 0),
           -- 'lesson' is a UI-only unit; the check constraint knows 'session'.
           CASE WHEN o.price_unit = 'lesson' THEN 'session' ELSE o.price_unit END
      FROM request_selections rs
      JOIN offerings o ON o.id = rs.offering_id
     WHERE rs.request_id = v_id;

    -- The ops-board distinction, without a new purchases.status value: this
    -- order came from a visitor and is waiting on a call, and a staff-made
    -- draft (current_status NULL) is a different thing.
    PERFORM log_status_event('order', v_purchase, 'enquiry',
      'Opened by a website inquiry — nothing is owed until it is confirmed', v_org);
  END IF;

  -- alert the barn: in-app to every staff/owner (mirrored to co-admins by the
  -- notifications trigger). Email is sent separately by the /api/request-received
  -- and /api/inquiry-confirmation endpoints the public form calls after this returns.
  PERFORM notify_staff(
    v_org, 'request_new',
    'New inquiry from ' || coalesce(nullif(btrim(v_first || ' ' || v_last), ''), v_email),
    '/app/ops/intake');

  RETURN jsonb_build_object(
    'request_id', v_id, 'status', 'new',
    'purchase_id', v_purchase, 'contact_id', v_contact);
END;
$function$;

-- ── 6. §C5c — SPLIT AN ORDER. A STAFF ACTION, NEVER AUTOMATIC. ──────────────
-- Owner: "we allow it as a unified inbound order inquiry but we have to split
-- it once we know the specifics… we just figure out or clarify it when we are
-- talking with them."
--
-- ⚠️ NO QUESTION ON THE FORM DECIDES THIS and nothing splits at submission. The
-- inquiry arrives unified and may be ambiguous; staff learn the specifics on
-- the call and CHOOSE. And it works for ANY order for any reason — the
-- acquisition-plus-care case is the reason it was built, not the limit of its
-- use, so nothing here mentions acquisition.
CREATE OR REPLACE FUNCTION public.split_purchase(
  p_purchase_id uuid, p_item_ids uuid[], p_reason text DEFAULT NULL)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_src purchases%ROWTYPE;
  v_new uuid;
  v_moved integer;
BEGIN
  IF NOT coalesce(has_staff_access(), false) THEN
    RAISE EXCEPTION 'only staff may split an order';
  END IF;
  SELECT * INTO v_src FROM purchases WHERE id = p_purchase_id AND deleted_at IS NULL;
  IF v_src.id IS NULL THEN RAISE EXCEPTION 'order not found'; END IF;
  IF v_src.org_id IS DISTINCT FROM current_org() THEN
    RAISE EXCEPTION 'order not found';
  END IF;
  IF p_item_ids IS NULL OR array_length(p_item_ids, 1) IS NULL THEN
    RAISE EXCEPTION 'choose at least one item to move';
  END IF;
  -- Moving EVERY live line would leave an empty husk and a clone, not a split.
  IF NOT EXISTS (
    SELECT 1 FROM purchase_items pi
     WHERE pi.purchase_id = p_purchase_id AND pi.voided_at IS NULL
       AND NOT (pi.id = ANY(p_item_ids))
  ) THEN
    RAISE EXCEPTION 'that would move every item — there would be nothing left in this order';
  END IF;

  -- Order B: same buyer, same tenant, SAME INQUIRY. It starts as a draft and
  -- owes nothing; whether it is held or confirmed is a separate staff decision.
  INSERT INTO purchases (org_id, request_id, buyer_contact_id, buyer_user_id,
                         status, amount, payment_status, horse_id, notes)
  VALUES (v_src.org_id, v_src.request_id, v_src.buyer_contact_id, v_src.buyer_user_id,
          'draft', 0, 'unpaid', v_src.horse_id, p_reason)
  RETURNING id INTO v_new;

  UPDATE purchase_items
     SET purchase_id = v_new
   WHERE id = ANY(p_item_ids) AND purchase_id = p_purchase_id AND voided_at IS NULL;
  GET DIAGNOSTICS v_moved = ROW_COUNT;
  IF v_moved = 0 THEN
    RAISE EXCEPTION 'none of those items belong to this order';
  END IF;

  PERFORM _recompute_purchase_total(p_purchase_id);
  PERFORM _recompute_purchase_total(v_new);

  PERFORM log_status_event('order', p_purchase_id, 'items_moved',
    v_moved || ' item(s) moved to a separate order'
      || coalesce(' — ' || nullif(btrim(p_reason), ''), ''), v_src.org_id);
  PERFORM log_status_event('order', v_new, 'split',
    'Split from order ' || coalesce(v_src.display_code, p_purchase_id::text)
      || coalesce(' — ' || nullif(btrim(p_reason), ''), ''), v_src.org_id);

  RETURN jsonb_build_object('purchase_id', v_new, 'moved', v_moved,
                            'request_id', v_src.request_id);
END;
$function$;

-- ── 7. §C5c — HOLD AN ORDER. It owes nothing and schedules nothing. ─────────
-- Order B is never `awaiting_payment` while the horse is missing: nothing is
-- owed for work that cannot begin.
CREATE OR REPLACE FUNCTION public.hold_purchase_for_horse(
  p_purchase_id uuid, p_reason text DEFAULT NULL)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v purchases%ROWTYPE;
BEGIN
  IF NOT coalesce(has_staff_access(), false) THEN
    RAISE EXCEPTION 'only staff may hold an order';
  END IF;
  SELECT * INTO v FROM purchases WHERE id = p_purchase_id AND deleted_at IS NULL;
  IF v.id IS NULL OR v.org_id IS DISTINCT FROM current_org() THEN
    RAISE EXCEPTION 'order not found';
  END IF;
  IF v.status = 'paid' THEN
    RAISE EXCEPTION 'that order is already paid — it cannot be put on hold';
  END IF;

  -- §C5b vocabulary only: `draft` plus a status event. No new status value.
  UPDATE purchases SET status = 'draft', payment_status = 'unpaid', updated_at = now()
   WHERE id = p_purchase_id;
  PERFORM log_status_event('order', p_purchase_id, 'awaiting_horse',
    coalesce(nullif(btrim(p_reason), ''),
             'Held until the horse these services are for exists'), v.org_id);

  RETURN jsonb_build_object('purchase_id', p_purchase_id, 'status', 'draft',
                            'current_status', 'awaiting_horse');
END;
$function$;

-- ── 8. §C5b rule 6 — void ONE line item ─────────────────────────────────────
CREATE OR REPLACE FUNCTION public.void_purchase_item(
  p_item_id uuid, p_reason text DEFAULT NULL)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_purchase uuid;
  v_org      uuid;
  v_label    text;
BEGIN
  IF NOT coalesce(has_staff_access(), false) THEN
    RAISE EXCEPTION 'only staff may cancel a line item';
  END IF;
  SELECT pi.purchase_id, pi.org_id, pi.label INTO v_purchase, v_org, v_label
    FROM purchase_items pi WHERE pi.id = p_item_id;
  IF v_purchase IS NULL OR v_org IS DISTINCT FROM current_org() THEN
    RAISE EXCEPTION 'line item not found';
  END IF;

  -- Voided, NEVER deleted: what was asked for is evidence.
  UPDATE purchase_items
     SET voided_at = now(), voided_by = auth.uid(), void_reason = nullif(btrim(p_reason), '')
   WHERE id = p_item_id AND voided_at IS NULL;

  PERFORM log_status_event('order', v_purchase, 'item_voided',
    coalesce(v_label, 'A line item') || ' cancelled'
      || coalesce(' — ' || nullif(btrim(p_reason), ''), ''), v_org);
  -- Recomputes the total, and voids the ORDER if that was the last live line.
  PERFORM _recompute_purchase_total(v_purchase);

  RETURN (SELECT jsonb_build_object(
            'purchase_id', v_purchase, 'amount', p.amount, 'status', p.status)
          FROM purchases p WHERE p.id = v_purchase);
END;
$function$;

-- ── 9. §C5c / test 12f — ORDER B WAKES ON A HORSE APPEARING ─────────────────
-- ⚠️ KEYED ON THE HORSE, NOT ON THE ACQUISITION ORDER CLOSING. They may buy
-- privately, or we may find one fast; the deal closing is not the event. The
-- event is a horse existing for this client — owned, leased, or related.
--
-- What the wake-up does: raises the held order to `awaiting_payment` (now, and
-- only now, is anything owed), records why, and tells staff and the client so
-- the client is PROMPTED to complete the horse intake, the documents and
-- payment. It never touches an order that was not explicitly held.
CREATE OR REPLACE FUNCTION public.trg_wake_held_orders_on_horse()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_contacts uuid[];
  r RECORD;
BEGIN
  IF NEW.deleted_at IS NOT NULL THEN RETURN NULL; END IF;
  v_contacts := ARRAY(SELECT DISTINCT c FROM unnest(ARRAY[
      NEW.current_owner_contact_id, NEW.lessee_contact_id]) c WHERE c IS NOT NULL);
  IF array_length(v_contacts, 1) IS NULL THEN RETURN NULL; END IF;

  FOR r IN
    SELECT p.id, p.org_id, p.buyer_contact_id, p.display_code
      FROM purchases p
     WHERE p.buyer_contact_id = ANY(v_contacts)
       AND p.deleted_at IS NULL
       AND p.status = 'draft'
       AND p.current_status = 'awaiting_horse'
  LOOP
    UPDATE purchases SET status = 'awaiting_payment', updated_at = now() WHERE id = r.id;
    PERFORM log_status_event('order', r.id, 'submitted',
      'Woken by ' || coalesce(NEW.nickname, NEW.registered_name, 'a horse')
        || ' appearing on this client''s record — intake, documents and payment now due',
      r.org_id);
    PERFORM notify_staff(r.org_id, 'order_ready',
      'Held order ' || coalesce(r.display_code, '') || ' is ready — the horse now exists',
      '/app/ops/records');
  END LOOP;
  RETURN NULL;
END;
$function$;

DROP TRIGGER IF EXISTS horses_wake_held_orders ON horses;
CREATE TRIGGER horses_wake_held_orders
  AFTER INSERT OR UPDATE OF current_owner_contact_id, lessee_contact_id ON horses
  FOR EACH ROW EXECUTE FUNCTION trg_wake_held_orders_on_horse();

-- ── 10. Grants ──────────────────────────────────────────────────────────────
-- The staff RPCs are authenticated-only AND check has_staff_access() inside.
-- ⚠️ `REVOKE … FROM PUBLIC` does not remove a direct grant, so anon is revoked
-- BY NAME as well; both are proven with has_function_privilege() in the report.
REVOKE ALL ON FUNCTION public.split_purchase(uuid, uuid[], text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.hold_purchase_for_horse(uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.void_purchase_item(uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public._recompute_purchase_total(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.split_purchase(uuid, uuid[], text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.hold_purchase_for_horse(uuid, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.void_purchase_item(uuid, text) TO authenticated, service_role;
