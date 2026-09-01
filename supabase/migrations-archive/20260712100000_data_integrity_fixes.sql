/*
  # Data-integrity fixes (owner-reported holes)

  1. staff_contact_options leaked SOFT-DELETED contacts into the contract
     party picker (Claire, deleted, still selectable). Filter deleted_at.
  2. my_onboarding_checklist ran for STAFF, so an admin's leftover test
     engagement showed a "complete your paperwork" alert they can never
     clear. Staff have no onboarding checklist — return empty for them.
  3. Clients page (admin_client_accounts) filters on the PROFILE's org_id;
     a client whose profile lost its org (detach/never-stamped) vanished
     even while active (Mary). Match on the CONTACT's org instead — the
     contact is the tenant anchor — and re-stamp orphaned client profiles.
*/

-- 1. party picker excludes soft-deleted contacts
CREATE OR REPLACE FUNCTION staff_contact_options()
RETURNS TABLE (id uuid, name text, email text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT c.id, trim(concat_ws(' ', c.first_name, c.last_name)), c.email
  FROM contacts c
  WHERE c.org_id = current_org() AND c.deleted_at IS NULL AND has_staff_access()
  ORDER BY c.last_name NULLS LAST, c.first_name
$$;

-- 2. staff get no onboarding checklist (no more unclearable admin alert)
CREATE OR REPLACE FUNCTION my_onboarding_checklist()
RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT CASE
    WHEN has_staff_access() THEN '[]'::jsonb
    WHEN current_contact_id() IS NULL THEN '[]'::jsonb
    ELSE contact_checklist(current_contact_id())
  END
$$;

-- 3a. re-stamp orphaned client profiles onto their contact's org
UPDATE profiles p
   SET org_id = c.org_id
  FROM contacts c
 WHERE p.contact_id = c.id
   AND p.org_id IS NULL
   AND p.role = 'USER'
   AND c.org_id IS NOT NULL;

-- 3b. admin_client_accounts keys on the CONTACT's org (the tenant anchor),
--     not the profile's — a detached profile no longer hides an active client.
DROP FUNCTION IF EXISTS admin_client_accounts();
CREATE FUNCTION admin_client_accounts()
RETURNS TABLE (
  kind text,
  user_id uuid, contact_id uuid, client_id uuid,
  first_name text, last_name text, display_name text, email text,
  is_suspended boolean, membership_status text, created_at timestamptz,
  tags text[],
  invite_id uuid, invite_status text, invite_expires_at timestamptz, invite_scheduled_for date
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT 'account', p.user_id, p.contact_id, cl.id,
         p.first_name, p.last_name, p.display_name, p.email,
         p.is_suspended, m.status, p.created_at,
         c.tags, NULL::uuid, NULL::text, NULL::timestamptz, NULL::date
  FROM profiles p
  JOIN contacts c ON c.id = p.contact_id AND c.org_id = current_org() AND c.deleted_at IS NULL
  LEFT JOIN clients cl ON cl.contact_id = p.contact_id AND cl.deleted_at IS NULL
  LEFT JOIN memberships m ON m.user_id = p.user_id
  WHERE p.role = 'USER' AND is_admin()
  UNION ALL
  SELECT 'pending', NULL, c.id, cl.id,
         c.first_name, c.last_name, NULL, c.email,
         false, NULL, cl.created_at,
         c.tags, inv.id, inv.status, inv.expires_at, inv.scheduled_for
  FROM clients cl
  JOIN contacts c ON c.id = cl.contact_id AND c.deleted_at IS NULL
  LEFT JOIN LATERAL (
    SELECT i.id, i.status, i.expires_at, i.scheduled_for
    FROM invitations i
    WHERE lower(i.email) = lower(c.email)
    ORDER BY i.created_at DESC LIMIT 1
  ) inv ON true
  WHERE cl.org_id = current_org() AND cl.deleted_at IS NULL AND is_admin()
    AND NOT EXISTS (SELECT 1 FROM profiles p WHERE p.contact_id = c.id)
$$;

GRANT EXECUTE ON FUNCTION staff_contact_options() TO authenticated;
GRANT EXECUTE ON FUNCTION my_onboarding_checklist() TO authenticated;
GRANT EXECUTE ON FUNCTION admin_client_accounts() TO authenticated;
