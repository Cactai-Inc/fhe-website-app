-- ─────────────────────────────────────────────────────────────────────────────
-- MEMBER DIRECTORY READS `contacts` (2026-07-30) — S2 follow-through
--
-- The community profile at /app/members/:userId renders a member's shared email,
-- mobile, WhatsApp and socials, and honours their hide_* / allow_* choices. That
-- enforcement lives HERE, in the member_directory view — not in any function,
-- which is why an earlier audit pass that only searched pg_proc concluded the
-- toggles had no reader. They do. The view was correct all along.
--
-- What S2 broke: the account page now WRITES these preferences to `contacts`
-- (the single person record), while this view still READ them from `profiles`.
-- Left alone, a member could tick "hide from community" and see nothing change,
-- because the flag they set and the flag the view checks were different columns
-- on different tables. That is the exact class of split this consolidation
-- exists to remove.
--
-- Fix: read the person fields from `contacts` (joined via profiles.contact_id)
-- and keep the ACCOUNT fields — display_name, avatar_url, bio, riding_level —
-- on `profiles`, where they belong. The community persona is deliberately
-- distinct from the legal identity: a member may show "CJ" to the community
-- while their contracts read "Charles Zigmund".
--
-- Behaviour is otherwise IDENTICAL: every CASE below is carried over unchanged,
-- only its source column moves. Verified after apply by diffing the view's
-- output against the pre-change rows.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE VIEW public.member_directory AS
 SELECT p.user_id,
    -- ACCOUNT-side persona (stays on profiles)
    p.display_name,
    -- Fall back to the contact's legal first name when no persona is set: the
    -- member record is the one with the name a person actually filled in.
    coalesce(p.first_name, c.first_name) AS first_name,
    p.avatar_url,
    p.bio,
    p.riding_level,
    -- PERSON-side reach + visibility (now on contacts)
    CASE WHEN c.hide_email THEN NULL::text ELSE c.email END AS email,
    CASE WHEN c.hide_mobile THEN NULL::text ELSE c.mobile END AS mobile,
    CASE WHEN c.hide_whatsapp THEN NULL::text ELSE c.whatsapp END AS whatsapp,
    CASE WHEN c.hide_mobile THEN false ELSE c.allow_sms END AS allow_sms,
    CASE WHEN c.hide_mobile THEN false ELSE c.allow_call END AS allow_call,
    CASE WHEN c.hide_whatsapp THEN false ELSE c.allow_whatsapp END AS allow_whatsapp,
    c.social_tiktok,
    c.social_instagram,
    c.social_facebook,
    c.social_linkedin,
    CASE WHEN c.hide_whatsapp THEN false ELSE c.allow_whatsapp_call END AS allow_whatsapp_call,
    (EXISTS ( SELECT 1
           FROM horses h
          WHERE h.current_owner_contact_id = p.contact_id AND h.deleted_at IS NULL)) AS is_horse_owner,
    -- "Prefers X" collapses to 'none' when the chosen channel is hidden or empty,
    -- so the profile never advertises a route the member has closed off.
    CASE
        WHEN c.preferred_contact = 'email'::text AND (c.hide_email OR c.email IS NULL) THEN 'none'::text
        WHEN (c.preferred_contact = ANY (ARRAY['sms'::text, 'call'::text])) AND (c.hide_mobile OR c.mobile IS NULL) THEN 'none'::text
        WHEN c.preferred_contact = 'whatsapp'::text AND (c.hide_whatsapp OR c.whatsapp IS NULL) THEN 'none'::text
        WHEN c.preferred_contact = 'instagram'::text AND c.social_instagram IS NULL THEN 'none'::text
        WHEN c.preferred_contact = 'facebook'::text AND c.social_facebook IS NULL THEN 'none'::text
        WHEN c.preferred_contact = 'linkedin'::text AND c.social_linkedin IS NULL THEN 'none'::text
        WHEN c.preferred_contact = 'tiktok'::text AND c.social_tiktok IS NULL THEN 'none'::text
        ELSE c.preferred_contact
    END AS preferred_contact
   FROM profiles p
     JOIN members m ON m.user_id = p.user_id AND m.status = 'active'::text
     -- INNER join: a member with no contact record has no person data to show.
     -- (The only such account is the platform owner, who is excluded below.)
     JOIN contacts c ON c.id = p.contact_id AND c.deleted_at IS NULL
  WHERE NOT p.is_suspended AND p.role IS DISTINCT FROM 'SUPER_ADMIN'::text;

COMMENT ON VIEW public.member_directory IS
  'The community-visible member profile. THE enforcement point for a member''s '
  'visibility choices: hide_email / hide_mobile / hide_whatsapp null out the '
  'corresponding field and force its allow_* flags false, and preferred_contact '
  'collapses to ''none'' when it points at a hidden or empty channel. Person '
  'fields come from `contacts` (the single person record, which the account page '
  'writes); persona fields — display_name, avatar_url, bio, riding_level — come '
  'from `profiles`, so a member''s community identity stays distinct from the '
  'legal name on their documents.';
