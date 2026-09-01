-- SPEC H.8 backend — the staff horse-records surface. Trainers are servicing
-- staff (two-operator model) but horses table writes are admin-only RLS and
-- reads are owner/party-scoped; these SECURITY DEFINER RPCs give ALL staff the
-- records surface: list (full fields + current parties + document count),
-- descriptive edit, and party assignment (owner/lessee) that writes history.

CREATE OR REPLACE FUNCTION staff_horse_records()
RETURNS TABLE (
  id uuid, registered_name text, barn_name text, breed text, color text,
  markings text, sex text, date_of_birth date, height text,
  registration_number text, registration_org text, microchip_id text,
  current_location text, fair_market_value numeric,
  vet_name text, vet_phone text, farrier_name text, farrier_phone text,
  owner_contact_id uuid, owner_name text, owner_name_text text,
  lessee_contact_id uuid, lessee_name text, lessee_name_text text,
  lease_start date, lease_end date, sublease_allowed boolean,
  document_count bigint, created_at timestamptz
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT h.id, h.registered_name, h.barn_name, h.breed, h.color,
         h.markings, h.sex, h.date_of_birth, h.height,
         h.registration_number, h.registration_org, h.microchip_id,
         h.current_location, h.fair_market_value,
         h.vet_name, h.vet_phone, h.farrier_name, h.farrier_phone,
         h.current_owner_contact_id,
         (SELECT trim(concat_ws(' ', c.first_name, c.last_name)) FROM contacts c WHERE c.id = h.current_owner_contact_id),
         h.owner_name_text,
         h.lessee_contact_id,
         (SELECT trim(concat_ws(' ', c.first_name, c.last_name)) FROM contacts c WHERE c.id = h.lessee_contact_id),
         h.lessee_name_text,
         h.lease_start, h.lease_end, h.sublease_allowed,
         (SELECT count(*) FROM horse_relationships r
           WHERE r.horse_id = h.id AND r.source_document_id IS NOT NULL),
         h.created_at
  FROM horses h
  WHERE h.org_id = current_org()
    AND h.deleted_at IS NULL
    AND has_staff_access()
  ORDER BY coalesce(h.barn_name, h.registered_name)
$$;

CREATE OR REPLACE FUNCTION staff_update_horse(p_id uuid, p jsonb)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $fn$
BEGIN
  IF NOT has_staff_access() THEN
    RAISE EXCEPTION 'staff access required';
  END IF;
  UPDATE horses SET
    registered_name     = coalesce(nullif(p ->> 'registered_name', ''), registered_name),
    barn_name           = CASE WHEN p ? 'barn_name' THEN nullif(p ->> 'barn_name', '') ELSE barn_name END,
    breed               = CASE WHEN p ? 'breed' THEN nullif(p ->> 'breed', '') ELSE breed END,
    color               = CASE WHEN p ? 'color' THEN nullif(p ->> 'color', '') ELSE color END,
    markings            = CASE WHEN p ? 'markings' THEN nullif(p ->> 'markings', '') ELSE markings END,
    sex                 = CASE WHEN p ? 'sex' THEN nullif(p ->> 'sex', '') ELSE sex END,
    height              = CASE WHEN p ? 'height' THEN nullif(p ->> 'height', '') ELSE height END,
    current_location    = CASE WHEN p ? 'current_location' THEN nullif(p ->> 'current_location', '') ELSE current_location END,
    fair_market_value   = CASE WHEN p ? 'fair_market_value'
                               THEN nullif(replace(replace(p ->> 'fair_market_value', '$', ''), ',', ''), '')::numeric
                               ELSE fair_market_value END,
    vet_name            = CASE WHEN p ? 'vet_name' THEN nullif(p ->> 'vet_name', '') ELSE vet_name END,
    vet_phone           = CASE WHEN p ? 'vet_phone' THEN nullif(p ->> 'vet_phone', '') ELSE vet_phone END,
    farrier_name        = CASE WHEN p ? 'farrier_name' THEN nullif(p ->> 'farrier_name', '') ELSE farrier_name END,
    farrier_phone       = CASE WHEN p ? 'farrier_phone' THEN nullif(p ->> 'farrier_phone', '') ELSE farrier_phone END,
    sublease_allowed    = CASE WHEN p ? 'sublease_allowed'
                               THEN lower(p ->> 'sublease_allowed') IN ('yes','true','1')
                               ELSE sublease_allowed END,
    updated_at = now()
  WHERE id = p_id AND org_id = current_org() AND deleted_at IS NULL;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'horse not found in this org';
  END IF;
END;
$fn$;

-- assign/reassign a party pointer + write the history row (staff)
CREATE OR REPLACE FUNCTION staff_assign_horse_party(
  p_horse_id   uuid,
  p_role       text,          -- 'OWNER' | 'LESSEE'
  p_contact_id uuid,          -- NULL clears (e.g. lease ended)
  p_term_start date DEFAULT NULL,
  p_term_end   date DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $fn$
DECLARE
  v_org uuid := current_org();
BEGIN
  IF NOT has_staff_access() THEN
    RAISE EXCEPTION 'staff access required';
  END IF;
  IF p_role NOT IN ('OWNER','LESSEE') THEN
    RAISE EXCEPTION 'role must be OWNER or LESSEE';
  END IF;

  IF p_role = 'OWNER' THEN
    UPDATE horse_relationships SET active = false, ended_at = now()
     WHERE horse_id = p_horse_id AND relationship = 'OWNER' AND active
       AND (p_contact_id IS NULL OR party_contact_id IS DISTINCT FROM p_contact_id);
    UPDATE horses SET current_owner_contact_id = p_contact_id, updated_at = now()
     WHERE id = p_horse_id AND org_id = v_org;
  ELSE
    UPDATE horse_relationships SET active = false, ended_at = now()
     WHERE horse_id = p_horse_id AND relationship = 'LESSEE' AND active
       AND (p_contact_id IS NULL OR party_contact_id IS DISTINCT FROM p_contact_id);
    UPDATE horses
       SET lessee_contact_id = p_contact_id,
           lease_start = CASE WHEN p_contact_id IS NULL THEN NULL ELSE coalesce(p_term_start, lease_start) END,
           lease_end   = CASE WHEN p_contact_id IS NULL THEN NULL ELSE coalesce(p_term_end, lease_end) END,
           updated_at = now()
     WHERE id = p_horse_id AND org_id = v_org;
  END IF;

  IF p_contact_id IS NOT NULL THEN
    INSERT INTO horse_relationships
      (org_id, horse_id, relationship, party_contact_id, term_start, term_end,
       created_by_contact_id)
    VALUES (v_org, p_horse_id, p_role, p_contact_id, p_term_start, p_term_end,
            current_contact_id());
  END IF;
END;
$fn$;

-- light staff contact search for the assignment picker
CREATE OR REPLACE FUNCTION staff_contact_options()
RETURNS TABLE (id uuid, name text, email text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT c.id, trim(concat_ws(' ', c.first_name, c.last_name)), c.email
  FROM contacts c
  WHERE c.org_id = current_org() AND has_staff_access()
  ORDER BY c.last_name NULLS LAST, c.first_name
$$;

GRANT EXECUTE ON FUNCTION staff_horse_records() TO authenticated;
GRANT EXECUTE ON FUNCTION staff_update_horse(uuid, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION staff_assign_horse_party(uuid, text, uuid, date, date) TO authenticated;
GRANT EXECUTE ON FUNCTION staff_contact_options() TO authenticated;
