-- WhatsApp supports voice calls, not just chat. Split the single allow_whatsapp
-- preference into text vs call so members control each. allow_whatsapp stays as
-- the TEXT/chat permission (no rename — avoids churn); add allow_whatsapp_call
-- for the call permission, defaulting to the member's existing WhatsApp setting
-- so nobody's contactability changes silently on rollout.

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS allow_whatsapp_call boolean NOT NULL DEFAULT true;

-- Seed the new toggle from the current allow_whatsapp so existing members keep
-- exactly the reachability they had (if they'd turned WhatsApp text off, calls
-- start off too; they can enable calls independently afterward).
UPDATE profiles SET allow_whatsapp_call = allow_whatsapp
 WHERE allow_whatsapp_call IS DISTINCT FROM allow_whatsapp;

-- Surface it on the member_directory view (honoring hide_whatsapp like the rest).
CREATE OR REPLACE VIEW public.member_directory AS
  SELECT p.user_id,
    p.display_name,
    p.first_name,
    p.avatar_url,
    p.bio,
    p.riding_level,
    CASE WHEN p.hide_email THEN NULL::text ELSE p.email END AS email,
    CASE WHEN p.hide_mobile THEN NULL::text ELSE p.mobile END AS mobile,
    CASE WHEN p.hide_whatsapp THEN NULL::text ELSE p.whatsapp END AS whatsapp,
    CASE WHEN p.hide_mobile THEN false ELSE p.allow_sms END AS allow_sms,
    CASE WHEN p.hide_mobile THEN false ELSE p.allow_call END AS allow_call,
    CASE WHEN p.hide_whatsapp THEN false ELSE p.allow_whatsapp END AS allow_whatsapp,
    p.social_tiktok,
    p.social_instagram,
    p.social_facebook,
    p.social_linkedin,
    -- appended last: CREATE OR REPLACE VIEW cannot insert a column mid-list
    CASE WHEN p.hide_whatsapp THEN false ELSE p.allow_whatsapp_call END AS allow_whatsapp_call
  FROM profiles p
    JOIN memberships m ON m.user_id = p.user_id AND m.status = 'active'::text
  WHERE NOT p.is_suspended;
