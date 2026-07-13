/*
  # Spine Refactor — Slice 2.3c: engagement-free onboarding

  Onboarding no longer manufactures an ONBOARDING engagement. It resolves the
  contact's horse (owned-else-leased) + parties (CLIENT signer + PARTICIPANT =
  a guardian-linked minor, else self) and generates required docs by calling the
  ONE spine generator (v11) directly. Requirement set = the contact's CATEGORY
  documents (required_templates_for_contact); service-specific docs move to the
  purchase doc-gate (owner decision). Docs are found by documents.contact_id.
  Minors use contacts.guardian_contact_id (not engagement_parties).

  Rewrites: my_onboarding_state, generate_my_onboarding_documents,
  contact_checklist, update_my_onboarding_profile. Drops ensure_onboarding_engagement.
*/

DROP FUNCTION IF EXISTS ensure_onboarding_engagement(uuid);

-- ── my_onboarding_state ──────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION my_onboarding_state()
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $fn$
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

  -- the contact's latest purchase (was client_purchases)
  SELECT jsonb_build_object(
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
$fn$;

-- ── generate_my_onboarding_documents (v11-direct) ────────────────────────────
CREATE OR REPLACE FUNCTION generate_my_onboarding_documents()
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $fn$
DECLARE
  v_contact uuid;
  v_out     jsonb := '[]'::jsonb;
  v_horse   uuid;
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

  -- horse this paperwork is about: owned first, else leased
  SELECT h.id INTO v_horse FROM horses h
   WHERE h.deleted_at IS NULL
     AND (h.current_owner_contact_id = v_contact OR h.lessee_contact_id = v_contact)
   ORDER BY (h.current_owner_contact_id = v_contact) DESC, h.created_at DESC
   LIMIT 1;

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
$fn$;

-- ── contact_checklist (document_parties + required docs; service branch retired)
CREATE OR REPLACE FUNCTION contact_checklist(p_contact_id uuid)
RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT coalesce(jsonb_agg(row ORDER BY done, created_at), '[]'::jsonb)
  FROM (
    SELECT jsonb_build_object(
        'kind', 'document',
        'id', d.id,
        'title', coalesce(d.title, 'Contract'),
        'action', CASE
          WHEN EXISTS (SELECT 1 FROM signatures sg
                        WHERE sg.document_id = d.id AND sg.signer_contact_id = p_contact_id
                          AND sg.deleted_at IS NULL) THEN 'Signed'
          WHEN coalesce(c.can_fill, true) AND EXISTS (
                 SELECT 1 FROM contract_fields f
                  WHERE f.document_id = d.id AND f.owner_role = dp.party_role
                    AND coalesce(f.value, '') = '') THEN 'Add your information and sign'
          WHEN coalesce(c.can_edit_deal, false) THEN 'Review, edit the terms, and sign'
          WHEN coalesce(c.can_suggest, false) THEN 'Review, suggest changes if needed, and sign'
          ELSE 'Review and sign'
        END,
        'link', '/app/contracts/' || d.id,
        'done', EXISTS (SELECT 1 FROM signatures sg
                         WHERE sg.document_id = d.id AND sg.signer_contact_id = p_contact_id
                           AND sg.deleted_at IS NULL)
      ) AS row,
      EXISTS (SELECT 1 FROM signatures sg
               WHERE sg.document_id = d.id AND sg.signer_contact_id = p_contact_id
                 AND sg.deleted_at IS NULL) AS done,
      d.created_at
    FROM document_parties dp
    JOIN documents d ON d.id = dp.document_id AND d.deleted_at IS NULL
    LEFT JOIN document_party_controls c
      ON c.document_id = d.id AND c.party_role = dp.party_role
    WHERE dp.contact_id = p_contact_id
      AND dp.party_role <> 'PARTICIPANT'

    UNION ALL

    SELECT jsonb_build_object(
        'kind', 'required_doc',
        'id', ct.template_key,
        'title', t.title,
        'action', 'Review and sign at first login',
        'link', '/app/onboarding',
        'done', false
      ),
      false,
      now()
    FROM required_templates_for_contact(p_contact_id) ct
    JOIN contract_templates t ON t.template_key = ct.template_key
    WHERE NOT EXISTS (
      SELECT 1 FROM documents d
      JOIN contract_templates t2 ON t2.id = d.template_id
      WHERE t2.template_key = ct.template_key
        AND d.contact_id = p_contact_id AND d.deleted_at IS NULL
    )
  ) items
$$;

-- ── update_my_onboarding_profile (guardian minor, not engagement_parties) ─────
CREATE OR REPLACE FUNCTION update_my_onboarding_profile(p jsonb)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $fn$
DECLARE
  v_contact   uuid;
  v_org       uuid;
  v_has_minor boolean;
  v_mf        text;
  v_ml        text;
  v_mdob      date;
  v_mname     text;
  v_minor_c   uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'authentication required'; END IF;
  v_contact := coalesce(current_contact_id(), ensure_contact_for_profile(auth.uid()));
  IF v_contact IS NULL THEN RAISE EXCEPTION 'no contact record for this account'; END IF;

  UPDATE contacts SET
    phone         = coalesce(NULLIF(trim(p->>'phone'), ''), phone),
    date_of_birth = coalesce(NULLIF(trim(p->>'date_of_birth'), '')::date, date_of_birth),
    address_line1 = coalesce(NULLIF(trim(p->>'address_street'), ''), address_line1),
    city          = coalesce(NULLIF(trim(p->>'address_city'), ''), city),
    state         = coalesce(NULLIF(trim(p->>'address_state'), ''), state),
    postal_code   = coalesce(NULLIF(trim(p->>'address_zip'), ''), postal_code),
    emergency_contact_1_name         = coalesce(NULLIF(trim(p->>'emergency_contact_1_name'), ''), emergency_contact_1_name),
    emergency_contact_1_relationship = coalesce(NULLIF(trim(p->>'emergency_contact_1_relationship'), ''), emergency_contact_1_relationship),
    emergency_contact_1_phone        = coalesce(NULLIF(trim(p->>'emergency_contact_1_phone'), ''), emergency_contact_1_phone),
    emergency_contact_2_name         = coalesce(NULLIF(trim(p->>'emergency_contact_2_name'), ''), emergency_contact_2_name),
    emergency_contact_2_relationship = coalesce(NULLIF(trim(p->>'emergency_contact_2_relationship'), ''), emergency_contact_2_relationship),
    emergency_contact_2_phone        = coalesce(NULLIF(trim(p->>'emergency_contact_2_phone'), ''), emergency_contact_2_phone),
    riding_experience_years          = coalesce(NULLIF(trim(p->>'riding_experience_years'), ''), riding_experience_years),
    jump_experience                  = coalesce(NULLIF(trim(p->>'jump_experience'), ''), jump_experience),
    riding_background                = coalesce(NULLIF(trim(p->>'riding_background'), ''), riding_background),
    jump_limitations                 = coalesce(NULLIF(trim(p->>'jump_limitations'), ''), jump_limitations),
    updated_at = now()
  WHERE id = v_contact;

  IF p ? 'has_minor' THEN
    v_has_minor := coalesce((p->>'has_minor')::boolean, false);
    v_mf    := NULLIF(trim(coalesce(p->>'minor_first_name', '')), '');
    v_ml    := NULLIF(trim(coalesce(p->>'minor_last_name', '')), '');
    v_mdob  := NULLIF(trim(coalesce(p->>'minor_dob', '')), '')::date;
    v_mname := trim(coalesce(v_mf, '') || ' ' || coalesce(v_ml, ''));

    IF v_has_minor AND v_mf IS NOT NULL THEN
      SELECT org_id INTO v_org FROM contacts WHERE id = v_contact;
      -- find the guardian's minor by name, else create it linked to the guardian
      SELECT id INTO v_minor_c FROM contacts
        WHERE guardian_contact_id = v_contact
          AND lower(trim(coalesce(first_name, '') || ' ' || coalesce(last_name, ''))) = lower(v_mname)
          AND deleted_at IS NULL
        ORDER BY created_at LIMIT 1;
      IF v_minor_c IS NULL THEN
        INSERT INTO contacts (org_id, first_name, last_name, date_of_birth, guardian_contact_id)
          VALUES (v_org, v_mf, v_ml, v_mdob, v_contact)
          RETURNING id INTO v_minor_c;
      ELSE
        UPDATE contacts SET date_of_birth = coalesce(date_of_birth, v_mdob)
          WHERE id = v_minor_c;
      END IF;
      INSERT INTO contact_roles (contact_id, role_type)
        VALUES (v_minor_c, 'PARTICIPANT') ON CONFLICT (contact_id, role_type) DO NOTHING;

    ELSIF NOT v_has_minor THEN
      -- toggled off: unlink this guardian's minors, but never disturb one whose
      -- participant doc has already executed (preservation rule).
      UPDATE contacts m SET guardian_contact_id = NULL
        WHERE m.guardian_contact_id = v_contact
          AND NOT EXISTS (
            SELECT 1 FROM document_parties dp
            JOIN documents d ON d.id = dp.document_id
            WHERE dp.contact_id = m.id AND dp.party_role = 'PARTICIPANT'
              AND d.status = 'EXECUTED' AND d.deleted_at IS NULL);
    END IF;
  END IF;
END;
$fn$;
