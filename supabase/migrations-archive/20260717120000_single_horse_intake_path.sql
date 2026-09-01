-- create_horse_record is now the SINGLE horse-creation path. It honors an optional
-- owner_contact_id ONLY when the caller is staff (assign-on-behalf-of-a-client);
-- a non-staff caller is always bound to their own account. Deletes the parallel
-- staff_create_horse_for_contact RPC below.
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
  -- someone else — the value is ignored and the horse binds to them.
  IF has_staff_access() AND nullif(p ->> 'owner_contact_id','') IS NOT NULL THEN
    v_me := (p ->> 'owner_contact_id')::uuid;
  END IF;

  IF v_org IS NULL THEN RAISE EXCEPTION 'no org context'; END IF;
  IF coalesce(nullif(trim(p ->> 'registered_name'), ''), nullif(trim(p ->> 'barn_name'), '')) IS NULL THEN
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
    org_id, registered_name, barn_name, breed, color, markings, sex,
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
    nullif(trim(coalesce(p ->> 'registered_name', p ->> 'barn_name')), ''),
    nullif(trim(p ->> 'barn_name'), ''),
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

DROP FUNCTION IF EXISTS public.staff_create_horse_for_contact(uuid, jsonb);
