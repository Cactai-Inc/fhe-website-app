/*
  # Spine Refactor — Slice 2.3e-1: document READERS off engagements (correctness)

  Every spine document (contract, onboarding) is contact-owned with
  engagement_id = NULL. Three admin/staff readers still reach documents THROUGH
  engagements, so they silently drop every spine doc from the views the owner
  uses to inspect a client. Repoint them onto documents.contact_id /
  document_parties so spine docs show up:

    - admin_client_documents(p_user_id) — the account's document list
    - admin_client_items(p_client_id)   — the account drawer's `documents` array
    - staff_contact_directory()         — per-contact party_roles + document_count

  The heavier engagement-coupled workflow functions (advance_document_workflow,
  request_document_change, sign_release, contract counterparty invites,
  platform_tenant_detail) are handled in the full teardown; here we only fix the
  pure readers. engagement_count in the directory stays until the teardown.
*/

-- admin_client_documents: the account's docs, contact-owned (was engagement-joined)
CREATE OR REPLACE FUNCTION public.admin_client_documents(p_user_id uuid)
RETURNS TABLE(id uuid, title text, status text, workflow_state text, created_at timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
  SELECT d.id, d.title, d.status, d.workflow_state, d.created_at
  FROM documents d
  JOIN profiles p ON p.contact_id = d.contact_id
  WHERE is_admin() AND p.user_id = p_user_id AND d.deleted_at IS NULL
  ORDER BY d.created_at DESC
$function$;

-- admin_client_items: `documents` array off documents.contact_id (client's contact).
-- The `engagements` array is left as-is; it retires with the teardown.
CREATE OR REPLACE FUNCTION public.admin_client_items(p_client_id uuid)
RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
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
      WHERE d.contact_id = (SELECT contact_id FROM clients WHERE id = p_client_id)
        AND d.deleted_at IS NULL
    )
  ) END
$function$;

-- staff_contact_directory: party_roles + document_count off document_parties /
-- documents.contact_id (spine), so a contact's real signing footprint shows.
CREATE OR REPLACE FUNCTION public.staff_contact_directory()
RETURNS TABLE(id uuid, display_code text, first_name text, last_name text, email text, phone text, tags text[], notes text, created_at timestamptz, linked_user_id uuid, linked_role text, is_client boolean, party_roles text[], horses_owned bigint, horses_leased bigint, engagement_count bigint, document_count bigint)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
  SELECT c.id, c.display_code, c.first_name, c.last_name,
         c.email, c.phone, c.tags, c.notes, c.created_at,
         p.user_id, p.role,
         EXISTS (SELECT 1 FROM clients cl
                  WHERE cl.contact_id = c.id AND cl.deleted_at IS NULL),
         (SELECT coalesce(array_agg(DISTINCT dp.party_role), '{}')
            FROM document_parties dp WHERE dp.contact_id = c.id),
         (SELECT count(*) FROM horses h
           WHERE h.current_owner_contact_id = c.id AND h.deleted_at IS NULL),
         (SELECT count(*) FROM horses h
           WHERE h.lessee_contact_id = c.id AND h.deleted_at IS NULL),
         (SELECT count(DISTINCT ep.engagement_id)
            FROM engagement_parties ep WHERE ep.contact_id = c.id),
         (SELECT count(DISTINCT d.id)
            FROM documents d
           WHERE d.deleted_at IS NULL
             AND (d.contact_id = c.id
                  OR EXISTS (SELECT 1 FROM document_parties dp
                              WHERE dp.document_id = d.id AND dp.contact_id = c.id)))
  FROM contacts c
  LEFT JOIN profiles p ON p.contact_id = c.id
  WHERE c.org_id = current_org()
    AND c.deleted_at IS NULL
    AND has_staff_access()
  ORDER BY c.last_name NULLS LAST, c.first_name
$function$;
