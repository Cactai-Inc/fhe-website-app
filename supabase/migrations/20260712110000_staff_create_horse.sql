/*
  # staff_create_horse_for_contact — record a client's horse from the ops side

  Owner case: Sarah owns a horse we want to lease. She was invited before
  engagement-creation existed, so her horse was never captured — there's no
  record, so a lease contract can't reference it. create_horse_record runs as
  the caller (a client adding THEIR own horse). Staff need to create a horse
  OWNED BY a chosen contact. This does that, with the same microchip-dedup
  discipline (an existing chip returns the match instead of duplicating).
*/

CREATE OR REPLACE FUNCTION staff_create_horse_for_contact(
  p_owner_contact_id uuid,
  p jsonb
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $fn$
DECLARE
  v_org   uuid := current_org();
  v_chip  text := nullif(regexp_replace(coalesce(p ->> 'microchip_id', ''), '\s', '', 'g'), '');
  v_id    uuid;
  v_name  text := nullif(trim(coalesce(p ->> 'registered_name', p ->> 'barn_name', '')), '');
BEGIN
  IF NOT has_staff_access() THEN
    RAISE EXCEPTION 'staff access required';
  END IF;
  IF p_owner_contact_id IS NULL
     OR NOT EXISTS (SELECT 1 FROM contacts c WHERE c.id = p_owner_contact_id
                     AND c.org_id = v_org AND c.deleted_at IS NULL) THEN
    RAISE EXCEPTION 'owner contact not found in this org';
  END IF;
  IF v_name IS NULL THEN
    RAISE EXCEPTION 'a horse name is required';
  END IF;

  -- breed/color are FK-constrained to lookup tables; ensure any supplied value
  -- exists (staff entry is trusted) so a new breed/color doesn't reject.
  IF nullif(trim(p ->> 'breed'), '') IS NOT NULL THEN
    INSERT INTO horse_breeds (code, display_name)
    VALUES (trim(p ->> 'breed'), trim(p ->> 'breed'))
    ON CONFLICT (code) DO NOTHING;
  END IF;
  IF nullif(trim(p ->> 'color'), '') IS NOT NULL THEN
    INSERT INTO horse_colors (code, display_name)
    VALUES (trim(p ->> 'color'), trim(p ->> 'color'))
    ON CONFLICT (code) DO NOTHING;
  END IF;

  -- microchip dedup: reveal the existing record instead of duplicating
  IF v_chip IS NOT NULL THEN
    SELECT id INTO v_id FROM horses
     WHERE org_id = v_org AND deleted_at IS NULL
       AND regexp_replace(coalesce(microchip_id,''), '\s', '', 'g') = v_chip
     LIMIT 1;
    IF v_id IS NOT NULL THEN
      RETURN jsonb_build_object('horse_id', v_id, 'outcome', 'match_found');
    END IF;
  END IF;

  INSERT INTO horses (
    org_id, registered_name, barn_name, breed, color, sex,
    date_of_birth, height, registration_number, microchip_id,
    current_location, current_owner_contact_id
  ) VALUES (
    v_org,
    coalesce(nullif(trim(p ->> 'registered_name'), ''), v_name),
    nullif(trim(p ->> 'barn_name'), ''),
    nullif(trim(p ->> 'breed'), ''),
    nullif(trim(p ->> 'color'), ''),
    nullif(trim(p ->> 'sex'), ''),
    nullif(p ->> 'date_of_birth', '')::date,
    nullif(trim(p ->> 'height'), ''),
    nullif(trim(p ->> 'registration_number'), ''),
    v_chip,
    nullif(trim(p ->> 'current_location'), ''),
    p_owner_contact_id
  )
  RETURNING id INTO v_id;

  -- ownership history row (mirrors create_horse_record)
  INSERT INTO horse_relationships
    (org_id, horse_id, relationship, party_contact_id, created_by_contact_id)
  VALUES (v_org, v_id, 'OWNER', p_owner_contact_id, current_contact_id());

  RETURN jsonb_build_object('horse_id', v_id, 'outcome', 'created');
END;
$fn$;

GRANT EXECUTE ON FUNCTION staff_create_horse_for_contact(uuid, jsonb) TO authenticated;
