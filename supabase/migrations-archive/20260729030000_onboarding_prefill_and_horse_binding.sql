-- ONBOARDING REPAIRS (owner-reported defects, 2026-07-28):
--
-- (a) The onboarding intake form did not prefill the person's info even though
--     the inviting contact already carried it (phone, DOB, address, emergency
--     contacts). Mechanism: the form prefilled from `profiles` only, but the
--     person data lives on `contacts`. Fix: my_onboarding_state() now returns a
--     `prefill` object read from the contact row; the form consumes it.
--
-- (c) generate_my_onboarding_documents() silently bound EVERY onboarding
--     document to the contact's NEWEST owned/leased horse — even when the
--     member skipped the horse-intake step and never chose that horse (this is
--     how the vet-auth appeared "filled with their previous horse"). Fix: the
--     horse the paperwork is about is never guessed —
--       1) the horse attached to the latest purchase (the service's horse),
--       2) else the contact's SOLE owned/leased horse (unambiguous),
--       3) else NULL — the documents generate without a horse identity instead
--          of binding to an arbitrary record. Both horse releases always share
--          the one v_horse, so they can never split across horses.

-- ── my_onboarding_state: add contact-sourced `prefill` ───────────────────────
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
  v_prefill  jsonb;
  v_needed   boolean := false;
  v_profile  boolean := false;
  v_pid      uuid;
  v_phorse   uuid;
  v_horse_needed boolean := false;
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
                              'documents', '[]'::jsonb, 'purchase', NULL, 'minor', NULL,
                              'horse_needed', false, 'prefill', NULL);
  END IF;

  SELECT * INTO v_c FROM contacts WHERE id = v_contact;
  v_profile := v_c.phone IS NOT NULL AND v_c.date_of_birth IS NOT NULL
           AND v_c.emergency_contact_1_name IS NOT NULL
           AND v_c.emergency_contact_1_phone IS NOT NULL;

  -- Everything the contact record already knows about the person, so the
  -- details form prefills instead of asking again (re-invited members).
  v_prefill := jsonb_build_object(
    'first_name', v_c.first_name, 'last_name', v_c.last_name,
    'phone', v_c.phone,
    'date_of_birth', to_char(v_c.date_of_birth, 'YYYY-MM-DD'),
    'address_street', v_c.address_line1, 'address_city', v_c.city,
    'address_state', v_c.state, 'address_zip', v_c.postal_code,
    'emergency_contact_1_name', v_c.emergency_contact_1_name,
    'emergency_contact_1_relationship', v_c.emergency_contact_1_relationship,
    'emergency_contact_1_phone', v_c.emergency_contact_1_phone,
    'emergency_contact_2_name', v_c.emergency_contact_2_name,
    'emergency_contact_2_relationship', v_c.emergency_contact_2_relationship,
    'emergency_contact_2_phone', v_c.emergency_contact_2_phone,
    'riding_experience_years', v_c.riding_experience_years,
    'jump_experience', v_c.jump_experience,
    'riding_background', v_c.riding_background);

  -- the contact's latest purchase (spine)
  SELECT pu.id, pu.horse_id INTO v_pid, v_phorse
    FROM purchases pu
    WHERE pu.buyer_contact_id = v_contact AND pu.deleted_at IS NULL
    ORDER BY pu.created_at DESC LIMIT 1;
  IF v_pid IS NOT NULL THEN
    SELECT jsonb_build_object(
        'purchase_id', pu.id, 'horse_id', pu.horse_id,
        'tier_label', (SELECT pi.label FROM purchase_items pi WHERE pi.purchase_id = pu.id ORDER BY pi.created_at DESC LIMIT 1),
        'amount', pu.amount, 'lessons_included', NULL, 'cadence', NULL,
        'paid', (pu.payment_status = 'paid'), 'payment_method', pu.payment_method)
      INTO v_purchase
      FROM purchases pu WHERE pu.id = v_pid;

    -- horse intake is needed when this purchase uses the rider's OWN horse and
    -- none is attached yet: any segment='horse' item, or a "(With your horse)"
    -- rider lesson (horse_included = false).
    v_horse_needed := v_phorse IS NULL AND EXISTS (
      SELECT 1 FROM purchase_items pi
      JOIN offerings o ON o.id = pi.offering_id
      WHERE pi.purchase_id = v_pid
        AND (o.segment = 'horse' OR (o.segment = 'rider' AND o.horse_included = false))
    );
  END IF;

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
                            'documents', v_docs, 'purchase', v_purchase, 'minor', v_minor,
                            'horse_needed', v_horse_needed, 'prefill', v_prefill);
END;
$function$;

-- ── generate_my_onboarding_documents: never guess the horse ──────────────────
CREATE OR REPLACE FUNCTION public.generate_my_onboarding_documents()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_contact uuid;
  v_out     jsonb := '[]'::jsonb;
  v_horse   uuid;
  v_cnt     integer;
  v_hid     text;
  v_minor   uuid;
  v_parties jsonb;
  req       record;
  v_doc     uuid;
  v_status  text;
  v_title   text;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'authentication required'; END IF;
  v_contact := coalesce(current_contact_id(), ensure_contact_for_profile(auth.uid()));
  IF v_contact IS NULL THEN RAISE EXCEPTION 'no contact record for this account'; END IF;
  IF NOT EXISTS (SELECT 1 FROM required_templates_for_contact(v_contact)) THEN
    RETURN v_out;
  END IF;

  -- The horse this paperwork is about — NEVER guessed:
  --   1) the horse attached to the latest purchase (the member chose it, or the
  --      horse-intake step attached it),
  --   2) else the contact's SOLE owned/leased horse (unambiguous),
  --   3) else NULL: documents generate without a horse identity rather than
  --      silently binding to an arbitrary record. All documents in this batch
  --      share the one v_horse, so the horse releases can never split.
  SELECT pu.horse_id INTO v_horse
    FROM purchases pu
    WHERE pu.buyer_contact_id = v_contact AND pu.deleted_at IS NULL
    ORDER BY pu.created_at DESC LIMIT 1;
  IF v_horse IS NULL THEN
    SELECT count(*), max(h.id::text) INTO v_cnt, v_hid
      FROM horses h
      WHERE h.deleted_at IS NULL
        AND (h.current_owner_contact_id = v_contact OR h.lessee_contact_id = v_contact);
    IF v_cnt = 1 THEN v_horse := v_hid::uuid; END IF;
  END IF;

  -- PARTICIPANT = a guardian-linked minor, else the client themselves
  SELECT id INTO v_minor FROM contacts
   WHERE guardian_contact_id = v_contact AND deleted_at IS NULL
   ORDER BY created_at LIMIT 1;

  v_parties := jsonb_build_array(
    jsonb_build_object('contact_id', v_contact, 'role', 'CLIENT', 'is_signer', true),
    jsonb_build_object('contact_id', coalesce(v_minor, v_contact), 'role', 'PARTICIPANT', 'is_signer', false));

  FOR req IN
    SELECT ct.template_key FROM required_templates_for_contact(v_contact) ct
    ORDER BY coalesce(array_position(
      ARRAY['COMPANY_POLICIES','FACILITY_RULES','RELEASE_PARTICIPANT',
            'RELEASE_HORSE_CARE','RELEASE_HORSE_EXERCISE','RELEASE_GENERAL',
            'HUMAN_EMERGENCY_MEDICAL','HORSE_EMERGENCY_VET','MEDIA_RELEASE'],
      ct.template_key), 99), ct.template_key
  LOOP
    SELECT d.id, d.status, d.title INTO v_doc, v_status, v_title
      FROM documents d
      JOIN contract_templates t ON t.id = d.template_id
      WHERE d.contact_id = v_contact AND t.template_key = req.template_key
        AND d.deleted_at IS NULL
      ORDER BY (d.status = 'EXECUTED') DESC, d.created_at DESC
      LIMIT 1;

    IF v_doc IS NULL OR v_status <> 'EXECUTED' THEN
      UPDATE documents d SET deleted_at = now()
        FROM contract_templates t
        WHERE d.template_id = t.id AND d.contact_id = v_contact
          AND t.template_key = req.template_key
          AND d.status <> 'EXECUTED' AND d.deleted_at IS NULL;
      SELECT g.document_id INTO v_doc
        FROM generate_document(v_contact, req.template_key, NULL::uuid, v_horse, v_parties, NULL::text) g;
      SELECT d.status, d.title INTO v_status, v_title FROM documents d WHERE d.id = v_doc;
    END IF;

    v_out := v_out || jsonb_build_object(
      'document_id', v_doc, 'template_key', req.template_key,
      'title', v_title, 'status', v_status);
    v_doc := NULL; v_status := NULL; v_title := NULL;
  END LOOP;

  RETURN v_out;
END;
$function$;

REVOKE ALL ON FUNCTION public.my_onboarding_state() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.generate_my_onboarding_documents() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.my_onboarding_state() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.generate_my_onboarding_documents() TO authenticated, service_role;
