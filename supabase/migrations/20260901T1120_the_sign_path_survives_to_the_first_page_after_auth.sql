-- TASK-SIGNDOOR — the door a person came in by survives the trip to the first
-- page after authentication.
--
-- THE MOVE. `/sign/guest|rider|horse|rider+horse` now asks for the email address
-- and nothing else (owner: *"it was supposed to only ask for their email
-- address"*). Everything it used to ask — name, phone, the FIX1 minor question,
-- the address — is asked on the FIRST page after auth, the `details` step of
-- src/pages/app/Onboarding.tsx.
--
-- ⚠️ THE PROBLEM THAT MAKES THIS MIGRATION NECESSARY, AND THE SPEC HAD IT WRONG.
-- TASK-SIGNDOOR §6 trap 3 says the path survives as the person's STANDING
-- CATEGORIES, and that the post-auth flow can therefore read it back. It cannot.
-- `my_standing_categories()` reads the `groups` table; `groups` is written only
-- by `apply_affiliations()`, which is `derive_affiliations()`, which derives
-- RIDER/HORSE_OWNER/GUEST from EXECUTED DOCUMENTS, PURCHASES and HORSES. A
-- brand-new self-service signup has none of the three. Proven on production,
-- 2026-09-01, in a rolled-back transaction:
--
--   BEGIN;
--   INSERT INTO contacts (org_id, first_name, last_name, email)
--     SELECT id, NULL, NULL, 'signdoor-probe@example.invalid' FROM organizations LIMIT 1;
--   SELECT derive_affiliations(<new id>);  -- (empty)
--   SELECT apply_affiliations(<new id>);   -- {}
--   SELECT array_agg(group_type) FROM groups WHERE contact_id = <new id>;  -- {}
--   ROLLBACK;
--
-- So gating the post-auth minor question on categories would have hidden it from
-- EVERY door signup — which is precisely the AR7/FIX1 incident, reintroduced.
--
-- WHERE THE PATH ACTUALLY LIVES: `invitations.categories`, written by
-- `provision_client_invitation` from the endpoint's PATH_CATEGORIES map, and
-- `invitations.document_id`, which is set only by `invite_contract_counterparty`
-- (the `deal` door). Both are already there; this reads them back.
--
-- NO NEW COLUMN, NO SECOND CONCEPT (D18). `_sign_path_for_categories()` is the
-- INCUMBENT categories->path mapping — provision_client_invitation already calls
-- it to decide which paperwork a door assigns. This reuses that exact function.

-- ── 1. the path, read back off the invitation that brought them here ────────
CREATE OR REPLACE FUNCTION public.sign_path_for_contact(p_contact_id uuid)
RETURNS text
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_cats text[];
  v_doc  uuid;
BEGIN
  IF p_contact_id IS NULL THEN RETURN ''; END IF;
  -- The NEWEST invitation, because a re-invited person's current door is the one
  -- that just brought them here, not the one from a year ago.
  SELECT i.categories, i.document_id INTO v_cats, v_doc
    FROM invitations i
   WHERE i.contact_id = p_contact_id AND i.deleted_at IS NULL
   ORDER BY i.created_at DESC
   LIMIT 1;
  IF NOT FOUND THEN RETURN ''; END IF;
  -- A contract invitation IS the `deal` door: `invite_contract_counterparty` is
  -- the only writer of invitations.document_id, and /api/sign-start's deal branch
  -- is the only self-service caller of it. `kind` cannot be used for this — every
  -- invitation row on production carries kind='COMMUNITY' (22 of 22, checked).
  IF v_doc IS NOT NULL THEN RETURN 'deal'; END IF;
  RETURN coalesce(_sign_path_for_categories(coalesce(v_cats, ARRAY[]::text[])), '');
END;
$function$;

-- ⚠️ NOT A PUBLIC RPC, AND SAYING SO IS NOT ENOUGH. A freshly created function
-- picks up Supabase's default privileges for anon/authenticated, so the REVOKEs
-- below are what actually closes it (BOOKS1 2026-09-01). Its two callers are
-- SECURITY DEFINER functions owned by postgres, which grants do not gate.
REVOKE ALL ON FUNCTION public.sign_path_for_contact(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.sign_path_for_contact(uuid) FROM anon;
REVOKE ALL ON FUNCTION public.sign_path_for_contact(uuid) FROM authenticated;

-- ── 2. the ONE authority on which doors may carry a minor ───────────────────
-- Owner ruling 2026-08-31: *"sign/rider and sign/guest … are the only places a
-- minor is applicable. the other two cannot be a minor, one is a horse owner for
-- horse care services and the other is horse owner for deal party, both require a
-- person to be 18+ to be horse owner."* `rider+horse` is a RIDER door and asks
-- (FIX1 §A applied his RULE, not his count of four).
--
-- ⚠️ EXPRESSED AS A DENY-LIST, DELIBERATELY. '' — no invitation, or an invitation
-- with no categories — means we do not know which door they came in by, and the
-- safe answer is to ASK. Not asking is the 2026-08-28 incident (a child's name
-- became the account holder). Asking a horse owner an extra question is not.
CREATE OR REPLACE FUNCTION public._sign_path_allows_minor(p_path text)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
AS $function$
  SELECT lower(btrim(coalesce(p_path, ''))) NOT IN ('horse', 'deal');
$function$;

REVOKE ALL ON FUNCTION public._sign_path_allows_minor(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public._sign_path_allows_minor(text) FROM anon;
REVOKE ALL ON FUNCTION public._sign_path_allows_minor(text) FROM authenticated;

-- ── 3. the onboarding state carries it to the form ─────────────────────────
-- Body below is production's, unchanged apart from the three marked additions.
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
  v_ok       boolean;
  v_contracts jsonb := '[]'::jsonb;
  -- SIGNDOOR — the door the person came in by, carried forward (see below).
  v_sign_path text := '';
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'authentication required'; END IF;
  PERFORM ensure_my_membership();
  v_contact := coalesce(current_contact_id(), ensure_contact_for_profile(auth.uid()));
  IF v_contact IS NULL THEN
    RETURN jsonb_build_object('needed', false, 'profile_complete', false,
                              'documents', '[]'::jsonb, 'purchase', NULL, 'minor', NULL,
                              'horse_needed', false, 'prefill', NULL,
                              'contracts_waiting', '[]'::jsonb,
                              'sign_path', '');
  END IF;

  SELECT * INTO v_c FROM contacts WHERE id = v_contact;
  v_profile := contact_profile_complete(v_contact);

  -- ── SIGNDOOR — WHICH DOOR THEY CAME IN BY, ON THE FIRST PAGE AFTER AUTH ──
  -- The /sign/* door no longer asks for a name, a phone or a minor; this step
  -- does. But WHICH questions belong here depends on the path, and post-auth
  -- there is no path in the URL. It is read back from the invitation that
  -- brought them here — the only place it was ever written down.
  v_sign_path := sign_path_for_contact(v_contact);

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

  -- The horse step ALSO runs as a review whenever a horse document is required
  -- and not yet satisfied — the member confirms/completes the horse record the
  -- paperwork merges from before signing (staff re-assign, no purchase needed).
  -- Same shared predicate: this used to carry its own inline copy of the rule.
  IF NOT v_horse_needed THEN
    v_horse_needed := EXISTS (
      SELECT 1 FROM contact_required_documents crd
      WHERE crd.contact_id = v_contact
        AND crd.template_key IN ('HORSE_EMERGENCY_VET','RELEASE_HORSE_CARE')
        AND crd.skipped_at IS NULL   -- CLOSEOUT §1.6
        AND NOT contact_document_satisfied(v_contact, crd.template_key)
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
    ORDER BY coalesce((SELECT max(x.onboarding_order) FROM contract_templates x
                       WHERE x.template_key = ct.template_key), 99), ct.template_key
  LOOP
    -- Satisfaction is decided by the shared predicate, NOT by reading a status off
    -- whichever row sorts first. The row lookup below only chooses what to DISPLAY.
    v_ok := contact_document_satisfied(v_contact, req.template_key);

    SELECT d.id, d.status, coalesce(d.title, t.title) INTO v_doc, v_status, v_title
      FROM documents d
      JOIN contract_templates t ON t.id = d.template_id
      WHERE d.contact_id = v_contact AND t.template_key = req.template_key
        AND d.deleted_at IS NULL
        -- a superseded executed copy no longer satisfies (staff re-assign):
        -- prefer a live pending/current doc over superseded evidence.
      ORDER BY (d.status = 'EXECUTED' AND coalesce(d.current_status,'') <> 'superseded') DESC,
               (d.status <> 'EXECUTED') DESC,
               d.created_at DESC
      LIMIT 1;

    IF v_ok THEN
      v_status := 'EXECUTED';
    ELSIF v_doc IS NULL THEN
      SELECT title INTO v_title FROM contract_templates WHERE template_key = req.template_key;
      v_status := 'MISSING';
    ELSIF v_status = 'EXECUTED' THEN
      -- executed but not satisfying: superseded evidence, or (once the resign-floor
      -- migration lands) an explicit staff demand for a newer version. Either way
      -- the member must act, so it must NOT read as 'EXECUTED'. The UI treats every
      -- non-EXECUTED status as actionable.
      v_status := 'RESIGN_REQUIRED';
    END IF;

    IF NOT v_ok THEN v_needed := true; END IF;
    v_docs := v_docs || jsonb_build_object(
      'document_id', v_doc, 'template_key', req.template_key,
      'title', v_title, 'status', coalesce(v_status, 'MISSING'));
    v_doc := NULL; v_status := NULL; v_title := NULL; v_ok := NULL;
  END LOOP;

  -- INTAKE 2026-08-24 — AN INCOMPLETE PROFILE IS ITSELF A REASON TO BE HERE.
  -- v_needed was only ever set by the document loop above, so a member with
  -- nothing to sign never saw the intake form and we never learned their mobile
  -- number, date of birth or emergency contact. Since OFFERINGDOCS, having no
  -- documents is the normal state for anyone who has not bought anything.
  IF NOT v_profile THEN v_needed := true; END IF;

  -- ── P1 ITEM 2 — A WAITING CONTRACT IS SOMETHING TO DO ────────────────────
  --
  -- The onboarding surface asked three questions — documents, purchase, standing
  -- slot — and if all three were no, told the member "Nothing to do here." It
  -- never asked whether a CONTRACT was waiting, so a counterparty invited to a
  -- lease and nothing else was told she had nothing to do while her lease sat
  -- unsigned. (CR-64. Same shape as SLOTREACH's fix to the same condition.)
  --
  -- A contract is WAITING when she is a party to a live contract-engine document
  -- she has not signed and has not hidden. Executed, void and terminated
  -- documents are records of something finished and are never waiting.
  SELECT coalesce(jsonb_agg(jsonb_build_object(
           'document_id', x.id, 'title', x.title,
           'workflow_state', x.workflow_state) ORDER BY x.created_at), '[]'::jsonb)
    INTO v_contracts
    FROM (
      SELECT DISTINCT d.id, d.title, d.workflow_state, d.created_at
        FROM documents d
        JOIN document_parties dp ON dp.document_id = d.id AND dp.contact_id = v_contact
       WHERE d.deleted_at IS NULL
         AND d.contract_id IS NOT NULL
         AND coalesce(d.workflow_state, '') NOT IN ('executed', 'void', 'terminated')
         AND d.voided_at IS NULL
         AND d.terminated_at IS NULL
         AND NOT EXISTS (
           SELECT 1 FROM signatures s
            WHERE s.document_id = d.id AND s.deleted_at IS NULL
              AND s.signed_at IS NOT NULL AND s.signer_contact_id = v_contact)
         AND NOT EXISTS (
           SELECT 1 FROM document_party_hidden h
            WHERE h.document_id = d.id AND h.contact_id = v_contact)
    ) x;

  RETURN jsonb_build_object('needed', v_needed, 'profile_complete', v_profile,
                            'documents', v_docs, 'purchase', v_purchase, 'minor', v_minor,
                            'horse_needed', v_horse_needed, 'prefill', v_prefill,
                            'contracts_waiting', v_contracts,
                            'sign_path', coalesce(v_sign_path, ''));
END;
$function$;

-- ── 4. and the server re-decides the rule, exactly as the door does ────────
-- Body below is production's, unchanged apart from the one marked guard.
CREATE OR REPLACE FUNCTION public.update_my_onboarding_profile(p jsonb)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_contact   uuid;
  v_org       uuid;
  v_has_minor boolean;
  v_mf        text;
  v_ml        text;
  v_mdob      date;
  v_mname     text;
  v_minor_c   uuid;
  v_fn        text := NULLIF(trim(coalesce(p->>'first_name', '')), '');
  v_ln        text := NULLIF(trim(coalesce(p->>'last_name',  '')), '');
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'authentication required'; END IF;
  v_contact := coalesce(current_contact_id(), ensure_contact_for_profile(auth.uid()));
  IF v_contact IS NULL THEN RAISE EXCEPTION 'no contact record for this account'; END IF;

  UPDATE contacts SET
    -- Name: fill only when currently blank or a placeholder (= the email).
    first_name = CASE WHEN v_fn IS NOT NULL AND (NULLIF(trim(coalesce(first_name,'')),'') IS NULL
                        OR lower(trim(first_name)) = lower(coalesce(email,'')))
                      THEN v_fn ELSE first_name END,
    last_name  = CASE WHEN v_ln IS NOT NULL AND NULLIF(trim(coalesce(last_name,'')),'') IS NULL
                      THEN v_ln ELSE last_name END,
    phone         = coalesce(NULLIF(trim(p->>'phone'), ''), phone),
    -- INTAKE 2026-08-24. `phone` IS the mobile number (relabelled, not rewired);
    -- this is the alternate the person only wants TEXTS on.
    text_only_phone   = coalesce(NULLIF(trim(p->>'text_only_phone'), ''), text_only_phone),
    preferred_contact = coalesce(NULLIF(trim(p->>'preferred_contact'), ''), preferred_contact),
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
    updated_at    = now()
  WHERE id = v_contact;

  -- Mirror the name onto the profile (same fill-when-blank rule) so account
  -- surfaces show it too.
  UPDATE profiles SET
    first_name = CASE WHEN v_fn IS NOT NULL AND NULLIF(trim(coalesce(first_name,'')),'') IS NULL THEN v_fn ELSE first_name END,
    last_name  = CASE WHEN v_ln IS NOT NULL AND NULLIF(trim(coalesce(last_name,'')),'')  IS NULL THEN v_ln ELSE last_name END
  WHERE user_id = auth.uid();

  -- Minor rider handling — VERBATIM from the prior prod body (unchanged).
  IF p ? 'has_minor' THEN
    v_has_minor := coalesce((p->>'has_minor')::boolean, false);
    v_mf    := NULLIF(trim(coalesce(p->>'minor_first_name', '')), '');
    v_ml    := NULLIF(trim(coalesce(p->>'minor_last_name', '')), '');
    v_mdob  := NULLIF(trim(coalesce(p->>'minor_dob', '')), '')::date;
    v_mname := trim(coalesce(v_mf, '') || ' ' || coalesce(v_ml, ''));

    -- ⚠️ SIGNDOOR — THE PATH RULE IS RE-DECIDED HERE, exactly as the door
    -- re-decides it from MINOR_PATHS. The browser is not the authority on which
    -- doors may carry a child: a horse owner and a contract counterparty must be
    -- 18+ (owner ruling 2026-08-31), and an unknown path FAILS OPEN to asking,
    -- because not asking is the AR7 incident and asking is merely a question.
    -- A guardian who ALREADY has a minor attached is always allowed through —
    -- otherwise an edit to an existing child would be dropped in silence, which
    -- is the "reports success while doing nothing" failure this repo has most of.
    IF v_has_minor AND v_mf IS NOT NULL
       AND (_sign_path_allows_minor(sign_path_for_contact(v_contact))
            OR EXISTS (SELECT 1 FROM contacts m
                        WHERE m.guardian_contact_id = v_contact AND m.deleted_at IS NULL)) THEN
      -- FIX1 §A — ONE ENGINE. This block used to hold the find-or-create inline,
      -- and /api/sign-start now needs exactly the same act at the front door,
      -- before there is an account to run this function under. Rather than write
      -- a second minor concept at the door (D18: never leave a second write path
      -- beside a correct engine), the block moved to attach_minor_to_guardian()
      -- and both callers reach it. The behaviour here is byte-for-byte what it
      -- was: find this guardian's minor by name, else create it linked to them,
      -- and only ever FILL a missing date of birth.
      v_minor_c := attach_minor_to_guardian(v_contact, v_mf, v_ml, v_mdob);

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
$function$
;
