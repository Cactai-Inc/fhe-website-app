/*
  # Provision-first client accounts

  The owner's order of operations: CREATE the client account (no invite), then
  create and link its items (contracts, engagements, billing), review them on
  the account page, and only THEN send the invitation — which can expire and be
  resent. When a start date was agreed in person, the invitation carries it and
  the claim-and-pay window is 48 hours.

  - invitations.scheduled_for — the agreed date; its presence is what puts the
    invite on the 48-hour window (enforced at the API when computing expires_at)
  - admin_create_client — contact (find-or-create by email) + category tags +
    clients row, NO invitation
  - admin_client_accounts — the Clients page list: login-backed clients UNION
    provisioned (contact-only) clients with their latest invitation state
  - admin_client_items — everything associated with a client record
    (engagements + their documents), keyed by client_id so it works before
    the person has any login
*/

ALTER TABLE invitations ADD COLUMN IF NOT EXISTS scheduled_for date;

CREATE OR REPLACE FUNCTION admin_create_client(
  p_first_name text,
  p_last_name  text,
  p_email      text,
  p_phone      text DEFAULT NULL,
  p_categories text[] DEFAULT '{}'
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $fn$
DECLARE
  v_contact uuid;
  v_client  uuid;
BEGIN
  IF NOT has_staff_access() THEN
    RAISE EXCEPTION 'staff access required';
  END IF;
  IF coalesce(trim(p_email), '') = '' THEN
    RAISE EXCEPTION 'email is required';
  END IF;

  SELECT id INTO v_contact FROM contacts
   WHERE lower(email) = lower(trim(p_email)) AND deleted_at IS NULL
   LIMIT 1;

  IF v_contact IS NULL THEN
    INSERT INTO contacts (first_name, last_name, email, phone, tags)
    VALUES (nullif(trim(p_first_name), ''), nullif(trim(p_last_name), ''),
            lower(trim(p_email)), nullif(trim(p_phone), ''), coalesce(p_categories, '{}'))
    RETURNING id INTO v_contact;
  ELSE
    UPDATE contacts SET
      first_name = coalesce(nullif(trim(p_first_name), ''), first_name),
      last_name  = coalesce(nullif(trim(p_last_name), ''), last_name),
      phone      = coalesce(nullif(trim(p_phone), ''), phone),
      -- merge, don't clobber, existing tags
      tags = (SELECT coalesce(array_agg(DISTINCT t), '{}')
                FROM unnest(coalesce(tags, '{}') || coalesce(p_categories, '{}')) t),
      updated_at = now()
    WHERE id = v_contact;
  END IF;

  SELECT id INTO v_client FROM clients
   WHERE contact_id = v_contact AND deleted_at IS NULL LIMIT 1;
  IF v_client IS NULL THEN
    INSERT INTO clients (contact_id, status, source)
    VALUES (v_contact, 'ACTIVE', 'staff created')
    RETURNING id INTO v_client;
  END IF;

  RETURN jsonb_build_object('contact_id', v_contact, 'client_id', v_client);
END;
$fn$;

CREATE OR REPLACE FUNCTION admin_client_accounts()
RETURNS TABLE (
  kind text,
  user_id uuid, contact_id uuid, client_id uuid,
  first_name text, last_name text, display_name text, email text,
  is_suspended boolean, membership_status text, created_at timestamptz,
  tags text[],
  invite_status text, invite_expires_at timestamptz, invite_scheduled_for date
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT 'account', p.user_id, p.contact_id, cl.id,
         p.first_name, p.last_name, p.display_name, p.email,
         p.is_suspended, m.status, p.created_at,
         c.tags, NULL::text, NULL::timestamptz, NULL::date
  FROM profiles p
  LEFT JOIN contacts c ON c.id = p.contact_id
  LEFT JOIN clients cl ON cl.contact_id = p.contact_id AND cl.deleted_at IS NULL
  LEFT JOIN memberships m ON m.user_id = p.user_id
  WHERE p.org_id = current_org() AND p.role = 'USER' AND is_admin()
  UNION ALL
  SELECT 'pending', NULL, c.id, cl.id,
         c.first_name, c.last_name, NULL, c.email,
         false, NULL, cl.created_at,
         c.tags, inv.status, inv.expires_at, inv.scheduled_for
  FROM clients cl
  JOIN contacts c ON c.id = cl.contact_id AND c.deleted_at IS NULL
  LEFT JOIN LATERAL (
    SELECT i.status, i.expires_at, i.scheduled_for
    FROM invitations i
    WHERE lower(i.email) = lower(c.email)
    ORDER BY i.created_at DESC LIMIT 1
  ) inv ON true
  WHERE cl.org_id = current_org() AND cl.deleted_at IS NULL AND is_admin()
    AND NOT EXISTS (SELECT 1 FROM profiles p WHERE p.contact_id = c.id)
$$;

CREATE OR REPLACE FUNCTION admin_client_items(p_client_id uuid)
RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT CASE WHEN NOT is_admin() THEN NULL ELSE jsonb_build_object(
    'engagements', (
      SELECT coalesce(jsonb_agg(jsonb_build_object(
        'id', e.id, 'service_type', e.service_type, 'status', e.status,
        'start_date', e.start_date, 'created_at', e.created_at
      ) ORDER BY e.created_at DESC), '[]'::jsonb)
      FROM engagements e
      WHERE e.client_id = p_client_id AND e.deleted_at IS NULL
    ),
    'documents', (
      SELECT coalesce(jsonb_agg(jsonb_build_object(
        'id', d.id, 'title', d.title, 'workflow_state', d.workflow_state,
        'status', d.status, 'created_at', d.created_at
      ) ORDER BY d.created_at DESC), '[]'::jsonb)
      FROM documents d
      JOIN engagements e ON e.id = d.engagement_id
      WHERE e.client_id = p_client_id AND d.deleted_at IS NULL
    )
  ) END
$$;

GRANT EXECUTE ON FUNCTION admin_create_client(text, text, text, text, text[]) TO authenticated;
GRANT EXECUTE ON FUNCTION admin_client_accounts() TO authenticated;
GRANT EXECUTE ON FUNCTION admin_client_items(uuid) TO authenticated;
