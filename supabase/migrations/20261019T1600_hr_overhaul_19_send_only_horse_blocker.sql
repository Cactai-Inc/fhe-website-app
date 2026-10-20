-- Sending a contract enforces ONLY the horse_missing blocker — not the full lock
-- blocker set. The counterparty fills their own fields AFTER receiving the contract,
-- so required-field and name blockers must not stop sending; only the structural
-- "no horse attached" rule does. (Lock still enforces the full set.)

DO $s$
DECLARE
  v_def text;
  v_old text := $q$  -- Cannot send a contract that is not ready to lock (e.g. no horse attached).
  IF jsonb_array_length(contract_lock_blockers(p_document_id)) > 0 THEN
    RAISE EXCEPTION 'this document is not ready to send: %',
      (SELECT string_agg(b->>'message', '; ') FROM jsonb_array_elements(contract_lock_blockers(p_document_id)) b);
  END IF;

  SELECT contact_id INTO v_target FROM document_parties$q$;
  v_new text := $q$  -- A sale or lease cannot be sent without its horse attached; other blockers
  -- (required fields, signer names) are the counterparty's to resolve after they
  -- receive it, so only the horse_missing blocker gates sending.
  IF EXISTS (SELECT 1 FROM jsonb_array_elements(contract_lock_blockers(p_document_id)) b
              WHERE b->>'code' = 'horse_missing') THEN
    RAISE EXCEPTION 'Attach the horse to this contract before sending it.';
  END IF;

  SELECT contact_id INTO v_target FROM document_parties$q$;
BEGIN
  SELECT pg_get_functiondef('public.send_contract_to_party(uuid,text)'::regprocedure) INTO v_def;
  IF position(v_old IN v_def) = 0 THEN
    RAISE EXCEPTION 'send_contract_to_party blocker-check anchor not found';
  END IF;
  EXECUTE replace(v_def, v_old, v_new);
END $s$;
