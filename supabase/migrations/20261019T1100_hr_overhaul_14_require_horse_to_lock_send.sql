-- A sale or lease cannot be locked or sent without a horse attached, so execution is
-- never reached without one and the error happens where the author can fix it. Add a
-- horse_missing blocker for sale/lease templates, and make the send path enforce
-- blockers (it did not before — only lock did).

-- 1. horse_missing blocker in contract_lock_blockers (append just before RETURN).
DO $b$
DECLARE
  v_def text;
  v_old text := $q$  RETURN v_blockers;
END;$q$;
  v_new text := $q$  -- A sale or lease must have its horse attached before it can be locked or sent.
  IF EXISTS (
    SELECT 1 FROM documents d
    JOIN contract_templates t ON t.id = d.template_id
    WHERE d.id = p_document_id AND d.horse_id IS NULL
      AND (is_horse_lease_template(t.template_key)
           OR coalesce(t.contract_kind, '') IN ('HORSE_SALE', 'HORSE_BILL_OF_SALE')
           OR t.template_key = 'HORSE_PURCHASE_SALE')
  ) THEN
    v_blockers := v_blockers || jsonb_build_array(jsonb_build_object(
      'code', 'horse_missing',
      'message', 'Attach the horse to this contract before locking or sending it.'));
  END IF;

  RETURN v_blockers;
END;$q$;
BEGIN
  SELECT pg_get_functiondef('public.contract_lock_blockers(uuid)'::regprocedure) INTO v_def;
  IF position(v_old IN v_def) = 0 THEN
    RAISE EXCEPTION 'contract_lock_blockers RETURN anchor not found';
  END IF;
  EXECUTE replace(v_def, v_old, v_new);
END $b$;

-- 2. send_contract_to_party enforces blockers (so the horse requirement also gates
--    sending, not just locking). Insert the check right after the authorization gate.
DO $s$
DECLARE
  v_def text;
  v_old text := $q$  SELECT contact_id INTO v_target FROM document_parties
   WHERE document_id = p_document_id AND party_role = p_party_role AND contact_id IS NOT NULL LIMIT 1;$q$;
  v_new text := $q$  -- Cannot send a contract that is not ready to lock (e.g. no horse attached).
  IF jsonb_array_length(contract_lock_blockers(p_document_id)) > 0 THEN
    RAISE EXCEPTION 'this document is not ready to send: %',
      (SELECT string_agg(b->>'message', '; ') FROM jsonb_array_elements(contract_lock_blockers(p_document_id)) b);
  END IF;

  SELECT contact_id INTO v_target FROM document_parties
   WHERE document_id = p_document_id AND party_role = p_party_role AND contact_id IS NOT NULL LIMIT 1;$q$;
BEGIN
  SELECT pg_get_functiondef('public.send_contract_to_party(uuid,text)'::regprocedure) INTO v_def;
  IF position(v_old IN v_def) = 0 THEN
    RAISE EXCEPTION 'send_contract_to_party anchor not found';
  END IF;
  EXECUTE replace(v_def, v_old, v_new);
END $s$;
