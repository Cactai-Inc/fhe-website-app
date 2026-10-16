-- Horse records overhaul, phase 3d: create_horse_record and update_horse_record stop
-- writing the removed columns (vet, farrier, narrative singles) and accept the new
-- jsonb columns (pending_fields, the narrative lists, injuries). Vet/farrier/care-team
-- are written through the provider RPCs; locations through horse_locations.

CREATE OR REPLACE FUNCTION public.create_horse_record(p jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_me    uuid := current_contact_id();
  v_org   uuid := current_org();
  v_chip  text := nullif(regexp_replace(coalesce(p ->> 'microchip_id', ''), '\s', '', 'g'), '');
  v_match horses%ROWTYPE;
  v_id    uuid;
  v_leased boolean := lower(coalesce(p ->> 'is_leased', 'no')) IN ('yes','true','1');
  v_owner_text  text := nullif(trim(concat_ws(' ', p ->> 'owner_name_text',
                          CASE WHEN nullif(p ->> 'owner_email','') IS NOT NULL
                               THEN '(' || (p ->> 'owner_email') || ')' END)), '');
  v_lessee_text text := nullif(trim(concat_ws(' ', p ->> 'lessee_name_text',
                          CASE WHEN nullif(p ->> 'lessee_email','') IS NOT NULL
                               THEN '(' || (p ->> 'lessee_email') || ')' END)), '');
BEGIN
  IF auth.uid() IS NULL OR v_me IS NULL THEN
    RAISE EXCEPTION 'an authenticated member account is required to create a horse record';
  END IF;
  IF has_staff_access() AND nullif(p ->> 'owner_contact_id','') IS NOT NULL THEN
    v_me := (p ->> 'owner_contact_id')::uuid;
  END IF;

  IF v_org IS NULL THEN RAISE EXCEPTION 'no org context'; END IF;
  -- Only a nickname (or registered name) is required to create a record.
  IF coalesce(nullif(trim(p ->> 'nickname'), ''), nullif(trim(p ->> 'registered_name'), '')) IS NULL THEN
    RAISE EXCEPTION 'a horse name is required';
  END IF;

  IF v_chip IS NOT NULL THEN
    SELECT * INTO v_match FROM horses
     WHERE org_id = v_org AND deleted_at IS NULL
       AND regexp_replace(coalesce(microchip_id, ''), '\s', '', 'g') = v_chip
     LIMIT 1;
    IF FOUND THEN
      IF has_staff_access() OR client_can_read_horse(v_match.id) THEN
        RETURN jsonb_build_object('outcome', 'match_found', 'horse_id', v_match.id);
      ELSE
        INSERT INTO horse_reconciliation
          (org_id, existing_horse_id, claimed_by_contact_id, claim_type, claim_note, match_method)
        VALUES (v_org, v_match.id, v_me, 'OWNER', nullif(p ->> 'claim_note', ''), 'MICROCHIP');
        RETURN jsonb_build_object('outcome', 'match_pending_review');
      END IF;
    END IF;
  END IF;

  INSERT INTO horses (
    org_id, registered_name, nickname, breed, color, markings, sex,
    date_of_birth, height, registration_number, registration_org,
    microchip_id, passport_number, passport_country, current_location,
    fair_market_value, euthanasia_authorization,
    pending_fields,
    medical_history_list, behavioral_history_list, known_conditions_list,
    training_history_list, competition_history_list, injuries_to_humans,
    created_by_contact_id, current_owner_contact_id, owner_name_text,
    lessee_contact_id, lessee_name_text, lease_start, lease_end)
  VALUES (
    v_org,
    nullif(trim(coalesce(p ->> 'registered_name', p ->> 'nickname')), ''),
    nullif(trim(p ->> 'nickname'), ''),
    nullif(p ->> 'breed', ''), nullif(p ->> 'color', ''), nullif(p ->> 'markings', ''),
    nullif(p ->> 'sex', ''),
    (nullif(p ->> 'date_of_birth', ''))::date,
    nullif(p ->> 'height', ''),
    nullif(p ->> 'registration_number', ''), nullif(p ->> 'registration_org', ''),
    v_chip, nullif(p ->> 'passport_number', ''), nullif(p ->> 'passport_country', ''),
    nullif(p ->> 'current_location', ''),
    nullif(replace(replace(coalesce(p ->> 'fair_market_value', ''), '$', ''), ',', ''), '')::numeric,
    nullif(p ->> 'euthanasia_authorization',''),
    coalesce(p -> 'pending_fields', '[]'::jsonb),
    coalesce(p -> 'medical_history_list', '[]'::jsonb),
    coalesce(p -> 'behavioral_history_list', '[]'::jsonb),
    coalesce(p -> 'known_conditions_list', '[]'::jsonb),
    coalesce(p -> 'training_history_list', '[]'::jsonb),
    coalesce(p -> 'competition_history_list', '[]'::jsonb),
    coalesce(p -> 'injuries_to_humans', '[]'::jsonb),
    v_me, v_me, v_owner_text,
    NULL, v_lessee_text,
    CASE WHEN v_leased THEN (nullif(p ->> 'lease_start', ''))::date END,
    CASE WHEN v_leased THEN (nullif(p ->> 'lease_end', ''))::date END)
  RETURNING id INTO v_id;

  INSERT INTO horse_relationships
    (org_id, horse_id, relationship, party_contact_id, created_by_contact_id)
  VALUES (v_org, v_id, 'OWNER', v_me, v_me);
  IF v_leased AND v_lessee_text IS NOT NULL THEN
    INSERT INTO horse_relationships
      (org_id, horse_id, relationship, party_name_text, created_by_contact_id, term_start, term_end)
    VALUES (v_org, v_id, 'LESSEE', v_lessee_text, v_me,
            (nullif(p ->> 'lease_start',''))::date, (nullif(p ->> 'lease_end',''))::date);
  END IF;

  IF v_chip IS NULL THEN
    INSERT INTO horse_reconciliation
      (org_id, existing_horse_id, claimed_by_contact_id, claim_type, claim_note, match_method)
    SELECT v_org, h.id, v_me, 'OTHER',
           'possible duplicate of new record ' || v_id::text, 'FUZZY'
    FROM horses h
    WHERE h.org_id = v_org AND h.deleted_at IS NULL AND h.id <> v_id
      AND lower(coalesce(h.registered_name, '')) = lower(coalesce(p ->> 'registered_name', ''))
      AND h.date_of_birth IS NOT DISTINCT FROM (nullif(p ->> 'date_of_birth',''))::date
      AND coalesce(h.color, '') = coalesce(p ->> 'color', '')
    LIMIT 3;
  END IF;

  RETURN jsonb_build_object('outcome', 'created', 'horse_id', v_id);
END;
$function$;

CREATE OR REPLACE FUNCTION public.update_horse_record(p_id uuid, p jsonb)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE v_org uuid;
BEGIN
  SELECT org_id INTO v_org FROM horses WHERE id = p_id AND deleted_at IS NULL;
  IF v_org IS NULL THEN RAISE EXCEPTION 'unknown horse'; END IF;
  IF NOT (has_staff_access() OR caller_owns_horse(p_id)) THEN
    RAISE EXCEPTION 'not authorized for this horse';
  END IF;

  UPDATE horses SET
    registered_name     = CASE WHEN p ? 'registered_name'     THEN nullif(btrim(p ->> 'registered_name'),'')     ELSE registered_name END,
    nickname            = CASE WHEN p ? 'nickname'            THEN nullif(btrim(p ->> 'nickname'),'')            ELSE nickname END,
    breed               = CASE WHEN p ? 'breed'               THEN nullif(btrim(p ->> 'breed'),'')               ELSE breed END,
    color               = CASE WHEN p ? 'color'               THEN nullif(btrim(p ->> 'color'),'')               ELSE color END,
    markings            = CASE WHEN p ? 'markings'            THEN nullif(btrim(p ->> 'markings'),'')            ELSE markings END,
    sex                 = CASE WHEN p ? 'sex'                 THEN nullif(btrim(p ->> 'sex'),'')                 ELSE sex END,
    date_of_birth       = CASE WHEN p ? 'date_of_birth'       THEN nullif(p ->> 'date_of_birth','')::date        ELSE date_of_birth END,
    height              = CASE WHEN p ? 'height'              THEN nullif(btrim(p ->> 'height'),'')              ELSE height END,
    registration_number = CASE WHEN p ? 'registration_number' THEN nullif(btrim(p ->> 'registration_number'),'') ELSE registration_number END,
    registration_org    = CASE WHEN p ? 'registration_org'    THEN nullif(btrim(p ->> 'registration_org'),'')    ELSE registration_org END,
    microchip_id        = CASE WHEN p ? 'microchip_id'        THEN nullif(btrim(p ->> 'microchip_id'),'')        ELSE microchip_id END,
    passport_number     = CASE WHEN p ? 'passport_number'     THEN nullif(btrim(p ->> 'passport_number'),'')     ELSE passport_number END,
    passport_country    = CASE WHEN p ? 'passport_country'    THEN nullif(btrim(p ->> 'passport_country'),'')    ELSE passport_country END,
    fair_market_value   = CASE WHEN p ? 'fair_market_value'   THEN nullif(regexp_replace(coalesce(p ->> 'fair_market_value',''),'[$,\s]','','g'),'')::numeric ELSE fair_market_value END,
    euthanasia_authorization = CASE WHEN p ? 'euthanasia_authorization' THEN nullif(btrim(p ->> 'euthanasia_authorization'),'') ELSE euthanasia_authorization END,
    pending_fields           = CASE WHEN p ? 'pending_fields'           THEN coalesce(p -> 'pending_fields', '[]'::jsonb)           ELSE pending_fields END,
    medical_history_list     = CASE WHEN p ? 'medical_history_list'     THEN coalesce(p -> 'medical_history_list', '[]'::jsonb)     ELSE medical_history_list END,
    behavioral_history_list  = CASE WHEN p ? 'behavioral_history_list'  THEN coalesce(p -> 'behavioral_history_list', '[]'::jsonb)  ELSE behavioral_history_list END,
    known_conditions_list    = CASE WHEN p ? 'known_conditions_list'    THEN coalesce(p -> 'known_conditions_list', '[]'::jsonb)    ELSE known_conditions_list END,
    training_history_list    = CASE WHEN p ? 'training_history_list'    THEN coalesce(p -> 'training_history_list', '[]'::jsonb)    ELSE training_history_list END,
    competition_history_list = CASE WHEN p ? 'competition_history_list' THEN coalesce(p -> 'competition_history_list', '[]'::jsonb) ELSE competition_history_list END,
    injuries_to_humans       = CASE WHEN p ? 'injuries_to_humans'       THEN coalesce(p -> 'injuries_to_humans', '[]'::jsonb)       ELSE injuries_to_humans END,
    updated_at = now()
  WHERE id = p_id;
END;
$function$;
