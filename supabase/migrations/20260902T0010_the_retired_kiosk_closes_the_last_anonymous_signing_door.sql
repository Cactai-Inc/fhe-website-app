-- The last two functions an ANONYMOUS caller could use to write a signature stop
-- being reachable anonymously.
--
-- TASK-SIGNFLOW-D, owner ruling 2026-09-01: "we dont use docs/release-participant
-- nor /release … the /sign/ flow should be the single pathway we use", and
-- "we dont have a situation where a person without an account signs documents on
-- an ipad or any other way."
--
-- 20260831T1200_signing_rpcs_are_not_anonymous.sql closed record_signature and
-- remove_my_signature and SAID, verbatim, why it could not close these two:
--   "the public kiosk paths sign through sign_release / sign_general_release,
--    which are untouched here."
-- That reason is now gone. The routes that reached them (/release,
-- /release/:releaseKey, /docs/release-participant) were removed from src/App.tsx
-- in this same change, and api/sign-release.ts — the one caller, which used the
-- ANON key on purpose because a kiosk has no session — is deleted with them.
--
-- WHAT THIS CLOSES, measured rather than asserted: sign_release creates a
-- contacts row, a clients row, a document, a signature and an esign_consents row,
-- and executes the document, for a caller with no account at all. It is the only
-- writer of signatures.method = 'KIOSK_TYPED' (verified across every function in
-- public via pg_get_functiondef). 40 such signatures exist, from 10 real signers,
-- 2026-07-13 to 2026-08-15. THEY STAY — D32: nothing is ever removed from the
-- database, and an executed release is a legal record.
--
-- ⚠️ REVOKE FROM PUBLIC ALONE IS NOT ENOUGH — a direct grant to `anon` survives
-- it, and this repo has been caught by that before. Both roles are named.
-- ⚠️ THE FUNCTIONS THEMSELVES ARE NOT DROPPED. A DROP + CREATE would reset the
-- ACL to the schema default and re-grant anon through Supabase's default
-- privileges. This migration revokes; it does not touch a function body.

REVOKE EXECUTE ON FUNCTION public.sign_release(
  text, text, text, text, text, text, boolean, text, text, date, text, boolean,
  uuid, boolean, date, text, text, text, text, text, text, text, text, text, text, text)
  FROM anon, PUBLIC;

REVOKE EXECUTE ON FUNCTION public.sign_general_release(text, text, text, text, uuid, boolean)
  FROM anon, PUBLIC;

-- Restated rather than assumed: the role that must keep access is named here, so
-- a later DROP/CREATE that resets the ACL has something to restore from.
-- service_role only. There is no browser caller of either function any more —
-- sign_general_release has had ZERO code callers for some time and sign_release's
-- only one was api/sign-release.ts. A server route holds service_role and can
-- still call them; nothing a browser holds can.
GRANT EXECUTE ON FUNCTION public.sign_release(
  text, text, text, text, text, text, boolean, text, text, date, text, boolean,
  uuid, boolean, date, text, text, text, text, text, text, text, text, text, text, text)
  TO service_role;

GRANT EXECUTE ON FUNCTION public.sign_general_release(text, text, text, text, uuid, boolean)
  TO service_role;
