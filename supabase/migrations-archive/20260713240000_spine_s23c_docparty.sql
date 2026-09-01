/*
  # Spine S2.3c-docparty: last engagement_parties doc readers -> document_parties
  New v11-generated docs have engagement_id = NULL; apply_contract_execution_effects
  (birth horse on lease execution) + contract_message_post now read document_parties
  (+ documents.horse_id). Comments mentioning the old engagement path are historical.
*/

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

CREATE OR REPLACE FUNCTION contract_message_post(p_document_id uuid, p_body text)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $fn$
DECLARE
  v_org uuid; v_eng uuid; v_title text;
  v_staff boolean; v_label text; v_row contract_messages%ROWTYPE;
  v_party record;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'authentication required'; END IF;
  SELECT org_id, title INTO v_org, v_title
    FROM documents WHERE id = p_document_id AND deleted_at IS NULL;
  IF NOT FOUND THEN RAISE EXCEPTION 'unknown document'; END IF;

  v_staff := has_staff_access() AND v_org = current_org();
  IF NOT (v_staff OR caller_is_document_party(p_document_id)) THEN
    RAISE EXCEPTION 'not a party to this contract';
  END IF;

  SELECT coalesce(nullif(trim(concat_ws(' ', c.first_name, c.last_name)), ''), pr.email, 'Member')
    INTO v_label
  FROM profiles pr LEFT JOIN contacts c ON c.id = pr.contact_id
  WHERE pr.user_id = auth.uid();

  INSERT INTO contract_messages (org_id, document_id, sender_contact_id, sender_user_id, sender_label, body)
  VALUES (v_org, p_document_id, current_contact_id(), auth.uid(), coalesce(v_label, 'Member'), trim(p_body))
  RETURNING * INTO v_row;

  -- notify every OTHER party's linked user + the org's admins (deal oversight)
  FOR v_party IN
    SELECT DISTINCT pr.user_id
    FROM document_parties ep
    JOIN profiles pr ON pr.contact_id = ep.contact_id
    WHERE ep.document_id = p_document_id AND pr.user_id <> auth.uid()
    UNION
    SELECT pr.user_id FROM profiles pr
    WHERE pr.org_id = v_org AND pr.role IN ('ADMIN') AND pr.user_id <> auth.uid()
  LOOP
    PERFORM notify_user(v_party.user_id, 'contract_message',
      'New message on ' || coalesce(v_title, 'a contract'),
      left(trim(p_body), 200),
      '/app/contracts/' || p_document_id);
  END LOOP;

  RETURN jsonb_build_object('id', v_row.id, 'created_at', v_row.created_at);
END;
$fn$;
