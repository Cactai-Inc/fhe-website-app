-- TASK-FIX1 §B — a resubmission must not be silently discarded.
--
-- Source of truth: docs/reports/TASK-AR7-REPORT.md F2 and R2.
--
-- WHAT HAPPENED. Evan LaBuzetta typed his daughter's name into /sign/rider,
-- noticed 109 seconds later, and resubmitted with his own. /api/sign-start
-- returned status:'sent', signup_attempts.email_ok went true, and the screen
-- told him the email had gone out. THE NAME WAS DISCARDED IN SILENCE, because
-- fill_claimant_details writes BLANKS ONLY and the record was no longer blank.
-- He then signed four legal documents under his daughter's name.
--
-- ⚠️ THE BLANKS-ONLY RULE IS CORRECT AND IS NOT WEAKENED HERE. It exists so a
-- public, unauthenticated form can never overwrite what staff hold, and it must
-- keep that property exactly: anyone who knows an email address can post to this
-- endpoint. fill_claimant_details is untouched. This is a SECOND, narrower
-- function that the door calls only when it can prove the submission is the same
-- person correcting their own prior submission.
--
-- ── WHY "UPDATE" AND NOT "TELL THEM IT WAS NOT APPLIED" ─────────────────────
-- The task offered both and asked for one, justified. Telling them is not
-- actually available on this surface: /api/sign-start is deliberately an
-- anti-enumeration endpoint — "the response must not reveal whether an address
-- is already known to us", and a brand-new address and a returning one report
-- the identical status today. A screen that says "we could not apply your name
-- to the record we already hold" IS the disclosure that this endpoint exists to
-- withhold, and it leaks the held name on top. So the honest answer is to make
-- the correction land, and then have the screen echo the name it will use —
-- which is the visitor's own input and discloses nothing.
--
-- ── THE FOUR GUARDS, AND WHAT EACH ONE IS FOR ───────────────────────────────
--  1. SAME REQUESTER. There must already be a signup_attempts row for this email
--     carrying the SAME requester_hash (sha256(ip|user-agent)). This is what
--     preserves blanks-only's real property: a stranger who knows an address
--     still cannot touch that contact, because their hash is different.
--     ⚠️ Verified against the incident: both of Evan's attempts carry the same
--     hash, 2c5a51fdf3d59214…, so the real case passes this guard.
--  2. NOTHING SIGNED. D22 §3, owner 2026-08-20: "THE NAME IS THE SIGNATURE AND
--     CANNOT BE CHANGED. Contact details CAN." Once this contact has sealed a
--     signature the name is evidence, and correcting it is supersede-and-reissue
--     (FIX1 §E), never an UPDATE through a public door.
--  3. NO HUMAN HAS SET IT. If any audit_logs row shows a real actor_user_id
--     changing first_name or last_name on this contact, a person decided that
--     name in-app — staff on the phone, or the member themselves through
--     ConfirmNameModal — and the door does not overrule a human. Writes from the
--     door itself run as service-role and carry a NULL actor, so they never
--     trip this.
--  4. IT MUST ACTUALLY DIFFER. Identical input changes nothing and reports
--     nothing, so the send-state screen never announces a correction that was
--     really just a second identical submission.

CREATE OR REPLACE FUNCTION public.correct_claimant_name_from_signup(
  p_contact_id     uuid,
  p_first_name     text,
  p_last_name      text,
  p_requester_hash text
) RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_c     contacts%ROWTYPE;
  v_first text := nullif(btrim(coalesce(p_first_name, '')), '');
  v_last  text := nullif(btrim(coalesce(p_last_name,  '')), '');
BEGIN
  -- Same authorization gate fill_claimant_details uses. The door holds the
  -- service-role key; nothing anonymous reaches this.
  IF NOT (coalesce(auth.role(), '') = 'service_role' OR has_staff_access()) THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  IF p_contact_id IS NULL OR v_first IS NULL THEN RETURN false; END IF;
  IF nullif(btrim(coalesce(p_requester_hash, '')), '') IS NULL THEN RETURN false; END IF;

  SELECT * INTO v_c FROM contacts WHERE id = p_contact_id AND deleted_at IS NULL;
  IF NOT FOUND THEN RETURN false; END IF;

  -- 4. it must actually differ
  IF btrim(coalesce(v_c.first_name, '')) = v_first
     AND btrim(coalesce(v_c.last_name, '')) IS NOT DISTINCT FROM v_last THEN
    RETURN false;
  END IF;

  -- 1. same requester, on an earlier attempt for this same address
  IF v_c.email IS NULL OR NOT EXISTS (
       SELECT 1 FROM signup_attempts sa
        WHERE lower(sa.email) = lower(v_c.email)
          AND sa.requester_hash = p_requester_hash) THEN
    RETURN false;
  END IF;

  -- 2. nothing signed
  IF EXISTS (SELECT 1 FROM signatures s
              WHERE s.signer_contact_id = p_contact_id
                AND s.deleted_at IS NULL AND s.signed_at IS NOT NULL) THEN
    RETURN false;
  END IF;

  -- 3. no human has deliberately set this name in-app
  IF EXISTS (
       SELECT 1 FROM audit_logs a
        WHERE a.table_name = 'contacts' AND a.action = 'UPDATE'
          AND a.record_id = p_contact_id
          AND a.actor_user_id IS NOT NULL
          AND (a.old_value->>'first_name' IS DISTINCT FROM a.new_value->>'first_name'
            OR a.old_value->>'last_name'  IS DISTINCT FROM a.new_value->>'last_name')) THEN
    RETURN false;
  END IF;

  -- family_sort_key is maintained by contacts_family_sort_key_trg and the name
  -- reaches profiles through sync_profile_name_from_contact_trg. Neither is
  -- written by hand here — that is what made the incident traceable at all.
  UPDATE contacts
     SET first_name = v_first,
         last_name  = v_last,
         name_needs_confirmation = false,
         updated_at = now()
   WHERE id = p_contact_id;

  RETURN true;
END;
$function$;

REVOKE ALL ON FUNCTION public.correct_claimant_name_from_signup(uuid, text, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.correct_claimant_name_from_signup(uuid, text, text, text) FROM anon;
REVOKE ALL ON FUNCTION public.correct_claimant_name_from_signup(uuid, text, text, text) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.correct_claimant_name_from_signup(uuid, text, text, text) TO service_role;
