-- A contract does not create a horse record. The horse must be attached before a
-- sale or lease can be locked or sent (enforced in contract_lock_blockers + the send
-- path), so by execution time a horse_id is always present. Remove the dormant
-- create-from-contract block (and the provider seeding that rode on it); if a horse
-- is somehow still missing at execution, fail clearly rather than inventing a record.

DO $strip$
DECLARE
  v_def text;
  v_old text := $q$  IF v_horse IS NULL THEN
    INSERT INTO horses (org_id, registered_name, nickname, breed, color, sex,
                        registration_number, microchip_id, current_location,
                        fair_market_value, created_by_contact_id, current_owner_contact_id)
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
            v_lessor, v_lessor)
    RETURNING id INTO v_horse;
    IF nullif(v_fields ->> 'HORSE.VET_NAME','') IS NOT NULL THEN
      INSERT INTO horse_relationships (org_id, horse_id, relationship, provider_role, party_name_text, phone, active, created_by_contact_id)
      VALUES (NEW.org_id, v_horse, 'VET', 'primary', nullif(v_fields ->> 'HORSE.VET_NAME',''), nullif(v_fields ->> 'HORSE.VET_PHONE',''), true, v_lessor);
    END IF;
    IF nullif(v_fields ->> 'HORSE.FARRIER_NAME','') IS NOT NULL THEN
      INSERT INTO horse_relationships (org_id, horse_id, relationship, provider_role, party_name_text, phone, active, created_by_contact_id)
      VALUES (NEW.org_id, v_horse, 'FARRIER', 'primary', nullif(v_fields ->> 'HORSE.FARRIER_NAME',''), nullif(v_fields ->> 'HORSE.FARRIER_PHONE',''), true, v_lessor);
    END IF;
    -- birth row: the owner-side party owns the record
    INSERT INTO horse_relationships (org_id, horse_id, relationship, party_contact_id,
                                     source_document_id, created_by_contact_id)
    VALUES (NEW.org_id, v_horse, 'OWNER', v_lessor, NEW.id, v_lessor);
  END IF;$q$;
  v_new text := $q$  IF v_horse IS NULL THEN
    -- The horse is required before a sale or lease is locked or sent, so this is
    -- unreachable on a real path; a contract never creates a record.
    RAISE EXCEPTION 'cannot apply execution effects: no horse is attached to document %', NEW.id;
  END IF;$q$;
BEGIN
  SELECT pg_get_functiondef('public.apply_contract_execution_effects'::regproc) INTO v_def;
  IF position(v_old IN v_def) = 0 THEN
    RAISE EXCEPTION 'apply_contract_execution_effects create-block anchor not found';
  END IF;
  EXECUTE replace(v_def, v_old, v_new);
END $strip$;
