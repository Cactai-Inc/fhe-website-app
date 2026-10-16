-- Horse records overhaul, phase 5c: capture_horse_record_info writes vet and farrier
-- into provider rows (upserting the primary entry) instead of the removed horse
-- columns, then recomposes the document from the horse record.

CREATE OR REPLACE FUNCTION public.capture_horse_record_info(p_document_id uuid, p_patch jsonb)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_org   uuid;
  v_horse uuid;
BEGIN
  SELECT org_id, horse_id INTO v_org, v_horse
    FROM documents WHERE id = p_document_id AND deleted_at IS NULL;
  IF v_org IS NULL THEN RAISE EXCEPTION 'unknown document'; END IF;
  IF v_horse IS NULL THEN RAISE EXCEPTION 'no horse on this document'; END IF;
  IF NOT ((coalesce(has_staff_access() AND v_org = current_org(), false)) OR caller_is_document_party(p_document_id)) THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  -- Upsert the primary VET provider from the patch (create it if none exists).
  IF p_patch ?| ARRAY['vet_name','vet_phone','vet_business_name','vet_address_line1','vet_city','vet_state','vet_postal'] THEN
    IF EXISTS (SELECT 1 FROM horse_relationships WHERE horse_id = v_horse AND relationship='VET' AND active) THEN
      UPDATE horse_relationships r SET
        party_name_text = CASE WHEN p_patch ? 'vet_name'          THEN nullif(btrim(p_patch->>'vet_name'),'')          ELSE party_name_text END,
        phone           = CASE WHEN p_patch ? 'vet_phone'         THEN nullif(btrim(p_patch->>'vet_phone'),'')         ELSE phone END,
        business_name   = CASE WHEN p_patch ? 'vet_business_name' THEN nullif(btrim(p_patch->>'vet_business_name'),'') ELSE business_name END,
        address_line1   = CASE WHEN p_patch ? 'vet_address_line1' THEN nullif(btrim(p_patch->>'vet_address_line1'),'') ELSE address_line1 END,
        city            = CASE WHEN p_patch ? 'vet_city'          THEN nullif(btrim(p_patch->>'vet_city'),'')          ELSE city END,
        state           = CASE WHEN p_patch ? 'vet_state'         THEN nullif(btrim(p_patch->>'vet_state'),'')         ELSE state END,
        postal          = CASE WHEN p_patch ? 'vet_postal'        THEN nullif(btrim(p_patch->>'vet_postal'),'')        ELSE postal END
      WHERE r.id = (SELECT id FROM horse_relationships WHERE horse_id = v_horse AND relationship='VET' AND active
                    ORDER BY (provider_role='primary') DESC, created_at DESC LIMIT 1);
    ELSE
      INSERT INTO horse_relationships (org_id, horse_id, relationship, provider_role,
        party_name_text, phone, business_name, address_line1, city, state, postal, active, created_by_contact_id)
      VALUES (v_org, v_horse, 'VET', 'primary',
        nullif(btrim(p_patch->>'vet_name'),''), nullif(btrim(p_patch->>'vet_phone'),''),
        nullif(btrim(p_patch->>'vet_business_name'),''), nullif(btrim(p_patch->>'vet_address_line1'),''),
        nullif(btrim(p_patch->>'vet_city'),''), nullif(btrim(p_patch->>'vet_state'),''),
        nullif(btrim(p_patch->>'vet_postal'),''), true, current_contact_id());
    END IF;
  END IF;

  -- Upsert the primary FARRIER provider from the patch.
  IF p_patch ?| ARRAY['farrier_name','farrier_phone'] THEN
    IF EXISTS (SELECT 1 FROM horse_relationships WHERE horse_id = v_horse AND relationship='FARRIER' AND active) THEN
      UPDATE horse_relationships r SET
        party_name_text = CASE WHEN p_patch ? 'farrier_name'  THEN nullif(btrim(p_patch->>'farrier_name'),'')  ELSE party_name_text END,
        phone           = CASE WHEN p_patch ? 'farrier_phone' THEN nullif(btrim(p_patch->>'farrier_phone'),'') ELSE phone END
      WHERE r.id = (SELECT id FROM horse_relationships WHERE horse_id = v_horse AND relationship='FARRIER' AND active
                    ORDER BY (provider_role='primary') DESC, created_at DESC LIMIT 1);
    ELSE
      INSERT INTO horse_relationships (org_id, horse_id, relationship, provider_role,
        party_name_text, phone, active, created_by_contact_id)
      VALUES (v_org, v_horse, 'FARRIER', 'primary',
        nullif(btrim(p_patch->>'farrier_name'),''), nullif(btrim(p_patch->>'farrier_phone'),''),
        true, current_contact_id());
    END IF;
  END IF;

  PERFORM sync_contract_fields_from_defs(p_document_id);

  UPDATE contract_fields cf
     SET value = horse_field_token_value(hz, split_part(regexp_replace(cf.field_key, '[{}]', '', 'g'), 'HORSE.', 2)),
         updated_at = now()
    FROM horses hz
   WHERE hz.id = v_horse
     AND cf.document_id = p_document_id
     AND regexp_replace(cf.field_key, '[{}]', '', 'g') IN
         ('HORSE.FARRIER_NAME','HORSE.FARRIER_PHONE','HORSE.VET_NAME',
          'HORSE.VET_PHONE','HORSE.VET_BUSINESS','HORSE.VET_ADDRESS');

  PERFORM remerge_contract_body(p_document_id);
END;
$function$;
