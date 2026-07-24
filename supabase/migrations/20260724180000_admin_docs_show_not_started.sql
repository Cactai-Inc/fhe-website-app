-- Admin visibility: the client Documents tab only listed GENERATED documents, so a
-- freshly-invited member (docs assigned but not yet generated at onboarding) looked
-- like they had nothing — no way for staff to see what the person still owes.
--
-- Extend admin_client_documents to ALSO list required templates that have no generated
-- document yet, as NOT_STARTED rows. Now staff see the full picture the moment docs are
-- assigned, before the member ever logs in. Same return shape (id/title/status/
-- workflow_state/created_at); NOT_STARTED rows carry a synthetic, stable id derived from
-- the template_key so the client list keying stays consistent.

CREATE OR REPLACE FUNCTION public.admin_client_documents(p_user_id uuid)
RETURNS TABLE(id uuid, title text, status text, workflow_state text, created_at timestamp with time zone)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
  -- generated documents (the real instances)
  SELECT d.id, d.title, d.status, d.workflow_state, d.created_at
  FROM documents d
  JOIN profiles p ON p.contact_id = d.contact_id
  WHERE is_admin() AND p.user_id = p_user_id AND d.deleted_at IS NULL

  UNION ALL

  -- required templates with NO generated document yet → "Not started"
  SELECT
    -- deterministic pseudo-id from the template key (stable list key; not a real doc)
    ('00000000-0000-0000-0000-0000' || substr(md5(ct.template_key), 1, 12))::uuid AS id,
    t.title,
    'NOT_STARTED'::text AS status,
    'not_started'::text AS workflow_state,
    NULL::timestamptz AS created_at
  FROM profiles p
  JOIN required_templates_for_contact(p.contact_id) ct ON true
  JOIN contract_templates t ON t.template_key = ct.template_key AND t.deleted_at IS NULL
  WHERE is_admin() AND p.user_id = p_user_id
    AND NOT EXISTS (
      SELECT 1 FROM documents d
      JOIN contract_templates t2 ON t2.id = d.template_id
      WHERE t2.template_key = ct.template_key
        AND d.contact_id = p.contact_id AND d.deleted_at IS NULL
    )

  ORDER BY created_at DESC NULLS LAST
$function$;

GRANT EXECUTE ON FUNCTION public.admin_client_documents(uuid) TO authenticated;
