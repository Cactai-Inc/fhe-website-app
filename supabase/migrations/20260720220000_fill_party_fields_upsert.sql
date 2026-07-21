-- Party auto-fill tokens ({{LESSOR.FULL_NAME}}, {{LESSEE.ADDRESS}}, the printed
-- names in the signature block, …) were rendering BLANK on HORSE_LEASE_V2.
--
-- Root cause: fill_party_fields_from_contacts only UPDATEs existing
-- contract_fields rows. The clause-model lease has no field_defs for the party
-- name/address/printed-name tokens (they're author-invisible auto-fill, never
-- shown as inputs), so recompose_document_fields never creates those rows and
-- the UPDATE matched nothing. remerge_contract_from_clauses then resolved the
-- tokens to '' → "made effective … by and between  of  ("Owner"…)".
--
-- Fix: make fill_party_fields_from_contacts UPSERT. When a party field row is
-- absent it is INSERTED as a SYSTEM-owned, author-invisible row carrying the
-- contact's value; when present (flat templates that DO define these fields) the
-- existing "fill only when blank, never overwrite" behavior is preserved via the
-- ON CONFLICT guard. The row's presence is what lets the clause merger read the
-- value into its {{TOKEN}} map. Idempotent and safe on every start_* path.

CREATE OR REPLACE FUNCTION public.fill_party_fields_from_contacts(p_document_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_org      uuid;
  v_contract uuid;
  r    RECORD;
  v_name text;
  v_addr text;
  v_pair record;
BEGIN
  SELECT contract_id, org_id INTO v_contract, v_org
    FROM documents WHERE id = p_document_id;
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
      compose_address(r.address_line1, r.address_line2, r.city, r.state, r.postal_code)
    );

    -- Upsert each party token. INSERT when the row is absent (clause-model docs
    -- have no field_def for these author-invisible auto-fill fields); on conflict,
    -- fill only when the existing value is blank so a value already entered on the
    -- document is never overwritten. Empty source values are skipped.
    FOR v_pair IN
      SELECT * FROM (VALUES
        (r.party_role || '.FULL_NAME',    v_name),
        (r.party_role || '.PRINTED_NAME', v_name),
        (r.party_role || '.EMAIL',        r.email),
        (r.party_role || '.PHONE',        r.phone),
        (r.party_role || '.ADDRESS',      v_addr)
      ) AS t(field_key, val)
      WHERE coalesce(btrim(t.val), '') <> ''
    LOOP
      INSERT INTO contract_fields (org_id, document_id, field_key, owner_role, value,
                                   value_type, is_optional, included, sort_order)
      VALUES (v_org, p_document_id, v_pair.field_key, 'SYSTEM', v_pair.val,
              'text', false, true, 0)
      ON CONFLICT (document_id, field_key) DO UPDATE
        SET value = EXCLUDED.value, updated_at = now()
        WHERE coalesce(btrim(contract_fields.value), '') = '';
    END LOOP;
  END LOOP;

  PERFORM remerge_contract_from_fields(p_document_id);
END;
$function$;
