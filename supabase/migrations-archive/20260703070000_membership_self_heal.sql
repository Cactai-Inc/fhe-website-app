/*
  # FHE CRM — Membership Self-Heal + Single-Engagement Onboarding Scope

  Production incident 2026-07-03: an invitation row was removed outside the app
  after provisioning, so the invited client registered successfully but
  redeem_invitation had nothing to redeem — no membership, and the member gate
  bounced them to /account with no way forward, while their PAID engagement sat
  waiting. The token is TRANSPORT; once staff provision a client for an email,
  possession of the authenticated account with that email IS the credential.

  1. ensure_my_membership() — authenticated self-heal: if the caller has no
     active membership but their contact is a provisioned client, grant the
     community membership redeem_invitation would have granted. Suspension is
     respected (profiles.is_suspended gates isMember client-side regardless).
  2. my_onboarding_state v3 / generate_my_onboarding_documents v3 — scope to
     the SINGLE most recent AWAITING_SIGNATURE engagement. A duplicate
     provision (double-click, re-send) must not double the signing checklist;
     older awaiting engagements keep their rows untouched (preservation), they
     just stop driving the checklist. State also self-heals membership on load.
*/

-- ============================================================
-- 1. ensure_my_membership
-- ============================================================
CREATE OR REPLACE FUNCTION ensure_my_membership()
RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $fn$
DECLARE
  v_contact uuid;
  v_org     uuid;
  v_status  text;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN false;
  END IF;

  SELECT status INTO v_status FROM memberships WHERE user_id = auth.uid();
  IF v_status = 'active' THEN
    RETURN true;
  END IF;

  -- provisioning evidence: the caller's contact has a live client row
  v_contact := coalesce(current_contact_id(), ensure_contact_for_profile(auth.uid()));
  IF v_contact IS NULL THEN
    RETURN false;
  END IF;
  SELECT cl.org_id INTO v_org
    FROM clients cl
    WHERE cl.contact_id = v_contact AND cl.deleted_at IS NULL
    ORDER BY cl.created_at DESC LIMIT 1;
  IF v_org IS NULL THEN
    RETURN false;
  END IF;

  -- mirror redeem_invitation's grant; reactivate only a paused membership —
  -- an explicitly cancelled/suspended one stays a staff decision.
  IF v_status IS NULL THEN
    INSERT INTO memberships (user_id, tier, status, org_id)
      VALUES (auth.uid(), 'community', 'active', v_org)
      ON CONFLICT (user_id) DO UPDATE SET status = 'active'
      WHERE memberships.status = 'paused';
  ELSIF v_status = 'paused' THEN
    UPDATE memberships SET status = 'active' WHERE user_id = auth.uid();
  ELSE
    RETURN false;
  END IF;

  RETURN EXISTS (SELECT 1 FROM memberships WHERE user_id = auth.uid() AND status = 'active');
END;
$fn$;

REVOKE ALL ON FUNCTION ensure_my_membership() FROM public, anon;
GRANT EXECUTE ON FUNCTION ensure_my_membership() TO authenticated;

COMMENT ON FUNCTION ensure_my_membership() IS
  'Self-heal for provisioned clients whose invitation token was lost/consumed: grants (or reactivates a paused) community membership when the caller''s contact has a live client row. Cancelled/suspended memberships are never overridden.';

-- ============================================================
-- 2a. my_onboarding_state v3 — latest awaiting engagement only + self-heal
-- ============================================================
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
        ARRAY['COMPANY_POLICIES','FACILITY_RULES','RELEASE_PARTICIPANT',
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
    'minor', v_minor
  );
END;
$fn$;

REVOKE ALL ON FUNCTION my_onboarding_state() FROM public, anon;
GRANT EXECUTE ON FUNCTION my_onboarding_state() TO authenticated;

COMMENT ON FUNCTION my_onboarding_state() IS
  'The signed-in member''s onboarding snapshot. v3: checklist scoped to the single most recent AWAITING_SIGNATURE engagement (duplicate provisions no longer double the documents) and membership self-heals on load.';

-- ============================================================
-- 2b. generate_my_onboarding_documents v3 — latest awaiting engagement only
-- ============================================================
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
    ORDER BY e.created_at DESC
    LIMIT 1;
  IF NOT FOUND THEN
    RETURN v_out;
  END IF;

  FOR req IN
    SELECT cr.template_key
    FROM contract_requirements cr
    WHERE cr.service_type = eng.service_type AND cr.org_id = eng.org_id
    ORDER BY coalesce(array_position(
      ARRAY['COMPANY_POLICIES','FACILITY_RULES','RELEASE_PARTICIPANT',
            'RELEASE_HORSE_CARE','RELEASE_HORSE_EXERCISE','RELEASE_GENERAL',
            'HUMAN_EMERGENCY_MEDICAL','HORSE_EMERGENCY_VET'],
      cr.template_key), 99), cr.template_key
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

REVOKE ALL ON FUNCTION generate_my_onboarding_documents() FROM public, anon;
GRANT EXECUTE ON FUNCTION generate_my_onboarding_documents() TO authenticated;

COMMENT ON FUNCTION generate_my_onboarding_documents() IS
  'Regenerate the signed-in member''s unsigned onboarding documents with fresh profile data. v3: scoped to the single most recent AWAITING_SIGNATURE engagement.';
