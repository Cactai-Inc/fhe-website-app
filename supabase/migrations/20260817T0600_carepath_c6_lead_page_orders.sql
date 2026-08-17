-- CAREPATH §C6 / test 8 — THE LEAD PAGE SHOWS THE SUBMISSION AND THE ORDER.
--
-- Owner: "We should see all of this on the lead page for this lead… On the
-- staff side, when we open the lead from the ops or lead page we see their
-- submission and order."
--
-- ⚠️ NO SECOND LEAD PAGE. `LeadWorkDrawer` is the one place staff work a lead
-- (it was EXTRACTED, not copied, by TASK-LEADCLEAN precisely so retiring a page
-- could not cost a capability, and this project has already paid for three
-- duplicate lead lists). It already shows the personal details, the selections
-- and the step-2 answers. What it could not show is the ORDER, because until
-- §C5 an inquiry did not have one. This is the reader for it.
--
-- One RPC rather than a client-side join, because the drawer needs the orders,
-- their live line items and the void state together, and because §C5c means
-- there may be TWO orders on one inquiry and staff must see both.
CREATE OR REPLACE FUNCTION public.request_orders(p_request_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_org uuid;
  v_out jsonb;
BEGIN
  IF NOT coalesce(has_staff_access(), false) THEN
    RAISE EXCEPTION 'only staff may read an inquiry''s orders';
  END IF;
  SELECT r.org_id INTO v_org FROM requests r WHERE r.id = p_request_id;
  IF v_org IS NULL OR v_org IS DISTINCT FROM current_org() THEN
    RETURN '[]'::jsonb;
  END IF;

  SELECT coalesce(jsonb_agg(o ORDER BY o->>'created_at'), '[]'::jsonb) INTO v_out
  FROM (
    SELECT jsonb_build_object(
      'id', p.id,
      'display_code', p.display_code,
      'status', p.status,
      'current_status', p.current_status,
      'current_status_label', (SELECT v.display_name FROM status_events_vocab v
                                WHERE v.entity_type = 'order' AND v.code = p.current_status),
      'amount', p.amount,
      'payment_status', p.payment_status,
      'created_at', p.created_at,
      'notes', p.notes,
      'items', coalesce((
        SELECT jsonb_agg(jsonb_build_object(
                 'id', pi.id, 'label', pi.label,
                 'price_amount', pi.price_amount, 'price_unit', pi.price_unit,
                 'quantity', pi.quantity,
                 'offering_id', pi.offering_id,
                 -- §C7: the quantity staff schedule against comes from the
                 -- CATALOG, never from parsing the offering name. Names changed
                 -- on 2026-08-15 and name-parsing broke credit minting three
                 -- separate times; CREDITALIGN settled minting on unit_count.
                 'config_kind', o.config_kind,
                 'weekly_frequency', o.weekly_frequency,
                 'unit_count', o.unit_count,
                 'voided_at', pi.voided_at,
                 'void_reason', pi.void_reason)
               ORDER BY pi.created_at)
          FROM purchase_items pi
          LEFT JOIN offerings o ON o.id = pi.offering_id
         WHERE pi.purchase_id = p.id), '[]'::jsonb)
    ) AS o
    FROM purchases p
    WHERE p.request_id = p_request_id AND p.deleted_at IS NULL
  ) s;

  RETURN v_out;
END;
$function$;

REVOKE ALL ON FUNCTION public.request_orders(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.request_orders(uuid) TO authenticated, service_role;
