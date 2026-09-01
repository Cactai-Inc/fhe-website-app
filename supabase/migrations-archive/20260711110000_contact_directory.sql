/*
  # staff_contact_directory — the business directory behind /app/ops/contacts

  The contacts page was a flat name list; useless without designations. This
  RPC returns each contact WITH the relationship signals the directory derives
  its visible tags and filters from, mirroring the community's directory
  pattern (members / resources):
    - linked account (profiles.contact_id) + its role → Client account / Team
    - clients row → Client
    - engagement party roles (LESSOR/SELLER/… ) → Counterparty
    - horse pointers → Horse owner / Lessee
    - none of the above → Lead (a name that came in and hasn't matriculated)
  Plus depth counts (engagements, documents, horses) and the contact's own
  tags/notes so a row is a dossier, not a name on a wall.
*/

CREATE OR REPLACE FUNCTION staff_contact_directory()
RETURNS TABLE (
  id uuid, display_code text, first_name text, last_name text,
  email text, phone text, tags text[], notes text, created_at timestamptz,
  linked_user_id uuid, linked_role text,
  is_client boolean,
  party_roles text[],
  horses_owned bigint, horses_leased bigint,
  engagement_count bigint, document_count bigint
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT c.id, c.display_code, c.first_name, c.last_name,
         c.email, c.phone, c.tags, c.notes, c.created_at,
         p.user_id, p.role,
         EXISTS (SELECT 1 FROM clients cl
                  WHERE cl.contact_id = c.id AND cl.deleted_at IS NULL),
         (SELECT coalesce(array_agg(DISTINCT ep.party_role), '{}')
            FROM engagement_parties ep WHERE ep.contact_id = c.id),
         (SELECT count(*) FROM horses h
           WHERE h.current_owner_contact_id = c.id AND h.deleted_at IS NULL),
         (SELECT count(*) FROM horses h
           WHERE h.lessee_contact_id = c.id AND h.deleted_at IS NULL),
         (SELECT count(DISTINCT ep.engagement_id)
            FROM engagement_parties ep WHERE ep.contact_id = c.id),
         (SELECT count(DISTINCT d.id)
            FROM documents d
            JOIN engagement_parties ep ON ep.engagement_id = d.engagement_id
           WHERE ep.contact_id = c.id AND d.deleted_at IS NULL)
  FROM contacts c
  LEFT JOIN profiles p ON p.contact_id = c.id
  WHERE c.org_id = current_org()
    AND c.deleted_at IS NULL
    AND has_staff_access()
  ORDER BY c.last_name NULLS LAST, c.first_name
$$;

GRANT EXECUTE ON FUNCTION staff_contact_directory() TO authenticated;
