-- TASK-BACKDATE — an order can carry its real date, and be settled from where
-- the work happens. (CR-94 passes 5 and 2.)
--
-- WHY. The owner is backfilling a year of trading. Today that backfill DOES NOT
-- FAIL — it succeeds and lies: `attach_offerings_to_client` has no date
-- parameter at all, so every historical order is stamped with the day it was
-- typed, every prior month reads zero, and `revenue_summary` (which recognises
-- at `paid_at`) reports the collapse confidently.
--
-- `mark_purchase_paid` ALREADY takes `p_paid_at` — TASK-ORIGIN §4.3 added it for
-- exactly this reason and nothing has ever passed it. This migration does not
-- rebuild that spine (D18); it connects it, and gives the CREATION half the same
-- parameter.
--
-- WHAT A DATE MEANS HERE. `p_occurred_at` / `p_paid_at` are supplied as a plain
-- calendar date (`YYYY-MM-DD`) from the browser and cast by PostgREST in a
-- session whose timezone is America/Los_Angeles (migration
-- 20260817T1600_tenant_timezone_is_pacific) — so the instant stored is the START
-- OF THAT DAY AT THE BARN. Omitted, everything below behaves exactly as it does
-- today (`now()`), so a same-day sale and a same-day payment are unchanged.
--
-- TWO GUARDS, BOTH SERVER-SIDE, because `attach_offerings_to_client`,
-- `mark_purchase_paid` and `confirm_payment_claim` are all EXECUTE-able by
-- `authenticated` directly over PostgREST — an API-route check would not be the
-- boundary:
--   1. A FUTURE DATE IS NOT A BACKFILL. A date later than today at the barn is
--      refused with an exception, not silently clamped.
--   2. A BACKDATED SETTLEMENT ANNOUNCES NOTHING. `_notify_purchase_paid` gains
--      `p_announce`; a settlement dated before today still RESOLVES the standing
--      "payment due" notices (or the order would show as owing money forever)
--      but does not tell the buyer "We received your payment. Thank you." for
--      money that arrived in March. The receipt EMAIL is suppressed one layer
--      up, in `api/orders-mark-paid.ts`, which is the only thing that sends one.
--
-- ⚠️ `CREATE OR REPLACE` with a new defaulted parameter OVERLOADS rather than
-- replaces, and leaves every existing call ambiguous. Every function whose arity
-- changes below is therefore DROPped explicitly and its ACL restored by hand
-- (DROP+CREATE resets `proacl` silently).
--
-- ⚠️ `revenue_summary` is NOT touched — TASK-BOOKS1 owns it. A backdated payment
-- moving money into a closed month is the POINT, not a regression.

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. `_notify_purchase_paid` — resolution always, announcement only when the
--    payment is being recorded as of today.
-- ─────────────────────────────────────────────────────────────────────────────
DROP FUNCTION IF EXISTS public._notify_purchase_paid(uuid);

CREATE OR REPLACE FUNCTION public._notify_purchase_paid(p_purchase_id uuid, p_announce boolean DEFAULT true)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_pur   purchases%ROWTYPE;
  v_user  uuid;
  v_label text;
  v_paid  text;
BEGIN
  SELECT * INTO v_pur FROM purchases WHERE id = p_purchase_id;
  IF NOT FOUND THEN RETURN; END IF;

  SELECT string_agg(pi.label, ', ' ORDER BY pi.created_at) INTO v_label
    FROM purchase_items pi WHERE pi.purchase_id = p_purchase_id;
  v_label := coalesce(nullif(btrim(v_label), ''), 'Your order');
  v_paid  := fmt_money(coalesce(v_pur.amount, 0));

  -- resolve any standing "payment due" / "you said you paid" notices.
  -- ⚠️ THIS RUNS FOR A BACKDATED SETTLEMENT TOO. Suppressing it would leave a
  -- backfilled order flagged as owing money in-app for ever.
  PERFORM resolve_notifications_for_link('/order/' || p_purchase_id::text, NULL, 'purchase_unpaid');
  PERFORM resolve_notifications_for_link('/app/orders', NULL, 'purchase_unpaid');
  PERFORM resolve_notifications_for_link('/app/ops/payments/review', NULL, 'purchase_unpaid');
  PERFORM resolve_notifications_for_link('/app/ops/payments/review', NULL, 'payment_reported');

  -- TASK-BACKDATE: the ANNOUNCEMENT half. A year of backfilled payments must not
  -- ring a client's bell once per historical month.
  IF NOT coalesce(p_announce, true) THEN RETURN; END IF;

  SELECT pr.user_id INTO v_user
    FROM profiles pr WHERE pr.contact_id = v_pur.buyer_contact_id LIMIT 1;
  IF v_user IS NOT NULL THEN
    PERFORM notify_user(v_user, 'payment_received',
      'Payment received — ' || v_label,
      'We received your payment of ' || v_paid || '. Thank you.',
      '/app/orders');
  END IF;

  PERFORM notify_staff(v_pur.org_id, 'payment_received',
    'Payment received — ' || v_label || ' (' || v_paid || ')',
    '/app/ops/payments/review');
END;
$function$;

-- ⚠️ `FROM PUBLIC` IS NOT ENOUGH. Supabase ships ALTER DEFAULT PRIVILEGES
-- granting EXECUTE on every new function to anon + authenticated, and those
-- are DIRECT grants a PUBLIC revoke does not touch — measured on this very
-- migration's first apply, which handed `anon` execute on
-- attach_offerings_to_client that 20260801010000 had deliberately revoked.
REVOKE ALL ON FUNCTION public._notify_purchase_paid(uuid, boolean) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public._notify_purchase_paid(uuid, boolean) TO service_role;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. `_provision_purchase_for_offerings` — the ONE write that creates an order,
--    now able to say when it happened.
-- ─────────────────────────────────────────────────────────────────────────────
DROP FUNCTION IF EXISTS public._provision_purchase_for_offerings(uuid,uuid,uuid,uuid[],boolean,text,text,numeric);

CREATE OR REPLACE FUNCTION public._provision_purchase_for_offerings(
  p_org_id uuid, p_contact_id uuid, p_client_id uuid, p_offering_ids uuid[],
  p_mark_paid boolean DEFAULT false, p_payment_method text DEFAULT NULL::text,
  p_notes text DEFAULT NULL::text, p_partial_amount numeric DEFAULT 0,
  p_occurred_at timestamptz DEFAULT NULL)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_purchase uuid;
  v_total    numeric;
  v_paid     numeric;
  v_when     timestamptz;
  v_backdated boolean;
BEGIN
  IF array_length(p_offering_ids, 1) IS NULL THEN
    RETURN NULL;  -- nothing to purchase
  END IF;

  -- TASK-BACKDATE: omitted is now(), which is every existing caller's behaviour.
  v_when := coalesce(p_occurred_at, now());
  v_backdated := (v_when AT TIME ZONE 'America/Los_Angeles')::date
               < (now()  AT TIME ZONE 'America/Los_Angeles')::date;

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
                         payment_method, payment_status, payment_reference, paid_at,
                         notes, created_at)
    VALUES (p_org_id, p_contact_id,
            CASE WHEN p_mark_paid THEN 'paid' ELSE 'awaiting_payment' END,
            v_total, v_paid, p_payment_method,
            CASE WHEN p_mark_paid THEN 'paid'
                 WHEN v_paid > 0  THEN 'pending'
                 ELSE 'unpaid' END,
            CASE WHEN p_mark_paid THEN 'Provisioned — paid in full via ' || coalesce(p_payment_method, 'offline payment')
                 WHEN v_paid > 0  THEN 'Provisioned — partial ' || v_paid::text || ' via ' || coalesce(p_payment_method, 'offline payment') END,
            -- TASK-BACKDATE: `revenue_summary` recognises at paid_at, so THIS is
            -- the field that decides which month a backfilled sale lands in.
            CASE WHEN p_mark_paid THEN v_when END,
            coalesce(p_notes, 'Provisioned invitation'),
            v_when)
    RETURNING id INTO v_purchase;

  INSERT INTO purchase_items (org_id, purchase_id, offering_id, label, price_amount, price_unit, quantity, created_at)
  SELECT p_org_id, v_purchase, o.id, o.name, coalesce(o.price_amount, 0), o.price_unit, 1, v_when
    FROM offerings o WHERE o.id = ANY(p_offering_ids);

  -- CREDITALIGN: minting is no longer this function's business. One seam,
  -- `_mint_credits_for_purchase_item`, fired by the purchase_items trigger; this
  -- call only re-runs it with the client this caller already knows.
  PERFORM _mint_credits_for_purchase_item(pi.id, p_client_id)
     FROM purchase_items pi WHERE pi.purchase_id = v_purchase;

  IF p_mark_paid THEN
    -- ZELLECLOSE: same "payment received" trail mark_purchase_paid gives every
    -- other paid purchase — this one was just paid at creation, not by an UPDATE.
    -- TASK-BACKDATE: a historical sale resolves notices but announces nothing.
    PERFORM _notify_purchase_paid(v_purchase, NOT v_backdated);
  ELSE
    -- U3(a): a purchase that owes money raises the standing "payment due" pair
    -- (buyer + staff). No-op when paid (handled above instead). ⚠️ NOT suppressed
    -- when backdated: a backfilled order that was never paid still owes money.
    PERFORM notify_purchase_unpaid(v_purchase);
  END IF;

  RETURN v_purchase;
END;
$function$;

-- ⚠️ `FROM PUBLIC` IS NOT ENOUGH. Supabase ships ALTER DEFAULT PRIVILEGES
-- granting EXECUTE on every new function to anon + authenticated, and those
-- are DIRECT grants a PUBLIC revoke does not touch — measured on this very
-- migration's first apply, which handed `anon` execute on
-- attach_offerings_to_client that 20260801010000 had deliberately revoked.
REVOKE ALL ON FUNCTION public._provision_purchase_for_offerings(uuid,uuid,uuid,uuid[],boolean,text,text,numeric,timestamptz) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public._provision_purchase_for_offerings(uuid,uuid,uuid,uuid[],boolean,text,text,numeric,timestamptz) TO service_role;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. `attach_offerings_to_client` — R1. The staff act that creates an order
--    from a person's record now carries the date the order really happened.
-- ─────────────────────────────────────────────────────────────────────────────
DROP FUNCTION IF EXISTS public.attach_offerings_to_client(uuid,uuid[],boolean,text,text,numeric,uuid);

CREATE OR REPLACE FUNCTION public.attach_offerings_to_client(
  p_contact_id uuid, p_offering_ids uuid[], p_mark_paid boolean DEFAULT false,
  p_payment_method text DEFAULT NULL::text, p_notes text DEFAULT NULL::text,
  p_partial_amount numeric DEFAULT 0, p_org_id uuid DEFAULT NULL::uuid,
  p_occurred_at timestamptz DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_org      uuid;
  v_client   uuid;
  v_purchase uuid;
  v_total    numeric := 0;
  v_labels   text[];
  v_when     timestamptz;
BEGIN
  IF NOT (coalesce(auth.role(), '') = 'service_role' OR has_staff_access()) THEN
    RAISE EXCEPTION 'not authorized to attach offerings';
  END IF;
  IF p_contact_id IS NULL THEN RAISE EXCEPTION 'contact is required'; END IF;
  IF array_length(p_offering_ids, 1) IS NULL THEN
    RAISE EXCEPTION 'at least one offering is required';
  END IF;

  -- TASK-BACKDATE: A FUTURE DATE IS NOT A BACKFILL. Refused here, not in the UI —
  -- this function is EXECUTE-able by `authenticated` straight over PostgREST.
  IF p_occurred_at IS NOT NULL
     AND (p_occurred_at AT TIME ZONE 'America/Los_Angeles')::date
       > (now()         AT TIME ZONE 'America/Los_Angeles')::date THEN
    RAISE EXCEPTION 'an order cannot be dated in the future (%)',
      to_char(p_occurred_at AT TIME ZONE 'America/Los_Angeles', 'YYYY-MM-DD');
  END IF;
  v_when := coalesce(p_occurred_at, now());

  -- org: explicit -> the contact's org -> an offering's org -> current_org()
  v_org := p_org_id;
  IF v_org IS NULL THEN
    SELECT org_id INTO v_org FROM contacts WHERE id = p_contact_id AND deleted_at IS NULL;
  END IF;
  IF v_org IS NULL THEN
    SELECT o.org_id INTO v_org FROM offerings o WHERE o.id = p_offering_ids[1];
  END IF;
  v_org := coalesce(v_org, current_org());
  IF v_org IS NULL THEN RAISE EXCEPTION 'could not resolve org'; END IF;

  -- client shell (create if the contact isn't a client yet).
  -- TASK-BACKDATE: `client_since` is a D8 marker — a client backfilled from last
  -- March became a client last March, not the day someone typed them in.
  SELECT cl.id INTO v_client FROM clients cl WHERE cl.contact_id = p_contact_id AND cl.deleted_at IS NULL;
  IF v_client IS NULL THEN
    INSERT INTO clients (org_id, contact_id, source, client_since)
      VALUES (v_org, p_contact_id, 'offering attachment', v_when)
      RETURNING id INTO v_client;
  END IF;

  -- the ONE shared purchase/items/credits write
  v_purchase := _provision_purchase_for_offerings(
    v_org, p_contact_id, v_client, p_offering_ids,
    p_mark_paid, p_payment_method, p_notes, p_partial_amount, p_occurred_at);

  SELECT coalesce(sum(o.price_amount), 0), array_agg(o.name)
    INTO v_total, v_labels
    FROM offerings o WHERE o.id = ANY(p_offering_ids);

  RETURN jsonb_build_object(
    'purchase_id', v_purchase, 'contact_id', p_contact_id,
    'amount', coalesce(v_total, 0),
    'occurred_at', v_when,
    'labels', coalesce(v_labels, ARRAY[]::text[]));
END;
$function$;

-- ⚠️ `FROM PUBLIC` IS NOT ENOUGH. Supabase ships ALTER DEFAULT PRIVILEGES
-- granting EXECUTE on every new function to anon + authenticated, and those
-- are DIRECT grants a PUBLIC revoke does not touch — measured on this very
-- migration's first apply, which handed `anon` execute on
-- attach_offerings_to_client that 20260801010000 had deliberately revoked.
REVOKE ALL ON FUNCTION public.attach_offerings_to_client(uuid,uuid[],boolean,text,text,numeric,uuid,timestamptz) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.attach_offerings_to_client(uuid,uuid[],boolean,text,text,numeric,uuid,timestamptz) TO authenticated, service_role;

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. `mark_purchase_paid` — R2's other half, AS AN IN-PLACE PATCH, NOT A REWRITE.
--
-- ⚠️ THIS SECTION WAS A FULL `CREATE OR REPLACE` AND IT WAS WRONG. It was applied
-- at 01:20 and by 01:35 it had been silently overwritten in production by
-- `TASK-BOOKS1`, which was replacing the same function to add
-- `p_disposition` / `p_write_down_reason` (comped and discounted orders). Two
-- threads, one function, last write wins — and the losing half fails SILENTLY,
-- because the function still exists, still compiles and still returns 'paid'.
-- It was caught by re-running the future-date test, which had passed an hour
-- earlier and now returned 'paid' for tomorrow's date.
--
-- ⚠️ `mark_purchase_paid` IS BOOKS1's FILE, not this task's — this task's spec
-- says "the RPC already takes `p_paid_at`; do not rebuild the spine". So this is
-- now the repo's established read-modify-rewrite pattern (CLAUDE.md, ~31
-- migrations): it reads whatever body is live and PATCHES it, so BOOKS1's
-- disposition logic survives whichever order the two are applied in, and this can
-- be re-run after BOOKS1 re-applies theirs. It is idempotent and it RAISES rather
-- than no-ops if an anchor is missing — a silent no-op here is exactly the
-- failure mode being repaired.
--
-- WHAT IT ADDS, and nothing else:
--   (a) the future-date refusal — the real server-side boundary, because this
--       function is EXECUTE-able by `authenticated` straight over PostgREST and
--       an API-route check therefore is not one;
--   (b) the silence — a settlement dated before today does not tell the buyer
--       "We received your payment. Thank you." for money that arrived in March,
--       and records on the order's own timeline that it did not.
-- `p_paid_at` itself is untouched: BOOKS1 already writes it in all four
-- settlement paths, which was verified against the live body before patching.
DO $mig$
DECLARE
  v_src text;
  v_new text;
  v_anchor_auth constant text :=
$a$  IF NOT (coalesce(auth.role(), '') = 'service_role' OR has_staff_access()) THEN
    RAISE EXCEPTION 'operator access required';
  END IF;$a$;
  v_guard constant text :=
$a$

  -- TASK-BACKDATE: A FUTURE DATE IS NOT A BACKFILL. Refused here, because this
  -- function is reachable by `authenticated` directly over PostgREST.
  IF p_paid_at IS NOT NULL
     AND (p_paid_at AT TIME ZONE 'America/Los_Angeles')::date
       > (now()     AT TIME ZONE 'America/Los_Angeles')::date THEN
    RAISE EXCEPTION 'a payment cannot be dated in the future (%)',
      to_char(p_paid_at AT TIME ZONE 'America/Los_Angeles', 'YYYY-MM-DD');
  END IF;$a$;
  v_anchor_call constant text := $a$PERFORM _notify_purchase_paid(p_purchase_id);$a$;
  v_replacement constant text :=
$a$-- TASK-BACKDATE: a settlement dated before today RESOLVES the standing
    -- "payment due" notices (or a backfilled order owes money for ever) but
    -- ANNOUNCES nothing. The receipt email is suppressed one layer up, in
    -- api/orders-mark-paid.ts, which is the only thing that sends one.
    PERFORM _notify_purchase_paid(p_purchase_id,
      NOT (p_paid_at IS NOT NULL
           AND (p_paid_at AT TIME ZONE 'America/Los_Angeles')::date
             < (now()     AT TIME ZONE 'America/Los_Angeles')::date));
    IF p_paid_at IS NOT NULL
       AND (p_paid_at AT TIME ZONE 'America/Los_Angeles')::date
         < (now()     AT TIME ZONE 'America/Los_Angeles')::date THEN
      PERFORM log_status_event('order', p_purchase_id, 'paid',
        'Backdated settlement — recorded as of '
          || to_char(p_paid_at AT TIME ZONE 'America/Los_Angeles', 'FMMonth FMDD, YYYY')
          || '. No receipt or notice was sent.', v_pur.org_id);
    END IF;$a$;
BEGIN
  SELECT pg_get_functiondef(p.oid) INTO v_src
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname = 'public' AND p.proname = 'mark_purchase_paid';

  IF v_src IS NULL THEN
    RAISE EXCEPTION 'TASK-BACKDATE: mark_purchase_paid does not exist — refusing to guess';
  END IF;

  -- Already patched (this migration re-run, or run after BOOKS1 re-applied and
  -- someone patched in between): leave it exactly as it is.
  IF position('a payment cannot be dated in the future' in v_src) > 0 THEN
    RAISE NOTICE 'TASK-BACKDATE: mark_purchase_paid already carries the date guard — nothing to do';
    RETURN;
  END IF;

  IF position(v_anchor_auth in v_src) = 0 THEN
    RAISE EXCEPTION 'TASK-BACKDATE: the operator-access guard in mark_purchase_paid has moved — patch by hand, do not no-op';
  END IF;
  IF position(v_anchor_call in v_src) = 0 THEN
    RAISE EXCEPTION 'TASK-BACKDATE: mark_purchase_paid no longer calls _notify_purchase_paid(p_purchase_id) — patch by hand, do not no-op';
  END IF;

  v_new := replace(v_src, v_anchor_auth, v_anchor_auth || v_guard);
  v_new := replace(v_new, v_anchor_call, v_replacement);
  EXECUTE v_new;

  RAISE NOTICE 'TASK-BACKDATE: mark_purchase_paid patched — % announcement site(s) made backdate-aware',
    (length(v_src) - length(replace(v_src, v_anchor_call, ''))) / length(v_anchor_call);
END
$mig$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. `confirm_payment_claim` — the claim-aware wrapper around the SAME spine.
--    Without this, a backdated settlement on an order that happens to carry a
--    pending client claim would silently drop the date — the exact "succeeds and
--    lies" failure this task exists to end.
-- ─────────────────────────────────────────────────────────────────────────────
DROP FUNCTION IF EXISTS public.confirm_payment_claim(uuid);

CREATE OR REPLACE FUNCTION public.confirm_payment_claim(p_purchase_id uuid, p_paid_at timestamptz DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_pur    purchases%ROWTYPE;
  v_method text;
  v_result text;
BEGIN
  IF NOT has_staff_access() THEN
    RAISE EXCEPTION 'operator access required';
  END IF;

  SELECT * INTO v_pur FROM purchases WHERE id = p_purchase_id AND deleted_at IS NULL;
  IF NOT FOUND THEN RAISE EXCEPTION 'unknown purchase: %', p_purchase_id; END IF;
  IF v_pur.client_claim_status <> 'pending' THEN
    RAISE EXCEPTION 'no pending claim on this order (claim status: %)', v_pur.client_claim_status;
  END IF;

  v_method := coalesce(v_pur.client_reported_method, v_pur.payment_method, 'zelle');

  -- D6: one payment spine — the SAME function a matched Zelle payment settles
  -- through. Writes payment_status/status/paid_at/amount_paid/payment_method,
  -- fires the existing status_events trigger, and notifies the buyer + staff.
  -- TASK-BACKDATE: `p_paid_at` rides through it; the future-date refusal and the
  -- silence live there, so there is one rule, not two.
  v_result := mark_purchase_paid(
    p_purchase_id, v_pur.amount, v_pur.client_reported_reference, v_method, p_paid_at);

  UPDATE purchases
     SET client_claim_status      = 'confirmed',
         client_claim_resolved_by = auth.uid(),
         client_claim_resolved_at = now()
   WHERE id = p_purchase_id;

  PERFORM log_status_event('order', p_purchase_id, 'claim_confirmed',
    'Confirmed by staff — settled as ' || v_method, v_pur.org_id);

  RETURN jsonb_build_object('confirmed', true, 'settlement', v_result, 'method', v_method);
END;
$function$;

-- ⚠️ `FROM PUBLIC` IS NOT ENOUGH. Supabase ships ALTER DEFAULT PRIVILEGES
-- granting EXECUTE on every new function to anon + authenticated, and those
-- are DIRECT grants a PUBLIC revoke does not touch — measured on this very
-- migration's first apply, which handed `anon` execute on
-- attach_offerings_to_client that 20260801010000 had deliberately revoked.
REVOKE ALL ON FUNCTION public.confirm_payment_claim(uuid, timestamptz) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.confirm_payment_claim(uuid, timestamptz) TO authenticated, service_role;

-- ─────────────────────────────────────────────────────────────────────────────
-- 6. `contact_dossier` — R3/R6's read half. Signature UNCHANGED, so the ACL is
--    preserved by CREATE OR REPLACE; the orders array gains four purchase-level
--    facts it never carried. Additive only — nothing is removed or renamed.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.contact_dossier(p_contact_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_org  uuid := current_org();
  v_user uuid;
  v_out  jsonb;
BEGIN
  IF NOT has_staff_access() THEN
    RAISE EXCEPTION 'staff access required';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM contacts
                  WHERE id = p_contact_id AND org_id = v_org) THEN
    RAISE EXCEPTION 'contact not found in this organisation';
  END IF;

  SELECT p.user_id INTO v_user FROM profiles p WHERE p.contact_id = p_contact_id;

  SELECT jsonb_build_object(
    -- ── the person: every editable field on the contact record ──────────────
    'contact', (SELECT to_jsonb(c) FROM contacts c WHERE c.id = p_contact_id),

    -- ── the account, when there is one ──────────────────────────────────────
    'account', CASE WHEN v_user IS NULL THEN NULL ELSE (
      SELECT jsonb_build_object(
        'user_id', p.user_id, 'role', p.role, 'is_suspended', p.is_suspended,
        'display_name', p.display_name, 'bio', p.bio, 'riding_level', p.riding_level,
        'avatar_url', p.avatar_url, 'created_at', p.created_at,
        'member_status', (SELECT m.status FROM members m WHERE m.user_id = p.user_id LIMIT 1),
        'login', (SELECT jsonb_build_object(
            'providers', coalesce((SELECT jsonb_agg(DISTINCT i.provider)
                                     FROM auth.identities i WHERE i.user_id = p.user_id), '[]'::jsonb),
            'last_sign_in_at', u.last_sign_in_at,
            'email_confirmed_at', u.email_confirmed_at)
          FROM auth.users u WHERE u.id = p.user_id))
      FROM profiles p WHERE p.user_id = v_user) END,

    -- ── how they are filed, and what that was derived from ──────────────────
    'standing', jsonb_build_object(
      'contact_type', (SELECT c.contact_type FROM contacts c WHERE c.id = p_contact_id),
      'is_client', EXISTS (SELECT 1 FROM clients cl
                            WHERE cl.contact_id = p_contact_id AND cl.deleted_at IS NULL),
      'groups', coalesce((SELECT jsonb_agg(g.group_type ORDER BY g.group_type)
                            FROM groups g WHERE g.contact_id = p_contact_id), '[]'::jsonb),
      'party_roles', coalesce((SELECT jsonb_agg(DISTINCT dp.party_role)
                                 FROM document_parties dp WHERE dp.contact_id = p_contact_id), '[]'::jsonb)),

    -- ── RELATIONSHIPS. The guardian link existed in the schema and was already
    --    populated, but nothing ever showed it. Both directions are returned so
    --    the tie reads correctly from parent or child.
    'family', jsonb_build_object(
      'guardian', (SELECT jsonb_build_object(
                     'contact_id', g.id,
                     'name', coalesce(nullif(trim(concat_ws(' ', g.first_name, g.last_name)), ''), g.email),
                     'email', g.email)
                     FROM contacts g
                     JOIN contacts c ON c.guardian_contact_id = g.id
                    WHERE c.id = p_contact_id AND g.deleted_at IS NULL),
      'dependants', coalesce((SELECT jsonb_agg(jsonb_build_object(
                     'contact_id', d.id,
                     'name', coalesce(nullif(trim(concat_ws(' ', d.first_name, d.last_name)), ''), d.email),
                     'date_of_birth', d.date_of_birth) ORDER BY d.date_of_birth)
                     FROM contacts d
                    WHERE d.guardian_contact_id = p_contact_id AND d.deleted_at IS NULL), '[]'::jsonb)),

    'horses', coalesce((SELECT jsonb_agg(jsonb_build_object(
                 'horse_id', h.id,
                 'name', coalesce(h.nickname, h.registered_name),
                 'relation', CASE WHEN h.current_owner_contact_id = p_contact_id THEN 'owner'
                                  ELSE 'lessee' END) ORDER BY h.registered_name)
                 FROM horses h
                WHERE h.deleted_at IS NULL
                  AND (h.current_owner_contact_id = p_contact_id
                    OR h.lessee_contact_id = p_contact_id)), '[]'::jsonb),

    'documents', coalesce((SELECT jsonb_agg(jsonb_build_object(
                 'document_id', d.id, 'code', d.display_code, 'title', d.title,
                 'status', d.status, 'current_status', d.current_status,
                 'generated_at', d.generated_at) ORDER BY d.generated_at DESC)
                 FROM documents d
                WHERE d.deleted_at IS NULL
                  AND (d.contact_id = p_contact_id
                    OR EXISTS (SELECT 1 FROM document_parties dp
                                WHERE dp.document_id = d.id AND dp.contact_id = p_contact_id))), '[]'::jsonb),

    'orders', coalesce((SELECT jsonb_agg(jsonb_build_object(
                 'purchase_id', pu.id, 'code', pu.display_code, 'status', pu.status,
                 'amount', pu.amount, 'amount_paid', pu.amount_paid,
                 'payment_status', pu.payment_status, 'payment_method', pu.payment_method,
                 -- TASK-BACKDATE: the Orders tab can now SETTLE an order, so it
                 -- needs the three facts that decide what the control says and
                 -- does: whether money already landed and WHEN (paid_at is what
                 -- revenue_summary recognises on), the richer status the badge
                 -- reads, and whether a CASHCONFIRM claim is already open —
                 -- because a pending claim settles through confirm_payment_claim,
                 -- not a fresh mark_purchase_paid, and the button must say so.
                 'paid_at', pu.paid_at, 'current_status', pu.current_status,
                 'client_claim_status', pu.client_claim_status,
                 'client_reported_method', pu.client_reported_method,
                 'items', coalesce((SELECT jsonb_agg(jsonb_build_object(
                              'item_id', pi.id, 'offering_id', pi.offering_id,
                              'label', coalesce(o.name, pi.label),
                              'quantity', pi.quantity,
                              'price_amount', pi.price_amount, 'price_unit', pi.price_unit,
                              'config_kind', o.config_kind, 'service_type', o.service_type,
                              'voided_at', pi.voided_at, 'void_reason', pi.void_reason)
                              ORDER BY pi.created_at)
                            FROM purchase_items pi
                            LEFT JOIN offerings o ON o.id = pi.offering_id
                           WHERE pi.purchase_id = pu.id), '[]'::jsonb),
                 'created_at', pu.created_at) ORDER BY pu.created_at DESC)
                 FROM purchases pu WHERE pu.buyer_contact_id = p_contact_id), '[]'::jsonb),

    'notifications', coalesce((SELECT jsonb_agg(jsonb_build_object(
                 'id', n.id, 'kind', n.kind, 'title', n.title,
                 'created_at', n.created_at) ORDER BY n.created_at DESC)
                 FROM notifications n WHERE v_user IS NOT NULL AND n.user_id = v_user
                 LIMIT 25), '[]'::jsonb),

    -- ── account-only: null (not empty) when there is no login, so the UI can
    --    tell "nothing here" apart from "does not apply to this person".
    'posts', CASE WHEN v_user IS NULL THEN NULL ELSE
                 coalesce((SELECT jsonb_agg(jsonb_build_object(
                   'id', f.id, 'post_type', f.post_type, 'body', left(f.body, 120),
                   'published', f.published, 'pulled_down', f.pulled_down,
                   'created_at', f.created_at) ORDER BY f.created_at DESC)
                   FROM feed_posts f WHERE f.author_id = v_user), '[]'::jsonb) END,

    'activity', CASE WHEN v_user IS NULL THEN NULL ELSE
                 coalesce((SELECT jsonb_agg(jsonb_build_object(
                   'id', a.id, 'action', a.action, 'table_name', a.table_name,
                   'occurred_at', a.occurred_at) ORDER BY a.occurred_at DESC)
                   FROM (SELECT * FROM audit_logs al
                          WHERE al.actor_user_id = v_user
                          ORDER BY al.occurred_at DESC LIMIT 50) a), '[]'::jsonb) END
  ) INTO v_out;

  RETURN v_out;
END
$function$

;
