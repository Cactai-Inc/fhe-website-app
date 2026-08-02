-- profiles.phone retirement (D14 closure, 2026-08-02), step 1: the one staff
-- account with no contact row gets one, the standard way — a TEAM contact in
-- the org, linked via profiles.contact_id. Carries the profile's phone (none
-- today) so the column can drop once every reader is repointed.
DO $$
DECLARE
  v_org uuid;
  v_contact uuid;
  v_phone text;
BEGIN
  SELECT id INTO v_org FROM organizations LIMIT 1;
  SELECT phone INTO v_phone FROM profiles WHERE user_id = '3c5d6af1-ce10-45c0-afbb-1ddbdfc77bd5';

  IF NOT EXISTS (SELECT 1 FROM profiles WHERE user_id = '3c5d6af1-ce10-45c0-afbb-1ddbdfc77bd5' AND contact_id IS NOT NULL) THEN
    SELECT id INTO v_contact FROM contacts WHERE org_id = v_org AND email = 'admin@cactai.io';
    IF v_contact IS NULL THEN
      INSERT INTO contacts (org_id, first_name, last_name, email, phone, contact_type)
        VALUES (v_org, 'CACTAI', 'INC.', 'admin@cactai.io', v_phone, 'TEAM')
        RETURNING id INTO v_contact;
    END IF;
    UPDATE profiles SET contact_id = v_contact WHERE user_id = '3c5d6af1-ce10-45c0-afbb-1ddbdfc77bd5';
  END IF;
END $$;
