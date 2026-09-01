/*
  # Lease realign · Slice 8 — drop horses.sublease_allowed + participant usage

  (bullet 1) Sublease permission is now solely the lessor-owned contract field
  TXN.SUBLEASE_ALLOWED (set on the contract, read by can_list_horse). The dead
  horses.sublease_allowed column is dropped; the three functions that still wrote
  or returned it are recreated without it.

  (bullet 2) generate_lease_availability now unions EVERY participant's days (the
  primary lessee's TXN.DAYS_USED + each lease_participant.days_used), and
  compute_lease_usage() fills a participant's blank usage_% from their share of
  everyone's chosen days.

  A. recreate create_horse_record / staff_update_horse / staff_horse_records.
  B. drop horses.sublease_allowed.
  C. compute_lease_usage + generate_lease_availability (participant union).
*/

-- ── A1. create_horse_record without sublease_allowed ─────────────────────────
CREATE OR REPLACE FUNCTION create_horse_record(p jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $fn$
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
    fair_market_value, vet_name, vet_phone, farrier_name, farrier_phone,
    medical_history, behavioral_history, medication_current, known_conditions,
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
    nullif(p ->> 'vet_name', ''), nullif(p ->> 'vet_phone', ''),
    nullif(p ->> 'farrier_name', ''), nullif(p ->> 'farrier_phone', ''),
    nullif(p ->> 'medical_history', ''), nullif(p ->> 'behavioral_history', ''),
    nullif(p ->> 'medication_current', ''), nullif(p ->> 'known_conditions', ''),
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
$fn$;

-- ── A2. staff_update_horse without sublease_allowed ──────────────────────────
CREATE OR REPLACE FUNCTION staff_update_horse(p_id uuid, p jsonb)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $fn$
BEGIN
  IF NOT has_staff_access() THEN RAISE EXCEPTION 'staff access required'; END IF;
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
    updated_at = now()
  WHERE id = p_id AND org_id = current_org() AND deleted_at IS NULL;
  IF NOT FOUND THEN RAISE EXCEPTION 'horse not found in this org'; END IF;
END;
$fn$;

-- ── A3. staff_horse_records without sublease_allowed (return type change) ─────
DROP FUNCTION IF EXISTS staff_horse_records();
CREATE OR REPLACE FUNCTION staff_horse_records()
RETURNS TABLE (
  id uuid, registered_name text, barn_name text, breed text, color text,
  markings text, sex text, date_of_birth date, height text,
  registration_number text, registration_org text, microchip_id text,
  current_location text, fair_market_value numeric,
  vet_name text, vet_phone text, farrier_name text, farrier_phone text,
  owner_contact_id uuid, owner_name text, owner_name_text text,
  lessee_contact_id uuid, lessee_name text, lessee_name_text text,
  lease_start date, lease_end date,
  document_count bigint, created_at timestamptz
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
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
         h.lease_start, h.lease_end,
         (SELECT count(*) FROM horse_relationships r
           WHERE r.horse_id = h.id AND r.source_document_id IS NOT NULL),
         h.created_at
  FROM horses h
  WHERE h.org_id = current_org() AND h.deleted_at IS NULL AND has_staff_access()
  ORDER BY coalesce(h.barn_name, h.registered_name)
$$;
GRANT EXECUTE ON FUNCTION staff_horse_records() TO authenticated;

-- ── B. drop the dead column ──────────────────────────────────────────────────
ALTER TABLE horses DROP COLUMN IF EXISTS sublease_allowed;

-- ── C1. compute each participant's blank usage_% from their day share ─────────
CREATE OR REPLACE FUNCTION compute_lease_usage(p_document_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $fn$
DECLARE v_primary int; v_total int;
BEGIN
  IF NOT (has_staff_access() OR caller_is_document_party(p_document_id)) THEN
    RAISE EXCEPTION 'not authorized'; END IF;
  -- primary lessee's day count (TXN.DAYS_USED)
  SELECT coalesce(array_length(array_remove(
           string_to_array(regexp_replace(coalesce(value,''), '\s','','g'), ','), ''), 1), 0)
    INTO v_primary FROM contract_fields WHERE document_id = p_document_id AND field_key = 'TXN.DAYS_USED';
  v_primary := coalesce(v_primary, 0);

  SELECT v_primary + coalesce(sum(coalesce(array_length(array_remove(
           string_to_array(regexp_replace(coalesce(days_used,''), '\s','','g'), ','), ''), 1), 0)), 0)
    INTO v_total FROM lease_participants WHERE document_id = p_document_id;
  IF coalesce(v_total,0) = 0 THEN RETURN jsonb_build_object('computed', 0); END IF;

  UPDATE lease_participants lp
     SET usage_pct = round(
           coalesce(array_length(array_remove(
             string_to_array(regexp_replace(coalesce(lp.days_used,''), '\s','','g'), ','), ''), 1), 0)::numeric
           / v_total * 100, 2)
   WHERE lp.document_id = p_document_id AND lp.usage_pct IS NULL AND lp.days_used IS NOT NULL;
  RETURN jsonb_build_object('computed', 1);
END;
$fn$;
REVOKE ALL ON FUNCTION compute_lease_usage(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION compute_lease_usage(uuid) TO authenticated, service_role;

-- ── C2. generate_lease_availability unions every participant's days ──────────
CREATE OR REPLACE FUNCTION generate_lease_availability(p_horse_id uuid, p_weeks int DEFAULT 4)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $fn$
DECLARE
  v_org uuid := current_org();
  v_h horses%ROWTYPE; v_doc uuid;
  v_used text[]; v_unav text[];
  d date; v_dow text; v_open time; v_close time; v_closed boolean;
  v_made int := 0; v_start timestamptz; v_end timestamptz;
BEGIN
  IF NOT has_staff_access() THEN RAISE EXCEPTION 'operator access required'; END IF;
  SELECT * INTO v_h FROM horses WHERE id = p_horse_id AND org_id = v_org;
  IF NOT FOUND THEN RAISE EXCEPTION 'horse not found in this org'; END IF;

  SELECT dc.id INTO v_doc FROM documents dc
    JOIN contract_templates t ON t.id = dc.template_id
    WHERE dc.horse_id = p_horse_id AND t.template_key = 'HORSE_LEASE'
      AND dc.status = 'EXECUTED' AND dc.deleted_at IS NULL
    ORDER BY dc.effective_date DESC NULLS LAST, dc.created_at DESC LIMIT 1;
  IF v_doc IS NULL THEN RAISE EXCEPTION 'no executed lease contract for this horse'; END IF;

  -- union: the primary lessee's days + every participant's days
  SELECT array_agg(DISTINCT day) INTO v_used FROM (
    SELECT unnest(string_to_array(regexp_replace(coalesce(
             (SELECT value FROM contract_fields WHERE document_id=v_doc AND field_key='TXN.DAYS_USED'),''), '\s','','g'), ',')) AS day
    UNION
    SELECT unnest(string_to_array(regexp_replace(coalesce(days_used,''), '\s','','g'), ',')) AS day
      FROM lease_participants WHERE document_id = v_doc
  ) x WHERE day <> '';
  SELECT string_to_array(regexp_replace(coalesce(value,''), '\s','','g'), ',')
    INTO v_unav FROM contract_fields WHERE document_id = v_doc AND field_key = 'TXN.DAYS_UNAVAILABLE';
  v_used := coalesce(v_used,'{}'); v_unav := coalesce(v_unav,'{}');
  IF array_length(array_remove(v_used,''),1) IS NULL THEN
    RAISE EXCEPTION 'the lease has no "days used" set (primary or participants) — fill it first';
  END IF;

  -- compute any blank participant usage % from the day shares
  PERFORM compute_lease_usage(v_doc);

  FOR d IN SELECT generate_series(current_date, current_date + (p_weeks*7), '1 day')::date LOOP
    CONTINUE WHEN v_h.lease_start IS NOT NULL AND d < v_h.lease_start;
    CONTINUE WHEN v_h.lease_end   IS NOT NULL AND d > v_h.lease_end;
    v_dow := to_char(d, 'Dy');
    CONTINUE WHEN NOT (v_dow = ANY (v_used));
    CONTINUE WHEN v_dow = ANY (v_unav);
    SELECT open_time, close_time, closed INTO v_open, v_close, v_closed
      FROM business_hours WHERE org_id = v_org AND weekday = extract(dow FROM d)::int;
    CONTINUE WHEN coalesce(v_closed, false);
    v_open := coalesce(v_open, '10:00'); v_close := coalesce(v_close, '18:00');
    CONTINUE WHEN EXISTS (
      SELECT 1 FROM bookings b WHERE b.horse_id = p_horse_id AND b.kind='block'
        AND b.is_flexible AND b.starts_at::date = d);
    v_start := d + v_open; v_end := d + v_close;
    INSERT INTO bookings (org_id, kind, status, is_flexible, horse_id, starts_at, ends_at, notes, created_by)
      VALUES (v_org, 'block', 'available', true, p_horse_id, v_start, v_end, 'Leased-horse availability', auth.uid());
    v_made := v_made + 1;
  END LOOP;
  RETURN jsonb_build_object('created', v_made);
END;
$fn$;
REVOKE ALL ON FUNCTION generate_lease_availability(uuid, int) FROM public, anon;
GRANT EXECUTE ON FUNCTION generate_lease_availability(uuid, int) TO authenticated, service_role;
