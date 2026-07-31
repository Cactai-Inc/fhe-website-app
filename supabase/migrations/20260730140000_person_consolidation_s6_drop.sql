-- ─────────────────────────────────────────────────────────────────────────────
-- PERSON CONSOLIDATION — S6: retire the duplicated person columns on `profiles`
-- (2026-07-30). LAST stage: nothing is dropped until every reader is re-pointed.
--
-- After S1–S5, `contacts` owns the person and `profiles` owns the account. These
-- columns on `profiles` are the residue of the old split. Leaving them is not
-- harmless: they are the trap that caused the original bug — a developer greps
-- for "address", finds profiles.address_line1, and wires a surface to a column
-- nothing writes.
--
-- READER AUDIT (run before writing this migration):
--   • Views: only member_directory referenced them; re-pointed at contacts in
--     20260730102000.
--   • Functions: admin_client_overview read p.phone / p.mobile / p.whatsapp off
--     profiles — FIXED BELOW before the drop. ensure_contact_for_profile,
--     sign_release and update_my_onboarding_profile matched the column names but
--     against `contacts`, not `profiles` (verified by reading each body).
--   • Frontend: contact.ts and AccountHub re-pointed in S2; the dead onboarding
--     prefill fallbacks were removed earlier today.
--
-- NOT DROPPED, deliberately:
--   • first_name / last_name — still read by admin_client_overview,
--     member_directory (as a fallback) and several staff surfaces. Consolidating
--     the NAME is a larger change than the contact block and deserves its own
--     stage, because 2 of 6 linked pairs already disagree on last_name and
--     picking a winner is a data decision, not a refactor.
--   • email — the auth mirror. profiles.email tracks auth.users.email and is
--     used by the email-change flow; it is not a duplicate of contacts.email in
--     the same sense.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 1. Re-point admin_client_overview at the contact ─────────────────────────
-- Surgical: read the live body and swap only the three person fields, leaving
-- every other line untouched. Guarded so a re-run is a no-op.
DO $do$
DECLARE
  v_def text;
  v_old text := '''phone'', p.phone, ''mobile'', p.mobile, ''whatsapp'', p.whatsapp,';
  v_new text := '''phone'', coalesce(pc.phone, p.phone), ''mobile'', pc.mobile, ''whatsapp'', pc.whatsapp,';
BEGIN
  SELECT pg_get_functiondef(p.oid) INTO v_def
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname = 'public' AND p.proname = 'admin_client_overview';
  IF v_def IS NULL THEN
    RAISE EXCEPTION 'admin_client_overview not found';
  END IF;

  IF position('pc.mobile' in v_def) > 0 THEN
    RAISE NOTICE 'admin_client_overview already reads the contact — skipping';
  ELSE
    IF position(v_old in v_def) = 0 THEN
      RAISE EXCEPTION 'admin_client_overview body changed shape — re-derive the patch';
    END IF;
    v_def := replace(v_def, v_old, v_new);
    -- Join the contact alongside the profile so pc.* resolves.
    v_def := replace(v_def,
      'FROM profiles p WHERE p.user_id = p_user_id),',
      'FROM profiles p LEFT JOIN contacts pc ON pc.id = p.contact_id AND pc.deleted_at IS NULL'
      || ' WHERE p.user_id = p_user_id),');
    EXECUTE v_def;
    RAISE NOTICE 'admin_client_overview now reads mobile/whatsapp from contacts';
  END IF;
END
$do$;

-- ── 2. Drop the retired columns ──────────────────────────────────────────────
-- The address block: zero writers for its whole life (0 of 7 rows populated,
-- against 12 of 16 on contacts). This is the pair of columns behind the original
-- report — a member filled in their address, the profile page showed nothing,
-- and the value surfaced later inside a contract.
ALTER TABLE profiles
  DROP COLUMN IF EXISTS address_line1,
  DROP COLUMN IF EXISTS address_line2,
  DROP COLUMN IF EXISTS city,
  DROP COLUMN IF EXISTS state,
  DROP COLUMN IF EXISTS postal_code;

-- The reach + visibility block: moved to contacts in S1 and backfilled there.
ALTER TABLE profiles
  DROP COLUMN IF EXISTS mobile,
  DROP COLUMN IF EXISTS whatsapp,
  DROP COLUMN IF EXISTS preferred_contact,
  DROP COLUMN IF EXISTS allow_sms,
  DROP COLUMN IF EXISTS allow_call,
  DROP COLUMN IF EXISTS allow_whatsapp,
  DROP COLUMN IF EXISTS allow_whatsapp_call,
  DROP COLUMN IF EXISTS hide_email,
  DROP COLUMN IF EXISTS hide_mobile,
  DROP COLUMN IF EXISTS hide_whatsapp,
  DROP COLUMN IF EXISTS social_tiktok,
  DROP COLUMN IF EXISTS social_instagram,
  DROP COLUMN IF EXISTS social_facebook,
  DROP COLUMN IF EXISTS social_linkedin;

-- D9: no dunning email exists and none is planned; this column never had a reader.
ALTER TABLE profiles DROP COLUMN IF EXISTS payment_reminders;

COMMENT ON TABLE profiles IS
  'THE account: the auth bridge (user_id ↔ auth.users), org and role, the '
  'community persona (display_name, avatar_url, bio, riding_level), tour markers '
  'and the email-change state machine. It holds NOTHING about the person — name '
  'aside, which is still being consolidated. Address, phone, mobile, WhatsApp, '
  'socials, contact preferences and community-visibility flags all live on '
  '`contacts`, which is the single person record and works for the majority of '
  'people who have no login at all.';
