-- Allow signing directly from 'in_review'. Signature is left OPEN: once a contract
-- is Notified (workflow_state = in_review), a party can sign at their convenience
-- without a separate staff "lock" step. Previously lock_and_sign_contract only
-- accepted 'locked' / 'editable' / 'executed', so a Notified (in_review) contract
-- had nowhere to sign. in_review gets the same pre-sign gates as the editable path.

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

  IF v_state NOT IN ('locked','editable','in_review','executed') THEN
    RAISE EXCEPTION 'document is not ready to sign (workflow_state=%)', v_state;
  END IF;
  -- editable OR in_review: sign in place (signature left open), applying the same
  -- pre-sign gates as the lock flow.
  IF v_state IN ('editable','in_review') THEN
    SELECT count(*) INTO v_open FROM document_change_requests
      WHERE document_id = p_document_id AND status = 'open';
    IF v_open > 0 THEN
      RAISE EXCEPTION 'cannot sign: % open change request(s) remain; resolve them first', v_open;
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
    -- defensive re-merge so a field-sourced, stripped body is composed before the
    -- first signature (never once a signature exists — would erase SIG tokens)
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
