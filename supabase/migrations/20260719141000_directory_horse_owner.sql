CREATE OR REPLACE VIEW public.member_directory AS
SELECT p.user_id,
    p.display_name,
    p.first_name,
    p.avatar_url,
    p.bio,
    p.riding_level,
        CASE
            WHEN p.hide_email THEN NULL::text
            ELSE p.email
        END AS email,
        CASE
            WHEN p.hide_mobile THEN NULL::text
            ELSE p.mobile
        END AS mobile,
        CASE
            WHEN p.hide_whatsapp THEN NULL::text
            ELSE p.whatsapp
        END AS whatsapp,
        CASE
            WHEN p.hide_mobile THEN false
            ELSE p.allow_sms
        END AS allow_sms,
        CASE
            WHEN p.hide_mobile THEN false
            ELSE p.allow_call
        END AS allow_call,
        CASE
            WHEN p.hide_whatsapp THEN false
            ELSE p.allow_whatsapp
        END AS allow_whatsapp,
    p.social_tiktok,
    p.social_instagram,
    p.social_facebook,
    p.social_linkedin,
        CASE
            WHEN p.hide_whatsapp THEN false
            ELSE p.allow_whatsapp_call
        END AS allow_whatsapp_call,
    EXISTS (SELECT 1 FROM horses h WHERE h.current_owner_contact_id = p.contact_id AND h.deleted_at IS NULL) AS is_horse_owner
   FROM profiles p
     JOIN memberships m ON m.user_id = p.user_id AND m.status = 'active'::text
  WHERE NOT p.is_suspended
    AND p.role IS DISTINCT FROM 'SUPER_ADMIN';
