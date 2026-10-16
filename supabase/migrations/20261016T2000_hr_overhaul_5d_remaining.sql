-- Horse records overhaul, phase 5d: the remaining readers/writers stop touching the
-- removed columns. Reads re-point to the provider and location helpers; staff_update
-- drops vet/farrier writes (those go through the provider RPCs).

-- staff_horse_records: vet/farrier/current_location come from the new structures.
CREATE OR REPLACE FUNCTION public.staff_horse_records()
 RETURNS TABLE(id uuid, registered_name text, nickname text, breed text, color text, markings text, sex text, date_of_birth date, height text, registration_number text, registration_org text, microchip_id text, current_location text, fair_market_value numeric, vet_name text, vet_phone text, farrier_name text, farrier_phone text, owner_contact_id uuid, owner_name text, owner_name_text text, lessee_contact_id uuid, lessee_name text, lessee_name_text text, lease_start date, lease_end date, document_count bigint, active_lease_doc jsonb, created_at timestamp with time zone)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT h.id, h.registered_name, h.nickname, h.breed, h.color,
         h.markings, h.sex, h.date_of_birth, h.height,
         h.registration_number, h.registration_org, h.microchip_id,
         coalesce(horse_current_location_label(h.id), h.current_location),
         h.fair_market_value,
         horse_provider_value(h.id,'VET','NAME'), horse_provider_value(h.id,'VET','PHONE'),
         horse_provider_value(h.id,'FARRIER','NAME'), horse_provider_value(h.id,'FARRIER','PHONE'),
         h.current_owner_contact_id,
         (SELECT trim(concat_ws(' ', c.first_name, c.last_name)) FROM contacts c WHERE c.id = h.current_owner_contact_id),
         h.owner_name_text,
         h.lessee_contact_id,
         (SELECT trim(concat_ws(' ', c.first_name, c.last_name)) FROM contacts c WHERE c.id = h.lessee_contact_id),
         h.lessee_name_text,
         h.lease_start, h.lease_end,
         (SELECT count(*) FROM documents d
           WHERE d.horse_id = h.id AND d.deleted_at IS NULL AND d.org_id = h.org_id),
         horse_active_lease_doc(h.id) AS active_lease_doc,
         h.created_at
  FROM horses h
  WHERE h.org_id = current_org() AND h.deleted_at IS NULL AND has_staff_access()
  ORDER BY coalesce(h.nickname, h.registered_name)
$function$;

-- staff_update_horse: vet/farrier writes removed; the rest is unchanged.
CREATE OR REPLACE FUNCTION public.staff_update_horse(p_id uuid, p jsonb)
 RETURNS void
 LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT has_staff_access() THEN RAISE EXCEPTION 'staff access required'; END IF;
  UPDATE horses SET
    registered_name   = coalesce(nullif(p ->> 'registered_name', ''), registered_name),
    nickname          = CASE WHEN p ? 'nickname' THEN nullif(p ->> 'nickname', '') ELSE nickname END,
    breed             = CASE WHEN p ? 'breed' THEN nullif(p ->> 'breed', '') ELSE breed END,
    color             = CASE WHEN p ? 'color' THEN nullif(p ->> 'color', '') ELSE color END,
    markings          = CASE WHEN p ? 'markings' THEN nullif(p ->> 'markings', '') ELSE markings END,
    sex               = CASE WHEN p ? 'sex' THEN nullif(p ->> 'sex', '') ELSE sex END,
    height            = CASE WHEN p ? 'height' THEN nullif(p ->> 'height', '') ELSE height END,
    current_location  = CASE WHEN p ? 'current_location' THEN nullif(p ->> 'current_location', '') ELSE current_location END,
    fair_market_value = CASE WHEN p ? 'fair_market_value'
                             THEN nullif(replace(replace(p ->> 'fair_market_value', '$', ''), ',', ''), '')::numeric
                             ELSE fair_market_value END,
    updated_at = now()
  WHERE id = p_id AND org_id = current_org() AND deleted_at IS NULL;
  IF NOT FOUND THEN RAISE EXCEPTION 'horse not found in this org'; END IF;
END;
$function$;

-- member_horses: the "home_location" display name comes from the open horse_locations
-- row (the FK pointer is gone). The replace targets only that one subselect.
DO $mh$
DECLARE v_def text;
BEGIN
  SELECT pg_get_functiondef('public.member_horses'::regproc) INTO v_def;
  v_def := replace(v_def,
    $o$'home_location', (SELECT name FROM locations WHERE id = h.home_location_id))$o$,
    $n$'home_location', horse_current_location_label(h.id))$n$);
  EXECUTE v_def;
END $mh$;

-- apply_contract_execution_effects: the sale/lease birth-from-contract INSERT no
-- longer sets vet/farrier columns; instead it seeds primary provider rows from the
-- contract's horse fields after the horse exists.
DO $ace$
DECLARE v_def text;
BEGIN
  SELECT pg_get_functiondef('public.apply_contract_execution_effects'::regproc) INTO v_def;
  v_def := replace(v_def,
    $o$    INSERT INTO horses (org_id, registered_name, nickname, breed, color, sex,
                        registration_number, microchip_id, current_location,
                        fair_market_value, vet_name, vet_phone, farrier_name,
                        farrier_phone, created_by_contact_id, current_owner_contact_id)$o$,
    $n$    INSERT INTO horses (org_id, registered_name, nickname, breed, color, sex,
                        registration_number, microchip_id, current_location,
                        fair_market_value, created_by_contact_id, current_owner_contact_id)$n$);
  v_def := replace(v_def,
    $o$            nullif(v_fields ->> 'HORSE.VET_NAME', ''),
            nullif(v_fields ->> 'HORSE.VET_PHONE', ''),
            nullif(v_fields ->> 'HORSE.FARRIER_NAME', ''),
            nullif(v_fields ->> 'HORSE.FARRIER_PHONE', ''),
            v_lessor, v_lessor)
    RETURNING id INTO v_horse;$o$,
    $n$            v_lessor, v_lessor)
    RETURNING id INTO v_horse;
    IF nullif(v_fields ->> 'HORSE.VET_NAME','') IS NOT NULL THEN
      INSERT INTO horse_relationships (org_id, horse_id, relationship, provider_role, party_name_text, phone, active, created_by_contact_id)
      VALUES (NEW.org_id, v_horse, 'VET', 'primary', nullif(v_fields ->> 'HORSE.VET_NAME',''), nullif(v_fields ->> 'HORSE.VET_PHONE',''), true, v_lessor);
    END IF;
    IF nullif(v_fields ->> 'HORSE.FARRIER_NAME','') IS NOT NULL THEN
      INSERT INTO horse_relationships (org_id, horse_id, relationship, provider_role, party_name_text, phone, active, created_by_contact_id)
      VALUES (NEW.org_id, v_horse, 'FARRIER', 'primary', nullif(v_fields ->> 'HORSE.FARRIER_NAME',''), nullif(v_fields ->> 'HORSE.FARRIER_PHONE',''), true, v_lessor);
    END IF;$n$);
  EXECUTE v_def;
END $ace$;
