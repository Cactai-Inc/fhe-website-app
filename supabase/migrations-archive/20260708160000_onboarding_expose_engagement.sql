/*
  # Spine 2d — expose engagement_id from my_onboarding_state (payment step needs it)
*/

CREATE OR REPLACE FUNCTION public.my_onboarding_state()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_contact  uuid;
  v_c        contacts%ROWTYPE;
  v_docs     jsonb := '[]'::jsonb;
  v_purchase jsonb;
  v_minor    jsonb;
  v_needed   boolean := false;
  v_profile  boolean := false;
  eng        engagements%ROWTYPE;
  req        record;
  v_doc      uuid;
  v_status   text;
  v_title    text;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'authentication required';
  END IF;

  -- self-heal on the first thing the app loads (harmless no-op otherwise)
  PERFORM ensure_my_membership();

  v_contact := coalesce(current_contact_id(), ensure_contact_for_profile(auth.uid()));
  IF v_contact IS NULL THEN
    RETURN jsonb_build_object('needed', false, 'profile_complete', false,
                              'documents', '[]'::jsonb, 'purchase', NULL,
                              'minor', NULL);
  END IF;

  SELECT * INTO v_c FROM contacts WHERE id = v_contact;
  v_profile := v_c.phone IS NOT NULL AND v_c.date_of_birth IS NOT NULL
           AND v_c.emergency_contact_1_name IS NOT NULL
           AND v_c.emergency_contact_1_phone IS NOT NULL;

  -- latest purchase snapshot across my engagements (survives onboarding completion)
  SELECT jsonb_build_object(
      'tier_label', cp.tier_label, 'amount', cp.amount,
      'lessons_included', cp.lessons_included, 'cadence', cp.cadence,
      'paid', cp.paid, 'payment_method', cp.payment_method)
    INTO v_purchase
    FROM client_purchases cp
    JOIN engagements e ON e.id = cp.engagement_id
    JOIN clients cl ON cl.id = e.client_id
    WHERE cl.contact_id = v_contact AND e.deleted_at IS NULL
    ORDER BY cp.created_at DESC LIMIT 1;

  -- v3: the checklist is driven by the SINGLE most recent awaiting engagement.
  SELECT e.* INTO eng
    FROM engagements e
    JOIN clients cl ON cl.id = e.client_id
    WHERE cl.contact_id = v_contact
      AND e.status = 'AWAITING_SIGNATURE'
      AND e.service_type IS NOT NULL
      AND e.deleted_at IS NULL
    ORDER BY e.created_at DESC
    LIMIT 1;

  IF FOUND THEN
    -- the minor rider (PARTICIPANT party) on that engagement (v2 key, unchanged shape)
    SELECT jsonb_build_object(
        'first_name', mc.first_name,
        'last_name',  mc.last_name,
        'dob',        to_char(mc.date_of_birth, 'YYYY-MM-DD'))
      INTO v_minor
      FROM engagement_parties ep
      JOIN contacts mc ON mc.id = ep.contact_id
      WHERE ep.engagement_id = eng.id AND ep.party_role = 'PARTICIPANT'
      ORDER BY ep.created_at
      LIMIT 1;

    FOR req IN
      SELECT cr.template_key
      FROM contract_requirements cr
      WHERE cr.service_type = eng.service_type AND cr.org_id = eng.org_id
      ORDER BY coalesce(array_position(
        ARRAY['FACILITY_RULES','COMPANY_POLICIES','RELEASE_PARTICIPANT',
              'RELEASE_HORSE_CARE','RELEASE_HORSE_EXERCISE','RELEASE_GENERAL',
              'HUMAN_EMERGENCY_MEDICAL','HORSE_EMERGENCY_VET'],
        cr.template_key), 99), cr.template_key
    LOOP
      SELECT d.id, d.status, coalesce(d.title, t.title) INTO v_doc, v_status, v_title
        FROM documents d
        JOIN contract_templates t ON t.id = d.template_id
        WHERE d.engagement_id = eng.id AND t.template_key = req.template_key
          AND d.deleted_at IS NULL
        ORDER BY (d.status = 'EXECUTED') DESC, d.created_at DESC
        LIMIT 1;
      IF v_doc IS NULL THEN
        SELECT title INTO v_title FROM contract_templates WHERE template_key = req.template_key;
        v_status := 'MISSING';
      END IF;
      IF v_status IS DISTINCT FROM 'EXECUTED' THEN
        v_needed := true;
      END IF;
      v_docs := v_docs || jsonb_build_object(
        'document_id', v_doc, 'template_key', req.template_key,
        'title', v_title, 'status', coalesce(v_status, 'MISSING'));
      v_doc := NULL; v_status := NULL; v_title := NULL;
    END LOOP;
  END IF;

  RETURN jsonb_build_object(
    'needed', v_needed,
    'profile_complete', v_profile,
    'documents', v_docs,
    'purchase', v_purchase,
    'minor', v_minor,
    'engagement_id', eng.id
  );
END;
$function$
;
