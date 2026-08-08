-- SECFIX2 G1 — close the last anon path into _ensure_client_account
--
-- THE HOLE
--   public.ensure_gift_buyer_account(uuid) is SECURITY DEFINER owned by postgres and is
--   executable by PUBLIC. Its body performs NO caller check of any kind — verified against
--   the live body: it contains no reference to auth.uid, is_admin, has_staff_access,
--   app_role or current_user. It reads gifts.org_id / gifts.buyer_email for whatever gift
--   id it is handed and calls
--       _ensure_client_account(org, buyer_email, first, last, '{}', '{}', 'CUSTOMER')
--   with postgres's rights.
--
--   S3 (20260807140000) revoked PUBLIC/anon/authenticated EXECUTE on
--   _ensure_client_account itself. This function is a SECURITY DEFINER wrapper around it,
--   so anon reaches the locked spine INDIRECTLY: guess or observe a gift uuid, call this,
--   and a contacts + clients row is provisioned in the real FHE org. That is the same
--   unauthorised-write primitive S3 closed, one hop away.
--
-- WHY A SINGLE `REVOKE … FROM anon` WOULD BE A SILENT NO-OP
--   The live ACL carries THREE independent grants:
--       =X/postgres                 <- PUBLIC
--       anon=X/postgres             <- explicit role grant
--       authenticated=X/postgres    <- explicit role grant
--       postgres=X/postgres  service_role=X/postgres
--   Revoking any one of them leaves anon executing through the others. Both prior traps in
--   this repo were exactly this shape (S2: column revoke against a table-level grant;
--   S3: FROM anon against a PUBLIC =X/postgres grant). All three are revoked together, and
--   has_function_privilege() is re-checked after the fact rather than trusting the
--   REVOKE's own output.
--
-- NOTHING CALLS THIS FUNCTION — verified four ways, not assumed
--   1. grep 'ensure_gift_buyer_account' over src/ api/ supabase/functions/  -> 0 hits
--      (only hits repo-wide are migrations, docs and a schema snapshot).
--   2. SELECT count(*) FROM pg_proc WHERE prosrc ILIKE '%gift_buyer%'      -> 0
--      Positive control for that query: prosrc ILIKE '%_ensure_client_account%' correctly
--      returns its 4 real callers, so the search is not silently broken.
--   3. pg_depend non-normal dependencies on the function oid                -> 0
--      (no trigger, view, default or constraint reaches it).
--   4. It is therefore dead in production: no client caller AND no database caller.
--
--   NOTE — this corrects the task brief, which stated "only other database functions"
--   invoke it. None do. There is consequently no gift flow that this revoke can break.
--   Gift redemption runs through redeem_gift, which does NOT call this function; it calls
--   _ensure_client_account directly under its own definer rights.
--
-- redeem_gift IS DELIBERATELY LEFT ALONE
--   It carries the same PUBLIC/anon/authenticated grants and is NOT touched here. It is
--   the live path behind the public /redeem route (src/lib/gifts.ts -> rpc('redeem_gift')).
--   Worth recording: its body opens with
--       IF auth.uid() IS NULL THEN RETURN 'not_authenticated'; END IF;
--   so anon executing it reaches nothing — it self-gates before touching
--   _ensure_client_account. The anon grant is retained as instructed and because the
--   /redeem page is publicly routed, but the indirect reach it appears to offer is already
--   closed by the function body.
--
--   postgres and service_role keep EXECUTE — the trusted server identities.
--
-- REVERT (restores the pre-migration state exactly):
--   GRANT EXECUTE ON FUNCTION public.ensure_gift_buyer_account(uuid)
--     TO PUBLIC, anon, authenticated;

BEGIN;

REVOKE EXECUTE ON FUNCTION public.ensure_gift_buyer_account(uuid)
  FROM PUBLIC, anon, authenticated;

COMMIT;
