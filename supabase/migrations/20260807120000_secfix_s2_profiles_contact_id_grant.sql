-- SECFIX S2 — stop `authenticated` writing profiles.contact_id (identity takeover)
--
-- THE HOLE
--   `authenticated` held a TABLE-level INSERT and UPDATE grant on public.profiles,
--   which covers every column including contact_id. The profiles_insert_own /
--   profiles_update_own policies constrain only WHICH ROW you may touch
--   (user_id = auth.uid()); neither constrains the VALUE of contact_id.
--   current_contact_id() is `SELECT contact_id FROM profiles WHERE user_id = auth.uid()`,
--   and every contact-scoped RLS policy in the system is built on it. So an ordinary
--   member could repoint their own profile at any other contact row and be treated as
--   that person by the whole authorization layer.
--
--   Two live vectors, both reproduced against prod before this migration:
--     V1  UPDATE profiles SET contact_id = <other contact>  — any member who has a profile row
--     V2  INSERT INTO profiles (user_id, contact_id, …)     — any auth user who has NOT yet
--         got a profile row. No auth.users trigger creates profiles rows here, so every
--         brand-new signup passes through that window. Closing only V1 leaves the takeover
--         fully available to anyone who can create an account.
--
-- WHY NOT `REVOKE UPDATE (contact_id) … FROM authenticated`
--   Because the grant is table-level, a column-scoped REVOKE is a SILENT NO-OP: PostgreSQL
--   reports "REVOKE" and has_column_privilege() still returns true. Verified in prod inside
--   BEGIN/ROLLBACK. The only way to remove one column from a table-level grant is to drop
--   the table-level grant and re-grant the columns that should remain.
--
-- WHY A GRANT AND NOT A TRIGGER
--   Declarative, and it cannot be bypassed by a code path that forgets to check.
--
-- WHAT IS DELIBERATELY NOT TOUCHED
--   * SELECT / DELETE / REFERENCES on profiles — unchanged.
--   * service_role and postgres — unchanged; they need the write.
--   * `anon`'s identical table-level grant — left alone ON PURPOSE. It is dormant:
--     profiles_update_own and profiles_insert_own both require user_id = auth.uid(),
--     and anon has no uid, so anon's UPDATE affects 0 rows and its INSERT is refused by
--     RLS. Both proven in prod. Revoking it belongs in its own migration, not this one.
--   * SECURITY DEFINER functions (promote_contact_to_account, _ensure_client_account,
--     ensure_contact_for_profile, the profiles_link_contact AFTER INSERT trigger, …) run
--     as their owner `postgres` and are unaffected by this grant. Trigger-assigned columns
--     are likewise not subject to the caller's column privileges.
--
-- LEGITIMATE PATHS CONFIRMED UNAFFECTED (checked before writing this)
--   No code in src/ or api/ writes profiles.contact_id at all. The single client INSERT
--   path is upsertMyProfile() (src/lib/api.ts:421) and its two call sites
--   (Account.tsx:77, ProfileCard.tsx:161) pass only first/last name, email, display_name,
--   bio, avatar_url, riding_level. adminUpdateProfile() (src/lib/admin.ts) explicitly
--   splits contact data out and never sends contact_id. Server routes use the
--   service-role client.
--
-- MAINTENANCE CONSEQUENCE (accepted)
--   The column list below is explicit. A column added to profiles later will NOT be
--   writable by `authenticated` until it is added here. That fails visibly on write
--   rather than silently opening a hole, which is the safer direction.
--
-- REVERT (restores the pre-migration state exactly):
--   GRANT INSERT, UPDATE ON public.profiles TO authenticated;

BEGIN;

-- V1 — UPDATE
REVOKE UPDATE ON public.profiles FROM authenticated;
GRANT UPDATE (
  user_id, first_name, last_name, email, is_admin, created_from_request_id,
  created_at, updated_at, display_name, avatar_url, bio, riding_level,
  is_suspended, org_id, role, pending_email, pending_email_mode,
  pending_email_token_hash, pending_email_started_at, old_email,
  first_dashboard_at, welcome_removed_at, title, pay_type, staff_active,
  tour_seen_at, tour_seen_desktop_at, tour_seen_mobile_at
) ON public.profiles TO authenticated;

-- V2 — INSERT
REVOKE INSERT ON public.profiles FROM authenticated;
GRANT INSERT (
  user_id, first_name, last_name, email, is_admin, created_from_request_id,
  created_at, updated_at, display_name, avatar_url, bio, riding_level,
  is_suspended, org_id, role, pending_email, pending_email_mode,
  pending_email_token_hash, pending_email_started_at, old_email,
  first_dashboard_at, welcome_removed_at, title, pay_type, staff_active,
  tour_seen_at, tour_seen_desktop_at, tour_seen_mobile_at
) ON public.profiles TO authenticated;

COMMIT;
