-- THE 23-CHARACTER WIPE, FIXED AT THE SOURCE.
--
-- `remerge_contract_from_fields` composes from `contract_templates.body`. Every
-- clause-composed template stores the literal string '(composed from clauses)'
-- there — 23 characters — so calling it on a lease, a sale or a bill of sale
-- replaces the document's entire text with that placeholder.
--
--   HORSE_LEASE_V2 / _FULL / _SIMPLE / _STANDARD   body_len 23, 163 clause defs
--   HORSE_SALE_V2                                  body_len 23,  76
--   HORSE_BILL_OF_SALE                             body_len 23,  36
--   the other 20 templates                         body_len 3,732–18,253, 0 clauses
--
-- Two functions ENDED on that call. Nothing has ever been lost, and the reason is
-- luck rather than design: every database caller happens to recompose from the
-- clauses immediately afterwards in the same transaction. The two app-side callers
-- did the same thing across TWO transactions, where a failure between them was
-- permanent — that half was fixed in the TypeScript on 2026-08-25 (commit
-- 0c148427). This closes it in the database, so a future caller cannot step on it.
--
-- ⚠️ WHAT THIS IS *NOT* FIXING, because it is not broken.
-- A build thread reported that `regenerate_contract_document`'s template-drift
-- guard destroys executed contracts, on the reading that `fill_party_fields_from_
-- contacts` blanks the body and the `IF v_drifted THEN RETURN` path returns before
-- the repairing UPDATE. That cannot happen: BOTH mergers end their write with
-- `AND workflow_state <> 'executed'`, and the drift guard only evaluates WHEN the
-- document is executed. The two conditions are mutually exclusive by construction.
-- Verified empirically on the live lease with all three stated conditions armed
-- (executed · clause-composed · signed_template_version 1 vs template version 3):
--
--   regenerate_contract_document  →  returned 25739, STORED 25739   ← body intact
--   remerge_contract_from_fields  →  returned    23, STORED 25739   ← write filtered
--   fill_party_fields_from_contacts alone      →  STORED 25739
--
-- The report read the RETURN value and took it for the stored value. The drift
-- guard is left exactly as it is; changing a function that runs on every contract
-- open, to fix a defect that does not exist, is the risk here.

BEGIN;

CREATE OR REPLACE FUNCTION public.fill_party_fields_from_contacts(p_document_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_org      uuid;
  v_contract uuid;
  v_doc_template_id uuid;
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
  SELECT contract_id, org_id, template_id INTO v_contract, v_org, v_doc_template_id
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

  /* ⚠️ NEVER `remerge_contract_from_fields` FROM HERE. It composes from
     `contract_templates.body`, and every clause-composed template stores the
     literal string '(composed from clauses)' there — 23 characters. This
     function's last act was therefore to REPLACE A LEASE'S ENTIRE TEXT with that
     placeholder, and the only reason no contract was ever lost is that all nine
     database callers happen to recompose from the clauses immediately afterwards,
     inside the same transaction. That is a property of nine call sites, not a
     property of this function, and it is not one a tenth caller would know to
     preserve.

     A clause-composed document is now left ALONE here: its `contract_fields` rows
     have been updated, and the caller recomposes. Stale is a recoverable failure
     mode; destroyed is not. Flat templates are unchanged — for them
     `remerge_contract_from_fields` IS the right composer, and it is still called.

     Verified 2026-08-25 — the nine callers, all of which recompose after:
       add_deal_document · add_document_party_by_email · reassign_document_party ·
       regenerate_contract_document · set_document_co_buyer · start_bill_of_sale ·
       start_bill_of_sale_standalone · start_lease_contract_v2 · start_sale_contract
     (`sync_contract_fields_from_defs` only NAMES it, in a comment.) */
  IF NOT EXISTS (
    SELECT 1 FROM contract_clause_defs cd
     WHERE cd.template_key = (SELECT ct.template_key FROM contract_templates ct
                               WHERE ct.id = v_doc_template_id)
  ) THEN
    PERFORM remerge_contract_from_fields(p_document_id);
  END IF;
END;
$function$

;

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

  /* ⚠️ THE SAME TRAP, AND THIS ONE WAS REACHABLE. See the note in
     `fill_party_fields_from_contacts`: `remerge_contract_from_fields` composes
     from `contract_templates.body`, which is 23 characters for every
     clause-composed template. This function has no other database caller — its
     one caller is `captureHorseRecord` in the app, which is a SEPARATE
     transaction, so the repairing re-merge could not roll back with it. Between
     the two round trips a live lease's text WAS the placeholder, and a dropped
     connection or a closed tab made that permanent.
     `remerge_contract_body` is the dispatcher that already existed: clauses when
     the template has them, fields when it does not. */
  PERFORM remerge_contract_body(p_document_id);
END;
$function$

;

COMMIT;
