-- THE SIGN BUTTON WIPES A CLAUSE-COMPOSED CONTRACT. THIS IS THE TENTH CALLER.
--
-- `lock_and_sign_contract` re-merges the body before the first signature, so the
-- text that gets signed reflects the final field values. It called
-- `remerge_contract_from_fields`, which composes from `contract_templates.body`
-- — the literal string '(composed from clauses)', 23 characters, for every
-- clause-composed template (HORSE_LEASE_V2 and friends, HORSE_SALE_V2,
-- HORSE_BILL_OF_SALE).
--
-- On 2026-08-25 (migration 20260825T1700) two other callers were moved off that
-- function, with the reasoning that all remaining database callers "happen to
-- recompose from the clauses immediately afterwards." THIS ONE DOES NOT. It
-- re-merges and then goes straight to `record_signature`.
--
-- Rehearsed on the live lease inside BEGIN/ROLLBACK, as the admin who would
-- click the button:
--
--   before                                     merged_body = 25,643 chars
--   remerge_contract_from_fields(...)          returned 23, STORED 23
--
-- The document is `editable` with no signatures, which is exactly the branch
-- condition. So the FIRST SIGNATURE ON THIS CONTRACT WOULD DESTROY IT — the
-- signature would attach to a document reading "(composed from clauses)".
--
-- The fix is the dispatcher, `remerge_contract_body`, which tries the clauses
-- first and falls back to the flat body only when a template has no clause defs.
-- That is what every other re-merge site uses.

BEGIN;

CREATE OR REPLACE FUNCTION public.lock_and_sign_contract(
  p_document_id uuid, p_party_role text, p_typed_name text,
  p_esign_consent boolean DEFAULT false)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_state text; v_blockers jsonb; v_msgs text; v_signed boolean;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'authentication required'; END IF;

  SELECT workflow_state INTO v_state
    FROM documents WHERE id = p_document_id AND deleted_at IS NULL;
  IF NOT FOUND THEN RAISE EXCEPTION 'unknown document: %', p_document_id; END IF;

  IF v_state NOT IN ('locked','editable') THEN
    IF v_state = 'executed' THEN
      RAISE EXCEPTION 'document is already executed; changing it requires signatures to be removed first';
    END IF;
    RAISE EXCEPTION 'document is not ready to sign (workflow_state=%); lock it first', v_state;
  END IF;

  -- ONE function decides completeness. contract_lock_blockers carries the
  -- condition-aware required-field check, the open-change-request check, the
  -- LESSEE.PARTY_TYPE check, the horse-confirmation check and the
  -- document-before-contract wall — and it runs on every call, so a locked
  -- document altered after locking is caught here instead of signing anyway.
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
      -- ⚠️ THE DISPATCHER, NEVER `remerge_contract_from_fields` DIRECTLY. See the
      -- header: the flat composer reads a 23-character placeholder for every
      -- clause-composed template, and nothing here recomposes afterwards.
      PERFORM remerge_contract_body(p_document_id);
    END IF;
  END IF;

  RETURN record_signature(p_document_id, p_party_role, p_typed_name, NULL, NULL,
                          coalesce(p_esign_consent, false));
END;
$function$;

COMMIT;
