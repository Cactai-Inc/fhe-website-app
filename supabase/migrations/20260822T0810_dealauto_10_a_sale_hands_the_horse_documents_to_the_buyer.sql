-- DEALAUTO follow-up §F2 (the mechanism) — a sale generates the horse
-- documents, addressed to the buyer.
--
-- `apply_contract_execution_effects` has always called `ensure_horse_documents`
-- in its LEASE branch and never in its SALE branch. Measured 2026-08-22: every
-- sale this system has written ends with ownership moved and no emergency
-- veterinary authorization and no care liability release on file for the person
-- who now owns the horse. The lease got it right and the sale was simply never
-- written.
--
-- The call goes AFTER the ownership transfer, deliberately. `ensure_horse_documents`
-- resolves its addressee as `coalesce(horses.current_owner_contact_id, …)` — so
-- placed after the UPDATE it addresses the BUYER without being told who that is,
-- and placed before it, it would have addressed the seller. That ordering IS the
-- owner's ruling expressed in one line: "the docs invert for a BOS vs a lease."
--
-- ⚠️ AND THE REASON THIS COULD NOT SIMPLY BE ADDED. `ensure_horse_documents`
-- authorizes on the CALLING SESSION: staff, or the horse's owner, or its lessee,
-- or an active horse_relationships row. On a lease that always holds — whoever
-- signs last is one of those. On a SALE where the SELLER signs last it never
-- does: the transfer immediately above has just made them the former owner and
-- deactivated their OWNER relationship row. It would have raised 'not authorized
-- for this horse' — and this trigger has no exception handler, so **the seller's
-- signature would have rolled back.** A guard that turns the last signature on a
-- bill of sale into an error is not a guard worth keeping as-is.
--
-- pg_trigger_depth() > 0 is the precise allowance: the caller is an execution
-- trigger acting on an instrument that has ALREADY been authorized and sealed —
-- the transfer is a fact by then, not a request. It is 0 for every direct RPC
-- from a browser, so the client-facing boundary is untouched. Same distinction
-- migration 7 made in deliver_executed_document_set, same reason.

CREATE OR REPLACE FUNCTION public.ensure_horse_documents(p_horse_id uuid, p_contract_id uuid DEFAULT NULL::uuid, p_include_care boolean DEFAULT NULL::boolean)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_org       uuid := current_org();
  v_horse     horses%ROWTYPE;
  v_owner     uuid;
  v_contact   uuid := current_contact_id();
  v_templates text[] := ARRAY['HORSE_EMERGENCY_VET'];
  v_tpl       text;
  v_doc       uuid;
  v_voided    int := 0;
  v_rc        int := 0;
  v_gen       jsonb := '[]'::jsonb;
  v_may       boolean;
  v_seq       int;
  v_fields    int;
BEGIN
  -- DEALAUTO: in trigger context the org comes from the horse, not from the
  -- signer's session — a buyer signing a bill of sale may have no org of their
  -- own resolved at that instant, and the horse's org is the fact.
  SELECT * INTO v_horse FROM horses
   WHERE id = p_horse_id AND deleted_at IS NULL
     AND (org_id = v_org OR pg_trigger_depth() > 0);
  IF NOT FOUND THEN RAISE EXCEPTION 'horse not found in this org'; END IF;
  v_org := v_horse.org_id;

  v_may := pg_trigger_depth() > 0
    OR has_staff_access()
    OR v_horse.current_owner_contact_id = v_contact
    OR v_horse.lessee_contact_id = v_contact
    OR EXISTS (SELECT 1 FROM horse_relationships hr WHERE hr.horse_id = p_horse_id AND hr.party_contact_id = v_contact AND hr.active);
  IF NOT v_may THEN RAISE EXCEPTION 'not authorized for this horse'; END IF;

  v_owner := coalesce(v_horse.current_owner_contact_id, v_contact);
  IF v_owner IS NULL THEN RAISE EXCEPTION 'horse has no owner on record to authorize'; END IF;

  IF p_include_care IS TRUE
     OR (p_include_care IS NULL AND owner_has_executed_template(v_owner, 'RELEASE_HORSE_CARE')) THEN
    v_templates := array_append(v_templates, 'RELEASE_HORSE_CARE');
  END IF;

  FOREACH v_tpl IN ARRAY v_templates LOOP
    -- HORSEDOCS: a signed document is evidence and is NEVER swept. EXECUTED is
    -- protected, and so is a still-pending document that already carries a live
    -- signature.
    WITH tmpl AS (SELECT id FROM contract_templates WHERE template_key = v_tpl)
    UPDATE documents d
       SET deleted_at = now(), deleted_by = auth.uid()
     WHERE d.contact_id = v_owner
       AND d.template_id = (SELECT id FROM tmpl)
       AND d.deleted_at IS NULL
       AND d.status <> 'EXECUTED'
       AND NOT EXISTS (SELECT 1 FROM signatures s
                        WHERE s.document_id = d.id AND s.deleted_at IS NULL)
       AND (d.horse_id IS NULL
            OR (d.horse_id = p_horse_id AND d.merged_body LIKE '%{{HORSE.REGISTERED_NAME}}%'));
    GET DIAGNOSTICS v_rc = ROW_COUNT;
    v_voided := v_voided + v_rc;

    IF EXISTS (
      SELECT 1 FROM documents d
      JOIN contract_templates t ON t.id = d.template_id
      WHERE d.contact_id = v_owner AND t.template_key = v_tpl
        AND d.horse_id = p_horse_id AND d.deleted_at IS NULL
        AND d.merged_body NOT LIKE '%{{HORSE.REGISTERED_NAME}}%'
    ) THEN
      CONTINUE;
    END IF;

    -- OWNER is the sole party/signer; coverage of FHE + any active-term lessee is
    -- a standing clause in the body, not a named party.
    SELECT gd.document_id INTO v_doc FROM generate_document(
      v_owner, v_tpl, p_contract_id, p_horse_id,
      jsonb_build_array(jsonb_build_object(
        'contact_id', v_owner, 'role', 'CLIENT', 'is_signer', true, 'signer_order', 1)),
      'horse'::text) gd;

    v_seq := CASE WHEN p_contract_id IS NULL THEN NULL
                  WHEN v_tpl = 'HORSE_EMERGENCY_VET' THEN 2
                  WHEN v_tpl = 'RELEASE_HORSE_CARE'  THEN 3 END;
    SELECT count(*) INTO v_fields FROM contract_fields WHERE document_id = v_doc;
    -- DEALAUTO §2: a document with nothing to author is ready to sign. Left
    -- 'editable' it appears in the signing set and offers no way to sign it.
    UPDATE documents
       SET status = 'AWAITING_SIGNATURE', sign_sequence = v_seq,
           workflow_state = CASE WHEN v_fields = 0 THEN 'locked' ELSE workflow_state END
      WHERE id = v_doc AND status = 'DRAFT';
    v_gen := v_gen || jsonb_build_object('template_key', v_tpl, 'document_id', v_doc);
  END LOOP;

  IF p_contract_id IS NOT NULL THEN
    UPDATE documents d SET sign_sequence = 1
      FROM contract_templates t
     WHERE d.template_id = t.id AND is_horse_lease_template(t.template_key)
       AND d.contract_id = p_contract_id AND d.deleted_at IS NULL
       AND d.sign_sequence IS DISTINCT FROM 1;
  END IF;

  RETURN jsonb_build_object('owner_contact_id', v_owner, 'generated', v_gen, 'voided', v_voided);
END;
$function$;

-- ── the sale branch finally does what the lease branch always did ──────────
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
  -- (releases, policies, medical auth), and NULL IN (...) is NULL.
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
    -- ownership does not move: the LESSOR is still the owner of record, so the
    -- generator addresses the horse documents to them
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

    -- DEALAUTO 2026-08-22 (owner): "the seller doesnt retain authority to
    -- release liability or grant vet auth. [the buyer] inherits that upon
    -- signature on the BOS." AFTER the transfer above, so the generator's
    -- own "address it to the owner of record" rule resolves to the buyer.
    -- Isolated: the paperwork that follows a sale may not undo the sale.
    BEGIN
      PERFORM ensure_horse_documents(v_horse, NEW.contract_id, true);
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'apply_contract_execution_effects: horse documents not generated for the buyer on horse %: %',
        v_horse, SQLERRM;
    END;

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
$function$;
