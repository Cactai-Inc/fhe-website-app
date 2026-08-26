-- SIGNING FOR A COMPANY: THE NAME AND TITLE ARE TYPED AT THE SIGNATURE.
--
-- Owner, 2026-08-25: "i open the document with their signature on it and i scroll
-- to the bottom and i need to do the same thing as them, type my full name and
-- since im signing on behalf of the company i have to include my title and then
-- those fields are populated along with the digital signature being applied."
--
-- That is not how it was built. `{ROLE}.ENTITY_SIGNER_NAME` and `_TITLE` are
-- `contract_field_defs` rows in the SIGNATURES section, owned by the party,
-- `is_optional = false`, shown only when that party's PARTY_TYPE is ENTITY. They
-- were AUTHORING fields — required before the document could reach 'ready to
-- sign' — so on the live lease `contract_lock_blockers` returned:
--
--   Required field(s) still empty: Signing individual — name,
--   Signing individual — title, Lessor prohibits the use of rider aids
--
-- Nobody can fill capacity before signing: WHO signs, and in WHAT capacity, is
-- only known at the moment of signing. Two people at a barn can both sign for the
-- company, with different titles.
--
-- So capacity moves to the signature act. `lock_and_sign_contract` takes an
-- optional title, and writes BOTH capacity tokens for the signing role BEFORE the
-- blockers are evaluated — the signature itself satisfies the requirement, in the
-- same transaction, and the merged body prints "By: <name> / Title: <title>".
--
-- ⚠️ The fields stay REQUIRED and stay in the template. An ENTITY party that
-- reaches execution without them is still impossible; what changed is WHEN they
-- are filled, not WHETHER.
--
-- ⚠️ `CREATE OR REPLACE` with a new defaulted argument OVERLOADS rather than
-- replaces (this repo has been bitten by that twice). The old signature is
-- dropped explicitly.

BEGIN;

DROP FUNCTION IF EXISTS public.lock_and_sign_contract(uuid, text, text, boolean);

CREATE FUNCTION public.lock_and_sign_contract(
  p_document_id uuid, p_party_role text, p_typed_name text,
  p_esign_consent boolean DEFAULT false,
  p_signer_title text DEFAULT NULL)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_state text; v_blockers jsonb; v_msgs text; v_signed boolean;
  v_org uuid; v_is_entity boolean; v_title text;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'authentication required'; END IF;

  SELECT workflow_state, org_id INTO v_state, v_org
    FROM documents WHERE id = p_document_id AND deleted_at IS NULL;
  IF NOT FOUND THEN RAISE EXCEPTION 'unknown document: %', p_document_id; END IF;

  IF v_state NOT IN ('locked','editable') THEN
    IF v_state = 'executed' THEN
      RAISE EXCEPTION 'document is already executed; changing it requires signatures to be removed first';
    END IF;
    RAISE EXCEPTION 'document is not ready to sign (workflow_state=%); lock it first', v_state;
  END IF;

  -- ── CAPACITY, WRITTEN BY THE SIGNATURE ──────────────────────────────────
  -- Only for a party this contract treats as an ENTITY: an individual signs in
  -- their own name and has no capacity to declare. The typed signature name IS
  -- the signing individual's name — they are the same fact, typed once.
  SELECT coalesce(upper(btrim(cf.value)), '') = 'ENTITY' INTO v_is_entity
    FROM contract_fields cf
   WHERE cf.document_id = p_document_id
     AND cf.field_key = p_party_role || '.PARTY_TYPE';

  IF coalesce(v_is_entity, false) THEN
    v_title := nullif(btrim(coalesce(p_signer_title, '')), '');
    IF v_title IS NULL THEN
      RAISE EXCEPTION 'signing for % requires the title you sign in', p_party_role;
    END IF;

    INSERT INTO contract_fields (org_id, document_id, field_key, owner_role, value,
                                 value_type, is_optional, included, sort_order)
    VALUES
      (v_org, p_document_id, p_party_role || '.ENTITY_SIGNER_NAME',  'SYSTEM',
       btrim(p_typed_name), 'text', false, true, 0),
      (v_org, p_document_id, p_party_role || '.ENTITY_SIGNER_TITLE', 'SYSTEM',
       v_title, 'text', false, true, 0)
    ON CONFLICT (document_id, field_key) DO UPDATE
      SET value = EXCLUDED.value, updated_at = now()
      WHERE contract_fields.value IS DISTINCT FROM EXCLUDED.value;
  END IF;

  -- ONE function decides completeness. contract_lock_blockers carries the
  -- condition-aware required-field check, the open-change-request check, the
  -- LESSEE.PARTY_TYPE check, the horse-confirmation check and the
  -- document-before-contract wall — and it runs on every call, so a locked
  -- document altered after locking is caught here instead of signing anyway.
  -- It runs AFTER the capacity write above, which is the point: the signature
  -- supplies the last two fields rather than being blocked by them.
  v_blockers := contract_lock_blockers(p_document_id);
  IF jsonb_array_length(v_blockers) > 0 THEN
    SELECT string_agg(b->>'message', '; ') INTO v_msgs
      FROM jsonb_array_elements(v_blockers) b;
    RAISE EXCEPTION 'cannot sign: %', v_msgs;
  END IF;

  IF v_state = 'editable' THEN
    SELECT EXISTS (SELECT 1 FROM signatures
                   WHERE document_id = p_document_id AND deleted_at IS NULL
                     AND signed_at IS NOT NULL) INTO v_signed;
    IF NOT v_signed THEN
      -- ⚠️ THE DISPATCHER, NEVER `remerge_contract_from_fields` DIRECTLY: the flat
      -- composer reads a 23-character placeholder for every clause-composed
      -- template, and nothing here recomposes afterwards (20260826T0900).
      PERFORM remerge_contract_body(p_document_id);
    END IF;
  END IF;

  RETURN record_signature(p_document_id, p_party_role, p_typed_name, NULL, NULL,
                          coalesce(p_esign_consent, false));
END;
$function$;

REVOKE ALL ON FUNCTION public.lock_and_sign_contract(uuid, text, text, boolean, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.lock_and_sign_contract(uuid, text, text, boolean, text) TO authenticated;

COMMIT;
