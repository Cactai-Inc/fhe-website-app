-- First-login intake captures the account holder's name.
--
-- Email-only invites create a nameless contact (name is deferred to first-login
-- intake per the invite spec). update_my_onboarding_profile now accepts
-- first_name/last_name and writes them to the holder's contact (and mirrors to
-- the profile) so the printed name merges into documents and the type-to-sign
-- gate has a name to match. Name is only filled when currently blank or a
-- placeholder (never overwrites a real name already on file).
--
-- Rebuilds update_my_onboarding_profile from its current prod body with the two
-- name columns added to the contacts UPDATE plus a profiles name mirror.

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
$function$;
