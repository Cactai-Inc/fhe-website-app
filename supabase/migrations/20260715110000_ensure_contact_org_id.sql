-- ROOT-CAUSE FIX for invite acceptance dying silently.
--
-- ensure_contact_for_profile() (fired by the profiles_link_contact trigger on
-- every profile insert) inserted into contacts WITHOUT an org_id. contacts.org_id
-- is NOT NULL and defaults to current_org(), which reads org_id back off the
-- CURRENT user's profile. During an invite where the profile is being inserted
-- with a null org_id (e.g. a bare upsertMyProfile), current_org() returns null →
-- the contacts insert violates the NOT NULL constraint → the whole profile insert
-- ABORTS. The invitee then has no profile, no membership, no staff_profiles row,
-- and lands on the "finishing setup / refresh" dead-end.
--
-- Fix: resolve the org explicitly from the profile (falling back to current_org()),
-- stamp it on the contact insert, and if NO org can be resolved, SKIP linking a
-- contact rather than aborting the profile write. A profile without a contact is
-- recoverable (ensure_contact_for_profile is idempotent and re-runs later);
-- a profile that never got created is not.

CREATE OR REPLACE FUNCTION public.ensure_contact_for_profile(p_user_id uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_profile   profiles%ROWTYPE;
  v_contact_id uuid;
  v_first text;
  v_last  text;
  v_org   uuid;
BEGIN
  SELECT * INTO v_profile FROM profiles WHERE user_id = p_user_id;
  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  -- Already linked — nothing to do.
  IF v_profile.contact_id IS NOT NULL THEN
    RETURN v_profile.contact_id;
  END IF;

  -- Resolve the org: the profile's own org first, then the session org. If we
  -- can't determine one, DON'T abort the profile write — skip contact creation
  -- and let a later call (with an org in context) link it.
  v_org := coalesce(v_profile.org_id, current_org());
  IF v_org IS NULL THEN
    RETURN NULL;
  END IF;

  v_first := NULLIF(trim(coalesce(v_profile.first_name, '')), '');
  v_last  := NULLIF(trim(coalesce(v_profile.last_name,  '')), '');
  IF v_first IS NULL AND v_last IS NULL THEN
    -- nameless profile: the email (or a placeholder) stands in until the person
    -- supplies a legal name (sign_release heals exactly this shape).
    v_first := coalesce(v_profile.email, 'Unnamed Contact');
  END IF;

  -- Dedup: reuse an existing contact with the same email (case-insensitive) that
  -- isn't already bound to another profile; else create one.
  IF v_profile.email IS NOT NULL THEN
    SELECT c.id INTO v_contact_id
    FROM contacts c
    WHERE lower(c.email) = lower(v_profile.email)
      AND c.org_id = v_org
      AND c.deleted_at IS NULL
      AND NOT EXISTS (SELECT 1 FROM profiles p2 WHERE p2.contact_id = c.id AND p2.user_id <> p_user_id)
    ORDER BY c.created_at
    LIMIT 1;
  END IF;

  IF v_contact_id IS NULL THEN
    INSERT INTO contacts (org_id, first_name, last_name, email, phone,
                          address_line1, address_line2, city, state, postal_code)
    VALUES (v_org, v_first, v_last, v_profile.email, v_profile.phone,
            v_profile.address_line1, v_profile.address_line2, v_profile.city, v_profile.state, v_profile.postal_code)
    RETURNING id INTO v_contact_id;
  END IF;

  UPDATE profiles SET contact_id = v_contact_id WHERE user_id = p_user_id;
  RETURN v_contact_id;
END;
$function$;
