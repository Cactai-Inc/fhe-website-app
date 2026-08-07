-- SECFIX S1 — stop five public views leaking real data to `anon`
--
-- THE HOLE
--   Five views in `public` are owned by `postgres`, carry no `security_invoker`, and
--   grant SELECT to `anon`. A view without security_invoker executes with its OWNER's
--   rights; `postgres` holds rolbypassrls, so the views bypass RLS entirely. Anyone
--   holding the public anon key — which ships in the client bundle by design — could
--   read 40 rows of real member and client data without authenticating.
--   Reproduced with SET LOCAL ROLE anon before this migration:
--     clients_overview 14 | inbound_queue 11 | memberships 9 | member_directory 6 |
--     service_credits 0 (empty today, same defect).
--
-- THE FIX, AND THE ONE PLACE IT DOES NOT FIT
--   `security_invoker = true` is the correct primary fix: the view then executes with
--   the caller's rights and RLS applies as intended. It is applied here to FOUR views.
--
--   It is deliberately NOT applied to `member_directory`. Measured in a dry run, it
--   collapses that view from 6 rows to 1 for an ordinary member, because the directory
--   is by definition a cross-member read while `profiles_select_own` and
--   `contacts_select` restrict a non-admin to their OWN row:
--       profiles_select_own : user_id = auth.uid() OR app_role()='SUPER_ADMIN' OR is_admin() AND …
--       contacts_select     : is_admin() OR (deleted_at IS NULL AND id = current_contact_id())
--   That would break both consumers — fetchMemberDirectory() (the community directory
--   would show a member only themselves) and fetchMemberProfile() (every other member's
--   profile page would 404). Making security_invoker work there needs a new SELECT
--   policy on profiles and contacts, which is a policy change and outside this task's
--   "grants and view options only" constraint. A lockout is a worse outcome than the
--   exposure, so the view option is left off and the gap is escalated in the report.
--
--   What IS done for member_directory is the mitigation the task sanctions where
--   nothing legitimate reads a view as anon: revoke anon's SELECT. Verified that
--   nothing does — both consumers live under /app and go through community.ts, whose
--   uid() helper throws when there is no session. This closes the anon exposure (the
--   most sensitive of the five: email, mobile, whatsapp for 6 real members) while
--   leaving authenticated reads untouched at 6 rows. It is an INTERIM measure, not the
--   primary fix, and does not close the RLS-bypass for any future non-anon caller.
--
-- DEFENCE IN DEPTH
--   anon's SELECT is revoked on all five. On the four that get security_invoker this is
--   belt-and-braces (they already return 0 rows to anon); it also protects them against
--   a future policy mistake. Confirmed no legitimate anon reader on any of the five:
--     clients_overview  — zero references in src/ or api/ (verified by grep)
--     memberships       — zero real references; the only two hits in api/hard-delete-client.ts
--                         are prose comments about the `members` TABLE cascade, not view reads
--     service_credits   — zero references in src/ or api/
--     inbound_queue     — staff only, src/lib/ops/api-intake.ts:135
--     member_directory  — authenticated members only, src/lib/community.ts:27 and :40
--
-- VERIFIED NOT BROKEN (dry run, before applying)
--   anon             → 0 rows on all five
--   ordinary member  → unchanged for every view it legitimately reads
--   staff/admin      → inbound_queue still 11 rows; clients_overview 14; memberships 9
--
-- REVERT (restores the pre-migration state exactly):
--   ALTER VIEW public.clients_overview SET (security_invoker = false);
--   ALTER VIEW public.inbound_queue    SET (security_invoker = false);
--   ALTER VIEW public.memberships      SET (security_invoker = false);
--   ALTER VIEW public.service_credits  SET (security_invoker = false);
--   GRANT SELECT ON public.clients_overview, public.inbound_queue, public.memberships,
--                   public.member_directory, public.service_credits TO anon;

BEGIN;

-- Primary fix — RLS now applies to the caller.
ALTER VIEW public.clients_overview SET (security_invoker = true);
ALTER VIEW public.inbound_queue    SET (security_invoker = true);
ALTER VIEW public.memberships      SET (security_invoker = true);
ALTER VIEW public.service_credits  SET (security_invoker = true);

-- member_directory deliberately keeps definer semantics — see the note above.

-- Defence in depth; for member_directory this is the only available mitigation.
REVOKE SELECT ON public.clients_overview FROM anon;
REVOKE SELECT ON public.inbound_queue    FROM anon;
REVOKE SELECT ON public.memberships      FROM anon;
REVOKE SELECT ON public.member_directory FROM anon;
REVOKE SELECT ON public.service_credits  FROM anon;

COMMIT;
