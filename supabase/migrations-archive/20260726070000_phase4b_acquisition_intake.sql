-- Phase 4b — acquisition intake: a Find-a-Horse / Horse-Evaluation purchase
-- unlocks an intake form the client fills (selection criteria / owner facts). The
-- submission lands on purchase_items.config (the same per-line config store from
-- Phase 4a) so it's tied to the exact purchase. An unfilled config = "intake
-- needed" (a dashboard task); a filled config = done.

BEGIN;

-- ── State: does this member have an acquisition purchase awaiting its intake? ──
-- Returns the pending intake line items (offering + kind) so the dashboard can
-- render a task card, and a convenience flag.
CREATE OR REPLACE FUNCTION public.my_acquisition_intake_state()
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  v_contact uuid := current_contact_id();
  v_pending jsonb;
BEGIN
  IF v_contact IS NULL THEN
    RETURN jsonb_build_object('pending', '[]'::jsonb, 'needs_intake', false);
  END IF;

  SELECT coalesce(jsonb_agg(jsonb_build_object(
           'purchase_item_id', pi.id,
           'offering_id', pi.offering_id,
           'label', pi.label,
           'config_kind', o.config_kind
         ) ORDER BY pu.created_at), '[]'::jsonb)
    INTO v_pending
    FROM purchases pu
    JOIN purchase_items pi ON pi.purchase_id = pu.id
    JOIN offerings o ON o.id = pi.offering_id
   WHERE (pu.buyer_contact_id = v_contact OR pu.buyer_user_id = auth.uid())
     AND coalesce(pu.status, '') <> 'void'
     AND pu.deleted_at IS NULL
     AND o.config_kind IN ('intake_finder', 'intake_evaluation')
     -- "not yet filled": no meaningful keys captured on the line config
     AND (pi.config IS NULL OR pi.config = '{}'::jsonb OR NOT (pi.config ? 'submitted_at'));

  RETURN jsonb_build_object(
    'pending', v_pending,
    'needs_intake', jsonb_array_length(v_pending) > 0);
END;
$function$;

-- ── Submit: the client fills the intake form → stamped onto the line config. ──
-- p_data is the form payload (criteria for finder, owner facts for evaluation);
-- we stamp submitted_at so the state function flips this line to "done".
CREATE OR REPLACE FUNCTION public.submit_acquisition_intake(
  p_purchase_item_id uuid, p_data jsonb)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
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
  PERFORM notify_staff(v_org, 'acquisition_intake_submitted',
    'A client submitted their acquisition intake', '/app/ops/oversight');

  RETURN jsonb_build_object('ok', true);
END;
$function$;

COMMIT;
