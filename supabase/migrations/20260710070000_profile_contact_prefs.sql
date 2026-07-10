-- PROFILE CONTACT PREFS + DIRECTORY EXPOSURE (Update B backend). The Account hub's
-- Profile section captures Mobile / WhatsApp (each with hide-from-community and
-- text/call permission toggles), social handles, and the payment-reminder pref.
-- The community roster's tap-to-contact buttons read a member's SHARED contact
-- fields from the directory — hide flags are honored IN THE VIEW, so a hidden
-- field never leaves the database for a non-self reader.

-- ── 1. storage on profiles (all nullable/default — safe adds) ──
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS mobile            text,
  ADD COLUMN IF NOT EXISTS whatsapp          text,
  ADD COLUMN IF NOT EXISTS allow_sms         boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS allow_call        boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS allow_whatsapp    boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS hide_email        boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS hide_mobile       boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS hide_whatsapp     boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS social_tiktok     text,
  ADD COLUMN IF NOT EXISTS social_instagram  text,
  ADD COLUMN IF NOT EXISTS social_facebook   text,
  ADD COLUMN IF NOT EXISTS social_linkedin   text,
  ADD COLUMN IF NOT EXISTS payment_reminders boolean NOT NULL DEFAULT true;

-- ── 2. directory view: expose only what the member shares ──
CREATE OR REPLACE VIEW public.member_directory AS
 SELECT p.user_id,
    p.display_name,
    p.first_name,
    p.avatar_url,
    p.bio,
    p.riding_level,
    -- shared contact fields (hide flags enforced here, not client-side)
    CASE WHEN p.hide_email    THEN NULL ELSE p.email    END AS email,
    CASE WHEN p.hide_mobile   THEN NULL ELSE p.mobile   END AS mobile,
    CASE WHEN p.hide_whatsapp THEN NULL ELSE p.whatsapp END AS whatsapp,
    CASE WHEN p.hide_mobile   THEN false ELSE p.allow_sms      END AS allow_sms,
    CASE WHEN p.hide_mobile   THEN false ELSE p.allow_call     END AS allow_call,
    CASE WHEN p.hide_whatsapp THEN false ELSE p.allow_whatsapp END AS allow_whatsapp,
    p.social_tiktok,
    p.social_instagram,
    p.social_facebook,
    p.social_linkedin
   FROM profiles p
     JOIN memberships m ON m.user_id = p.user_id AND m.status = 'active'::text
  WHERE NOT p.is_suspended;
