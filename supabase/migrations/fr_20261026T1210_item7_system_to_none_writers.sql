-- Fix round 3, item 7 — the writers that stamped owner_role 'SYSTEM' now stamp
-- 'NONE'. SYSTEM is removed as an owner value; the computed/auto-fill/entity-signer
-- rows these functions insert carry NONE (no party edits them). The sync function's
-- two guards that protected SYSTEM rows now protect NONE rows.
--
-- Each is an in-place string replace of the exact owner_role literal in the live
-- body, read fresh, so the rest of every function is untouched. The 'SYSTEM' in
-- fill_party_fields_from_contacts' log_contract_change call is an ACTOR label, not
-- an owner_role, and is deliberately left alone.

BEGIN;

-- recompose_document_fields: three computed inserts stamp owner_role.
DO $mig$
DECLARE v_src text := pg_get_functiondef('public.recompose_document_fields(uuid)'::regprocedure);
BEGIN
  v_src := replace(v_src, '''TXN.LEASE_FEE_PAYABLE'', ''SYSTEM''', '''TXN.LEASE_FEE_PAYABLE'', ''NONE''');
  v_src := replace(v_src, '''TXN.TRANSPORT_APPLIES'', ''SYSTEM''', '''TXN.TRANSPORT_APPLIES'', ''NONE''');
  v_src := replace(v_src, '''TXN.TRIAL_AT_CURRENT'', ''SYSTEM''', '''TXN.TRIAL_AT_CURRENT'', ''NONE''');
  IF v_src ~ 'LEASE_FEE_PAYABLE'', ''SYSTEM' THEN RAISE EXCEPTION 'recompose SYSTEM not fully replaced'; END IF;
  EXECUTE v_src;
END $mig$;

-- fill_party_fields_from_contacts: the two party auto-fill INSERTs stamp owner_role
-- (the log_contract_change actor 'SYSTEM' is NOT touched).
DO $mig$
DECLARE
  v_src text := pg_get_functiondef('public.fill_party_fields_from_contacts(uuid)'::regprocedure);
  v_old text := 'VALUES (v_org, p_document_id, v_pair.field_key, ''SYSTEM'', v_pair.val,';
  v_new text := 'VALUES (v_org, p_document_id, v_pair.field_key, ''NONE'', v_pair.val,';
BEGIN
  IF position(v_old in v_src) = 0 THEN RAISE EXCEPTION 'fill_party owner_role anchor not found'; END IF;
  v_src := replace(v_src, v_old, v_new);  -- replaces BOTH identical inserts
  EXECUTE v_src;
END $mig$;

-- lock_and_sign_contract: the two ENTITY_SIGNER capacity inserts stamp owner_role.
DO $mig$
DECLARE v_src text := pg_get_functiondef('public.lock_and_sign_contract(uuid,text,text,boolean,text)'::regprocedure);
BEGIN
  v_src := replace(v_src, '''.ENTITY_SIGNER_NAME'',  ''SYSTEM''', '''.ENTITY_SIGNER_NAME'',  ''NONE''');
  v_src := replace(v_src, '''.ENTITY_SIGNER_TITLE'', ''SYSTEM''', '''.ENTITY_SIGNER_TITLE'', ''NONE''');
  IF v_src ~ 'ENTITY_SIGNER_[A-Z]+'',? +''SYSTEM' THEN RAISE EXCEPTION 'lock_and_sign SYSTEM not fully replaced'; END IF;
  EXECUTE v_src;
END $mig$;

-- sync_contract_fields_from_defs: the two guards that protected SYSTEM rows now
-- protect NONE rows (the party auto-fill + computed rows that have no def).
DO $mig$
DECLARE v_src text := pg_get_functiondef('public.sync_contract_fields_from_defs(uuid)'::regprocedure);
BEGIN
  v_src := replace(v_src, 'cf.owner_role <> ''SYSTEM''', 'cf.owner_role <> ''NONE''');
  IF v_src ~ 'owner_role <> ''SYSTEM' THEN RAISE EXCEPTION 'sync SYSTEM guard not replaced'; END IF;
  EXECUTE v_src;
END $mig$;

COMMIT;
