-- Horse records overhaul, phase 2: move existing data into the new structures.
-- Runs before any column is removed. "N/A" and empty values are not providers.

-- ── Current location → horse_locations open row ─────────────────────────────
INSERT INTO public.horse_locations
  (org_id, horse_id, name, address_line1, city, state, postal, keeping_spots, notes, start_on, end_on)
SELECT h.org_id, h.id, l.name, l.address_line1, l.city, l.state, l.postal,
       coalesce(h.current_keeping_spots, '[]'::jsonb), h.current_location_notes, NULL, NULL
  FROM horses h
  JOIN locations l ON l.id = h.current_location_id
 WHERE h.deleted_at IS NULL
   AND NOT EXISTS (SELECT 1 FROM horse_locations hl WHERE hl.horse_id = h.id AND hl.end_on IS NULL);

-- ── Vet provider (person + company) → VET relationship, primary ─────────────
INSERT INTO public.horse_relationships
  (org_id, horse_id, relationship, provider_role, party_name_text, business_name, phone,
   address_line1, city, state, postal, active, created_by_contact_id)
SELECT h.org_id, h.id, 'VET', 'primary',
       nullif(btrim(h.vet_name), ''), nullif(btrim(h.vet_business_name), ''), nullif(btrim(h.vet_phone), ''),
       nullif(btrim(h.vet_address_line1), ''), nullif(btrim(h.vet_city), ''),
       nullif(btrim(h.vet_state), ''), nullif(btrim(h.vet_postal), ''),
       true, h.current_owner_contact_id
  FROM horses h
 WHERE h.deleted_at IS NULL
   AND nullif(btrim(h.vet_name), '') IS NOT NULL AND h.vet_name <> 'N/A'
   AND NOT EXISTS (SELECT 1 FROM horse_relationships r WHERE r.horse_id = h.id AND r.relationship = 'VET');

-- ── Farrier provider → FARRIER relationship, primary ────────────────────────
INSERT INTO public.horse_relationships
  (org_id, horse_id, relationship, provider_role, party_name_text, phone, active, created_by_contact_id)
SELECT h.org_id, h.id, 'FARRIER', 'primary',
       nullif(btrim(h.farrier_name), ''), nullif(btrim(h.farrier_phone), ''),
       true, h.current_owner_contact_id
  FROM horses h
 WHERE h.deleted_at IS NULL
   AND nullif(btrim(h.farrier_name), '') IS NOT NULL AND h.farrier_name <> 'N/A'
   AND NOT EXISTS (SELECT 1 FROM horse_relationships r WHERE r.horse_id = h.id AND r.relationship = 'FARRIER');

-- ── Care team (trainer / care giver / groom / other) → relationship rows ────
-- Values are a person's name. "Claire Bourdon" maps to her existing contact; any
-- other name is stored as entered. Home and current collapse to one row per
-- (horse, type, person) — the same person in the same role is one provider.
INSERT INTO public.horse_relationships
  (org_id, horse_id, relationship, provider_role, party_contact_id, party_name_text, role_label, active, created_by_contact_id)
SELECT DISTINCT ON (s.horse_id, s.rel, lower(s.nm))
       s.org_id, s.horse_id, s.rel, 'primary',
       (SELECT c.id FROM contacts c
         WHERE c.org_id = s.org_id AND c.deleted_at IS NULL
           AND lower(btrim(c.first_name || ' ' || c.last_name)) = lower(s.nm) LIMIT 1),
       s.nm, s.role_label, true, s.owner
  FROM (
    SELECT h.org_id, h.id AS horse_id, h.current_owner_contact_id AS owner,
           v.rel, btrim(v.nm) AS nm, v.role_label
      FROM horses h
      JOIN LATERAL (
        SELECT 'TRAINER'::text AS rel, h.home_trainer AS nm, NULL::text AS role_label
        UNION ALL SELECT 'TRAINER', h.current_trainer, NULL
        UNION ALL SELECT 'CARE_GIVER', h.home_care_giver, NULL
        UNION ALL SELECT 'CARE_GIVER', h.current_care_giver, NULL
        UNION ALL SELECT 'GROOM', h.home_groom, NULL
        UNION ALL SELECT 'GROOM', h.current_groom, NULL
        UNION ALL SELECT 'OTHER', h.home_other_person, 'Other'
        UNION ALL SELECT 'OTHER', h.current_other_person, 'Other'
      ) v ON true
     WHERE h.deleted_at IS NULL
       AND nullif(btrim(v.nm), '') IS NOT NULL AND v.nm <> 'N/A'
  ) s
 ORDER BY s.horse_id, s.rel, lower(s.nm);

-- ── Narrative single values → first entry of each list (item 7) ─────────────
UPDATE horses SET medical_history_list =
  CASE WHEN nullif(btrim(medical_history),'') IS NOT NULL AND medical_history <> 'N/A'
       THEN jsonb_build_array(jsonb_build_object('summary', medical_history)) ELSE '[]'::jsonb END
WHERE deleted_at IS NULL;
UPDATE horses SET behavioral_history_list =
  CASE WHEN nullif(btrim(behavioral_history),'') IS NOT NULL AND behavioral_history <> 'N/A'
       THEN jsonb_build_array(jsonb_build_object('concern', behavioral_history)) ELSE '[]'::jsonb END
WHERE deleted_at IS NULL;
UPDATE horses SET known_conditions_list =
  CASE WHEN nullif(btrim(known_conditions),'') IS NOT NULL AND known_conditions <> 'N/A'
       THEN jsonb_build_array(jsonb_build_object('condition', known_conditions)) ELSE '[]'::jsonb END
WHERE deleted_at IS NULL;
UPDATE horses SET training_history_list =
  CASE WHEN nullif(btrim(training_history),'') IS NOT NULL AND training_history <> 'N/A'
       THEN jsonb_build_array(jsonb_build_object('entry', training_history)) ELSE '[]'::jsonb END
WHERE deleted_at IS NULL;
UPDATE horses SET competition_history_list =
  CASE WHEN nullif(btrim(competition_history),'') IS NOT NULL AND competition_history <> 'N/A'
       THEN jsonb_build_array(jsonb_build_object('entry', competition_history)) ELSE '[]'::jsonb END
WHERE deleted_at IS NULL;
