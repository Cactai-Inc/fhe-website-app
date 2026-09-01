/*
  # Spine 2f — order-from-engagement bridge (Path A payment)

  After the onboarding client finishes signing, we need a payable order. The
  payment machinery lives in the orders world (finalize_order_payment, Zelle
  reconcile, OrderPayment.tsx); onboarding lives in the engagements world. This
  RPC bridges them: mint an orders row + order_items from the engagement's
  client_purchases snapshot, owned by the calling user, so the existing
  Zelle/Stripe payment UI can drive it.

  create_order_from_engagement(p_engagement_id):
    - caller must be the engagement's client (auth.uid()'s contact → client).
    - reuses an existing non-terminal order for this engagement if present
      (idempotent — re-entering the payment step doesn't mint duplicates).
    - sets orders.expires_at = the line item's hold_expires_at (so the order
      inherits the 48h booking hold; the reaper releases both together).
    - links request_selections.order_id back for lifecycle tracking.
    - returns the order id.
*/

CREATE OR REPLACE FUNCTION create_order_from_engagement(p_engagement_id uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $fn$
DECLARE
  v_uid      uuid := auth.uid();
  v_eng      engagements%ROWTYPE;
  v_cp       client_purchases%ROWTYPE;
  v_order    uuid;
  v_hold     timestamptz;
  v_own      boolean;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'authentication required'; END IF;

  SELECT * INTO v_eng FROM engagements WHERE id = p_engagement_id AND deleted_at IS NULL;
  IF NOT FOUND THEN RAISE EXCEPTION 'unknown engagement'; END IF;

  -- ownership: the caller's profile.contact_id must be the engagement's client contact
  SELECT EXISTS (
    SELECT 1 FROM clients cl
    JOIN profiles p ON p.contact_id = cl.contact_id
    WHERE cl.id = v_eng.client_id AND p.id = v_uid
  ) INTO v_own;
  IF NOT v_own THEN RAISE EXCEPTION 'not your engagement'; END IF;

  -- reuse a live order for this engagement if one exists (idempotent)
  SELECT rs.order_id INTO v_order
    FROM request_selections rs
    WHERE rs.engagement_id = p_engagement_id AND rs.order_id IS NOT NULL
    LIMIT 1;
  IF v_order IS NOT NULL THEN
    PERFORM 1 FROM orders WHERE id = v_order AND status NOT IN ('cancelled','expired');
    IF FOUND THEN RETURN v_order; END IF;
  END IF;

  -- the purchase snapshot (price/label) for this engagement
  SELECT * INTO v_cp FROM client_purchases WHERE engagement_id = p_engagement_id
    ORDER BY created_at DESC LIMIT 1;

  -- inherit the booking hold from the line item, if any
  SELECT hold_expires_at INTO v_hold FROM request_selections
    WHERE engagement_id = p_engagement_id ORDER BY approved_at DESC NULLS LAST LIMIT 1;

  INSERT INTO orders (user_id, org_id, status, subtotal, fee, total, expires_at)
    VALUES (v_uid, v_eng.org_id, 'draft',
            coalesce(v_cp.amount, 0), 0, coalesce(v_cp.amount, 0), v_hold)
    RETURNING id INTO v_order;

  INSERT INTO order_items (order_id, offering_id, label, price_amount, org_id)
    VALUES (v_order, v_cp.offering_id, coalesce(v_cp.tier_label, v_eng.service_type, 'Service'),
            coalesce(v_cp.amount, 0), v_eng.org_id);

  -- link back for lifecycle tracking
  UPDATE request_selections SET order_id = v_order
    WHERE engagement_id = p_engagement_id AND order_id IS NULL;

  RETURN v_order;
END;
$fn$;

REVOKE ALL ON FUNCTION create_order_from_engagement(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION create_order_from_engagement(uuid) TO authenticated, service_role;
