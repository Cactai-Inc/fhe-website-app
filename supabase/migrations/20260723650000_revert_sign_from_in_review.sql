-- Revert: signing must require a LOCKED (read-only) document. Model is:
--   Notify → in_review (parties review + can still edit)
--   Lock for signing → locked (READ-ONLY) → both sign → executed
-- A contract you sign must be frozen — you sign what you see. Signing from
-- in_review (still editable) was wrong. Restore 'locked'/'editable'/'executed' only.

CREATE OR REPLACE FUNCTION public.lock_and_sign_contract(p_document_id uuid, p_party_role text, p_typed_name text, p_esign_consent boolean DEFAULT false)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_state text;
  v_open  int;
  v_missing int;
  v_horse_confirmed timestamptz;
  v_needs_horse boolean;
  v_signed boolean;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'authentication required';
  END IF;

  SELECT workflow_state, horse_section_confirmed_at INTO v_state, v_horse_confirmed
    FROM documents WHERE id = p_document_id AND deleted_at IS NULL;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'unknown document: %', p_document_id;
  END IF;

  IF v_state NOT IN ('locked','editable','executed') THEN
    RAISE EXCEPTION 'document is not ready to sign (workflow_state=%); lock it first', v_state;
  END IF;
  IF v_state IN ('editable') THEN
    SELECT count(*) INTO v_open FROM document_change_requests
      WHERE document_id = p_document_id AND status = 'open';
    IF v_open > 0 THEN
      RAISE EXCEPTION 'cannot sign: % open change request(s) remain; resolve or lock first', v_open;
    END IF;
    SELECT count(*) INTO v_missing FROM contract_fields
      WHERE document_id = p_document_id AND required
        AND nullif(trim(coalesce(value, '')), '') IS NULL;
    IF v_missing > 0 THEN
      RAISE EXCEPTION 'cannot sign: % required field(s) still empty', v_missing;
    END IF;
    v_needs_horse := EXISTS (
      SELECT 1 FROM contract_fields
      WHERE document_id = p_document_id
        AND owner_role = 'LESSOR' AND field_key LIKE 'HORSE.%');
    IF v_needs_horse AND v_horse_confirmed IS NULL THEN
      RAISE EXCEPTION 'cannot sign: the horse information has not been confirmed by the Lessor';
    END IF;
    SELECT EXISTS (SELECT 1 FROM signatures
                   WHERE document_id = p_document_id AND deleted_at IS NULL
                     AND signed_at IS NOT NULL) INTO v_signed;
    IF NOT v_signed THEN
      PERFORM remerge_contract_from_fields(p_document_id);
    END IF;
  END IF;

  RETURN record_signature(p_document_id, p_party_role, p_typed_name, NULL, NULL,
                          coalesce(p_esign_consent, false));
END;
$function$;
