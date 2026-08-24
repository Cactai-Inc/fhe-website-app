-- TASK-INTAKE — one mobile number, a texts-only alternate, and an onboarding
-- flow that surfaces when there is nothing to sign.
--
-- Owner, 2026-08-24: "we still need the onboarding flow intake form surfaced even
-- when the documents are not going to be signed, the entire profile is missing
-- valuable information... we should be collecting the mobile number on intake not
-- a 'contact number for phone calls', there is no difference with mobile — the
-- only difference is if they want to add an alternate number for texts only...
-- this field for contact phone (for calls) should be relabeled mobile number and
-- the mobile number field can be removed. I suggest doing it that way instead of
-- removing the main phone field since renaming is less work than rewiring."
--
-- Agreed, and the data agrees harder than the argument does: of 25 contacts,
-- `phone` holds 21 numbers and `mobile` holds 2 — one of which duplicates the
-- phone exactly, and one of which (Pamela Godde) is the ONLY number on the record
-- while `phone` is empty. So `phone` is the real column, `mobile` is a near-empty
-- shadow of it, and a party token reading `phone` prints a blank for the one
-- person whose number lives in the other one.
--
--   phone           -> THE mobile number. Relabelled everywhere, not rewired.
--   text_only_phone -> NEW. An alternate the person only wants texts on.
--   mobile          -> retained, unused by the UI (D32). Its values are folded in.

-- 1. Nobody loses a number. Only fills a blank; never overwrites.
UPDATE contacts SET phone = mobile
 WHERE phone IS NULL AND mobile IS NOT NULL AND deleted_at IS NULL;

-- 2. The texts-only alternate.
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS text_only_phone text;
COMMENT ON COLUMN contacts.text_only_phone IS
  'An alternate number the person wants TEXTS ONLY on. `phone` is their mobile and '
  'the number we call. Added 2026-08-24 (TASK-INTAKE).';

-- Phone normalisation already runs on contacts; keep the new column in it if the
-- trigger names its columns explicitly.
DO $norm$
DECLARE v_def text;
BEGIN
  SELECT pg_get_triggerdef(oid) INTO v_def
    FROM pg_trigger WHERE tgrelid = 'contacts'::regclass AND tgname LIKE '%normalise_phone%';
  IF v_def IS NOT NULL AND position('text_only_phone' IN v_def) = 0 THEN
    RAISE NOTICE 'contacts phone-normalisation trigger does not cover text_only_phone: %', v_def;
  END IF;
END
$norm$;

-- 3. Staff may edit it — the allowlist RAISES on an unknown key, so it must be named.
DO $mig$
DECLARE v_src text;
BEGIN
  SELECT pg_get_functiondef(oid) INTO v_src FROM pg_proc WHERE proname = 'update_contact_record';
  IF v_src IS NULL THEN RAISE EXCEPTION 'update_contact_record not found'; END IF;
  IF position('text_only_phone' IN v_src) > 0 THEN
    RAISE NOTICE 'already allowlisted'; RETURN;
  END IF;
  v_src := replace(v_src,
    $q$'first_name','last_name','email','phone','phone_ext','mobile','mobile_ext','whatsapp',$q$,
    $q$'first_name','last_name','email','phone','phone_ext','mobile','mobile_ext','whatsapp','text_only_phone',$q$);
  IF position('text_only_phone' IN v_src) = 0 THEN
    RAISE EXCEPTION 'could not extend the update_contact_record allowlist';
  END IF;
  EXECUTE v_src;
END
$mig$;

-- 4. ⚠️ THE ONBOARDING FLOW SURFACES FOR AN INCOMPLETE PROFILE, NOT ONLY FOR
--    UNSIGNED DOCUMENTS.
--
-- `v_needed` was set true in exactly one place: inside the loop over required
-- documents. So a person with nothing to sign — which is now the NORMAL state for
-- anyone who has not bought anything (OFFERINGDOCS) — was never shown the intake
-- form at all, and their date of birth, emergency contact and phone were never
-- asked for. The owner: "the entire profile is missing valuable information."
--
-- `contact_profile_complete` already knows the answer (phone + DOB + emergency
-- contact name and phone). It just was not consulted.
DO $mig$
DECLARE v_src text; v_old text;
BEGIN
  SELECT pg_get_functiondef(oid) INTO v_src FROM pg_proc WHERE proname = 'my_onboarding_state';
  IF v_src IS NULL THEN RAISE EXCEPTION 'my_onboarding_state not found'; END IF;
  IF position('-- INTAKE 2026-08-24' IN v_src) > 0 THEN
    RAISE NOTICE 'already surfaces for an incomplete profile'; RETURN;
  END IF;

  v_old := '  RETURN jsonb_build_object(''needed'', v_needed, ''profile_complete'', v_profile,';
  IF position(v_old IN v_src) = 0 THEN
    RAISE EXCEPTION 'my_onboarding_state is not the shape this migration expected';
  END IF;

  v_src := replace(v_src, v_old,
'  -- INTAKE 2026-08-24 — AN INCOMPLETE PROFILE IS ITSELF A REASON TO BE HERE.
  -- v_needed was only ever set by the document loop above, so a member with
  -- nothing to sign never saw the intake form and we never learned their mobile
  -- number, date of birth or emergency contact. Since OFFERINGDOCS, having no
  -- documents is the normal state for anyone who has not bought anything.
  IF NOT v_profile THEN v_needed := true; END IF;

' || v_old);
  EXECUTE v_src;
END
$mig$;
