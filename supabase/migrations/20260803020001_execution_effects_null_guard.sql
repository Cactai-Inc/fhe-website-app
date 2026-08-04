-- apply_contract_execution_effects: NULL-safe template guard (2026-08-03).
-- Found live by the onboarding e2e: signing COMPANY_POLICIES (or any plain
-- template) aborted with a horses_named constraint violation because the
-- sale-build guard let NULL contract_kind fall through. Full body carried
-- forward from live otherwise unchanged.
CREATE OR REPLACE FUNCTION public.apply_contract_execution_effects()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_key      text;
  v_kind     text;
  v_fields   jsonb := '{}'::jsonb;
  v_horse    uuid;
  v_chip     text;
  v_lessor   uuid;  -- lease: owner side  | sale: seller
  v_lessee   uuid;  -- lease: lessee      | sale: buyer
  v_start    date;
  v_end      date;
  v_hname    text;
  r          record;
BEGIN
  IF NOT (NEW.workflow_state = 'executed' AND OLD.workflow_state IS DISTINCT FROM 'executed') THEN
    RETURN NEW;
  END IF;

  SELECT template_key, contract_kind INTO v_key, v_kind
    FROM contract_templates WHERE id = NEW.template_id;
  -- coalesce is load-bearing: contract_kind is NULL for every plain template
  -- (releases, policies, medical auth), and NULL IN (...) is NULL — which made
  -- IF NOT(... OR NULL) skip this early return, so the horse-transfer effects
  -- fired on EVERY executed document and broke onboarding signing outright
  -- (horses_named violation from all-empty HORSE.* fields). 2026-08-03 e2e.
  IF NOT (is_horse_lease_template(v_key)
          OR v_key = 'HORSE_PURCHASE_SALE'
          OR coalesce(v_kind, '') IN ('HORSE_SALE', 'HORSE_BILL_OF_SALE')) THEN
    RETURN NEW;
  END IF;

  FOR r IN SELECT field_key, coalesce(trim(value), '') AS val
             FROM contract_fields WHERE document_id = NEW.id LOOP
    v_fields := v_fields || jsonb_build_object(r.field_key, r.val);
  END LOOP;

  -- accompanied bill of sale: the sale agreement drives the transfer; this
  -- document records it and has no exec effect of its own
  IF v_kind = 'HORSE_BILL_OF_SALE'
     AND coalesce(v_fields ->> 'TXN.BOS_HAS_SALE_AGREEMENT', '') = 'YES' THEN
    RETURN NEW;
  END IF;

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

  IF is_horse_lease_template(v_key) THEN
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
  ELSE  -- sale kinds: ownership transfers seller → buyer
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

    -- conservative default: home location does NOT follow the transfer
    -- automatically — staff review it
    SELECT coalesce(nickname, registered_name, 'the horse') INTO v_hname
      FROM horses WHERE id = v_horse;
    PERFORM notify_staff(NEW.org_id, 'horse_ownership_transferred',
      'Ownership transferred — review home location for ' || v_hname,
      '/app/ops/horses');
  END IF;

  RETURN NEW;
END;
$function$

;
