/*
  # Owner contacts seed (owner directive B, 2026-07-02)

  contacts.tags containing 'owner' renders an "Owner" badge in the contacts UI
  (table row + edit drawer). Seed for tenant #1:
    - the existing Charles Zigmund contact (seeded 20260701010000) gains the
      'owner' tag (fix-only, idempotent);
    - a Claire Zigmund contact is found-or-created with tags {'owner'} (tag
      appended when she already exists without it).

  Runs as superuser (auth.uid() IS NULL), so org_id is set explicitly from the
  first organization — same posture as the 20260701010000 identity seed. Runs
  AFTER 20260702090000: contacts carry first_name/last_name only.
*/

DO $$
DECLARE
  v_org     uuid;
  v_contact uuid;
BEGIN
  SELECT id INTO v_org FROM organizations ORDER BY created_at LIMIT 1;
  IF v_org IS NULL THEN
    RETURN;  -- no tenant seeded yet (shouldn't happen; migration 24 seeds one)
  END IF;

  -- Charles Zigmund — existing signatory contact gains the 'owner' tag.
  SELECT id INTO v_contact FROM contacts
    WHERE org_id = v_org AND first_name = 'Charles' AND last_name = 'Zigmund'
      AND deleted_at IS NULL
    ORDER BY created_at LIMIT 1;
  IF v_contact IS NOT NULL THEN
    UPDATE contacts SET tags = array_append(tags, 'owner')
      WHERE id = v_contact AND NOT ('owner' = ANY(tags));
  END IF;

  -- Claire Zigmund — find-or-create, tagged 'owner'.
  v_contact := NULL;
  SELECT id INTO v_contact FROM contacts
    WHERE org_id = v_org AND first_name = 'Claire' AND last_name = 'Zigmund'
      AND deleted_at IS NULL
    ORDER BY created_at LIMIT 1;
  IF v_contact IS NULL THEN
    INSERT INTO contacts (org_id, first_name, last_name, tags, notes)
      VALUES (v_org, 'Claire', 'Zigmund', ARRAY['owner'],
              'Business owner — seeded by the owner-badge pass (20260702100000).');
  ELSE
    UPDATE contacts SET tags = array_append(tags, 'owner')
      WHERE id = v_contact AND NOT ('owner' = ANY(tags));
  END IF;
END $$;
