-- VALIDATION ROUND — record_signature must accept 'COBUYER' as the signing role.
--
-- Companion to vr_20261026T2000 (caller_party_roles now maps the co-buyer's seat to
-- the COBUYER role so the co-buyer can edit their own COBUYER-owned initials). That
-- change also makes the contract page's myRoles[0] = 'COBUYER' for the co-buyer, and
-- the signing path passes that straight through:
--   ContractPage signAndContinue -> lockAndSign -> lock_and_sign_contract(..., 'COBUYER')
--   -> record_signature(..., 'COBUYER').
--
-- But a co-buyer is SEATED as a second BUYER party row (there is no COBUYER party_role
-- in the document_parties / signatures CHECK constraints — only BUYER). record_signature
-- validates the signer against document_parties.party_role = p_party_role, seeds/updates
-- the signatures row keyed on party_role = p_party_role, and only THEN derives the
-- namespace v_ns = BUYER/COBUYER by signer_order rank (keyed to the caller's contact).
-- So with p_party_role = 'COBUYER' the signer check fails ("not a signer on this
-- document in role COBUYER") and the co-buyer cannot sign at all.
--
-- The architecture is: the stored party_role is always 'BUYER'; COBUYER is a derived
-- NAMESPACE, never a stored role. Fix: normalize an incoming 'COBUYER' to 'BUYER' at
-- the very top of record_signature. Every downstream use (signer lookup, the signatures
-- INSERT/UPDATE, the status detail text) then operates on the real stored role, and the
-- existing rank-based v_ns derivation still resolves this caller to the COBUYER
-- namespace for the SIG.COBUYER.* token merge — exactly as it did before the co-buyer's
-- myRoles started coming back as COBUYER. lock_and_sign_contract is left untouched: its
-- COBUYER.PARTY_TYPE / COBUYER.ENTITY_SIGNER_* references are field namespaces (correct),
-- and its forward of 'COBUYER' to record_signature is normalized here.

BEGIN;

DO $fix$
DECLARE v_def text;
BEGIN
  SELECT pg_get_functiondef('public.record_signature'::regproc) INTO v_def;

  IF position('normalize an incoming COBUYER' IN v_def) > 0 THEN
    RETURN;  -- already patched
  END IF;

  -- Insert the normalization immediately after the signer-contact is resolved, before
  -- the signer-role existence check that uses p_party_role.
  v_def := replace(
    v_def,
    'IF v_signer IS NULL THEN RAISE EXCEPTION ''no contact for the signing account''; END IF;',
    'IF v_signer IS NULL THEN RAISE EXCEPTION ''no contact for the signing account''; END IF;' || chr(10)
      || chr(10)
      || '  -- normalize an incoming COBUYER (a derived namespace) to the stored party_role' || chr(10)
      || '  -- BUYER: a co-buyer is seated as a second BUYER party row, and the COBUYER' || chr(10)
      || '  -- namespace is re-derived below by signer_order rank for the token merge.' || chr(10)
      || '  IF p_party_role = ''COBUYER'' THEN p_party_role := ''BUYER''; END IF;'
  );

  EXECUTE v_def;
END $fix$;

COMMIT;
