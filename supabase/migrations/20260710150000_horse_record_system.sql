-- SPEC H — the horse record system. Extends the EXISTING `horses` table (additive;
-- reconciled: the artifact's owner_contact_id maps to the existing
-- current_owner_contact_id — one owner pointer, no duplicate), adds the
-- relationship history + reconciliation queue, the create_horse_record RPC with
-- the microchip dedup model, execution effects (lease = attach-lessee-for-term,
-- sale = transfer-ownership, both keep history), and the lease-expiry nudge
-- producer. All four creation paths converge on create_horse_record.

-- ── 1. extend horses (identity/care/roles) ──
ALTER TABLE horses
  ADD COLUMN IF NOT EXISTS markings             text,
  ADD COLUMN IF NOT EXISTS registration_org     text,
  ADD COLUMN IF NOT EXISTS passport_number      text,
  ADD COLUMN IF NOT EXISTS passport_country     text,
  ADD COLUMN IF NOT EXISTS medical_history      text,
  ADD COLUMN IF NOT EXISTS behavioral_history   text,
  ADD COLUMN IF NOT EXISTS medication_current   text,
  ADD COLUMN IF NOT EXISTS known_conditions     text,
  ADD COLUMN IF NOT EXISTS training_history     text,
  ADD COLUMN IF NOT EXISTS competition_history  text,
  ADD COLUMN IF NOT EXISTS created_by_contact_id uuid REFERENCES contacts(id),
  ADD COLUMN IF NOT EXISTS owner_name_text      text,
  ADD COLUMN IF NOT EXISTS lessee_contact_id    uuid REFERENCES contacts(id),
  ADD COLUMN IF NOT EXISTS lessee_name_text     text,
  ADD COLUMN IF NOT EXISTS lease_start          date,
  ADD COLUMN IF NOT EXISTS lease_end            date,
  ADD COLUMN IF NOT EXISTS sublease_allowed     boolean NOT NULL DEFAULT false;

-- ── 2. read helper covers all record links (owner / engagement / party ledger /
--       creator / current lessee) ──
CREATE OR REPLACE FUNCTION public.client_can_read_horse(h_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM horses h
    WHERE h.id = h_id
      AND h.deleted_at IS NULL
      AND (
        h.current_owner_contact_id = current_contact_id()
        OR h.lessee_contact_id     = current_contact_id()
        OR h.created_by_contact_id = current_contact_id()
        OR EXISTS (
          SELECT 1 FROM engagements e
          WHERE e.primary_horse_id = h.id
            AND e.deleted_at IS NULL
            AND e.client_id = current_client_id()
        )
        OR EXISTS (
          SELECT 1 FROM horse_parties hp
          WHERE hp.horse_id = h.id
            AND hp.deleted_at IS NULL
            AND hp.contact_id = current_contact_id()
            AND (hp.effective_to IS NULL OR hp.effective_to >= current_date)
        )
      )
  );
$$;

-- ── 3. horse_relationships — full ownership + lease history ──
CREATE TABLE IF NOT EXISTS horse_relationships (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id             uuid NOT NULL REFERENCES organizations(id),
  horse_id           uuid NOT NULL REFERENCES horses(id) ON DELETE CASCADE,
  relationship       text NOT NULL CHECK (relationship IN ('OWNER','LESSEE')),
  party_contact_id   uuid REFERENCES contacts(id),
  party_name_text    text,
  term_start         date,
  term_end           date,
  source_document_id uuid REFERENCES documents(id),
  created_by_contact_id uuid REFERENCES contacts(id),
  active             boolean NOT NULL DEFAULT true,
  created_at         timestamptz NOT NULL DEFAULT now(),
  ended_at           timestamptz
);
CREATE INDEX IF NOT EXISTS horse_relationships_horse_idx ON horse_relationships (horse_id);
CREATE INDEX IF NOT EXISTS horse_relationships_party_idx ON horse_relationships (party_contact_id);
CREATE INDEX IF NOT EXISTS horse_relationships_active_idx ON horse_relationships (horse_id) WHERE active;

ALTER TABLE horse_relationships ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS horse_rel_read ON horse_relationships;
CREATE POLICY horse_rel_read ON horse_relationships
  FOR SELECT USING (
    org_id = current_org()
    AND (has_staff_access() OR party_contact_id = current_contact_id()
         OR client_can_read_horse(horse_id))
  );
DROP POLICY IF EXISTS horse_rel_staff_write ON horse_relationships;
CREATE POLICY horse_rel_staff_write ON horse_relationships
  FOR ALL USING (org_id = current_org() AND has_staff_access())
  WITH CHECK (org_id = current_org() AND has_staff_access());
GRANT SELECT ON horse_relationships TO authenticated;
GRANT INSERT, UPDATE ON horse_relationships TO authenticated;

-- ── 4. horse_reconciliation — staff-only claims queue ──
CREATE TABLE IF NOT EXISTS horse_reconciliation (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id                uuid NOT NULL REFERENCES organizations(id),
  existing_horse_id     uuid REFERENCES horses(id),
  claimed_by_contact_id uuid REFERENCES contacts(id),
  claim_type            text CHECK (claim_type IN ('OWNER','LESSEE','OTHER')),
  claim_note            text,
  evidence_document_id  uuid REFERENCES documents(id),
  match_method          text CHECK (match_method IN ('MICROCHIP','FUZZY')),
  status                text NOT NULL DEFAULT 'open'
                          CHECK (status IN ('open','approved','rejected')),
  resolved_by_contact_id uuid REFERENCES contacts(id),
  resolved_at           timestamptz,
  created_at            timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE horse_reconciliation ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS horse_recon_staff ON horse_reconciliation;
CREATE POLICY horse_recon_staff ON horse_reconciliation
  FOR ALL USING (org_id = current_org() AND has_staff_access())
  WITH CHECK (org_id = current_org() AND has_staff_access());
GRANT SELECT, INSERT, UPDATE ON horse_reconciliation TO authenticated;

-- ── 5. create_horse_record — the ONE creation path (microchip dedup) ──
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

  -- microchip dedup: checked ONCE at submit, server-side
  IF v_chip IS NOT NULL THEN
    SELECT * INTO v_match FROM horses
     WHERE org_id = v_org AND deleted_at IS NULL
       AND regexp_replace(coalesce(microchip_id, ''), '\s', '', 'g') = v_chip
     LIMIT 1;
    IF FOUND THEN
      IF has_staff_access() OR client_can_read_horse(v_match.id) THEN
        -- authorized: reveal + no duplicate
        RETURN jsonb_build_object('outcome', 'match_found', 'horse_id', v_match.id);
      ELSE
        -- NOT authorized: reveal nothing; open a staff reconciliation task
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
    lessee_contact_id, lessee_name_text)
  VALUES (
    v_org,
    nullif(trim(coalesce(p ->> 'registered_name', p ->> 'barn_name')), ''),
    nullif(trim(p ->> 'barn_name'), ''),
    nullif(p ->> 'breed', ''), nullif(p ->> 'color', ''), nullif(p ->> 'markings', ''),
    nullif(p ->> 'sex', ''),
    (p ->> 'date_of_birth')::date,
    nullif(p ->> 'height', ''),
    nullif(p ->> 'registration_number', ''), nullif(p ->> 'registration_org', ''),
    v_chip, nullif(p ->> 'passport_number', ''), nullif(p ->> 'passport_country', ''),
    nullif(p ->> 'current_location', ''),
    nullif(p ->> 'fair_market_value', '')::numeric,
    nullif(p ->> 'vet_name', ''), nullif(p ->> 'vet_phone', ''),
    nullif(p ->> 'farrier_name', ''), nullif(p ->> 'farrier_phone', ''),
    nullif(p ->> 'medical_history', ''), nullif(p ->> 'behavioral_history', ''),
    nullif(p ->> 'medication_current', ''), nullif(p ->> 'known_conditions', ''),
    nullif(p ->> 'training_history', ''), nullif(p ->> 'competition_history', ''),
    v_me,
    CASE WHEN v_role = 'OWNER' THEN v_me END,
    nullif(p ->> 'owner_name_text', ''),
    CASE WHEN v_role = 'LESSEE' THEN v_me END,
    nullif(p ->> 'lessee_name_text', ''))
  RETURNING id INTO v_id;

  -- history rows for the declared relationship (and named counterpart, if any)
  INSERT INTO horse_relationships
    (org_id, horse_id, relationship, party_contact_id, party_name_text,
     created_by_contact_id)
  VALUES (v_org, v_id, v_role, v_me, NULL, v_me);
  IF v_role = 'LESSEE' AND nullif(p ->> 'owner_name_text', '') IS NOT NULL THEN
    INSERT INTO horse_relationships
      (org_id, horse_id, relationship, party_name_text, created_by_contact_id)
    VALUES (v_org, v_id, 'OWNER', p ->> 'owner_name_text', v_me);
  END IF;

  -- fuzzy fallback (name+dob+color) runs AFTER creation, admin-signal only
  IF v_chip IS NULL THEN
    INSERT INTO horse_reconciliation
      (org_id, existing_horse_id, claimed_by_contact_id, claim_type, claim_note, match_method)
    SELECT v_org, h.id, v_me, 'OTHER',
           'possible duplicate of new record ' || v_id::text, 'FUZZY'
    FROM horses h
    WHERE h.org_id = v_org AND h.deleted_at IS NULL AND h.id <> v_id
      AND lower(coalesce(h.registered_name, '')) = lower(coalesce(p ->> 'registered_name', ''))
      AND h.date_of_birth IS NOT DISTINCT FROM (p ->> 'date_of_birth')::date
      AND coalesce(h.color, '') = coalesce(p ->> 'color', '')
    LIMIT 3;
  END IF;

  RETURN jsonb_build_object('outcome', 'created', 'horse_id', v_id);
END;
$fn$;

REVOKE ALL ON FUNCTION create_horse_record(jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION create_horse_record(jsonb) TO authenticated, service_role;

-- ── 6. execution effects — lease attaches lessee-for-term; sale transfers owner ──
CREATE OR REPLACE FUNCTION apply_contract_execution_effects()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $fn$
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
  SELECT contact_id INTO v_lessor FROM engagement_parties
   WHERE engagement_id = NEW.engagement_id
     AND party_role IN ('LESSOR','SELLER') LIMIT 1;
  SELECT contact_id INTO v_lessee FROM engagement_parties
   WHERE engagement_id = NEW.engagement_id
     AND party_role IN ('LESSEE','BUYER') LIMIT 1;

  -- find the record: engagement's horse, else microchip match, else CREATE from
  -- the contract's horse fields (the contract births the record)
  SELECT primary_horse_id INTO v_horse FROM engagements WHERE id = NEW.engagement_id;
  v_chip := nullif(regexp_replace(coalesce(v_fields ->> 'HORSE.MICROCHIP', ''), '\s', '', 'g'), '');
  IF v_horse IS NULL AND v_chip IS NOT NULL THEN
    SELECT id INTO v_horse FROM horses
     WHERE org_id = NEW.org_id AND deleted_at IS NULL
       AND regexp_replace(coalesce(microchip_id, ''), '\s', '', 'g') = v_chip
     LIMIT 1;
  END IF;
  IF v_horse IS NULL THEN
    INSERT INTO horses (org_id, registered_name, barn_name, breed, color, sex,
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
  ELSE  -- HORSE_PURCHASE_SALE: ownership transfers seller → buyer
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
$fn$;

DROP TRIGGER IF EXISTS contract_execution_effects_trg ON documents;
CREATE TRIGGER contract_execution_effects_trg
  AFTER UPDATE OF workflow_state ON documents
  FOR EACH ROW
  EXECUTE FUNCTION apply_contract_execution_effects();

-- ── 7. lease-expiry nudge producer (H.11) — called by the daily nudge cron ──
CREATE OR REPLACE FUNCTION lease_expiry_nudge(p_days_ahead int DEFAULT 30)
RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $fn$
DECLARE v_n integer := 0;
BEGIN
  INSERT INTO notifications (org_id, user_id, kind, title, link)
  SELECT h.org_id, pr.user_id, 'lease_expiring',
         coalesce(h.barn_name, h.registered_name, 'Your lease') ||
           ' — lease ends ' || to_char(h.lease_end, 'FMMonth FMDD'),
         '/app/account'
  FROM horses h
  JOIN profiles pr ON pr.contact_id IN (h.lessee_contact_id, h.current_owner_contact_id)
  WHERE h.deleted_at IS NULL
    AND h.lease_end IS NOT NULL
    AND h.lease_end - current_date IN (p_days_ahead, 7, 1)
    AND pr.user_id IS NOT NULL
    AND NOT EXISTS (
      SELECT 1 FROM notifications n
      WHERE n.user_id = pr.user_id AND n.kind = 'lease_expiring'
        AND n.created_at::date = current_date
    );
  GET DIAGNOSTICS v_n = ROW_COUNT;
  RETURN v_n;
END;
$fn$;

REVOKE ALL ON FUNCTION lease_expiry_nudge(int) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION lease_expiry_nudge(int) TO service_role;
