-- ADMIN ACCOUNT-ISOLATED VIEW (owner chunk). One RPC assembles everything the
-- per-account surface needs that plain RLS reads can't provide: the profile +
-- linkage ids, LOGIN method (auth identities) + last sign-in, and rollup counts.
-- Plus an admin message-oversight reader (DMs are participant-scoped by RLS).
-- Both are is_admin()-gated and org-checked.

CREATE OR REPLACE FUNCTION admin_client_overview(p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $fn$
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
        'phone', p.phone, 'mobile', p.mobile, 'whatsapp', p.whatsapp,
        'riding_level', p.riding_level, 'bio', p.bio, 'role', p.role,
        'is_suspended', p.is_suspended, 'created_at', p.created_at,
        'contact_id', p.contact_id,
        'client_id', (SELECT c.id FROM clients c WHERE c.contact_id = p.contact_id AND c.deleted_at IS NULL))
      FROM profiles p WHERE p.user_id = p_user_id),
    'login', (SELECT jsonb_build_object(
        'providers', coalesce((SELECT jsonb_agg(DISTINCT i.provider)
          FROM auth.identities i WHERE i.user_id = p_user_id), '[]'::jsonb),
        'last_sign_in_at', u.last_sign_in_at,
        'created_at', u.created_at,
        'email_confirmed_at', u.email_confirmed_at)
      FROM auth.users u WHERE u.id = p_user_id),
    'membership', (SELECT jsonb_build_object('tier', m.tier, 'status', m.status,
        'started_at', m.started_at)
      FROM memberships m WHERE m.user_id = p_user_id LIMIT 1),
    'counts', jsonb_build_object(
      'orders',    (SELECT count(*) FROM orders WHERE user_id = p_user_id),
      'posts',     (SELECT count(*) FROM feed_posts WHERE author_id = p_user_id),
      'documents', (SELECT count(*) FROM documents d
                     JOIN engagements e ON e.id = d.engagement_id
                     JOIN clients c ON c.id = e.client_id
                     JOIN profiles p ON p.contact_id = c.contact_id
                     WHERE p.user_id = p_user_id AND d.deleted_at IS NULL),
      'bookings',  (SELECT count(*) FROM lesson_sessions ls
                     JOIN clients c ON c.id = ls.client_id
                     JOIN profiles p ON p.contact_id = c.contact_id
                     WHERE p.user_id = p_user_id AND ls.deleted_at IS NULL))
  ) INTO v;
  RETURN v;
END;
$fn$;

-- message oversight: the account's DM threads (admin-only; participant RLS bypassed
-- deliberately for the oversight surface the owner specified)
CREATE OR REPLACE FUNCTION admin_client_messages(p_user_id uuid, p_limit int DEFAULT 100)
RETURNS TABLE (id uuid, sender_id uuid, recipient_id uuid, body text, created_at timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT dm.id, dm.sender_id, dm.recipient_id, dm.body, dm.created_at
  FROM direct_messages dm
  WHERE is_admin()
    AND (dm.sender_id = p_user_id OR dm.recipient_id = p_user_id)
  ORDER BY dm.created_at DESC
  LIMIT p_limit
$$;

-- the account's documents (admin; via the client linkage)
CREATE OR REPLACE FUNCTION admin_client_documents(p_user_id uuid)
RETURNS TABLE (id uuid, title text, status text, workflow_state text, created_at timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT d.id, d.title, d.status, d.workflow_state, d.created_at
  FROM documents d
  JOIN engagements e ON e.id = d.engagement_id
  JOIN clients c ON c.id = e.client_id
  JOIN profiles p ON p.contact_id = c.contact_id
  WHERE is_admin() AND p.user_id = p_user_id AND d.deleted_at IS NULL
  ORDER BY d.created_at DESC
$$;

-- the account's lesson bookings (admin)
CREATE OR REPLACE FUNCTION admin_client_bookings(p_user_id uuid)
RETURNS TABLE (id uuid, starts_at timestamptz, ends_at timestamptz, status text, location text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT ls.id, ls.starts_at, ls.ends_at, ls.status, ls.location
  FROM lesson_sessions ls
  JOIN clients c ON c.id = ls.client_id
  JOIN profiles p ON p.contact_id = c.contact_id
  WHERE is_admin() AND p.user_id = p_user_id AND ls.deleted_at IS NULL
  ORDER BY ls.starts_at DESC
$$;

GRANT EXECUTE ON FUNCTION admin_client_overview(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION admin_client_messages(uuid, int) TO authenticated;
GRANT EXECUTE ON FUNCTION admin_client_documents(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION admin_client_bookings(uuid) TO authenticated;
