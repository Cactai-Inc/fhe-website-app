-- TASK-FIX1 §A — the front door can attach the minor, through the spine that
-- already exists.
--
-- Source of truth: docs/reports/TASK-AR7-REPORT.md F1 (root cause) and R1.
--
-- THE DEFECT. /sign/* has one name field and every word on the page says it is
-- the rider's. A parent enrolling a child types the CHILD's name, and that name
-- becomes the account holder, the contact, the profile, the printed CLIENT slot
-- and the signature line. On 2026-08-28 that is exactly what happened, and the
-- corridor propagated it perfectly because nothing downstream was wrong.
--
-- THE SHAPE. Onboarding.tsx has asked the minor question since it shipped:
-- guardian is the account holder, minor is the non-signing PARTICIPANT, linked
-- by contacts.guardian_contact_id. my_onboarding_state() reads it back,
-- generate_my_onboarding_documents() puts the minor in the PARTICIPANT slot.
-- ⚠️ The door must reuse THAT spine, not invent a second minor concept.
--
-- So the find-or-create half of update_my_onboarding_profile's minor block is
-- lifted out verbatim into attach_minor_to_guardian(), and both the onboarding
-- RPC and /api/sign-start call it. One engine, two doors (D18).
--
-- The toggle-OFF half stays in update_my_onboarding_profile: detaching a minor
-- is a different act, it is only meaningful once someone is inside the corridor,
-- and it carries its own preservation rule (never disturb a minor whose
-- PARTICIPANT document has already executed).

-- ── the engine ──────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.attach_minor_to_guardian(
  p_guardian_contact_id uuid,
  p_first_name text,
  p_last_name  text,
  p_dob        date
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_org   uuid;
  v_mf    text := nullif(btrim(coalesce(p_first_name, '')), '');
  v_ml    text := nullif(btrim(coalesce(p_last_name,  '')), '');
  v_mname text;
  v_minor uuid;
BEGIN
  -- A minor with no first name is not a minor we can record. The onboarding
  -- caller already guards on this; the door does too. Returning NULL rather
  -- than raising keeps a half-filled optional block from failing a signup.
  IF p_guardian_contact_id IS NULL OR v_mf IS NULL THEN RETURN NULL; END IF;

  SELECT org_id INTO v_org FROM contacts
   WHERE id = p_guardian_contact_id AND deleted_at IS NULL;
  IF v_org IS NULL THEN
    RAISE EXCEPTION 'no such guardian contact: %', p_guardian_contact_id;
  END IF;

  v_mname := btrim(coalesce(v_mf, '') || ' ' || coalesce(v_ml, ''));

  -- Find this guardian's minor by name, else create one linked to them. Matching
  -- on name is what makes a repeat submission idempotent: a parent who signs up
  -- twice gets ONE child record, not two.
  SELECT id INTO v_minor FROM contacts
    WHERE guardian_contact_id = p_guardian_contact_id
      AND lower(btrim(coalesce(first_name, '') || ' ' || coalesce(last_name, ''))) = lower(v_mname)
      AND deleted_at IS NULL
    ORDER BY created_at LIMIT 1;

  IF v_minor IS NULL THEN
    INSERT INTO contacts (org_id, first_name, last_name, date_of_birth, guardian_contact_id)
      VALUES (v_org, v_mf, v_ml, p_dob, p_guardian_contact_id)
      RETURNING id INTO v_minor;
  ELSE
    -- FILL, never overwrite — the same rule fill_claimant_details applies to
    -- everything a public form supplies.
    UPDATE contacts SET date_of_birth = coalesce(date_of_birth, p_dob)
      WHERE id = v_minor;
  END IF;

  RETURN v_minor;
END;
$function$;

-- Not a public RPC. The two legitimate callers are update_my_onboarding_profile
-- (SECURITY DEFINER, owned by postgres, so grants do not gate it) and
-- /api/sign-start, which holds the service-role key. Nothing authenticated or
-- anonymous should be able to hang a child off an arbitrary guardian.
REVOKE ALL ON FUNCTION public.attach_minor_to_guardian(uuid, text, text, date) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.attach_minor_to_guardian(uuid, text, text, date) FROM anon;
REVOKE ALL ON FUNCTION public.attach_minor_to_guardian(uuid, text, text, date) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.attach_minor_to_guardian(uuid, text, text, date) TO service_role;

-- ── the onboarding caller now reaches it instead of holding a copy ──────────
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

    IF v_has_minor AND v_mf IS NOT NULL THEN
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
