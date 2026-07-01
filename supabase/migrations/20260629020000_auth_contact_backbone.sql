/*
  # FHE CRM — Auth↔Contact Backbone (migration 9)

  Makes "the contact is the backbone" true at the auth seam: whenever a profile is
  created (i.e. someone signs up — email/password or Google), a contact record is
  created and linked, so every downstream action already hangs off a person.

  Additive. Pairs with migration 8 (which added profiles.contact_id + contacts).

  Design:
  - ensure_contact_for_profile(): SECURITY DEFINER, idempotent. Given a profile,
    find-or-create its contact (dedup by lower(email) to honor "stop duplicating
    records") and link profiles.contact_id. Returns the contact id.
  - AFTER INSERT trigger on profiles calls it, so the app keeps creating profiles
    exactly as it does today (client-side insert) with no behavior change — the
    backbone link just happens automatically.
  - Backfill: link every existing profile that has no contact yet, then we can rely
    on the invariant going forward.

  A contact at signup is a LEAD, not yet a CLIENT — the clients row is created later
  when a purchase/engagement is approved (Lead → Client → Engagement).
*/

CREATE OR REPLACE FUNCTION ensure_contact_for_profile(p_user_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_profile   profiles%ROWTYPE;
  v_contact_id uuid;
  v_full_name text;
BEGIN
  SELECT * INTO v_profile FROM profiles WHERE user_id = p_user_id;
  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  -- Already linked → nothing to do.
  IF v_profile.contact_id IS NOT NULL THEN
    RETURN v_profile.contact_id;
  END IF;

  v_full_name := NULLIF(trim(coalesce(v_profile.first_name,'') || ' ' || coalesce(v_profile.last_name,'')), '');
  IF v_full_name IS NULL THEN
    v_full_name := coalesce(v_profile.email, 'Unnamed Contact');
  END IF;

  -- Dedup: reuse an existing contact with the same email (case-insensitive) that
  -- isn't already bound to another profile; else create one.
  IF v_profile.email IS NOT NULL THEN
    SELECT c.id INTO v_contact_id
    FROM contacts c
    WHERE lower(c.email) = lower(v_profile.email)
      AND c.deleted_at IS NULL
      AND NOT EXISTS (SELECT 1 FROM profiles p2 WHERE p2.contact_id = c.id AND p2.user_id <> p_user_id)
    ORDER BY c.created_at
    LIMIT 1;
  END IF;

  IF v_contact_id IS NULL THEN
    INSERT INTO contacts (full_name, first_name, last_name, email, phone,
                          address_line1, address_line2, city, state, postal_code)
    VALUES (v_full_name, v_profile.first_name, v_profile.last_name, v_profile.email, v_profile.phone,
            v_profile.address_line1, v_profile.address_line2, v_profile.city, v_profile.state, v_profile.postal_code)
    RETURNING id INTO v_contact_id;
  END IF;

  UPDATE profiles SET contact_id = v_contact_id WHERE user_id = p_user_id;
  RETURN v_contact_id;
END;
$$;

-- Fire on profile creation. AFTER INSERT so the row exists for the function to read.
CREATE OR REPLACE FUNCTION profiles_link_contact()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM ensure_contact_for_profile(NEW.user_id);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS profiles_link_contact_trg ON profiles;
CREATE TRIGGER profiles_link_contact_trg AFTER INSERT ON profiles
  FOR EACH ROW EXECUTE FUNCTION profiles_link_contact();

-- Backfill existing profiles (idempotent — only those not yet linked).
DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT user_id FROM profiles WHERE contact_id IS NULL LOOP
    PERFORM ensure_contact_for_profile(r.user_id);
  END LOOP;
END $$;
