-- Offering-attachment spine — entry point (c): attach offering(s) to an
-- EXISTING client account.
--
-- Pure money/credits operation: creates one purchase + items + lesson_credits
-- for an already-existing contact, via the SAME shared helper the invite core
-- uses (_provision_purchase_for_offerings). Does NOT touch contact_roles,
-- onboarding documents, or invitations — the account already exists and is
-- already categorized; this only adds a purchase.
--
-- Used by the admin client-account Orders tab ("Attach offering").

CREATE OR REPLACE FUNCTION public.attach_offerings_to_client(
  p_contact_id     uuid,
  p_offering_ids   uuid[],
  p_mark_paid      boolean DEFAULT false,
  p_payment_method text    DEFAULT NULL,
  p_notes          text    DEFAULT NULL,
  p_partial_amount numeric DEFAULT 0,
  p_org_id         uuid    DEFAULT NULL
) RETURNS jsonb
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
BEGIN
  IF NOT (coalesce(auth.role(), '') = 'service_role' OR has_staff_access()) THEN
    RAISE EXCEPTION 'not authorized to attach offerings';
  END IF;
  IF p_contact_id IS NULL THEN RAISE EXCEPTION 'contact is required'; END IF;
  IF array_length(p_offering_ids, 1) IS NULL THEN
    RAISE EXCEPTION 'at least one offering is required';
  END IF;

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

  -- client shell (create if the contact isn't a client yet)
  SELECT cl.id INTO v_client FROM clients cl WHERE cl.contact_id = p_contact_id AND cl.deleted_at IS NULL;
  IF v_client IS NULL THEN
    INSERT INTO clients (org_id, contact_id, source)
      VALUES (v_org, p_contact_id, 'offering attachment')
      RETURNING id INTO v_client;
  END IF;

  -- the ONE shared purchase/items/credits write
  v_purchase := _provision_purchase_for_offerings(
    v_org, p_contact_id, v_client, p_offering_ids,
    p_mark_paid, p_payment_method, p_notes, p_partial_amount);

  SELECT coalesce(sum(o.price_amount), 0), array_agg(o.name)
    INTO v_total, v_labels
    FROM offerings o WHERE o.id = ANY(p_offering_ids);

  RETURN jsonb_build_object(
    'purchase_id', v_purchase, 'contact_id', p_contact_id,
    'amount', coalesce(v_total, 0),
    'labels', coalesce(v_labels, ARRAY[]::text[]));
END;
$function$;

REVOKE ALL ON FUNCTION public.attach_offerings_to_client(uuid,uuid[],boolean,text,text,numeric,uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.attach_offerings_to_client(uuid,uuid[],boolean,text,text,numeric,uuid) TO authenticated, service_role;

COMMENT ON FUNCTION public.attach_offerings_to_client(uuid,uuid[],boolean,text,text,numeric,uuid) IS
  'Attach offering(s) to an existing client account: one purchase + items + '
  'lesson_credits via the shared _provision_purchase_for_offerings helper. No '
  'category/document/invitation side effects.';
