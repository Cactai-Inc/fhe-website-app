-- PARTYEMAIL PHASE 4a — the record owns the party fields, and the signature owns
-- the name.
--
-- D22 §2 (owner, 2026-08-20): "if the contract record changes, email, name, phone,
-- address, they need to be pushed to the contract fields ... otherwise we end up
-- with a contract that is locked to only using the email address."
-- D22 §3: "even on a locked contract this information can be updated because we
-- would have the previous version archived and the contract information such as
-- phone and email and address are not part of the signature, only the name is ...
-- so that cannot be changed."
--
-- WHAT WAS WRONG. fill_party_fields_from_contacts upserted every party token
-- blank-only:
--     ON CONFLICT ... DO UPDATE SET value = EXCLUDED.value
--       WHERE coalesce(btrim(contract_fields.value), '') = ''
-- so it was a one-time seed, not a propagation. Once a token held anything at all,
-- the contact record could never reach it again — which is precisely the contract
-- "locked to only using the email address" the owner described.
--
-- WHAT CHANGES. Three of the five party tokens become the RECORD's, permanently:
--   .EMAIL · .PHONE · .ADDRESS   — pushed on every fill, forever, on locked and
--                                  executed documents too. They are not part of
--                                  the signature.
--   .FULL_NAME · .PRINTED_NAME   — pushed while the document is unsigned; frozen
--                                  the moment it is signed. They are what the
--                                  signature attests to.
--   .PARTY_TYPE                  — unchanged (blank-only). It is a declaration on
--                                  the instrument, not a contact detail, and
--                                  contract_lock_blockers already reconciles it
--                                  against the record.
--
-- THE FREEZE IS AN EXCLUSION INSIDE THIS FILL, not a second locking concept.
-- "Signed" is document-level and means: workflow_state = 'executed', OR any sealed
-- signature exists on the document. Document-level rather than per-party because a
-- signature attests to the whole instrument, including the other side's name.
--
-- D14: A PROPAGATED CHANGE IS A CHANGE. When a push OVERWRITES a value that was
-- already there, log_contract_change records it exactly as a person's edit is
-- recorded, so it appears in track-changes and reaches the party who did not make
-- it. A first fill (blank -> value) is not a change and is not logged.
--
-- An empty source value is still skipped: clearing a phone on the record does not
-- blank the token on a live contract.
--
-- Reissued from the live prod body (pg_get_functiondef, 2026-08-20).

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
  v_frozen boolean;
  v_prev   text;
BEGIN
  IF NOT coalesce(caller_is_document_party_or_staff(p_document_id), false) THEN
    RAISE EXCEPTION 'not authorized to write party fields on document %', p_document_id;
  END IF;
  SELECT contract_id, org_id INTO v_contract, v_org
    FROM documents WHERE id = p_document_id;
  IF v_contract IS NULL THEN RETURN; END IF;

  -- Is the name settled? Once anything on this document has been signed, the two
  -- name tokens are the signature's and stop tracking the record.
  SELECT (coalesce(d.workflow_state, '') = 'executed')
      OR EXISTS (SELECT 1 FROM signatures s
                  WHERE s.document_id = p_document_id
                    AND s.signed_at IS NOT NULL AND s.deleted_at IS NULL)
    INTO v_frozen
    FROM documents d WHERE d.id = p_document_id;

  FOR r IN
    SELECT t.*,
           CASE WHEN t.party_role = 'BUYER' AND t.rn > 1 THEN 'COBUYER' ELSE t.party_role END AS ns
      FROM (
        SELECT cp.party_role,
               row_number() OVER (PARTITION BY cp.party_role
                                  ORDER BY cp.signer_order NULLS LAST, cp.id) AS rn,
               c.first_name, c.last_name, c.email, c.phone_display AS phone,
               c.address_composed, c.address_line1, c.address_line2,
               c.city, c.state, c.postal_code, c.is_company
          FROM contract_parties cp
          JOIN contacts c ON c.id = cp.contact_id
         WHERE cp.contract_id = v_contract
      ) t
  LOOP
    v_name := nullif(btrim(coalesce(r.first_name,'') || ' ' || coalesce(r.last_name,'')), '');
    -- prefer a precomposed address; otherwise assemble from parts
    v_addr := coalesce(
      nullif(btrim(coalesce(r.address_composed,'')), ''),
      compose_address(r.address_line1, r.address_line2, r.city, r.state, r.postal_code)
    );

    -- `owned` = the contact record is the source of truth for this token and
    -- overwrites whatever the document holds. FALSE keeps the original blank-only
    -- behaviour, which is what a frozen name and PARTY_TYPE get.
    FOR v_pair IN
      SELECT * FROM (VALUES
        (r.ns || '.FULL_NAME',    v_name,   NOT v_frozen),
        (r.ns || '.PRINTED_NAME', v_name,   NOT v_frozen),
        (r.ns || '.EMAIL',        r.email,  true),
        (r.ns || '.PHONE',        r.phone,  true),
        (r.ns || '.ADDRESS',      v_addr,   true),
         (r.ns || '.PARTY_TYPE',
          CASE WHEN r.ns IN ('LESSEE','LESSOR','SELLER','BUYER','COBUYER')
               THEN CASE WHEN coalesce(r.is_company,false) THEN 'ENTITY' ELSE 'INDIVIDUAL' END END,
          false)
      ) AS t(field_key, val, owned)
      WHERE coalesce(btrim(t.val), '') <> ''
    LOOP
      SELECT nullif(btrim(coalesce(cf.value, '')), '') INTO v_prev
        FROM contract_fields cf
       WHERE cf.document_id = p_document_id AND cf.field_key = v_pair.field_key;

      IF v_pair.owned THEN
        INSERT INTO contract_fields (org_id, document_id, field_key, owner_role, value,
                                     value_type, is_optional, included, sort_order)
        VALUES (v_org, p_document_id, v_pair.field_key, 'SYSTEM', v_pair.val,
                'text', false, true, 0)
        ON CONFLICT (document_id, field_key) DO UPDATE
          SET value = EXCLUDED.value, updated_at = now()
          WHERE contract_fields.value IS DISTINCT FROM EXCLUDED.value;

        -- D14: an overwrite is an edit and is surfaced like one. A first fill is
        -- not an edit, so v_prev IS NULL is silent.
        IF v_prev IS NOT NULL AND v_prev IS DISTINCT FROM v_pair.val THEN
          PERFORM log_contract_change(
            p_document_id, 'field_value', v_pair.field_key, v_pair.field_key,
            'SYSTEM', v_prev, v_pair.val,
            jsonb_build_object('propagated', true, 'source', 'contact_record'));
        END IF;
      ELSE
        -- Blank-only: a value already on the document is never overwritten. This
        -- is what a signed name keeps, and what PARTY_TYPE has always had.
        INSERT INTO contract_fields (org_id, document_id, field_key, owner_role, value,
                                     value_type, is_optional, included, sort_order)
        VALUES (v_org, p_document_id, v_pair.field_key, 'SYSTEM', v_pair.val,
                'text', false, true, 0)
        ON CONFLICT (document_id, field_key) DO UPDATE
          SET value = EXCLUDED.value, updated_at = now()
          WHERE coalesce(btrim(contract_fields.value), '') = '';
      END IF;
    END LOOP;
  END LOOP;

  PERFORM remerge_contract_from_fields(p_document_id);
END;
$function$;
