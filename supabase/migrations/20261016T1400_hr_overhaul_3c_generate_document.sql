-- Horse records overhaul, phase 3c: generate_document's HORSE token branch reads
-- vet, farrier, location and conditions from the new structures. The home/current
-- location variables it computed from the removed FK pointers are replaced by the
-- horse_locations helper.

DO $gd$
DECLARE
  v_def text;
BEGIN
  SELECT pg_get_functiondef('public.generate_document(uuid,text,uuid,uuid,jsonb,text,uuid[])'::regprocedure) INTO v_def;

  -- location variables now come from horse_locations (the FK pointers are gone)
  v_def := replace(v_def,
    $o$    v_home_loc := coalesce(location_full_label(v_horse.home_location_id), '');
    v_curr_loc := coalesce(location_full_label(v_horse.current_location_id), '');$o$,
    $n$    v_home_loc := coalesce(horse_current_location_label(v_horse.id), '');
    v_curr_loc := coalesce(horse_current_location_label(v_horse.id), '');$n$);

  -- vet / farrier / conditions from providers + lists
  v_def := replace(v_def,
    $o$        WHEN 'VET_NAME'            THEN v_horse.vet_name
        WHEN 'VET_PHONE'           THEN v_horse.vet_phone
        WHEN 'FARRIER_NAME'        THEN v_horse.farrier_name
        WHEN 'FARRIER_PHONE'       THEN v_horse.farrier_phone$o$,
    $n$        WHEN 'VET_NAME'            THEN horse_provider_value(v_horse.id, 'VET', 'NAME')
        WHEN 'VET_PHONE'           THEN horse_provider_value(v_horse.id, 'VET', 'PHONE')
        WHEN 'FARRIER_NAME'        THEN horse_provider_value(v_horse.id, 'FARRIER', 'NAME')
        WHEN 'FARRIER_PHONE'       THEN horse_provider_value(v_horse.id, 'FARRIER', 'PHONE')$n$);

  v_def := replace(v_def,
    $o$        WHEN 'KNOWN_CONDITIONS'        THEN v_horse.known_conditions$o$,
    $n$        WHEN 'KNOWN_CONDITIONS'        THEN horse_list_prose(v_horse.known_conditions_list, 'condition')$n$);

  v_def := replace(v_def,
    $o$        WHEN 'VET_BUSINESS'        THEN v_horse.vet_business_name
        WHEN 'VET_ADDRESS'         THEN compose_vet_address(v_horse.vet_address_line1, v_horse.vet_city, v_horse.vet_state, v_horse.vet_postal)$o$,
    $n$        WHEN 'VET_BUSINESS'        THEN horse_provider_value(v_horse.id, 'VET', 'BUSINESS')
        WHEN 'VET_ADDRESS'         THEN horse_provider_value(v_horse.id, 'VET', 'ADDRESS')$n$);

  -- the create-from-contract INSERT referenced removed columns; drop those two
  -- assignments so the shell row is created without them (providers are seeded
  -- by apply_contract_execution_effects separately).
  v_def := replace(v_def,
    $o$            nullif(v_fields ->> 'HORSE.VET_NAME', ''),
            nullif(v_fields ->> 'HORSE.VET_PHONE', ''),
            nullif(v_fields ->> 'HORSE.FARRIER_NAME', ''),
            nullif(v_fields ->> 'HORSE.FARRIER_PHONE', ''),
            v_lessor, v_lessor)$o$,
    $n$            v_lessor, v_lessor)$n$);
  v_def := replace(v_def,
    $o$    INSERT INTO horses (org_id, registered_name, nickname, breed, color, sex,
                        registration_number, microchip_id, current_location,
                        fair_market_value, vet_name, vet_phone, farrier_name,
                        farrier_phone, created_by_contact_id, current_owner_contact_id)$o$,
    $n$    INSERT INTO horses (org_id, registered_name, nickname, breed, color, sex,
                        registration_number, microchip_id, current_location,
                        fair_market_value, created_by_contact_id, current_owner_contact_id)$n$);

  EXECUTE v_def;
END $gd$;
