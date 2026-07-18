-- Rename barn_name→nickname in all 11 functions + update attach_horse_to_document
-- and set_horse_locations to the barn+stall split. Three functions that return
-- nickname as an output column are dropped+recreated (row type changed).
CREATE OR REPLACE FUNCTION public.set_horse_locations(p_horse_id uuid, p_payload jsonb)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_org uuid; v_owner uuid; v_me uuid := current_contact_id(); v_staff boolean := has_staff_access();
  v_target_owner uuid;
  v_home_id uuid; v_curr_id uuid;
  v_home jsonb := p_payload -> 'home';
  v_curr jsonb := p_payload -> 'current';
BEGIN
  SELECT org_id, current_owner_contact_id INTO v_org, v_owner FROM horses WHERE id = p_horse_id AND deleted_at IS NULL;
  IF v_org IS NULL THEN RAISE EXCEPTION 'unknown horse'; END IF;
  IF NOT (v_staff AND v_org = current_org()) THEN
    IF v_me IS NULL OR v_me NOT IN (
      (SELECT current_owner_contact_id FROM horses WHERE id = p_horse_id),
      (SELECT lessee_contact_id FROM horses WHERE id = p_horse_id)
    ) THEN RAISE EXCEPTION 'not authorized for this horse'; END IF;
  END IF;
  v_target_owner := coalesce(v_owner, v_me);

  -- HOME
  IF v_home IS NOT NULL AND nullif(btrim(v_home ->> 'name'), '') IS NOT NULL THEN
    v_home_id := public._resolve_location(v_org, v_target_owner, v_home);
  END IF;

  -- CURRENT (only when provided AND distinct); otherwise current mirrors home
  IF v_curr IS NOT NULL AND nullif(btrim(v_curr ->> 'name'), '') IS NOT NULL THEN
    v_curr_id := public._resolve_location(v_org, v_target_owner, v_curr);
  ELSE
    v_curr_id := v_home_id;
    v_curr := v_home;
  END IF;

  UPDATE horses SET
      home_location_id     = coalesce(v_home_id, home_location_id),
      current_location_id  = coalesce(v_curr_id, current_location_id),
      current_location     = coalesce((SELECT name FROM locations WHERE id = v_curr_id), current_location),
      home_barn            = v_home ->> 'barn',
      home_stall           = v_home ->> 'stall',
      home_location_notes  = v_home ->> 'notes',
      home_trainer         = v_home ->> 'trainer',
      home_care_giver      = v_home ->> 'care_giver',
      home_groom           = v_home ->> 'groom',
      home_other_person    = v_home ->> 'other',
      current_barn         = v_curr ->> 'barn',
      current_stall        = v_curr ->> 'stall',
      current_location_notes = v_curr ->> 'notes',
      current_trainer      = v_curr ->> 'trainer',
      current_care_giver   = v_curr ->> 'care_giver',
      current_groom        = v_curr ->> 'groom',
      current_other_person = v_curr ->> 'other',
      updated_at = now()
   WHERE id = p_horse_id;
END;
$function$;

DROP FUNCTION IF EXISTS public.my_listable_horses(text);
DROP FUNCTION IF EXISTS public.my_stable_horses();
DROP FUNCTION IF EXISTS public.staff_horse_records();
CREATE OR REPLACE FUNCTION public.my_listable_horses(p_intent text DEFAULT 'sale'::text)
 RETURNS TABLE(id uuid, registered_name text, nickname text, breed text, color text, sex text, height text, date_of_birth date)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT h.id, h.registered_name, h.nickname, h.breed, h.color, h.sex,
         h.height, h.date_of_birth
  FROM horses h
  WHERE h.org_id = current_org() AND h.deleted_at IS NULL
    AND (
      has_staff_access()
      OR h.current_owner_contact_id = current_contact_id()
      OR h.lessee_contact_id = current_contact_id()
    )
    AND can_list_horse(h.id, p_intent)
  ORDER BY coalesce(h.nickname, h.registered_name)
$function$;

CREATE OR REPLACE FUNCTION public.attach_horse_to_document(p_document_id uuid, p_horse_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_me      uuid := current_contact_id();
  v_staff   boolean := has_staff_access();
  v_org     uuid;
  v_state   text;
  v_horse   horses%ROWTYPE;
  v_breed   text;
  v_color   text;
  v_markings text;
  v_reg_org  text;
  v_passport_country text;
  v_home_loc text;
  v_curr_loc text;
  r         record;
  v_val     text;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'authentication required'; END IF;

  SELECT org_id, workflow_state INTO v_org, v_state FROM documents WHERE id = p_document_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'unknown document'; END IF;
  IF v_state NOT IN ('editable', 'editing', 'in_review') THEN
    RAISE EXCEPTION 'this contract can no longer be edited';
  END IF;

  IF NOT (v_staff AND v_org = current_org()) THEN
    IF NOT EXISTS (SELECT 1 FROM document_parties dp WHERE dp.document_id = p_document_id AND dp.contact_id = v_me) THEN
      RAISE EXCEPTION 'not authorized for this document';
    END IF;
  END IF;

  SELECT * INTO v_horse FROM horses WHERE id = p_horse_id AND deleted_at IS NULL;
  IF NOT FOUND THEN RAISE EXCEPTION 'unknown horse'; END IF;
  IF v_horse.org_id <> v_org THEN RAISE EXCEPTION 'horse is not in this organization'; END IF;

  IF NOT (v_staff AND v_org = current_org()) THEN
    IF v_horse.current_owner_contact_id IS DISTINCT FROM v_me THEN
      RAISE EXCEPTION 'you can only attach your own horse';
    END IF;
  END IF;

  SELECT display_name INTO v_breed FROM horse_breeds WHERE code = v_horse.breed;
  SELECT display_name INTO v_color FROM horse_colors WHERE code = v_horse.color;
  v_markings := coalesce((SELECT display_name FROM lookup_options WHERE lookup_key='horse_markings' AND code = v_horse.markings), v_horse.markings);
  v_reg_org := coalesce((SELECT display_name FROM lookup_options WHERE lookup_key='horse_registration_org' AND code = v_horse.registration_org), v_horse.registration_org);
  v_passport_country := coalesce((SELECT display_name FROM lookup_options WHERE lookup_key='horse_passport_country' AND code = v_horse.passport_country), v_horse.passport_country);
  v_home_loc := nullif(btrim(concat_ws(' â ',
    (SELECT nullif(btrim(concat_ws(', ', l.name, l.address_line1, l.city, nullif(btrim(concat_ws(' ', l.state, l.postal)),''))),'') FROM locations l WHERE l.id = v_horse.home_location_id),
    nullif(btrim(concat_ws(' ', v_horse.home_barn, v_horse.home_stall)),''))), '');
  v_curr_loc := nullif(btrim(concat_ws(' â ',
    (SELECT nullif(btrim(concat_ws(', ', l.name, l.address_line1, l.city, nullif(btrim(concat_ws(' ', l.state, l.postal)),''))),'') FROM locations l WHERE l.id = v_horse.current_location_id),
    nullif(btrim(concat_ws(' ', v_horse.current_barn, v_horse.current_stall)),''))), '');

  UPDATE documents SET horse_id = p_horse_id, updated_at = now() WHERE id = p_document_id;

  FOR r IN
    SELECT cf.id,
           upper(split_part(regexp_replace(cf.field_key, '[{}]', '', 'g'), '.', 2)) AS field
    FROM contract_fields cf
    WHERE cf.document_id = p_document_id
      AND regexp_replace(cf.field_key, '[{}]', '', 'g') LIKE 'HORSE.%'
  LOOP
    v_val := CASE r.field
      WHEN 'REGISTERED_NAME'     THEN v_horse.registered_name
      WHEN 'BARN_NAME'           THEN v_horse.nickname
      WHEN 'BREED'               THEN v_breed
      WHEN 'COLOR'               THEN v_color
      WHEN 'SEX'                 THEN v_horse.sex
      WHEN 'AGE_DOB'             THEN to_char(v_horse.date_of_birth, 'FMMonth FMDD, YYYY')
      WHEN 'HEIGHT'              THEN v_horse.height
      WHEN 'REGISTRATION_NUMBER' THEN v_horse.registration_number
            WHEN 'MICROCHIP'           THEN v_horse.microchip_id
      WHEN 'MARKINGS'            THEN v_markings
      WHEN 'REGISTRATION_ORG'    THEN v_reg_org
      WHEN 'PASSPORT_NUMBER'     THEN v_horse.passport_number
      WHEN 'PASSPORT_COUNTRY'    THEN v_passport_country
      WHEN 'CURRENT_LOCATION'    THEN coalesce(nullif(v_curr_loc,''), v_horse.current_location)
      WHEN 'HOME_LOCATION'       THEN v_home_loc
      WHEN 'VET_NAME'            THEN v_horse.vet_name
      WHEN 'VET_PHONE'           THEN v_horse.vet_phone
      WHEN 'VET_BUSINESS'        THEN v_horse.vet_business_name
      WHEN 'VET_ADDRESS'         THEN nullif(btrim(concat_ws(', ', v_horse.vet_address_line1, v_horse.vet_city, nullif(btrim(concat_ws(' ', v_horse.vet_state, v_horse.vet_postal)),''))), '')
      WHEN 'FARRIER_NAME'        THEN v_horse.farrier_name
      WHEN 'FARRIER_PHONE'       THEN v_horse.farrier_phone
      WHEN 'FAIR_MARKET_VALUE'   THEN fmt_money(v_horse.fair_market_value)
      WHEN 'MEDICATION_NAME'         THEN v_horse.medication_name
      WHEN 'MEDICATION_DOSAGE'       THEN v_horse.medication_dosage
      WHEN 'MEDICATION_INSTRUCTIONS' THEN v_horse.medication_instructions
      WHEN 'MEDICATION_ADDITIONAL'   THEN v_horse.medication_additional
      WHEN 'KNOWN_CONDITIONS'        THEN v_horse.known_conditions
      WHEN 'TRAINING_HISTORY'        THEN v_horse.training_history
      WHEN 'COMPETITION_HISTORY'     THEN v_horse.competition_history
      WHEN 'MEDICAL_HISTORY'         THEN v_horse.medical_history
      WHEN 'BEHAVIORAL_HISTORY'      THEN v_horse.behavioral_history
      WHEN 'MEDICATION_HISTORY'      THEN v_horse.medication_current
      WHEN 'EUTHANASIA_A' THEN CASE WHEN v_horse.euthanasia_authorization = 'A' THEN 'X' ELSE ' ' END
      WHEN 'EUTHANASIA_B' THEN CASE WHEN v_horse.euthanasia_authorization = 'B' THEN 'X' ELSE ' ' END
      ELSE '' END;

    UPDATE contract_fields SET value = v_val, updated_at = now() WHERE id = r.id;
  END LOOP;

  PERFORM remerge_contract_from_fields(p_document_id);
END;
$function$;

CREATE OR REPLACE FUNCTION public.my_stable_update_horse(p_id uuid, p_barn_name text DEFAULT NULL::text, p_breed text DEFAULT NULL::text, p_sex text DEFAULT NULL::text, p_height text DEFAULT NULL::text, p_color text DEFAULT NULL::text, p_location text DEFAULT NULL::text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  UPDATE horses
     SET nickname        = COALESCE(p_barn_name, nickname),
         breed            = COALESCE(p_breed, breed),
         sex              = COALESCE(p_sex, sex),
         height           = COALESCE(p_height, height),
         color            = COALESCE(p_color, color),
         current_location = COALESCE(p_location, current_location),
         updated_at       = now()
   WHERE id = p_id
     AND org_id = current_org()
     AND deleted_at IS NULL
     AND current_owner_contact_id = current_contact_id();
  IF NOT FOUND THEN
    RAISE EXCEPTION 'horse not found or not yours to edit';
  END IF;
END;
$function$;

CREATE OR REPLACE FUNCTION public.my_stable_add_horse(p_name text, p_barn_name text DEFAULT NULL::text, p_breed text DEFAULT NULL::text, p_sex text DEFAULT NULL::text, p_height text DEFAULT NULL::text, p_dob date DEFAULT NULL::date, p_color text DEFAULT NULL::text, p_location text DEFAULT NULL::text, p_notes text DEFAULT NULL::text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_org     uuid := current_org();
  v_contact uuid := current_contact_id();
  v_id      uuid;
BEGIN
  IF v_org IS NULL OR v_contact IS NULL THEN
    RAISE EXCEPTION 'no member context';
  END IF;
  IF p_name IS NULL OR btrim(p_name) = '' THEN
    RAISE EXCEPTION 'horse name required';
  END IF;

  INSERT INTO horses (org_id, registered_name, nickname, breed, sex, height,
                      date_of_birth, color, current_location, notes,
                      current_owner_contact_id)
  VALUES (v_org, btrim(p_name), p_barn_name, p_breed, p_sex, p_height,
          p_dob, p_color, COALESCE(p_location, 'Carmel Creek Ranch'), p_notes,
          v_contact)
  RETURNING id INTO v_id;

  INSERT INTO horse_parties (org_id, horse_id, contact_id, role, effective_from)
  VALUES (v_org, v_id, v_contact, 'owner', current_date);

  RETURN v_id;
END;
$function$;

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
  v_role  text := upper(coalesce(p ->> 'my_relationship', 'OWNER'));
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
  -- Staff may create the record ON BEHALF OF a client: owner_contact_id names the
  -- target account and becomes the owner. A NON-STAFF caller can never assign to
  -- someone else â the value is ignored and the horse binds to them.
  IF has_staff_access() AND nullif(p ->> 'owner_contact_id','') IS NOT NULL THEN
    v_me := (p ->> 'owner_contact_id')::uuid;
  END IF;

  IF v_org IS NULL THEN RAISE EXCEPTION 'no org context'; END IF;
  IF coalesce(nullif(trim(p ->> 'registered_name'), ''), nullif(trim(p ->> 'nickname'), '')) IS NULL THEN
    RAISE EXCEPTION 'a horse name is required';
  END IF;
  IF v_role NOT IN ('OWNER','LESSEE') THEN v_role := 'OWNER'; END IF;

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
        VALUES (v_org, v_match.id, v_me,
                CASE WHEN v_role = 'LESSEE' THEN 'LESSEE' ELSE 'OWNER' END,
                nullif(p ->> 'claim_note', ''), 'MICROCHIP');
        RETURN jsonb_build_object('outcome', 'match_pending_review');
      END IF;
    END IF;
  END IF;

  INSERT INTO horses (
    org_id, registered_name, nickname, breed, color, markings, sex,
    date_of_birth, height, registration_number, registration_org,
    microchip_id, passport_number, passport_country, current_location,
    fair_market_value, vet_name, vet_phone, vet_business_name, vet_address_line1, vet_city, vet_state, vet_postal, farrier_name, farrier_phone,
    medical_history, behavioral_history, medication_current,
    medication_name, medication_dosage, medication_instructions, medication_additional,
    known_conditions, euthanasia_authorization,
    training_history, competition_history,
    created_by_contact_id,
    current_owner_contact_id, owner_name_text,
    lessee_contact_id, lessee_name_text,
    lease_start, lease_end)
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
    nullif(p ->> 'vet_name', ''), nullif(p ->> 'vet_phone', ''), nullif(p ->> 'vet_business_name',''), nullif(p ->> 'vet_address_line1',''), nullif(p ->> 'vet_city',''), nullif(p ->> 'vet_state',''), nullif(p ->> 'vet_postal',''),
    nullif(p ->> 'farrier_name', ''), nullif(p ->> 'farrier_phone', ''),
    nullif(p ->> 'medical_history', ''), nullif(p ->> 'behavioral_history', ''),
    nullif(p ->> 'medication_current', ''), nullif(p ->> 'medication_name',''), nullif(p ->> 'medication_dosage',''), nullif(p ->> 'medication_instructions',''), nullif(p ->> 'medication_additional',''), nullif(p ->> 'known_conditions', ''), nullif(p ->> 'euthanasia_authorization',''),
    nullif(p ->> 'training_history', ''), nullif(p ->> 'competition_history', ''),
    v_me,
    CASE WHEN v_role = 'OWNER' THEN v_me END,
    v_owner_text,
    CASE WHEN v_role = 'LESSEE' THEN v_me END,
    v_lessee_text,
    CASE WHEN v_leased THEN (nullif(p ->> 'lease_start', ''))::date END,
    CASE WHEN v_leased THEN (nullif(p ->> 'lease_end', ''))::date END)
  RETURNING id INTO v_id;

  INSERT INTO horse_relationships
    (org_id, horse_id, relationship, party_contact_id, created_by_contact_id, term_start, term_end)
  VALUES (v_org, v_id, v_role, v_me, v_me,
          CASE WHEN v_role = 'LESSEE' AND v_leased THEN (nullif(p ->> 'lease_start',''))::date END,
          CASE WHEN v_role = 'LESSEE' AND v_leased THEN (nullif(p ->> 'lease_end',''))::date END);
  IF v_role = 'LESSEE' AND v_owner_text IS NOT NULL THEN
    INSERT INTO horse_relationships
      (org_id, horse_id, relationship, party_name_text, created_by_contact_id)
    VALUES (v_org, v_id, 'OWNER', v_owner_text, v_me);
  ELSIF v_role = 'OWNER' AND v_leased AND v_lessee_text IS NOT NULL THEN
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

CREATE OR REPLACE FUNCTION public.apply_contract_execution_effects()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_key      text;
  v_fields   jsonb := '{}'::jsonb;
  v_horse    uuid;
  v_chip     text;
  v_lessor   uuid;  -- lease: owner side  | sale: seller
  v_lessee   uuid;  -- lease: lessee      | sale: buyer
  v_start    date;
  v_end      date;
  r          record;
BEGIN
  IF NOT (NEW.workflow_state = 'executed' AND OLD.workflow_state IS DISTINCT FROM 'executed') THEN
    RETURN NEW;
  END IF;

  SELECT template_key INTO v_key FROM contract_templates WHERE id = NEW.template_id;
  IF v_key NOT IN ('HORSE_LEASE', 'HORSE_PURCHASE_SALE') THEN
    RETURN NEW;
  END IF;

  FOR r IN SELECT field_key, coalesce(trim(value), '') AS val
             FROM contract_fields WHERE document_id = NEW.id LOOP
    v_fields := v_fields || jsonb_build_object(r.field_key, r.val);
  END LOOP;

  -- parties from the engagement
  SELECT contact_id INTO v_lessor FROM document_parties
   WHERE document_id = NEW.id AND party_role IN ('LESSOR','SELLER') LIMIT 1;
  SELECT contact_id INTO v_lessee FROM document_parties
   WHERE document_id = NEW.id AND party_role IN ('LESSEE','BUYER') LIMIT 1;

  -- find the record: engagement's horse, else microchip match, else CREATE from
  -- the contract's horse fields (the contract births the record)
  v_horse := NEW.horse_id;
  v_chip := nullif(regexp_replace(coalesce(v_fields ->> 'HORSE.MICROCHIP', ''), '\s', '', 'g'), '');
  IF v_horse IS NULL AND v_chip IS NOT NULL THEN
    SELECT id INTO v_horse FROM horses
     WHERE org_id = NEW.org_id AND deleted_at IS NULL
       AND regexp_replace(coalesce(microchip_id, ''), '\s', '', 'g') = v_chip
     LIMIT 1;
  END IF;
  IF v_horse IS NULL THEN
    INSERT INTO horses (org_id, registered_name, nickname, breed, color, sex,
                        registration_number, microchip_id, current_location,
                        fair_market_value, vet_name, vet_phone, farrier_name,
                        farrier_phone, created_by_contact_id, current_owner_contact_id)
    VALUES (NEW.org_id,
            nullif(v_fields ->> 'HORSE.REGISTERED_NAME', ''),
            nullif(v_fields ->> 'HORSE.BARN_NAME', ''),
            nullif(v_fields ->> 'HORSE.BREED', ''),
            nullif(v_fields ->> 'HORSE.COLOR', ''),
            nullif(v_fields ->> 'HORSE.SEX', ''),
            nullif(v_fields ->> 'HORSE.REGISTRATION_NUMBER', ''),
            v_chip,
            nullif(v_fields ->> 'HORSE.CURRENT_LOCATION', ''),
            nullif(replace(replace(v_fields ->> 'HORSE.FAIR_MARKET_VALUE', '$', ''), ',', ''), '')::numeric,
            nullif(v_fields ->> 'HORSE.VET_NAME', ''),
            nullif(v_fields ->> 'HORSE.VET_PHONE', ''),
            nullif(v_fields ->> 'HORSE.FARRIER_NAME', ''),
            nullif(v_fields ->> 'HORSE.FARRIER_PHONE', ''),
            v_lessor, v_lessor)
    RETURNING id INTO v_horse;
    -- birth row: the owner-side party owns the record
    INSERT INTO horse_relationships (org_id, horse_id, relationship, party_contact_id,
                                     source_document_id, created_by_contact_id)
    VALUES (NEW.org_id, v_horse, 'OWNER', v_lessor, NEW.id, v_lessor);
  END IF;

  IF v_key = 'HORSE_LEASE' THEN
    v_start := nullif(v_fields ->> 'TXN.LEASE_START', '')::date;
    v_end   := nullif(v_fields ->> 'TXN.LEASE_END', '')::date;
    UPDATE horses
       SET lessee_contact_id = v_lessee,
           lease_start = v_start,
           lease_end   = v_end,
           current_owner_contact_id = coalesce(current_owner_contact_id, v_lessor),
           updated_at = now()
     WHERE id = v_horse;
    INSERT INTO horse_relationships (org_id, horse_id, relationship, party_contact_id,
                                     term_start, term_end, source_document_id,
                                     created_by_contact_id)
    VALUES (NEW.org_id, v_horse, 'LESSEE', v_lessee, v_start, v_end, NEW.id, v_lessee);
    -- bundle the horse documents into the lease (owner signs), on file for future services
    PERFORM ensure_horse_documents(v_horse, NEW.contract_id, true);
  ELSE  -- HORSE_PURCHASE_SALE: ownership transfers seller â buyer
    UPDATE horse_relationships
       SET active = false, ended_at = now()
     WHERE horse_id = v_horse AND relationship = 'OWNER' AND active;
    UPDATE horses
       SET current_owner_contact_id = v_lessee,   -- the buyer
           lessee_contact_id = NULL, lease_start = NULL, lease_end = NULL,
           updated_at = now()
     WHERE id = v_horse;
    INSERT INTO horse_relationships (org_id, horse_id, relationship, party_contact_id,
                                     source_document_id, created_by_contact_id)
    VALUES (NEW.org_id, v_horse, 'OWNER', v_lessee, NEW.id, v_lessee);
  END IF;

  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.staff_update_horse(p_id uuid, p jsonb)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT has_staff_access() THEN RAISE EXCEPTION 'staff access required'; END IF;
  UPDATE horses SET
    registered_name     = coalesce(nullif(p ->> 'registered_name', ''), registered_name),
    nickname           = CASE WHEN p ? 'nickname' THEN nullif(p ->> 'nickname', '') ELSE nickname END,
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
    updated_at = now()
  WHERE id = p_id AND org_id = current_org() AND deleted_at IS NULL;
  IF NOT FOUND THEN RAISE EXCEPTION 'horse not found in this org'; END IF;
END;
$function$;

CREATE OR REPLACE FUNCTION public.my_stable_horses()
 RETURNS TABLE(id uuid, registered_name text, nickname text, breed text, sex text, height text, date_of_birth date, color text, current_location text, is_owner boolean, created_at timestamp with time zone, lease_start date, lease_end date)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_scope uuid;
BEGIN
  v_scope := CASE WHEN has_staff_access() THEN company_contact_id()
                  ELSE current_contact_id() END;
  RETURN QUERY
  SELECT h.id, h.registered_name, h.nickname, h.breed, h.sex, h.height,
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
$function$;

CREATE OR REPLACE FUNCTION public.staff_horse_records()
 RETURNS TABLE(id uuid, registered_name text, nickname text, breed text, color text, markings text, sex text, date_of_birth date, height text, registration_number text, registration_org text, microchip_id text, current_location text, fair_market_value numeric, vet_name text, vet_phone text, farrier_name text, farrier_phone text, owner_contact_id uuid, owner_name text, owner_name_text text, lessee_contact_id uuid, lessee_name text, lessee_name_text text, lease_start date, lease_end date, document_count bigint, active_lease_doc jsonb, created_at timestamp with time zone)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT h.id, h.registered_name, h.nickname, h.breed, h.color,
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
         h.lease_start, h.lease_end,
         (SELECT count(*) FROM horse_relationships r
           WHERE r.horse_id = h.id AND r.source_document_id IS NOT NULL),
         horse_active_lease_doc(h.id) AS active_lease_doc,
         h.created_at
  FROM horses h
  WHERE h.org_id = current_org() AND h.deleted_at IS NULL AND has_staff_access()
  ORDER BY coalesce(h.nickname, h.registered_name)
$function$;

CREATE OR REPLACE FUNCTION public.generate_document(p_contact_id uuid, p_template_key text, p_contract_id uuid, p_horse_id uuid, p_parties jsonb, p_service_type text)
 RETURNS TABLE(document_id uuid, merged_body text)
 LANGUAGE plpgsql
AS $function$
#variable_conflict use_column
DECLARE
  v_tmpl    contract_templates%ROWTYPE;
  v_org_id  uuid;
  v_ctr     contracts%ROWTYPE;
  v_has_ctr boolean := false;
  v_horse   horses%ROWTYPE;
  v_cfg     business_config%ROWTYPE;
  v_breed   text := '';
  v_color   text := '';
  v_home_loc text := '';
  v_curr_loc text := '';
  v_doc_id  uuid;
  v_doc_code text;
  v_body    text;
  v_val     text;
  v_org     text;
  v_rate    numeric;
  v_dir     jsonb := '{}'::jsonb;
  r         record;
  m         record;
  v_fn text; v_ph text; v_em text; v_ad text; v_ti text; v_re text; v_db text;
  v_ec1n text; v_ec1r text; v_ec1p text; v_ec2n text; v_ec2r text; v_ec2p text;
  v_ry text; v_jx text; v_rb text; v_jl text;
  v_c_phone text; v_c_email text; v_c_url text;
  v_has_minor boolean := false;
  v_is_jumper boolean := false;
  v_svc text;
BEGIN
  SELECT * INTO v_tmpl FROM contract_templates
    WHERE template_key = p_template_key AND active AND deleted_at IS NULL;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'unknown or inactive contract template: %', p_template_key;
  END IF;
  IF v_tmpl.body IS NULL THEN
    RAISE EXCEPTION 'template % has no body loaded (no source document yet)', p_template_key;
  END IF;

  -- org from the CONTACT (was: the engagement). Explicit, not RLS-accidental.
  SELECT org_id INTO v_org_id FROM contacts WHERE id = p_contact_id;
  IF v_org_id IS NULL THEN
    RAISE EXCEPTION 'unknown contact: %', p_contact_id;
  END IF;

  IF p_contract_id IS NOT NULL THEN
    SELECT * INTO v_ctr FROM contracts WHERE id = p_contract_id AND deleted_at IS NULL;
    v_has_ctr := FOUND;
  END IF;

  v_svc := coalesce(p_service_type, v_ctr.segment);

  IF p_horse_id IS NOT NULL THEN
    SELECT * INTO v_horse FROM horses WHERE id = p_horse_id;
    SELECT display_name INTO v_breed FROM horse_breeds WHERE code = v_horse.breed;
    SELECT display_name INTO v_color FROM horse_colors WHERE code = v_horse.color;
    v_home_loc := coalesce((SELECT name FROM locations WHERE id = v_horse.home_location_id), '');
    v_curr_loc := coalesce((SELECT name FROM locations WHERE id = v_horse.current_location_id), '');
  END IF;

  SELECT * INTO v_cfg FROM business_config WHERE org_id = v_org_id;
  SELECT value_text INTO v_c_phone FROM config_values WHERE org_id = v_org_id AND namespace = 'CONTACT' AND key = 'PHONE';
  SELECT value_text INTO v_c_email FROM config_values WHERE org_id = v_org_id AND namespace = 'CONTACT' AND key = 'EMAIL';
  SELECT value_text INTO v_c_url   FROM config_values WHERE org_id = v_org_id AND namespace = 'CONTACT' AND key = 'URL';

  -- DIRECTIONAL TERMINOLOGY Ã¢ÂÂ from the contract now (deal_side/retained_by in
  -- contract.terms), was engagement_stages. No contract Ã¢ÂÂ no overrides.
  IF v_has_ctr THEN
    SELECT COALESCE(tv.token_overrides, '{}'::jsonb) INTO v_dir
      FROM template_variants tv
      WHERE tv.template_key = p_template_key
        AND tv.retained_by  = (v_ctr.terms ->> 'retained_by')
        AND tv.deal_side    = (v_ctr.terms ->> 'deal_side')
        AND tv.active
      LIMIT 1;
  END IF;
  v_dir := COALESCE(v_dir, '{}'::jsonb);

  INSERT INTO documents (org_id, contact_id, contract_id, horse_id, template_id, title, status)
    VALUES (v_org_id, p_contact_id, p_contract_id, p_horse_id, v_tmpl.id, v_tmpl.title, 'DRAFT')
    RETURNING id, display_code INTO v_doc_id, v_doc_code;

  -- seed the document's parties (was engagement_parties). Person + SIG tokens and
  -- signing authz all resolve from document_parties keyed by this document.
  IF p_parties IS NOT NULL THEN
    INSERT INTO document_parties (document_id, contact_id, party_role, relationship, title, is_signer, signer_order, org_id)
    SELECT v_doc_id,
           (e ->> 'contact_id')::uuid,
           e ->> 'role',
           e ->> 'relationship',
           e ->> 'title',
           COALESCE((e ->> 'is_signer')::boolean, false),
           (e ->> 'signer_order')::int,
           v_org_id
      FROM jsonb_array_elements(p_parties) e
    ON CONFLICT (document_id, contact_id, party_role) DO NOTHING;
  END IF;

  v_body := v_tmpl.body;

  v_has_minor := EXISTS (
    SELECT 1 FROM document_parties WHERE document_id = v_doc_id AND party_role = 'PARTICIPANT');
  v_is_jumper := v_svc = 'JUMPER_TRAINING';
  FOR m IN
    SELECT DISTINCT (regexp_matches(v_body, '<!-- CUT-START: ([A-Z_]+)', 'g'))[1] AS name
  LOOP
    IF m.name IN ('EVALUATION_PERIOD','PARTIAL_LEASE','INSURANCE',
                  'MORTALITY_INSURANCE','MAJOR_MEDICAL_INSURANCE',
                  'LOSS_OF_USE_INSURANCE','COMPETITION') THEN
      CONTINUE;
    END IF;
    IF (m.name LIKE 'MINOR%' AND v_has_minor)
       OR (m.name LIKE 'JUMPER%' AND v_is_jumper) THEN
      v_body := regexp_replace(
        v_body, '[ \t]*<!-- CUT-(START|END): ' || m.name || '[^>]*-->\n?', '', 'g');
    ELSE
      v_body := regexp_replace(
        v_body,
        '\n?[ \t]*<!-- CUT-START: ' || m.name || '[^>]*-->.*<!-- CUT-END: ' || m.name || ' -->\n?',
        E'\n', 'g');
    END IF;
  END LOOP;

  FOR r IN
    SELECT namespace, field, token FROM template_tokens
    WHERE template_id = v_tmpl.id AND kind <> 'signature'
  LOOP
    v_val := '';

    IF r.namespace = 'HORSE' THEN
      v_val := CASE r.field
        WHEN 'REGISTERED_NAME'     THEN v_horse.registered_name
        WHEN 'BARN_NAME'           THEN v_horse.nickname
        WHEN 'BREED'               THEN v_breed
        WHEN 'COLOR'               THEN v_color
        WHEN 'SEX'                 THEN v_horse.sex
        WHEN 'AGE_DOB'             THEN to_char(v_horse.date_of_birth, 'FMMonth FMDD, YYYY')
        WHEN 'HEIGHT'              THEN v_horse.height
        WHEN 'REGISTRATION_NUMBER' THEN v_horse.registration_number
        WHEN 'MICROCHIP'           THEN v_horse.microchip_id
        WHEN 'CURRENT_LOCATION'    THEN coalesce(nullif(v_curr_loc,''), v_horse.current_location)
        WHEN 'HOME_LOCATION'       THEN v_home_loc
        WHEN 'VET_NAME'            THEN v_horse.vet_name
        WHEN 'VET_PHONE'           THEN v_horse.vet_phone
        WHEN 'FARRIER_NAME'        THEN v_horse.farrier_name
        WHEN 'FARRIER_PHONE'       THEN v_horse.farrier_phone
        WHEN 'FAIR_MARKET_VALUE'   THEN fmt_money(v_horse.fair_market_value)
        WHEN 'MEDICATION_NAME'         THEN v_horse.medication_name
        WHEN 'MEDICATION_DOSAGE'       THEN v_horse.medication_dosage
        WHEN 'MEDICATION_INSTRUCTIONS' THEN v_horse.medication_instructions
        WHEN 'MEDICATION_ADDITIONAL'   THEN v_horse.medication_additional
        WHEN 'KNOWN_CONDITIONS'        THEN v_horse.known_conditions
        WHEN 'EUTHANASIA_A' THEN CASE WHEN v_horse.euthanasia_authorization = 'A' THEN 'X' ELSE ' ' END
        WHEN 'EUTHANASIA_B' THEN CASE WHEN v_horse.euthanasia_authorization = 'B' THEN 'X' ELSE ' ' END
        ELSE '' END;

    ELSIF r.namespace = 'ENG' THEN
      -- ENG.ID/SERVICE_TYPE/START_DATE are used by ZERO live templates; map what
      -- exists onto the contract, blank otherwise.
      v_val := CASE r.field
        WHEN 'ID'           THEN v_ctr.display_code
        WHEN 'SERVICE_TYPE' THEN v_svc
        WHEN 'START_DATE'   THEN to_char(v_ctr.effective_date, 'FMMonth FMDD, YYYY')
        ELSE '' END;

    ELSIF r.namespace = 'DOC' THEN
      v_val := CASE r.field
        WHEN 'UUID'           THEN v_doc_id::text
        WHEN 'ID'             THEN v_doc_code
        WHEN 'GENERATED_DATE' THEN to_char(now(), 'FMMonth FMDD, YYYY')
        WHEN 'EFFECTIVE_DATE' THEN to_char(now(), 'FMMonth FMDD, YYYY')
        ELSE '' END;

    ELSIF r.namespace = 'ORD' THEN
      IF r.field = 'SERVICE_SELECTION' THEN
        SELECT pi.label INTO v_val FROM purchase_items pi
          JOIN purchases pu ON pu.id = pi.purchase_id
          WHERE pu.contract_id = p_contract_id
          ORDER BY pi.created_at DESC LIMIT 1;
      ELSE
        v_val := CASE r.field
          WHEN 'UUID' THEN v_doc_id::text
          WHEN 'ID'   THEN v_doc_code
          ELSE '' END;
      END IF;

    ELSIF r.namespace = 'REQ' THEN
      v_val := '';

    ELSIF r.namespace = 'DIR' THEN
      v_val := v_dir ->> r.field;

    ELSIF r.namespace IN ('ORG', 'FHE') THEN
      v_org := CASE r.field
        WHEN 'LEGAL_NAME'       THEN v_cfg.legal_entity_name
        WHEN 'SIGNATORY_NAME'   THEN v_cfg.signatory_name
        WHEN 'SIGNATORY_TITLE'  THEN v_cfg.signatory_title
        WHEN 'ADDRESS'          THEN v_cfg.business_address
        WHEN 'BRAND_NAME'       THEN v_cfg.legal_entity_name
        WHEN 'ENTITY_FORMATION' THEN v_cfg.entity_formation
        WHEN 'REGISTERED_AGENT' THEN v_cfg.registered_agent
        WHEN 'CANCELLATION_FEE' THEN fmt_money(v_cfg.cancellation_fee)
        WHEN 'LATE_FEE'         THEN fmt_money(v_cfg.late_fee)
        WHEN 'NO_SHOW_FEE'      THEN fmt_money(v_cfg.no_show_fee)
        WHEN 'PHONE'            THEN v_c_phone
        WHEN 'EMAIL'            THEN v_c_email
        WHEN 'URL'              THEN v_c_url
        ELSE NULL END;
      IF v_org IS NULL THEN
        SELECT coalesce(cv.value_text, cv.value_num::text, cv.value_json #>> '{}')
          INTO v_org FROM config_values cv
          WHERE cv.org_id = v_org_id AND cv.namespace = 'ORG' AND cv.key = r.field;
      END IF;
      v_val := v_org;

    ELSIF r.namespace = 'TXN' THEN
      -- commission from config; deal money is filled by remerge from contract_fields.
      IF r.field = 'COMMISSION_RATE' THEN
        v_rate := CASE
          WHEN v_svc ILIKE '%SALE%'  THEN v_cfg.commission_sale_rate
          WHEN v_svc ILIKE '%LEASE%' THEN v_cfg.commission_lease_rate
          ELSE v_cfg.commission_purchase_rate END;
        v_val := CASE WHEN v_rate IS NULL THEN ''
                      ELSE rtrim(rtrim(to_char(v_rate, 'FM999990.00'), '0'), '.') || '%' END;
      ELSIF r.field = 'COMMISSION_MIN' THEN
        v_val := fmt_money(v_cfg.commission_min);
      ELSE
        v_val := '';
      END IF;

    ELSE
      v_fn := NULL; v_ph := NULL; v_em := NULL; v_ad := NULL; v_ti := NULL; v_re := NULL; v_db := NULL;
      v_ec1n := NULL; v_ec1r := NULL; v_ec1p := NULL; v_ec2n := NULL; v_ec2r := NULL; v_ec2p := NULL;
      v_ry := NULL; v_jx := NULL; v_rb := NULL; v_jl := NULL;
      SELECT NULLIF(trim(coalesce(c.first_name, '') || ' ' || coalesce(c.last_name, '')), ''),
             c.phone, c.email, c.address_composed, dp.title, dp.relationship,
             CASE WHEN c.date_of_birth IS NULL THEN NULL
                  ELSE to_char(c.date_of_birth, 'FMMonth FMDD, YYYY') END,
             c.emergency_contact_1_name, c.emergency_contact_1_relationship, c.emergency_contact_1_phone,
             c.emergency_contact_2_name, c.emergency_contact_2_relationship, c.emergency_contact_2_phone,
             c.riding_experience_years, c.jump_experience, c.riding_background, c.jump_limitations
        INTO v_fn, v_ph, v_em, v_ad, v_ti, v_re, v_db,
             v_ec1n, v_ec1r, v_ec1p, v_ec2n, v_ec2r, v_ec2p,
             v_ry, v_jx, v_rb, v_jl
        FROM document_parties dp
        JOIN contacts c ON c.id = dp.contact_id
        WHERE dp.document_id = v_doc_id AND dp.party_role = r.namespace
        ORDER BY dp.signer_order NULLS LAST
        LIMIT 1;
      v_val := CASE r.field
        WHEN 'FULL_NAME'    THEN v_fn
        WHEN 'PRINTED_NAME' THEN v_fn
        WHEN 'PHONE'        THEN v_ph
        WHEN 'EMAIL'        THEN v_em
        WHEN 'ADDRESS'      THEN v_ad
        WHEN 'TITLE'        THEN v_ti
        WHEN 'RELATIONSHIP' THEN v_re
        WHEN 'DOB'          THEN v_db
        WHEN 'EMERGENCY_CONTACT_1_NAME'         THEN v_ec1n
        WHEN 'EMERGENCY_CONTACT_1_RELATIONSHIP' THEN v_ec1r
        WHEN 'EMERGENCY_CONTACT_1_PHONE'        THEN v_ec1p
        WHEN 'EMERGENCY_CONTACT_2_NAME'         THEN v_ec2n
        WHEN 'EMERGENCY_CONTACT_2_RELATIONSHIP' THEN v_ec2r
        WHEN 'EMERGENCY_CONTACT_2_PHONE'        THEN v_ec2p
        WHEN 'RIDING_EXPERIENCE_YEARS'          THEN v_ry
        WHEN 'JUMP_EXPERIENCE'                  THEN v_jx
        WHEN 'RIDING_BACKGROUND'                THEN v_rb
        WHEN 'JUMP_LIMITATIONS'                 THEN v_jl
        WHEN 'HORSE_CAPACITY' THEN CASE
          WHEN v_horse.current_owner_contact_id IS NULL THEN 'owns, leases, manages, or otherwise has authority over'
          WHEN (SELECT dp2.contact_id FROM document_parties dp2 WHERE dp2.document_id = v_doc_id AND dp2.party_role = r.namespace ORDER BY dp2.signer_order NULLS LAST LIMIT 1) = v_horse.current_owner_contact_id THEN 'owns'
          WHEN (SELECT dp2.contact_id FROM document_parties dp2 WHERE dp2.document_id = v_doc_id AND dp2.party_role = r.namespace ORDER BY dp2.signer_order NULLS LAST LIMIT 1) = v_horse.lessee_contact_id THEN 'leases'
          ELSE 'is an authorized agent of' END
        ELSE '' END;
    END IF;

    v_body := replace(v_body, r.token, COALESCE(v_val, ''));
  END LOOP;

  UPDATE documents SET merged_body = v_body WHERE id = v_doc_id;

  document_id := v_doc_id;
  merged_body := v_body;
  RETURN NEXT;
END;
$function$;

CREATE OR REPLACE FUNCTION public.lease_reminder_sweep()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  d record;
  u uuid;
  v_kind text; v_title text; v_body text; v_link text; v_window interval;
  v_n int := 0;
BEGIN
  -- every executed lease with a start (â¤7d) or expiry (â¤30d) coming up
  FOR d IN
    SELECT dc.id AS doc_id, dc.org_id,
           coalesce(h.nickname, h.registered_name, 'the horse') AS hname,
           h.lease_start, h.lease_end
    FROM documents dc
    JOIN contract_templates t ON t.id = dc.template_id
    JOIN horses h ON h.id = dc.horse_id
    WHERE t.template_key = 'HORSE_LEASE' AND dc.status = 'EXECUTED'
      AND dc.deleted_at IS NULL AND h.deleted_at IS NULL
      AND (
        (h.lease_start IS NOT NULL AND h.lease_start BETWEEN current_date AND current_date + 7)
        OR (h.lease_end IS NOT NULL AND h.lease_end BETWEEN current_date AND current_date + 30)
      )
  LOOP
    IF d.lease_start IS NOT NULL AND d.lease_start BETWEEN current_date AND current_date + 7 THEN
      v_kind := 'lease_start'; v_window := interval '3 days';
      v_title := 'Lease start approaching';
      v_body := d.hname || ' â lease starts ' || to_char(d.lease_start, 'FMMonth FMDD') || '.';
    ELSE
      v_kind := 'lease_expiry'; v_window := interval '7 days';
      v_title := 'Lease expiring soon';
      v_body := d.hname || ' â lease ends ' || to_char(d.lease_end, 'FMMonth FMDD, YYYY') || '.';
    END IF;
    v_link := '/app/contracts/' || d.doc_id;

    -- recipients: every party of the lease + all staff/admin in the org
    FOR u IN
      SELECT pr.user_id
        FROM document_parties dp JOIN profiles pr ON pr.contact_id = dp.contact_id
       WHERE dp.document_id = d.doc_id AND pr.user_id IS NOT NULL
      UNION
      SELECT pr2.user_id FROM profiles pr2
       WHERE pr2.org_id = d.org_id
         AND coalesce(pr2.role,'USER') IN ('SUPER_ADMIN','ADMIN','MANAGER','EMPLOYEE')
         AND pr2.user_id IS NOT NULL
    LOOP
      IF NOT EXISTS (
        SELECT 1 FROM notifications n
        WHERE n.user_id = u AND n.kind = v_kind AND n.link = v_link
          AND n.created_at > now() - v_window
      ) THEN
        PERFORM notify_user(u, v_kind, v_title, v_body, v_link);
        v_n := v_n + 1;
      END IF;
    END LOOP;
  END LOOP;
  RETURN jsonb_build_object('notifications_created', v_n);
END;
$function$;

