-- TASK-PAGEMERGE (DUPECENSUS 2.7), second call site: Admin.tsx's provisioned-
-- client "Associated items" list (admin_client_items, the no-login-yet
-- account view) sent every document to the read-only viewer too, same defect
-- as admin_client_documents fixed in the sibling migration this session. One
-- field added to the documents jsonb array; CREATE OR REPLACE is sufficient
-- (the function's return type, jsonb, is unchanged).
--
-- Base body taken from pg_get_functiondef on the LIVE function, not from an
-- older migration file: the `engagements` arm this function used to build
-- (20260713260000) is already gone from prod — engagements is retired
-- (CLAUDE.md) — and no migration file in this repo shows that removal, so
-- replaying an older file's body here would have resurrected a query against
-- a table that no longer exists.
CREATE OR REPLACE FUNCTION public.admin_client_items(p_client_id uuid)
RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
  SELECT CASE WHEN NOT is_admin() THEN NULL ELSE jsonb_build_object(
    'documents', (
      SELECT coalesce(jsonb_agg(jsonb_build_object(
        'id', d.id, 'title', d.title, 'workflow_state', d.workflow_state,
        'status', d.status, 'created_at', d.created_at, 'contract_id', d.contract_id
      ) ORDER BY d.created_at DESC), '[]'::jsonb)
      FROM documents d
      WHERE d.contact_id = (SELECT contact_id FROM clients WHERE id = p_client_id)
        AND d.deleted_at IS NULL
    )
  ) END
$function$;
