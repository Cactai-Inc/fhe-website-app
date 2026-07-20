-- Preferred contact method: each member can indicate how they'd rather be reached,
-- so other members see it when viewing the profile. It's a hint, not a restriction —
-- the shared channels still all appear; this just flags the favored one.
--
-- Values map to a shareable channel (or 'none'): platform (message on FHE), email,
-- sms, call, whatsapp, instagram, facebook, linkedin, tiktok.

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS preferred_contact text NOT NULL DEFAULT 'none';

ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_preferred_contact_chk;
ALTER TABLE profiles ADD CONSTRAINT profiles_preferred_contact_chk
  CHECK (preferred_contact IN ('none','platform','email','sms','call','whatsapp','instagram','facebook','linkedin','tiktok'));

-- Surface it on the member directory. A preference pointing at a HIDDEN channel is
-- suppressed to 'none' so we never advertise a method the viewer can't see/use.
CREATE OR REPLACE VIEW member_directory AS
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
        CASE WHEN p.hide_whatsapp THEN false ELSE p.allow_whatsapp_call END AS allow_whatsapp_call,
    (EXISTS ( SELECT 1
           FROM horses h
          WHERE h.current_owner_contact_id = p.contact_id AND h.deleted_at IS NULL)) AS is_horse_owner,
    -- suppress a preference whose channel is hidden or empty → 'none' (appended last
    -- so CREATE OR REPLACE keeps the existing column order intact)
        CASE
            WHEN p.preferred_contact = 'email'     AND (p.hide_email OR p.email IS NULL) THEN 'none'
            WHEN p.preferred_contact IN ('sms','call') AND (p.hide_mobile OR p.mobile IS NULL) THEN 'none'
            WHEN p.preferred_contact = 'whatsapp'  AND (p.hide_whatsapp OR p.whatsapp IS NULL) THEN 'none'
            WHEN p.preferred_contact = 'instagram' AND p.social_instagram IS NULL THEN 'none'
            WHEN p.preferred_contact = 'facebook'  AND p.social_facebook IS NULL THEN 'none'
            WHEN p.preferred_contact = 'linkedin'  AND p.social_linkedin IS NULL THEN 'none'
            WHEN p.preferred_contact = 'tiktok'    AND p.social_tiktok IS NULL THEN 'none'
            ELSE p.preferred_contact
        END AS preferred_contact
   FROM profiles p
     JOIN memberships m ON m.user_id = p.user_id AND m.status = 'active'::text
  WHERE NOT p.is_suspended AND p.role IS DISTINCT FROM 'SUPER_ADMIN'::text;
