-- P1 — THE TWO NEW FUNCTIONS ARE NOT PUBLIC.
--
-- Postgres grants EXECUTE to PUBLIC on a newly created function by default, and
-- this database has no ALTER DEFAULT PRIVILEGES to stop it — the existing
-- functions (`invite_contract_counterparty`, `regenerate_contract_document`,
-- `my_onboarding_state` …) carry `authenticated | service_role` and nothing else
-- because each was revoked explicitly. The two added today are brought in line.
--
-- Neither was actually reachable: `invite_contract_party_account` refuses anyone
-- who is not service-role or staff of the document's org, and
-- `contract_intake_requirements` raises on a NULL `auth.uid()`. But
-- `invitations.token` is a live credential and the first of these mints one, so
-- the guard should not be the only thing standing there. (SECFIX2, 2026-08-07,
-- was the same shape: an anon path that "could not work" and was revoked anyway.)
--
-- `validate_invitation` is DELIBERATELY not touched: it is the pre-auth token
-- check the claim page calls before anyone is signed in, and it has always been
-- granted to PUBLIC/anon.

BEGIN;

REVOKE EXECUTE ON FUNCTION public.invite_contract_party_account(uuid, uuid, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.contract_intake_requirements(uuid) FROM PUBLIC, anon;

COMMIT;
