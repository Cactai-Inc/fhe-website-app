-- profiles.phone retirement (D14 closure), step 2: repoint the three SQL
-- readers to the contact record, then drop the column. Frontend writers
-- repointed in the same commit (adminUpdateProfile/adminListMembers).

CREATE OR REPLACE FUNCTION public.admin_client_overview(p_user_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_org uuid := current_org();
  v jsonb;
BEGIN
  IF NOT is_admin() THEN
    RAISE EXCEPTION 'admin access required';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM profiles WHERE user_id = p_user_id AND org_id = v_org) THEN
    RAISE EXCEPTION 'account not found in your organization';
  END IF;

  SELECT jsonb_build_object(
    'profile', (SELECT jsonb_build_object(
        'user_id', p.user_id, 'email', p.email, 'first_name', p.first_name,
        'last_name', p.last_name, 'display_name', p.display_name,
        'phone', pc.phone, 'mobile', pc.mobile, 'whatsapp', pc.whatsapp,
        'riding_level', p.riding_level, 'bio', p.bio, 'role', p.role,
        'is_suspended', p.is_suspended, 'created_at', p.created_at,
        'contact_id', p.contact_id,
        'client_id', (SELECT c.id FROM clients c WHERE c.contact_id = p.contact_id AND c.deleted_at IS NULL))
      FROM profiles p LEFT JOIN contacts pc ON pc.id = p.contact_id AND pc.deleted_at IS NULL WHERE p.user_id = p_user_id),
    'login', (SELECT jsonb_build_object(
        'providers', coalesce((SELECT jsonb_agg(DISTINCT i.provider)
          FROM auth.identities i WHERE i.user_id = p_user_id), '[]'::jsonb),
        'last_sign_in_at', u.last_sign_in_at,
        'created_at', u.created_at,
        'email_confirmed_at', u.email_confirmed_at)
      FROM auth.users u WHERE u.id = p_user_id),
    'member', (SELECT jsonb_build_object('status', m.status,
        'started_at', m.started_at)
      FROM members m WHERE m.user_id = p_user_id LIMIT 1),
    'counts', jsonb_build_object(
      'orders',    (SELECT count(*) FROM purchases WHERE buyer_user_id = p_user_id AND deleted_at IS NULL),
      'posts',     (SELECT count(*) FROM feed_posts WHERE author_id = p_user_id),
      'documents', (SELECT count(*) FROM documents d
                     JOIN profiles p ON p.contact_id = d.contact_id
                     WHERE p.user_id = p_user_id AND d.deleted_at IS NULL),
      'bookings',  (SELECT count(*) FROM bookings b
                     JOIN clients c ON c.id = b.client_id
                     JOIN profiles p ON p.contact_id = c.contact_id
                     WHERE b.kind = 'lesson' AND p.user_id = p_user_id))
  ) INTO v;
  RETURN v;
END;
$function$

;

CREATE OR REPLACE FUNCTION public.pending_fee_candidates()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT (coalesce(auth.role(),'') = 'service_role' OR has_staff_access()) THEN
    RAISE EXCEPTION 'not authorized';
  END IF;
  RETURN (
    SELECT coalesce(jsonb_agg(jsonb_build_object(
        'id', cr.id,
        'fee_amount', cr.fee_amount,
        'name', nullif(trim(coalesce(c.first_name,'') || ' ' || coalesce(c.last_name,'')), ''),
        'email', coalesce(c.email, p.email),
        'phone', coalesce(c.phone, c.mobile))), '[]'::jsonb)
    FROM booking_change_requests cr
    JOIN bookings b ON b.id = cr.booking_id
    LEFT JOIN clients cl ON cl.id = b.client_id
    LEFT JOIN contacts c ON c.id = cl.contact_id
    LEFT JOIN profiles p ON p.user_id = b.account_user_id
    WHERE cr.status = 'pending' AND cr.fee_paid = false AND cr.fee_amount IS NOT NULL);
END;
$function$

;

CREATE OR REPLACE FUNCTION public.ensure_contact_for_profile(p_user_id uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  c_denied_users constant uuid[] := ARRAY[
    'b45a5503-89bc-489a-b012-c7fbf5c09632',  -- admin@fhequestrian.com
    'fdbdfe89-76d7-486b-b734-8e23b09e0353',  -- hello@fhequestrian.com
    '3c5d6af1-ce10-45c0-afbb-1ddbdfc77bd5'   -- admin@cactai.io (platform)
  ]::uuid[];
  v_profile    profiles%ROWTYPE;
  v_contact_id uuid;
  v_first text;
  v_last  text;
  v_org   uuid;
BEGIN
  SELECT * INTO v_profile FROM profiles WHERE user_id = p_user_id;
  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  IF v_profile.contact_id IS NOT NULL THEN
    RETURN v_profile.contact_id;
  END IF;

  -- D1: protected identities never regrow a tenant bridge through this path.
  IF p_user_id = ANY(c_denied_users) THEN
    RETURN NULL;
  END IF;

  v_org := coalesce(v_profile.org_id, current_org());
  IF v_org IS NULL THEN
    RETURN NULL;
  END IF;

  v_first := NULLIF(trim(coalesce(v_profile.first_name, '')), '');
  v_last  := NULLIF(trim(coalesce(v_profile.last_name,  '')), '');
  IF v_first IS NULL AND v_last IS NULL THEN
    v_first := coalesce(v_profile.email, 'Unnamed Contact');
  END IF;

  IF v_profile.email IS NOT NULL THEN
    SELECT c.id INTO v_contact_id
    FROM contacts c
    WHERE lower(c.email) = lower(v_profile.email)
      AND c.org_id = v_org
      AND c.deleted_at IS NULL
      AND NOT c.is_company
      AND NOT EXISTS (SELECT 1 FROM profiles p2 WHERE p2.contact_id = c.id AND p2.user_id <> p_user_id)
    ORDER BY c.created_at
    LIMIT 1;
  END IF;

  IF v_contact_id IS NULL THEN
    -- profiles has no address columns — a contact seeded from a bare
    -- profile starts with name/email/phone only. Address, if any, lives on
    -- contacts already and is untouched by this path.
    INSERT INTO contacts (org_id, first_name, last_name, email)
    VALUES (v_org, v_first, v_last, v_profile.email)
    RETURNING id INTO v_contact_id;
  END IF;

  PERFORM promote_contact_to_account(p_user_id, v_contact_id);
  RETURN v_contact_id;
END;
$function$

;

-- Backfill before drop: any profile phone whose linked contact has none moves
-- to the contact (live audit 2026-08-02: exactly one row, admin@fhequestrian.com;
-- the other five contacts already carry the same number, formatted).
UPDATE contacts c SET phone = p.phone
  FROM profiles p
 WHERE p.contact_id = c.id
   AND p.phone IS NOT NULL AND btrim(p.phone) <> ''
   AND coalesce(btrim(c.phone), '') = '';

ALTER TABLE public.profiles DROP COLUMN IF EXISTS phone;
