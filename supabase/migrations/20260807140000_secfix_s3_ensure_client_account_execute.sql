-- SECFIX S3 — stop unauthenticated callers executing _ensure_client_account
--
-- THE HOLE
--   public._ensure_client_account(uuid,text,text,text,text[],text[],text) is SECURITY
--   DEFINER owned by postgres, and it writes contacts, clients and
--   contact_required_documents into WHATEVER ORG IS PASSED AS A PARAMETER. Its body
--   validates only that p_org is non-null, that email is non-empty and that p_marker is
--   CLIENT or CUSTOMER. There is no caller check of any kind — verified: the body
--   contains no reference to is_admin, has_staff_access, auth.uid, app_role, current_org
--   or current_user.
--
--   Reproduced against prod before this migration, as `anon`, unauthenticated:
--     SELECT _ensure_client_account('e656f20b-…'::uuid, 'secfix-anon-probe@example.test',
--                                   'Anon','Probe', ARRAY['RIDER'], NULL, 'CLIENT');
--     → {"client_id": "9a00e53e-…", "contact_id": "4d19a47a-…"}
--     → 1 contact + 1 client + 4 contact_required_documents rows in the real FHE org.
--   (Rolled back; nothing persisted.)
--
-- WHY THIS IS NOT JUST `REVOKE … FROM anon`
--   The function's ACL is:
--       =X/postgres   postgres=X/postgres   anon=X/postgres
--       authenticated=X/postgres            service_role=X/postgres
--   The leading `=X/postgres` is a grant to PUBLIC. Revoking from anon alone is a SILENT
--   NO-OP — anon keeps EXECUTE through PUBLIC. Verified in prod inside BEGIN/ROLLBACK:
--       REVOKE EXECUTE … FROM anon;
--       → anon_still_can_execute = t
--   Same shape of trap as S2's table-level grant. PUBLIC must be revoked as well.
--
-- SCOPE NOTE — authenticated is revoked too
--   Once PUBLIC and anon are revoked, `authenticated` still holds an explicit grant, so
--   the identical unauthorised write would remain available to anyone who can create an
--   account — the same defect one signup away. Nothing legitimate uses that grant, so it
--   goes as well. This is stated plainly rather than done quietly.
--
-- THE FOUR LEGITIMATE CALLERS ARE UNAFFECTED
--   provision_client_invitation, redeem_gift, redeem_contract_invitation and
--   ensure_gift_buyer_account are all SECURITY DEFINER owned by postgres. They therefore
--   call _ensure_client_account with postgres's rights, not the web caller's, and do not
--   depend on the grants removed here. Each is exercised end to end in the verification.
--   No direct call to _ensure_client_account exists anywhere in src/ or api/ (grep: none).
--
--   service_role and postgres keep EXECUTE — the trusted server identities.
--
-- REVERT (restores the pre-migration state exactly):
--   GRANT EXECUTE ON FUNCTION public._ensure_client_account(uuid,text,text,text,text[],text[],text)
--     TO PUBLIC, anon, authenticated;

BEGIN;

REVOKE EXECUTE ON FUNCTION
  public._ensure_client_account(uuid,text,text,text,text[],text[],text)
  FROM PUBLIC, anon, authenticated;

COMMIT;
