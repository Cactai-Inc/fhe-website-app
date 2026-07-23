-- Care section: the Farrier Care and Veterinary Care clauses referenced combined
-- tokens {{HORSE.FARRIER}} / {{HORSE.VET}} that NOTHING populates (the horse
-- record stores discrete columns, and attach_horse_to_document only fills the
-- discrete tokens FARRIER_NAME/FARRIER_PHONE/VET_NAME/VET_PHONE/VET_BUSINESS/
-- VET_ADDRESS). So those lines always showed a muted "from horse record" hint.
--
-- Fix: reference the real discrete tokens so the actual details show, and when a
-- detail is missing from the horse record the client renders a blank editable
-- input (see ClauseDocument HORSE_RECORD_TOKENS). Farrier = name + phone; Vet =
-- name + phone + business + address (all four columns the record stores).

-- 1) Farrier Care clause body → discrete farrier fields.
UPDATE contract_clause_defs
   SET body = 'Party responsible for arranging: {{TXN.FARRIER_ARRANGE}}
Party responsible for costs: {{TXN.FARRIER_COST_PARTY}}
Farrier: {{HORSE.FARRIER_NAME}}
Farrier phone: {{HORSE.FARRIER_PHONE}}'
 WHERE template_key='HORSE_LEASE_V2' AND clause_key='CARE.FARRIER';

-- 2) Veterinary Care clause body → discrete vet fields (full details).
UPDATE contract_clause_defs
   SET body = 'Party responsible for arranging: {{TXN.VET_ARRANGE}}
Party responsible for costs: {{TXN.VET_COST_PARTY}}
Veterinarian: {{HORSE.VET_NAME}}
Practice: {{HORSE.VET_BUSINESS}}
Address: {{HORSE.VET_ADDRESS}}
Veterinarian phone: {{HORSE.VET_PHONE}}'
 WHERE template_key='HORSE_LEASE_V2' AND clause_key='CARE.ROUTINE_VET';

-- 3) Replace the combined HORSE.FARRIER / HORSE.VET field defs with discrete ones.
--    Keep the existing "only when the Lessee arranges" gate so they surface for the
--    party who needs to know the provider. is_optional so a blank record is valid.
DELETE FROM contract_field_defs
 WHERE template_key='HORSE_LEASE_V2' AND field_key IN ('HORSE.FARRIER','HORSE.VET');

INSERT INTO contract_field_defs
  (template_key, field_key, clause_key, section, label, input_kind, value_type, format_type, owner_role, is_optional, sort_order, guidance, conditional_on)
VALUES
  ('HORSE_LEASE_V2','HORSE.FARRIER_NAME','CARE.FARRIER','CARE','Farrier','text','text','text','LESSOR',true,20,
   'Farrier on the horse record.', '{"equals":["LESSEE"],"field_key":"TXN.FARRIER_ARRANGE"}'::jsonb),
  ('HORSE_LEASE_V2','HORSE.FARRIER_PHONE','CARE.FARRIER','CARE','Farrier phone','text','text','text','LESSOR',true,21,
   'Farrier phone on the horse record.', '{"equals":["LESSEE"],"field_key":"TXN.FARRIER_ARRANGE"}'::jsonb),
  ('HORSE_LEASE_V2','HORSE.VET_NAME','CARE.ROUTINE_VET','CARE','Veterinarian','text','text','text','LESSOR',true,20,
   'Veterinarian on the horse record.', '{"equals":["LESSEE"],"field_key":"TXN.VET_ARRANGE"}'::jsonb),
  ('HORSE_LEASE_V2','HORSE.VET_BUSINESS','CARE.ROUTINE_VET','CARE','Practice','text','text','text','LESSOR',true,21,
   'Veterinary practice on the horse record.', '{"equals":["LESSEE"],"field_key":"TXN.VET_ARRANGE"}'::jsonb),
  ('HORSE_LEASE_V2','HORSE.VET_ADDRESS','CARE.ROUTINE_VET','CARE','Address','text','text','text','LESSOR',true,22,
   'Veterinary address on the horse record.', '{"equals":["LESSEE"],"field_key":"TXN.VET_ARRANGE"}'::jsonb),
  ('HORSE_LEASE_V2','HORSE.VET_PHONE','CARE.ROUTINE_VET','CARE','Veterinarian phone','text','text','text','LESSOR',true,23,
   'Veterinarian phone on the horse record.', '{"equals":["LESSEE"],"field_key":"TXN.VET_ARRANGE"}'::jsonb);

-- 4) capture_horse_record_info: write farrier/vet details onto the horse record
--    from within the contract, then re-materialize the HORSE.* tokens and remerge.
--    Any document party or staff may write (mirrors captureContactInfo for parties);
--    owner-confirmation of non-owner edits is handled at the review layer.
CREATE OR REPLACE FUNCTION public.capture_horse_record_info(p_document_id uuid, p_patch jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_org   uuid;
  v_horse uuid;
BEGIN
  SELECT org_id, horse_id INTO v_org, v_horse
    FROM documents WHERE id = p_document_id AND deleted_at IS NULL;
  IF v_org IS NULL THEN RAISE EXCEPTION 'unknown document'; END IF;
  IF v_horse IS NULL THEN RAISE EXCEPTION 'no horse on this document'; END IF;
  IF NOT ((has_staff_access() AND v_org = current_org()) OR caller_is_document_party(p_document_id)) THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  -- Only the keys present in the patch are changed (the rest are kept as-is). We
  -- deliberately do NOT call attach_horse_to_document to re-materialize, because it
  -- forbids a non-owner from touching the horse — and the whole point here is that
  -- a non-owner party (e.g. the Lessee) can supply missing details for the owner to
  -- confirm on review. This function does its own party/staff authorization above.
  UPDATE horses SET
    farrier_name      = CASE WHEN p_patch ? 'farrier_name'      THEN nullif(btrim(p_patch->>'farrier_name'),'')      ELSE farrier_name      END,
    farrier_phone     = CASE WHEN p_patch ? 'farrier_phone'     THEN nullif(btrim(p_patch->>'farrier_phone'),'')     ELSE farrier_phone     END,
    vet_name          = CASE WHEN p_patch ? 'vet_name'          THEN nullif(btrim(p_patch->>'vet_name'),'')          ELSE vet_name          END,
    vet_phone         = CASE WHEN p_patch ? 'vet_phone'         THEN nullif(btrim(p_patch->>'vet_phone'),'')         ELSE vet_phone         END,
    vet_business_name = CASE WHEN p_patch ? 'vet_business_name' THEN nullif(btrim(p_patch->>'vet_business_name'),'') ELSE vet_business_name END,
    vet_address_line1 = CASE WHEN p_patch ? 'vet_address_line1' THEN nullif(btrim(p_patch->>'vet_address_line1'),'') ELSE vet_address_line1 END,
    vet_city          = CASE WHEN p_patch ? 'vet_city'          THEN nullif(btrim(p_patch->>'vet_city'),'')          ELSE vet_city          END,
    vet_state         = CASE WHEN p_patch ? 'vet_state'         THEN nullif(btrim(p_patch->>'vet_state'),'')         ELSE vet_state         END,
    vet_postal        = CASE WHEN p_patch ? 'vet_postal'        THEN nullif(btrim(p_patch->>'vet_postal'),'')        ELSE vet_postal        END,
    updated_at = now()
  WHERE id = v_horse;

  -- Ensure the discrete HORSE.* field rows exist for this doc, then re-materialize
  -- just the farrier/vet tokens from the updated horse record.
  PERFORM sync_contract_fields_from_defs(p_document_id);

  UPDATE contract_fields cf
     SET value = CASE regexp_replace(cf.field_key, '[{}]', '', 'g')
                   WHEN 'HORSE.FARRIER_NAME'  THEN coalesce(hz.farrier_name,'')
                   WHEN 'HORSE.FARRIER_PHONE' THEN coalesce(hz.farrier_phone,'')
                   WHEN 'HORSE.VET_NAME'      THEN coalesce(hz.vet_name,'')
                   WHEN 'HORSE.VET_PHONE'     THEN coalesce(hz.vet_phone,'')
                   WHEN 'HORSE.VET_BUSINESS'  THEN coalesce(hz.vet_business_name,'')
                   WHEN 'HORSE.VET_ADDRESS'   THEN coalesce(nullif(btrim(concat_ws(', ',
                                                   hz.vet_address_line1, hz.vet_city,
                                                   nullif(btrim(concat_ws(' ', hz.vet_state, hz.vet_postal)),''))),''),'')
                   ELSE cf.value
                 END,
         updated_at = now()
    FROM horses hz
   WHERE hz.id = v_horse
     AND cf.document_id = p_document_id
     AND regexp_replace(cf.field_key, '[{}]', '', 'g') IN
         ('HORSE.FARRIER_NAME','HORSE.FARRIER_PHONE','HORSE.VET_NAME',
          'HORSE.VET_PHONE','HORSE.VET_BUSINESS','HORSE.VET_ADDRESS');

  PERFORM remerge_contract_from_fields(p_document_id);
END;
$$;

GRANT EXECUTE ON FUNCTION public.capture_horse_record_info(uuid, jsonb) TO authenticated;
