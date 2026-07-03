/*
  # Minor rider onboarding + kiosk attribution tightening (owner directives 2026-07-03)

  1. Minors join the AUTHENTICATED onboarding flow (/app/onboarding): the
     parent/legal guardian is the account holder and the CLIENT signer;
     the minor rides as the non-signing PARTICIPANT party. generate_document v9
     (20260703030000) already does the document work — a PARTICIPANT party on
     the engagement keeps the MINOR_* CUT sections and resolves
     {{PARTICIPANT.FULL_NAME}}/{{PARTICIPANT.DOB}} from that contact; no
     PARTICIPANT party strips them whole. This migration is the plumbing:

     a. update_my_onboarding_profile v2 — optional jsonb keys:
          has_minor (boolean), minor_first_name, minor_last_name,
          minor_dob (YYYY-MM-DD).
        has_minor true + minor name present → for EACH of the caller's
        AWAITING_SIGNATURE service engagements, find-or-create the minor
        contact (org from the ENGAGEMENT; name + DOB; no email; DOB healed
        when null, exactly like sign_release) and upsert the PARTICIPANT
        party row (is_signer false, org stamped explicitly).
        has_minor false → delete PARTICIPANT party rows on those engagements
        ONLY where the engagement has no EXECUTED document (owner directive:
        never disturb executed records).
        Keys absent → minor state untouched.

     b. my_onboarding_state v2 — adds
          "minor": {"first_name","last_name","dob"} | null
        read from the PARTICIPANT party of the active onboarding engagement,
        so the UI can prefill/track the toggle.

  2. Kiosk attribution: the public /release kiosk narrows to the general
     visitor release and its email becomes REQUIRED. sign_general_release
     (the kiosk's general-release wrapper) now rejects an empty p_email with
     'email is required'. sign_release itself is UNTOUCHED — the in-app path
     supplies email via the account, and every kiosk guarantee (rules gate,
     typed-name fence, unilateral execution, org stamps) stays where it is.
*/

-- ============================================================
-- 1a. update_my_onboarding_profile v2 — optional minor rider keys
-- ============================================================
CREATE OR REPLACE FUNCTION update_my_onboarding_profile(p jsonb)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $fn$
DECLARE
  v_contact   uuid;
  v_has_minor boolean;
  v_mf        text;
  v_ml        text;
  v_mdob      date;
  v_mname     text;
  v_minor_c   uuid;
  eng         record;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'authentication required';
  END IF;
  v_contact := coalesce(current_contact_id(), ensure_contact_for_profile(auth.uid()));
  IF v_contact IS NULL THEN
    RAISE EXCEPTION 'no contact record for this account';
  END IF;

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

  -- ── v2: minor rider (PARTICIPANT party) — only when the key is PRESENT ────
  -- The has_minor key absent leaves the minor state untouched (partial saves
  -- from other screens never clear a rider). generate_document v9 keys the
  -- MINOR_* CUT sections off the PARTICIPANT party's existence; nothing else
  -- to do document-side.
  IF p ? 'has_minor' THEN
    v_has_minor := coalesce((p->>'has_minor')::boolean, false);
    v_mf    := NULLIF(trim(coalesce(p->>'minor_first_name', '')), '');
    v_ml    := NULLIF(trim(coalesce(p->>'minor_last_name', '')), '');
    v_mdob  := NULLIF(trim(coalesce(p->>'minor_dob', '')), '')::date;
    v_mname := trim(coalesce(v_mf, '') || ' ' || coalesce(v_ml, ''));

    IF v_has_minor AND v_mf IS NOT NULL THEN
      FOR eng IN
        SELECT e.* FROM engagements e
        JOIN clients cl ON cl.id = e.client_id
        WHERE cl.contact_id = v_contact
          AND e.status = 'AWAITING_SIGNATURE'
          AND e.service_type IS NOT NULL
          AND e.deleted_at IS NULL
        ORDER BY e.created_at
      LOOP
        -- find-or-create the minor contact by name within the ENGAGEMENT's org
        -- (minors typically have no contact channel; no email — mirrors
        -- sign_release 20260703050000, incl. the DOB heal when null).
        v_minor_c := NULL;
        SELECT id INTO v_minor_c FROM contacts
          WHERE org_id = eng.org_id
            AND lower(trim(coalesce(first_name, '') || ' ' || coalesce(last_name, ''))) = lower(v_mname)
            AND deleted_at IS NULL
          ORDER BY created_at LIMIT 1;
        IF v_minor_c IS NULL THEN
          INSERT INTO contacts (org_id, first_name, last_name, date_of_birth)
            VALUES (eng.org_id, v_mf, v_ml, v_mdob)
            RETURNING id INTO v_minor_c;
        ELSE
          UPDATE contacts SET date_of_birth = v_mdob
            WHERE id = v_minor_c AND date_of_birth IS NULL AND v_mdob IS NOT NULL;
        END IF;
        INSERT INTO contact_roles (contact_id, role_type)
          VALUES (v_minor_c, 'PARTICIPANT')
          ON CONFLICT (contact_id, role_type) DO NOTHING;

        -- one PARTICIPANT per engagement: retire a stale different-minor row
        -- first (drafts only — an engagement holding an EXECUTED document
        -- keeps its recorded parties, same preservation rule as has_minor
        -- false below), then upsert with the org stamped explicitly.
        DELETE FROM engagement_parties ep
          WHERE ep.engagement_id = eng.id
            AND ep.party_role = 'PARTICIPANT'
            AND ep.contact_id <> v_minor_c
            AND NOT EXISTS (
              SELECT 1 FROM documents d
              WHERE d.engagement_id = eng.id AND d.status = 'EXECUTED' AND d.deleted_at IS NULL);
        INSERT INTO engagement_parties (org_id, engagement_id, contact_id, party_role, is_signer, signer_order)
          VALUES (eng.org_id, eng.id, v_minor_c, 'PARTICIPANT', false, NULL)
          ON CONFLICT (engagement_id, contact_id, party_role) DO NOTHING;
      END LOOP;

    ELSIF NOT v_has_minor THEN
      -- toggled off: remove the PARTICIPANT party from my pending onboarding
      -- engagements, ONLY where nothing has EXECUTED yet — executed records
      -- are never disturbed (owner directive: preserve existing content).
      DELETE FROM engagement_parties ep
        USING engagements e, clients cl
        WHERE ep.engagement_id = e.id
          AND e.client_id = cl.id
          AND cl.contact_id = v_contact
          AND e.status = 'AWAITING_SIGNATURE'
          AND e.service_type IS NOT NULL
          AND e.deleted_at IS NULL
          AND ep.party_role = 'PARTICIPANT'
          AND NOT EXISTS (
            SELECT 1 FROM documents d
            WHERE d.engagement_id = e.id AND d.status = 'EXECUTED' AND d.deleted_at IS NULL);
    END IF;
  END IF;
END;
$fn$;

REVOKE ALL ON FUNCTION update_my_onboarding_profile(jsonb) FROM public, anon;
GRANT EXECUTE ON FUNCTION update_my_onboarding_profile(jsonb) TO authenticated;

COMMENT ON FUNCTION update_my_onboarding_profile(jsonb) IS
  'Save the authenticated client''s onboarding profile (contacts is the canonical store). v2: optional has_minor/minor_first_name/minor_last_name/minor_dob keys manage the non-signing PARTICIPANT party on the caller''s AWAITING_SIGNATURE service engagements — present+true upserts the minor contact + party (DOB healed when null), present+false removes the party where no document has EXECUTED, absent leaves minor state untouched.';

-- ============================================================
-- 1b. my_onboarding_state v2 — expose the minor for the toggle/prefill
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
  eng        record;
  req        record;
  v_doc      uuid;
  v_status   text;
  v_title    text;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'authentication required';
  END IF;
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

  -- v2: the minor rider (PARTICIPANT party) on the active onboarding
  -- engagement — the UI's toggle prefill and the "Rider:" confirmation line.
  SELECT jsonb_build_object(
      'first_name', mc.first_name,
      'last_name',  mc.last_name,
      'dob',        to_char(mc.date_of_birth, 'YYYY-MM-DD'))
    INTO v_minor
    FROM engagements e
    JOIN clients cl ON cl.id = e.client_id
    JOIN engagement_parties ep ON ep.engagement_id = e.id AND ep.party_role = 'PARTICIPANT'
    JOIN contacts mc ON mc.id = ep.contact_id
    WHERE cl.contact_id = v_contact
      AND e.status = 'AWAITING_SIGNATURE'
      AND e.service_type IS NOT NULL
      AND e.deleted_at IS NULL
    ORDER BY e.created_at, ep.created_at
    LIMIT 1;

  FOR eng IN
    SELECT e.* FROM engagements e
    JOIN clients cl ON cl.id = e.client_id
    WHERE cl.contact_id = v_contact
      AND e.status = 'AWAITING_SIGNATURE'
      AND e.service_type IS NOT NULL
      AND e.deleted_at IS NULL
    ORDER BY e.created_at
  LOOP
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
  END LOOP;

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
  'The signed-in member''s onboarding snapshot (profile gate, signing checklist, purchase summary). v2: adds "minor" — {first_name,last_name,dob}|null from the PARTICIPANT party of the active onboarding engagement.';

-- ============================================================
-- 2. sign_general_release v3 — kiosk attribution: email REQUIRED
--    (wrapper only; sign_release's email-or-phone contract is unchanged for
--    the in-app path, and every other kiosk guarantee lives in sign_release.)
-- ============================================================
CREATE OR REPLACE FUNCTION sign_general_release(
  p_full_name  text,
  p_email      text,
  p_phone      text,
  p_typed_name text,
  p_org        uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $fn$
BEGIN
  -- Owner directive 2026-07-03: kiosk signatures must carry an email for
  -- attribution. Fail before any row is written.
  IF NULLIF(trim(coalesce(p_email, '')), '') IS NULL THEN
    RAISE EXCEPTION 'email is required';
  END IF;
  RETURN sign_release(
    'RELEASE_GENERAL',
    NULLIF(split_part(trim(coalesce(p_full_name, '')), ' ', 1), ''),
    CASE WHEN position(' ' IN trim(coalesce(p_full_name, ''))) > 0
         THEN NULLIF(trim(substring(trim(p_full_name) FROM position(' ' IN trim(p_full_name)) + 1)), '')
         ELSE NULL END,
    p_email, p_phone, p_typed_name,
    false, NULL, NULL, NULL, NULL, true, p_org);
END;
$fn$;

REVOKE ALL ON FUNCTION sign_general_release(text, text, text, text, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION sign_general_release(text, text, text, text, uuid)
  TO anon, authenticated, service_role;

COMMENT ON FUNCTION sign_general_release(text, text, text, text, uuid) IS
  'Kiosk wrapper over sign_release(RELEASE_GENERAL, …, adult path). v3: p_email REQUIRED (kiosk attribution, owner 2026-07-03). Splits its single full-name argument on the first space into first/last. Unilateral: EXECUTES on the visitor signature (signer = CLIENT party).';
