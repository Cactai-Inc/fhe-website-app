/*
  # Explicit first-login paperwork, prefilled by category

  No invisible auto-trigger: the ADMIN chooses (checkboxes) exactly which
  documents a client signs at first login. Category defaults
  (Rider / Horse owner / Lessee / Lessor / Buyer / Seller) PREFILL the
  selection; the stored assignment is what the system acts on, and the admin
  sees it before the invitation goes out.

  - category_document_requirements: the PREFILL defaults (category → template)
  - contact_required_documents: the explicit per-client assignment
  - set_contact_required_documents / category_document_defaults: staff RPCs
  - ensure_onboarding_engagement: assigned docs hang off a lightweight
    ONBOARDING engagement when there's no purchase engagement
  - my_onboarding_state v5 / generate_my_onboarding_documents v5: requirement
    set = service_type requirements UNION the ASSIGNED documents
  - contact_checklist v2: assigned-but-not-yet-generated documents appear as
    rows, so the ONE invitation email lists them up front
*/

CREATE TABLE IF NOT EXISTS category_document_requirements (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id       uuid NOT NULL,
  category     text NOT NULL,
  template_key text NOT NULL,
  UNIQUE (org_id, category, template_key)
);
ALTER TABLE category_document_requirements ENABLE ROW LEVEL SECURITY;

INSERT INTO category_document_requirements (org_id, category, template_key)
SELECT 'e656f20b-ef43-4725-9029-19e7f0190d9c', c.category, c.template_key
FROM (VALUES
  ('Rider', 'COMPANY_POLICIES'),
  ('Rider', 'FACILITY_RULES'),
  ('Rider', 'RELEASE_PARTICIPANT'),
  ('Rider', 'HUMAN_EMERGENCY_MEDICAL'),
  -- MEDIA_RELEASE excluded: its template body was never loaded from a source
  -- document (generate_document refuses). Re-add once the owner provides it.
  ('Horse owner', 'COMPANY_POLICIES'),
  ('Horse owner', 'FACILITY_RULES'),
  ('Horse owner', 'RELEASE_GENERAL'),
  ('Horse owner', 'HORSE_EMERGENCY_VET'),
  ('Lessee', 'COMPANY_POLICIES'),
  ('Lessee', 'FACILITY_RULES'),
  ('Lessee', 'RELEASE_HORSE_CARE'),
  -- RELEASE_HORSE_EXERCISE excluded: template retired (inactive) in the
  -- design pass; the horse-care release covers handling/exercise liability.
  ('Lessee', 'HORSE_EMERGENCY_VET'),
  ('Lessor', 'COMPANY_POLICIES'),
  ('Lessor', 'RELEASE_GENERAL'),
  ('Buyer', 'COMPANY_POLICIES'),
  ('Buyer', 'RELEASE_GENERAL'),
  ('Seller', 'COMPANY_POLICIES'),
  ('Seller', 'RELEASE_GENERAL')
) AS c(category, template_key)
ON CONFLICT (org_id, category, template_key) DO NOTHING;

-- the explicit per-client assignment (what the admin checked)
CREATE TABLE IF NOT EXISTS contact_required_documents (
  contact_id   uuid NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  template_key text NOT NULL,
  org_id       uuid NOT NULL DEFAULT current_org(),
  PRIMARY KEY (contact_id, template_key)
);
ALTER TABLE contact_required_documents ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION required_templates_for_contact(p_contact_id uuid)
RETURNS TABLE (template_key text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT crd.template_key FROM contact_required_documents crd
  WHERE crd.contact_id = p_contact_id
$$;

-- staff: replace the assignment wholesale (checkbox save)
CREATE OR REPLACE FUNCTION set_contact_required_documents(
  p_contact_id uuid, p_template_keys text[]
)
RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $fn$
DECLARE v_org uuid; v_n integer;
BEGIN
  IF NOT has_staff_access() THEN RAISE EXCEPTION 'staff access required'; END IF;
  SELECT org_id INTO v_org FROM contacts WHERE id = p_contact_id AND deleted_at IS NULL;
  IF v_org IS NULL OR v_org <> current_org() THEN
    RAISE EXCEPTION 'contact not found in this org';
  END IF;
  DELETE FROM contact_required_documents WHERE contact_id = p_contact_id;
  INSERT INTO contact_required_documents (contact_id, template_key, org_id)
  SELECT p_contact_id, k, v_org FROM unnest(coalesce(p_template_keys, '{}')) k
  ON CONFLICT DO NOTHING;
  GET DIAGNOSTICS v_n = ROW_COUNT;
  RETURN v_n;
END;
$fn$;

-- staff: the prefill defaults + titles for the checkbox UI
CREATE OR REPLACE FUNCTION category_document_defaults()
RETURNS TABLE (category text, template_key text, title text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT cdr.category, cdr.template_key, t.title
  FROM category_document_requirements cdr
  JOIN contract_templates t ON t.template_key = cdr.template_key
  WHERE cdr.org_id = current_org() AND has_staff_access()
  ORDER BY cdr.category, t.title
$$;

CREATE OR REPLACE FUNCTION ensure_onboarding_engagement(p_contact_id uuid)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $fn$
DECLARE
  v_client uuid;
  v_eng    uuid;
  v_org    uuid;
BEGIN
  SELECT cl.id, cl.org_id INTO v_client, v_org
    FROM clients cl WHERE cl.contact_id = p_contact_id AND cl.deleted_at IS NULL
    LIMIT 1;
  IF v_client IS NULL THEN
    SELECT c.org_id INTO v_org FROM contacts c WHERE c.id = p_contact_id;
    INSERT INTO clients (contact_id, status, source, org_id)
    VALUES (p_contact_id, 'ACTIVE', 'onboarding', v_org)
    RETURNING id INTO v_client;
  END IF;

  SELECT e.id INTO v_eng
    FROM engagements e
    WHERE e.client_id = v_client AND e.service_type = 'ONBOARDING'
      AND e.deleted_at IS NULL
    LIMIT 1;
  IF v_eng IS NULL THEN
    INSERT INTO engagements (client_id, service_type, status, org_id)
    VALUES (v_client, 'ONBOARDING', 'AWAITING_SIGNATURE', v_org)
    RETURNING id INTO v_eng;
    INSERT INTO engagement_parties (engagement_id, contact_id, party_role, is_signer, org_id)
    VALUES (v_eng, p_contact_id, 'CLIENT', true, v_org),
           (v_eng, p_contact_id, 'PARTICIPANT', false, v_org);
  END IF;
  RETURN v_eng;
END;
$fn$;

-- v5: requirements = engagement service_type reqs UNION category reqs.
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
  eng        engagements%ROWTYPE;
  req        record;
  v_doc      uuid;
  v_status   text;
  v_title    text;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'authentication required';
  END IF;
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

  SELECT e.* INTO eng
    FROM engagements e
    JOIN clients cl ON cl.id = e.client_id
    WHERE cl.contact_id = v_contact
      AND e.status = 'AWAITING_SIGNATURE'
      AND e.service_type IS NOT NULL
      AND e.deleted_at IS NULL
    ORDER BY (e.service_type <> 'ONBOARDING'), e.created_at DESC
    LIMIT 1;

  -- category-only client: no awaiting engagement yet, but their categories
  -- require documents → the ONBOARDING engagement carries them
  IF NOT FOUND AND EXISTS (SELECT 1 FROM required_templates_for_contact(v_contact)) THEN
    PERFORM ensure_onboarding_engagement(v_contact);
    SELECT e.* INTO eng FROM engagements e
      JOIN clients cl ON cl.id = e.client_id
      WHERE cl.contact_id = v_contact AND e.service_type = 'ONBOARDING'
        AND e.deleted_at IS NULL
      LIMIT 1;
  END IF;

  IF eng.id IS NOT NULL THEN
    SELECT jsonb_build_object(
        'first_name', mc.first_name, 'last_name', mc.last_name,
        'dob', to_char(mc.date_of_birth, 'YYYY-MM-DD'))
      INTO v_minor
      FROM engagement_parties ep
      JOIN contacts mc ON mc.id = ep.contact_id
      WHERE ep.engagement_id = eng.id AND ep.party_role = 'PARTICIPANT'
        AND mc.id <> v_contact
      ORDER BY ep.created_at
      LIMIT 1;

    FOR req IN
      SELECT rq.template_key FROM (
        SELECT cr.template_key
        FROM contract_requirements cr
        WHERE cr.service_type = eng.service_type AND cr.org_id = eng.org_id
        UNION
        SELECT ct.template_key FROM required_templates_for_contact(v_contact) ct
      ) rq
      ORDER BY coalesce(array_position(
        ARRAY['COMPANY_POLICIES','FACILITY_RULES','RELEASE_PARTICIPANT',
              'RELEASE_HORSE_CARE','RELEASE_HORSE_EXERCISE','RELEASE_GENERAL',
              'HUMAN_EMERGENCY_MEDICAL','HORSE_EMERGENCY_VET','MEDIA_RELEASE'],
        rq.template_key), 99), rq.template_key
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
    'minor', v_minor
  );
END;
$fn$;

CREATE OR REPLACE FUNCTION generate_my_onboarding_documents()
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $fn$
DECLARE
  v_contact uuid;
  v_out     jsonb := '[]'::jsonb;
  eng       engagements%ROWTYPE;
  req       record;
  v_doc     uuid;
  v_status  text;
  v_title   text;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'authentication required';
  END IF;
  v_contact := coalesce(current_contact_id(), ensure_contact_for_profile(auth.uid()));
  IF v_contact IS NULL THEN
    RAISE EXCEPTION 'no contact record for this account';
  END IF;

  SELECT e.* INTO eng
    FROM engagements e
    JOIN clients cl ON cl.id = e.client_id
    WHERE cl.contact_id = v_contact
      AND e.status = 'AWAITING_SIGNATURE'
      AND e.service_type IS NOT NULL
      AND e.deleted_at IS NULL
    ORDER BY (e.service_type <> 'ONBOARDING'), e.created_at DESC
    LIMIT 1;
  IF NOT FOUND THEN
    IF EXISTS (SELECT 1 FROM required_templates_for_contact(v_contact)) THEN
      PERFORM ensure_onboarding_engagement(v_contact);
      SELECT e.* INTO eng FROM engagements e
        JOIN clients cl ON cl.id = e.client_id
        WHERE cl.contact_id = v_contact AND e.service_type = 'ONBOARDING'
          AND e.deleted_at IS NULL
        LIMIT 1;
    ELSE
      RETURN v_out;
    END IF;
  END IF;

  FOR req IN
    SELECT rq.template_key FROM (
      SELECT cr.template_key
      FROM contract_requirements cr
      WHERE cr.service_type = eng.service_type AND cr.org_id = eng.org_id
      UNION
      SELECT ct.template_key FROM required_templates_for_contact(v_contact) ct
    ) rq
    ORDER BY coalesce(array_position(
      ARRAY['COMPANY_POLICIES','FACILITY_RULES','RELEASE_PARTICIPANT',
            'RELEASE_HORSE_CARE','RELEASE_HORSE_EXERCISE','RELEASE_GENERAL',
            'HUMAN_EMERGENCY_MEDICAL','HORSE_EMERGENCY_VET','MEDIA_RELEASE'],
      rq.template_key), 99), rq.template_key
  LOOP
    SELECT d.id, d.status, d.title INTO v_doc, v_status, v_title
      FROM documents d
      JOIN contract_templates t ON t.id = d.template_id
      WHERE d.engagement_id = eng.id AND t.template_key = req.template_key
        AND d.deleted_at IS NULL
      ORDER BY (d.status = 'EXECUTED') DESC, d.created_at DESC
      LIMIT 1;

    IF v_doc IS NULL OR v_status <> 'EXECUTED' THEN
      UPDATE documents d SET deleted_at = now()
        FROM contract_templates t
        WHERE d.template_id = t.id AND d.engagement_id = eng.id
          AND t.template_key = req.template_key
          AND d.status <> 'EXECUTED' AND d.deleted_at IS NULL;
      SELECT g.document_id INTO v_doc FROM generate_document(eng.id, req.template_key) g;
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

-- contact_checklist v2: pre-generation, list the category-required documents
-- (so the invitation email covers them before any document row exists)
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
                        WHERE sg.document_id = d.id
                          AND sg.signer_contact_id = p_contact_id
                          AND sg.deleted_at IS NULL)
            THEN 'Signed'
          WHEN coalesce(c.can_fill, true) AND EXISTS (
                 SELECT 1 FROM contract_fields f
                  WHERE f.document_id = d.id AND f.owner_role = ep.party_role
                    AND coalesce(f.value, '') = '')
            THEN 'Add your information and sign'
          WHEN coalesce(c.can_edit_deal, false) THEN 'Review, edit the terms, and sign'
          WHEN coalesce(c.can_suggest, false) THEN 'Review, suggest changes if needed, and sign'
          ELSE 'Review and sign'
        END,
        'link', '/app/contracts/' || d.id,
        'done', EXISTS (SELECT 1 FROM signatures sg
                         WHERE sg.document_id = d.id
                           AND sg.signer_contact_id = p_contact_id
                           AND sg.deleted_at IS NULL)
      ) AS row,
      EXISTS (SELECT 1 FROM signatures sg
               WHERE sg.document_id = d.id
                 AND sg.signer_contact_id = p_contact_id
                 AND sg.deleted_at IS NULL) AS done,
      d.created_at
    FROM engagement_parties ep
    JOIN documents d ON d.engagement_id = ep.engagement_id AND d.deleted_at IS NULL
    LEFT JOIN document_party_controls c
      ON c.document_id = d.id AND c.party_role = ep.party_role
    WHERE ep.contact_id = p_contact_id
      AND ep.party_role <> 'PARTICIPANT'   -- one row per doc, not one per seat

    UNION ALL

    -- assigned-but-not-generated documents (first-login paperwork)
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
      JOIN engagement_parties ep ON ep.engagement_id = d.engagement_id
      WHERE t2.template_key = ct.template_key
        AND ep.contact_id = p_contact_id AND d.deleted_at IS NULL
    )

    UNION ALL

    SELECT jsonb_build_object(
        'kind', 'engagement',
        'id', e.id,
        'title', initcap(replace(coalesce(e.service_type, 'engagement'), '_', ' ')),
        'action', CASE WHEN e.status = 'ACTIVE' THEN 'Active' ELSE 'Review' END,
        'link', '/app/account',
        'done', e.status = 'ACTIVE'
      ),
      e.status = 'ACTIVE',
      e.created_at
    FROM engagements e
    JOIN clients cl ON cl.id = e.client_id AND cl.deleted_at IS NULL
    WHERE cl.contact_id = p_contact_id AND e.deleted_at IS NULL
      AND e.service_type <> 'ONBOARDING'
      AND NOT EXISTS (SELECT 1 FROM documents d2
                       WHERE d2.engagement_id = e.id AND d2.deleted_at IS NULL)
  ) items
$$;

GRANT EXECUTE ON FUNCTION required_templates_for_contact(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION set_contact_required_documents(uuid, text[]) TO authenticated;
GRANT EXECUTE ON FUNCTION category_document_defaults() TO authenticated;
REVOKE ALL ON FUNCTION ensure_onboarding_engagement(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION ensure_onboarding_engagement(uuid) TO authenticated, service_role;

-- ONBOARDING is a registered service type (engagements.service_type FK):
-- the administrative engagement that carries first-login paperwork.
INSERT INTO service_types (code, display_name, description, segment, requires_horse, active, sort_order)
VALUES ('ONBOARDING', 'Account Onboarding',
        'Administrative engagement carrying the first-login paperwork assigned to a new client.',
        'support', false, true, 99)
ON CONFLICT (code) DO NOTHING;
