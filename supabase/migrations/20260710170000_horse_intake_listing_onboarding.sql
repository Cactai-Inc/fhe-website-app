-- SPEC H.7 + H.9 backend — onboarding horse intake + marketplace listing wiring.
--
--   create_horse_record v2 — accepts the intake's LEASE block (dates, sublease,
--     named lessee/owner with email folded into the name_text) so the standardized
--     form maps 1:1; unresolved parties stay text until matched.
--   my_onboarding_horse_step / my_onboarding_attach_horse — the onboarding append:
--     a horse-involving activation (horse-care service, or a riding purchase where
--     horse_included=false — "Ride your horse") collects the FULL intake and
--     attaches the record to the engagement so the horse-dependent documents merge.
--   can_list_horse / my_listable_horses — listing eligibility (H.9): owner of an
--     un-leased horse → sale or lease; owner of a leased horse → sale only; lessee
--     → lease only and only when sublease_allowed; staff/admin unrestricted.
--   feed_post_create v2 (patched separately below) enforces the eligibility
--     server-side whenever a horse-type post carries subject_horse_id.

-- ── 1. create_horse_record v2: intake lease block ──
CREATE OR REPLACE FUNCTION create_horse_record(p jsonb)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $fn$
DECLARE
  v_me    uuid := current_contact_id();
  v_org   uuid := current_org();
  v_chip  text := nullif(regexp_replace(coalesce(p ->> 'microchip_id', ''), '\s', '', 'g'), '');
  v_match horses%ROWTYPE;
  v_id    uuid;
  v_role  text := upper(coalesce(p ->> 'my_relationship', 'OWNER')); -- OWNER | LESSEE
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
  IF v_org IS NULL THEN
    RAISE EXCEPTION 'no org context';
  END IF;
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
          (org_id, existing_horse_id, claimed_by_contact_id, claim_type,
           claim_note, match_method)
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
    lease_start, lease_end, sublease_allowed)
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
    CASE WHEN v_leased THEN (nullif(p ->> 'lease_end', ''))::date END,
    v_leased AND lower(coalesce(p ->> 'sublease_allowed', 'no')) IN ('yes','true','1'))
  RETURNING id INTO v_id;

  INSERT INTO horse_relationships
    (org_id, horse_id, relationship, party_contact_id, created_by_contact_id,
     term_start, term_end)
  VALUES (v_org, v_id, v_role, v_me, v_me,
          CASE WHEN v_role = 'LESSEE' AND v_leased THEN (nullif(p ->> 'lease_start',''))::date END,
          CASE WHEN v_role = 'LESSEE' AND v_leased THEN (nullif(p ->> 'lease_end',''))::date END);
  IF v_role = 'LESSEE' AND v_owner_text IS NOT NULL THEN
    INSERT INTO horse_relationships
      (org_id, horse_id, relationship, party_name_text, created_by_contact_id)
    VALUES (v_org, v_id, 'OWNER', v_owner_text, v_me);
  ELSIF v_role = 'OWNER' AND v_leased AND v_lessee_text IS NOT NULL THEN
    INSERT INTO horse_relationships
      (org_id, horse_id, relationship, party_name_text, created_by_contact_id,
       term_start, term_end)
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

-- ── 2. onboarding horse step (H.7) ──
-- needed = the activated purchase involves the member's OWN horse: a horse-segment
-- service, or a riding offering with horse_included = false ("Ride your horse").
CREATE OR REPLACE FUNCTION my_onboarding_horse_step(p_engagement_id uuid)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $fn$
DECLARE
  v_eng    engagements%ROWTYPE;
  v_needed boolean := false;
BEGIN
  SELECT * INTO v_eng FROM engagements
   WHERE id = p_engagement_id AND deleted_at IS NULL
     AND client_id = current_client_id();
  IF NOT FOUND THEN
    RETURN jsonb_build_object('needed', false, 'horse_id', NULL);
  END IF;

  v_needed :=
    v_eng.service_type IN ('HORSE_TRAINING','HORSE_EXERCISE','HORSE_CLIPPING')
    OR EXISTS (
      SELECT 1 FROM client_purchases cp
      JOIN offerings o ON o.id = cp.offering_id
      WHERE cp.engagement_id = p_engagement_id
        AND o.segment = 'rider'
        AND o.horse_included = false
    );

  RETURN jsonb_build_object(
    'needed', v_needed AND v_eng.primary_horse_id IS NULL,
    'horse_id', v_eng.primary_horse_id);
END;
$fn$;

-- attach the freshly-created record to MY onboarding engagement (fills the seat
-- the horse-dependent documents merge from). Only when no horse is attached yet.
CREATE OR REPLACE FUNCTION my_onboarding_attach_horse(p_engagement_id uuid, p_horse_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $fn$
BEGIN
  IF NOT client_can_read_horse(p_horse_id) THEN
    RAISE EXCEPTION 'that horse record is not yours to attach';
  END IF;
  UPDATE engagements
     SET primary_horse_id = p_horse_id, updated_at = now()
   WHERE id = p_engagement_id
     AND deleted_at IS NULL
     AND client_id = current_client_id()
     AND primary_horse_id IS NULL;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'engagement not found, not yours, or already has a horse attached';
  END IF;
END;
$fn$;

GRANT EXECUTE ON FUNCTION my_onboarding_horse_step(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION my_onboarding_attach_horse(uuid, uuid) TO authenticated;

-- ── 3. listing eligibility (H.9) ──
-- owner + un-leased → sale or lease · owner + leased → sale only ·
-- lessee → lease only, and only when sublease_allowed · staff → unrestricted.
CREATE OR REPLACE FUNCTION can_list_horse(p_horse_id uuid, p_intent text DEFAULT 'sale')
RETURNS boolean
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $fn$
DECLARE
  v_h horses%ROWTYPE;
  v_me uuid := current_contact_id();
  v_leased boolean;
BEGIN
  SELECT * INTO v_h FROM horses
   WHERE id = p_horse_id AND org_id = current_org() AND deleted_at IS NULL;
  IF NOT FOUND THEN RETURN false; END IF;
  IF has_staff_access() THEN RETURN true; END IF;

  v_leased := v_h.lessee_contact_id IS NOT NULL
              AND (v_h.lease_end IS NULL OR v_h.lease_end >= current_date);

  IF v_h.current_owner_contact_id = v_me THEN
    IF p_intent = 'lease' THEN RETURN NOT v_leased; END IF;
    RETURN true;                       -- owner may always list for sale
  END IF;
  IF v_h.lessee_contact_id = v_me AND v_leased THEN
    RETURN p_intent = 'lease' AND v_h.sublease_allowed;
  END IF;
  RETURN false;
END;
$fn$;

-- the member's listable horses for the create-listing picker
CREATE OR REPLACE FUNCTION my_listable_horses(p_intent text DEFAULT 'sale')
RETURNS TABLE (
  id uuid, registered_name text, barn_name text, breed text, color text,
  sex text, height text, date_of_birth date
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT h.id, h.registered_name, h.barn_name, h.breed, h.color, h.sex,
         h.height, h.date_of_birth
  FROM horses h
  WHERE h.org_id = current_org() AND h.deleted_at IS NULL
    AND (
      has_staff_access()
      OR h.current_owner_contact_id = current_contact_id()
      OR h.lessee_contact_id = current_contact_id()
    )
    AND can_list_horse(h.id, p_intent)
  ORDER BY coalesce(h.barn_name, h.registered_name)
$$;

GRANT EXECUTE ON FUNCTION can_list_horse(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION my_listable_horses(text) TO authenticated;
