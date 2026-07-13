/*
  # Company identity — every admin acts AS French Heritage Equestrian

  Owner: "whether I do it or hello@ does it, everything we do should appear as
  the same unified French Heritage Equestrian account. If I add a horse, or
  hello@ adds a horse, it belongs to the same root."

  Mechanism: a single canonical COMPANY contact per org (contacts.is_company).
  company_contact_id() resolves it (creating it once from business_config /
  brand name). For STAFF, "the company's own" scope resolves to this contact,
  not the individual admin's personal contact. So:
   - the company stable = horses owned by the company contact (my_stable v3)
   - a horse an admin records "as the company" is owned by the company contact
   - admins keep their personal contact for THEIR signatures on documents;
     but company-facing artifacts (stable, company posts) attribute to the
     company root.

  This migration adds the anchor + company_contact_id() + my_stable v3. Create
  paths ("add a horse as the company") are wired in the app layer.
*/

ALTER TABLE contacts ADD COLUMN IF NOT EXISTS is_company boolean NOT NULL DEFAULT false;
CREATE UNIQUE INDEX IF NOT EXISTS one_company_contact_per_org
  ON contacts (org_id) WHERE is_company AND deleted_at IS NULL;

-- Resolve (and lazily create) the org's single company contact.
CREATE OR REPLACE FUNCTION company_contact_id()
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $fn$
DECLARE
  v_org  uuid := current_org();
  v_id   uuid;
  v_name text;
BEGIN
  IF v_org IS NULL THEN RETURN NULL; END IF;
  SELECT id INTO v_id FROM contacts
   WHERE org_id = v_org AND is_company AND deleted_at IS NULL LIMIT 1;
  IF v_id IS NOT NULL THEN RETURN v_id; END IF;

  -- create it once, named from the brand registry (fallback: org name)
  SELECT cv.value_text INTO v_name FROM config_values cv
   WHERE cv.org_id = v_org AND cv.namespace = 'BRAND' AND cv.key = 'NAME';
  IF v_name IS NULL THEN
    SELECT name INTO v_name FROM organizations WHERE id = v_org;
  END IF;
  v_name := coalesce(v_name, 'The Company');

  INSERT INTO contacts (org_id, first_name, last_name, is_company)
  VALUES (v_org, v_name, NULL, true)
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$fn$;

-- my_stable_horses v3: STAFF see the COMPANY stable (company-owned + horses
-- leased TO the company). Clients keep their personal stable, unchanged.
CREATE OR REPLACE FUNCTION my_stable_horses()
RETURNS TABLE (
  id uuid, registered_name text, barn_name text, breed text, sex text,
  height text, date_of_birth date, color text, current_location text,
  is_owner boolean, created_at timestamptz, lease_start date, lease_end date
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $fn$
DECLARE
  v_scope uuid;
BEGIN
  -- staff act as the company; clients act as themselves
  v_scope := CASE WHEN has_staff_access() THEN company_contact_id()
                  ELSE current_contact_id() END;
  RETURN QUERY
  SELECT h.id, h.registered_name, h.barn_name, h.breed, h.sex, h.height,
         h.date_of_birth, h.color, h.current_location,
         (h.current_owner_contact_id = v_scope) AS is_owner,
         h.created_at, h.lease_start, h.lease_end
  FROM horses h
  WHERE h.deleted_at IS NULL
    AND h.org_id = current_org()
    AND (
      h.current_owner_contact_id = v_scope
      OR h.lessee_contact_id     = v_scope
      OR EXISTS (
        SELECT 1 FROM horse_parties hp
        WHERE hp.horse_id = h.id AND hp.deleted_at IS NULL
          AND hp.contact_id = v_scope
          AND (hp.effective_to IS NULL OR hp.effective_to >= current_date)
      )
    )
  ORDER BY h.created_at;
END;
$fn$;

GRANT EXECUTE ON FUNCTION company_contact_id() TO authenticated;
GRANT EXECUTE ON FUNCTION my_stable_horses() TO authenticated;

-- Seed FHE's company contact so it exists immediately (company_contact_id()
-- also creates it lazily, but seeding avoids a first-call race and makes it
-- selectable in the party picker from the start).
INSERT INTO contacts (org_id, first_name, is_company)
SELECT 'e656f20b-ef43-4725-9029-19e7f0190d9c', 'French Heritage Equestrian', true
WHERE NOT EXISTS (
  SELECT 1 FROM contacts
  WHERE org_id = 'e656f20b-ef43-4725-9029-19e7f0190d9c' AND is_company AND deleted_at IS NULL
);
