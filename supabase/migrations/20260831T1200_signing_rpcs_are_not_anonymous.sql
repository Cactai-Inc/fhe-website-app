-- The two functions that WRITE a signature stop being reachable anonymously.
--
-- Flagged by TASK-AR7, TASK-FIX1 and the ORCH5 audit — three threads, never ruled.
-- Owner ruling 2026-08-31: "fix the anon grant in cybersecurity safe ways."
--
-- NOT a live vulnerability, and that was verified rather than assumed. Probed as
-- `anon` against a real document id: record_signature stops at
-- current_contact_id() being NULL ("no contact for the signing account") and
-- remove_my_signature raises "authentication required". The guard inside the
-- function was doing the work the grant should never have permitted.
--
-- This is defence in depth: an EXECUTE grant nothing needs, on the two functions
-- that write and remove signatures. If a future edit ever moves that internal
-- check — exactly what happened to the typed-name rule, which three surfaces
-- enforced and a fourth did not — the grant is what decides whether the mistake
-- is reachable by a stranger.
--
-- Verified before writing this: three call sites, all authenticated client code
-- (src/lib/api.ts, src/lib/ops/api-client.ts, src/lib/contracts.ts). No api/
-- route calls them (a server route would hold service_role regardless), and the
-- public kiosk paths sign through sign_release / sign_general_release, which are
-- untouched here.
--
-- ⚠️ REVOKE FROM PUBLIC ALONE IS NOT ENOUGH — a direct grant to `anon` survives
-- it, and this repo has been caught by that before (ORCHESTRATOR.md §3). Both
-- roles are named explicitly.

REVOKE EXECUTE ON FUNCTION public.record_signature(uuid, text, text, text, text, boolean)
  FROM anon, PUBLIC;

REVOKE EXECUTE ON FUNCTION public.remove_my_signature(uuid, uuid)
  FROM anon, PUBLIC;

-- Restated rather than assumed: a DROP/CREATE elsewhere resets an ACL to the
-- schema default, so the roles that MUST keep access are named here too.
GRANT EXECUTE ON FUNCTION public.record_signature(uuid, text, text, text, text, boolean)
  TO authenticated, service_role;

GRANT EXECUTE ON FUNCTION public.remove_my_signature(uuid, uuid)
  TO authenticated, service_role;
