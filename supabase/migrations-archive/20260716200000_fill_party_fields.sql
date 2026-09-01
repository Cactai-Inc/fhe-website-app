-- ROOT CAUSE (party fields empty on a fresh contract): the seed creates the
-- LESSEE.* / LESSOR.* / BUYER.* / SELLER.* identity fields EMPTY, and — unlike the
-- horse, which has attach_horse_to_document — nothing ever copies the selected
-- contact's name/email/phone/address into them. The party contact goes into
-- contract_parties (for signing/roles) but never into the document's fields.
--
-- fill_party_fields_from_contacts mirrors the horse attach: for each party on the
-- document's contract, it writes that contact's identity into the matching
-- {ROLE}.FULL_NAME / .PRINTED_NAME / .EMAIL / .PHONE / .ADDRESS fields (only when
-- the field exists and is still blank, so it never clobbers a hand-entered value),
-- then re-merges the body.

CREATE OR REPLACE FUNCTION public.fill_party_fields_from_contacts(p_document_id uuid)
 RETURNS void
 LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  v_contract uuid;
  r RECORD;
  v_name text;
  v_addr text;
BEGIN
  SELECT contract_id INTO v_contract FROM documents WHERE id = p_document_id;
  IF v_contract IS NULL THEN RETURN; END IF;

  FOR r IN
    SELECT cp.party_role, c.first_name, c.last_name, c.email, c.phone,
           c.address_composed, c.address_line1, c.address_line2,
           c.city, c.state, c.postal_code, c.is_company
      FROM contract_parties cp
      JOIN contacts c ON c.id = cp.contact_id
     WHERE cp.contract_id = v_contract
  LOOP
    v_name := nullif(btrim(coalesce(r.first_name,'') || ' ' || coalesce(r.last_name,'')), '');
    -- prefer a precomposed address; otherwise assemble from parts
    v_addr := coalesce(
      nullif(btrim(coalesce(r.address_composed,'')), ''),
      nullif(btrim(
        concat_ws(', ',
          nullif(btrim(coalesce(r.address_line1,'') || ' ' || coalesce(r.address_line2,'')), ''),
          r.city,
          nullif(btrim(coalesce(r.state,'') || ' ' || coalesce(r.postal_code,'')), '')
        )), '')
    );

    -- fill only when the field EXISTS and is currently blank (never overwrite
    -- something already entered on the document)
    UPDATE contract_fields SET value = v_name, updated_at = now()
      WHERE document_id = p_document_id
        AND field_key IN (r.party_role || '.FULL_NAME', r.party_role || '.PRINTED_NAME')
        AND v_name IS NOT NULL AND coalesce(btrim(value),'') = '';

    UPDATE contract_fields SET value = r.email, updated_at = now()
      WHERE document_id = p_document_id AND field_key = r.party_role || '.EMAIL'
        AND coalesce(nullif(btrim(r.email),''),'') <> '' AND coalesce(btrim(value),'') = '';

    UPDATE contract_fields SET value = r.phone, updated_at = now()
      WHERE document_id = p_document_id AND field_key = r.party_role || '.PHONE'
        AND coalesce(nullif(btrim(r.phone),''),'') <> '' AND coalesce(btrim(value),'') = '';

    UPDATE contract_fields SET value = v_addr, updated_at = now()
      WHERE document_id = p_document_id AND field_key = r.party_role || '.ADDRESS'
        AND v_addr IS NOT NULL AND coalesce(btrim(value),'') = '';
  END LOOP;

  PERFORM remerge_contract_from_fields(p_document_id);
END;
$function$;
GRANT EXECUTE ON FUNCTION public.fill_party_fields_from_contacts(uuid) TO authenticated;
