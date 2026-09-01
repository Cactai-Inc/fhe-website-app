/*
  # Spine Refactor — Slice 2.3e-7: onboarding "pay after sign" off the engagement

  Onboarding's payment bridge minted an order from the onboarding ENGAGEMENT
  (create_purchase_from_engagement). Since onboarding went engagement-free, the
  bridge was inert (state.engagement_id NULL → always skipped to 'done'). Expose
  the contact's latest purchase id on my_onboarding_state so the client pays THAT
  spine purchase directly after signing. Only adds 'purchase_id' to the purchase
  object; everything else is reproduced verbatim.
*/
CREATE OR REPLACE FUNCTION public.my_onboarding_state()
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  v_contact  uuid;
  v_c        contacts%ROWTYPE;
  v_docs     jsonb := '[]'::jsonb;
  v_purchase jsonb;
  v_minor    jsonb;
  v_needed   boolean := false;
  v_profile  boolean := false;
  req        record;
  v_doc      uuid;
  v_status   text;
  v_title    text;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'authentication required'; END IF;
  PERFORM ensure_my_membership();
  v_contact := coalesce(current_contact_id(), ensure_contact_for_profile(auth.uid()));
  IF v_contact IS NULL THEN
    RETURN jsonb_build_object('needed', false, 'profile_complete', false,
                              'documents', '[]'::jsonb, 'purchase', NULL, 'minor', NULL);
  END IF;

  SELECT * INTO v_c FROM contacts WHERE id = v_contact;
  v_profile := v_c.phone IS NOT NULL AND v_c.date_of_birth IS NOT NULL
           AND v_c.emergency_contact_1_name IS NOT NULL
           AND v_c.emergency_contact_1_phone IS NOT NULL;

  -- the contact's latest purchase (spine); purchase_id drives the pay-after-sign step
  SELECT jsonb_build_object(
      'purchase_id', pu.id,
      'tier_label', (SELECT pi.label FROM purchase_items pi WHERE pi.purchase_id = pu.id ORDER BY pi.created_at DESC LIMIT 1),
      'amount', pu.amount, 'lessons_included', NULL, 'cadence', NULL,
      'paid', (pu.payment_status = 'paid'), 'payment_method', pu.payment_method)
    INTO v_purchase
    FROM purchases pu
    WHERE pu.buyer_contact_id = v_contact AND pu.deleted_at IS NULL
    ORDER BY pu.created_at DESC LIMIT 1;

  -- a guardian-linked minor, if any
  SELECT jsonb_build_object('first_name', mc.first_name, 'last_name', mc.last_name,
      'dob', to_char(mc.date_of_birth, 'YYYY-MM-DD'))
    INTO v_minor
    FROM contacts mc
    WHERE mc.guardian_contact_id = v_contact AND mc.deleted_at IS NULL
    ORDER BY mc.created_at LIMIT 1;

  FOR req IN
    SELECT ct.template_key FROM required_templates_for_contact(v_contact) ct
    ORDER BY coalesce(array_position(
      ARRAY['COMPANY_POLICIES','FACILITY_RULES','RELEASE_PARTICIPANT',
            'RELEASE_HORSE_CARE','RELEASE_HORSE_EXERCISE','RELEASE_GENERAL',
            'HUMAN_EMERGENCY_MEDICAL','HORSE_EMERGENCY_VET','MEDIA_RELEASE'],
      ct.template_key), 99), ct.template_key
  LOOP
    SELECT d.id, d.status, coalesce(d.title, t.title) INTO v_doc, v_status, v_title
      FROM documents d
      JOIN contract_templates t ON t.id = d.template_id
      WHERE d.contact_id = v_contact AND t.template_key = req.template_key
        AND d.deleted_at IS NULL
      ORDER BY (d.status = 'EXECUTED') DESC, d.created_at DESC
      LIMIT 1;
    IF v_doc IS NULL THEN
      SELECT title INTO v_title FROM contract_templates WHERE template_key = req.template_key;
      v_status := 'MISSING';
    END IF;
    IF v_status IS DISTINCT FROM 'EXECUTED' THEN v_needed := true; END IF;
    v_docs := v_docs || jsonb_build_object(
      'document_id', v_doc, 'template_key', req.template_key,
      'title', v_title, 'status', coalesce(v_status, 'MISSING'));
    v_doc := NULL; v_status := NULL; v_title := NULL;
  END LOOP;

  RETURN jsonb_build_object('needed', v_needed, 'profile_complete', v_profile,
                            'documents', v_docs, 'purchase', v_purchase, 'minor', v_minor);
END;
$function$;
