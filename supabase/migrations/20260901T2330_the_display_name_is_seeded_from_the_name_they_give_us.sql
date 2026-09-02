-- OWNER, 2026-09-01: *"yes the display name should be populated from the name they
-- give us when they fill in the account information. that field exists so they can
-- change it if they want to from the profile page."*
--
-- ⚠️ NOTHING HAS EVER WRITTEN `profiles.display_name`. Measured before this
-- migration: **14 of 16 live accounts carry no value**, and a grep of every
-- function in the database found ~38 READERS and not one writer. That is why the
-- contact dossier printed "(no display name)" over Casey Caddell, whose name is on
-- her profile AND her contact.
--
-- 🔒 SEEDED, NOT OWNED. Every write below fills a BLANK and never overwrites. The
-- column belongs to the member the moment they set it.

-- ─── 1 · SEED IT WHERE THE NAME IS GIVEN ─────────────────────────────────────
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
    last_name  = CASE WHEN v_ln IS NOT NULL AND NULLIF(trim(coalesce(last_name,'')),'')  IS NULL THEN v_ln ELSE last_name END,
    -- ⚠️ THE DISPLAY NAME IS SEEDED FROM THE NAME THEY JUST GAVE US. Owner,
    -- 2026-09-01: *"the display name should be populated from the name they give
    -- us when they fill in the account information. that field exists so they can
    -- change it if they want to from the profile page."*
    -- Nothing has ever written this column — 14 of 16 live accounts carry no
    -- value — which is why the dossier said "(no display name)" for a person whose
    -- name was on the record twice.
    -- ⚠️ SEEDED, NOT OWNED. `NULLIF(trim(…)) IS NULL` means it fills a BLANK and
    -- never overwrites a value: the moment a member types their own handle, this
    -- stops touching it. That is the difference between a default and a rule.
    display_name = CASE
      WHEN NULLIF(trim(coalesce(display_name, '')), '') IS NULL
      THEN NULLIF(btrim(concat_ws(' ',
             coalesce(v_fn, first_name), coalesce(v_ln, last_name))), '')
      ELSE display_name END
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

-- ─── 2 · AND WHEREVER ELSE A NAME LANDS ON A PROFILE ─────────────────────────
-- ⚠️ ONE WRITER, NOT THREE. `promote_contact_to_account` and the provisioning
-- spine both set a profile's name, and a second and third copy of the rule above
-- would drift. A trigger states it once, for every path that will ever exist —
-- including the ones not written yet.
CREATE OR REPLACE FUNCTION public.trg_seed_display_name()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
BEGIN
  IF NULLIF(btrim(coalesce(NEW.display_name, '')), '') IS NULL THEN
    NEW.display_name := NULLIF(btrim(concat_ws(' ', NEW.first_name, NEW.last_name)), '');
  END IF;
  RETURN NEW;
END;
$function$;

-- ⚠️ `UPDATE OF first_name, last_name` FIRES ON THE COLUMNS THE STATEMENT NAMES,
-- not on the values that end up stored (TASK-ROLE §2a — three instances in two
-- days). That is exactly the behaviour wanted here: any statement that sets a name
-- gets the seed considered, and BEFORE means it costs no second write.
DROP TRIGGER IF EXISTS profiles_seed_display_name ON profiles;
CREATE TRIGGER profiles_seed_display_name
  BEFORE INSERT OR UPDATE OF first_name, last_name, display_name ON profiles
  FOR EACH ROW EXECUTE FUNCTION trg_seed_display_name();

-- ─── 3 · BACKFILL THE ACCOUNTS THAT ALREADY EXIST ────────────────────────────
-- Additive: only rows whose display name is blank AND whose name is known. Nobody
-- loses anything they chose (D32), because nobody has chosen anything yet.
UPDATE profiles
   SET display_name = NULLIF(btrim(concat_ws(' ', first_name, last_name)), '')
 WHERE NULLIF(btrim(coalesce(display_name, '')), '') IS NULL
   AND NULLIF(btrim(concat_ws(' ', first_name, last_name)), '') IS NOT NULL;
