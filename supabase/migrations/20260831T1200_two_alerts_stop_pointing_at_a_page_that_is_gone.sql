-- TASK-FIX3 · 2026-08-31
--
-- /app/ops/oversight and /app/ops/activity were removed today (owner: "remove
-- the surfaces that are dedicated to it entirely"). TWO DATABASE FUNCTIONS MINT
-- STAFF NOTIFICATIONS WHOSE `link` POINTS AT THE OVERSIGHT PAGE. Left alone they
-- would keep writing rows whose only affordance is a click into the branded 404.
--
-- Neither notification was ever about oversight. The page was simply the
-- staff-facing catch-all when these were written; both now name the surface that
-- actually owns the thing that happened.
--
--   deliver_evaluation_report  -> /app/ops/evaluations   (EvaluationReportsPage;
--                                 moved into the Management section today)
--   submit_acquisition_intake  -> /app/records/deals     (the deals ledger — a
--                                 brokerage acquisition brief becomes a deal;
--                                 mod.brokerage has no staff hub of its own,
--                                 which is recorded as a gap, not solved here)
--
-- ⚠️ CREATE OR REPLACE, not DROP + CREATE. Both functions are SECURITY DEFINER
-- and carry EXECUTE grants to PUBLIC/anon/authenticated/service_role; DROP would
-- reset them silently (TASK-ORIGIN, 2026-08-27). The signatures and bodies below
-- are byte-for-byte today's production definitions with ONE string changed each.
--
-- ⚠️ NO EXISTING ROWS ARE REWRITTEN — `SELECT ... FROM notifications WHERE link
-- LIKE '/app/ops/oversight%' OR link LIKE '/app/ops/activity%'` returned 0 rows
-- on production before this migration was written. There is no historical link
-- to repair, only future ones to stop minting.

CREATE OR REPLACE FUNCTION public.deliver_evaluation_report(p_report_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_contact uuid;
  v_org     uuid;
  v_user    uuid;
  v_consistent boolean;
BEGIN
  IF NOT has_staff_access() THEN RAISE EXCEPTION 'staff access required'; END IF;
  SELECT contact_id, org_id INTO v_contact, v_org FROM evaluation_reports
   WHERE id = p_report_id AND org_id = current_org();
  IF v_contact IS NULL THEN RAISE EXCEPTION 'report not found'; END IF;

  SELECT EXISTS (SELECT 1 FROM groups g
                  WHERE g.contact_id = v_contact AND g.group_type IN ('RIDER','HORSE_OWNER'))
    INTO v_consistent;

  UPDATE evaluation_reports
     SET status = 'delivered', delivered_at = now(),
         available_until = CASE WHEN v_consistent THEN NULL ELSE now() + interval '90 days' END
   WHERE id = p_report_id;

  -- ALERT the client (their account), not just staff. notifications.user_id is
  -- the account; resolve it from the report's contact.
  SELECT user_id INTO v_user FROM profiles WHERE contact_id = v_contact LIMIT 1;
  IF v_user IS NOT NULL THEN
    INSERT INTO notifications (org_id, user_id, kind, title, body, link)
    VALUES (v_org, v_user, 'evaluation_report_ready',
            'Your horse evaluation report is ready',
            'Your evaluation report is available to review, download, or share.',
            '/app/evaluations');
  END IF;
  -- TASK-FIX3: was '/app/ops/oversight', which no longer resolves.
  PERFORM notify_staff(v_org, 'evaluation_report_delivered',
    'An evaluation report was delivered', '/app/ops/evaluations');

  RETURN jsonb_build_object('ok', true, 'consistent_client', v_consistent);
END;
$function$;

CREATE OR REPLACE FUNCTION public.submit_acquisition_intake(p_purchase_item_id uuid, p_data jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_contact uuid := current_contact_id();
  v_org     uuid;
  v_owns    boolean;
BEGIN
  IF v_contact IS NULL THEN RAISE EXCEPTION 'sign in to submit intake'; END IF;

  -- the line must belong to a purchase this member owns (contact or user grain)
  SELECT pu.org_id, true INTO v_org, v_owns
    FROM purchase_items pi
    JOIN purchases pu ON pu.id = pi.purchase_id
   WHERE pi.id = p_purchase_item_id
     AND (pu.buyer_contact_id = v_contact OR pu.buyer_user_id = auth.uid());
  IF NOT coalesce(v_owns, false) THEN RAISE EXCEPTION 'that purchase is not yours'; END IF;

  UPDATE purchase_items
     SET config = coalesce(config, '{}'::jsonb)
                  || coalesce(p_data, '{}'::jsonb)
                  || jsonb_build_object('submitted_at', now())
   WHERE id = p_purchase_item_id;

  -- let staff know the brief/intake is in
  -- TASK-FIX3: was '/app/ops/oversight', which no longer resolves.
  PERFORM notify_staff(v_org, 'acquisition_intake_submitted',
    'A client submitted their acquisition intake', '/app/records/deals');

  RETURN jsonb_build_object('ok', true);
END;
$function$;
