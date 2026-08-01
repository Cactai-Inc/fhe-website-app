-- ─────────────────────────────────────────────────────────────────────────────
-- CLOSE THE UNAUTHENTICATED DOOR ON _provision_purchase_for_offerings
-- (2026-08-01, follow-up to batch 1)
--
-- Two overloads of _provision_purchase_for_offerings exist. The 2026-07-25
-- signature (…, p_mark_paid boolean, p_payment_method text, …) had its grants
-- correctly scoped. The 2026-07-26 signature (…, p_payment_method text,
-- p_mark_paid boolean, …) was created without a matching REVOKE, so it kept
-- PostgreSQL's default EXECUTE-to-PUBLIC and additionally carried anon:
--
--   =X/postgres | postgres=X/postgres | anon=X/postgres | authenticated=X/postgres | service_role=X/postgres
--    ^^^^^^^^^^ PUBLIC                  ^^^^^^^^^^^^^^^ unauthenticated role
--
-- That is an unauthenticated path into purchase provisioning.
--
-- Revoking is safe INDEPENDENT of the caller trace: both SQL-side callers
-- (provision_client_invitation, attach_offerings_to_client) are SECURITY
-- DEFINER owned by postgres, so they execute as the owner and never rely on
-- the invoker's EXECUTE privilege. Verified 2026-08-01:
--
--   proname                      | security_definer | owner
--   provision_client_invitation  | t                | postgres
--   attach_offerings_to_client   | t                | postgres
--
-- The eventual DROP of this overload still needs the caller trace (call sites
-- resolve positionally, and getting that wrong breaks invite provisioning —
-- see batch 1 section 4). The grant does not need to wait for it.
-- ─────────────────────────────────────────────────────────────────────────────

REVOKE ALL ON FUNCTION public._provision_purchase_for_offerings(
  uuid, uuid, uuid, uuid[], text, boolean, numeric, text) FROM PUBLIC;

REVOKE ALL ON FUNCTION public._provision_purchase_for_offerings(
  uuid, uuid, uuid, uuid[], text, boolean, numeric, text) FROM anon;

-- Match the sibling overload's grants exactly.
GRANT EXECUTE ON FUNCTION public._provision_purchase_for_offerings(
  uuid, uuid, uuid, uuid[], text, boolean, numeric, text) TO authenticated;

GRANT EXECUTE ON FUNCTION public._provision_purchase_for_offerings(
  uuid, uuid, uuid, uuid[], text, boolean, numeric, text) TO service_role;
