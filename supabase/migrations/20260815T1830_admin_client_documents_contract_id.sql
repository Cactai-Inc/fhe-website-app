-- TASK-PAGEMERGE (DUPECENSUS 2.7, "Staff document viewer — TWO, and which one
-- you get depends on where you clicked"): DocumentQueueTable already routes
-- correctly (row.contract_id ? /app/contracts/:id : /app/ops/documents/:id),
-- but Admin.tsx's two document links do not — they send EVERY document to
-- the read-only viewer, so a document with a contract renders differently
-- depending on which page you opened it from. admin_client_documents() is
-- Admin.tsx's data source and does not return contract_id at all, so the
-- frontend has nothing to route on. Adds one column, same additive pattern
-- as the 2026-08-11 wall_gating change to this same function; no other
-- column, no access-posture change.
DROP FUNCTION IF EXISTS public.admin_client_documents(uuid);

CREATE FUNCTION public.admin_client_documents(p_user_id uuid)
 RETURNS TABLE(id uuid, title text, status text, workflow_state text, created_at timestamp with time zone, wall_gating boolean, contract_id uuid)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  -- generated documents (the real instances)
  SELECT d.id, d.title, d.status, d.workflow_state, d.created_at, coalesce(ct.wall_gating, false), d.contract_id
  FROM documents d
  JOIN profiles p ON p.contact_id = d.contact_id
  LEFT JOIN contract_templates ct ON ct.id = d.template_id
  WHERE is_admin() AND p.user_id = p_user_id AND d.deleted_at IS NULL

  UNION ALL

  -- required templates with no document that satisfies them and none in
  -- progress → a pending requirement row:
  --   NOT_STARTED  when the person has no history for the template at all,
  --   ASSIGNED     when prior executed copies exist but are superseded
  --                (staff re-assigned it for signature).
  SELECT
    -- deterministic pseudo-id from the template key (stable list key; not a
    -- real doc).
    ('00000000-0000-0000-0000-' || substr(md5(ct.template_key), 1, 12))::uuid AS id,
    t.title,
    CASE WHEN EXISTS (
      SELECT 1 FROM documents d JOIN contract_templates t2 ON t2.id = d.template_id
      WHERE t2.template_key = ct.template_key
        AND d.contact_id = p.contact_id AND d.deleted_at IS NULL
    ) THEN 'ASSIGNED' ELSE 'NOT_STARTED' END AS status,
    'awaiting_signature'::text AS workflow_state,
    NULL::timestamptz AS created_at,
    coalesce(t.wall_gating, false) AS wall_gating,
    NULL::uuid AS contract_id -- no document exists yet, so no contract to route to
  FROM profiles p
  JOIN required_templates_for_contact(p.contact_id) ct ON true
  JOIN contract_templates t ON t.template_key = ct.template_key AND t.deleted_at IS NULL
  WHERE is_admin() AND p.user_id = p_user_id
    AND NOT EXISTS (
      SELECT 1 FROM documents d
      JOIN contract_templates t2 ON t2.id = d.template_id
      WHERE t2.template_key = ct.template_key
        AND d.contact_id = p.contact_id AND d.deleted_at IS NULL
        AND (d.status <> 'EXECUTED'                      -- in progress (pending signature)
          OR (d.status = 'EXECUTED'
              AND coalesce(d.current_status,'') <> 'superseded'))  -- satisfied
    )

  ORDER BY created_at DESC NULLS LAST
$function$;

-- DROP FUNCTION wipes prior grants; restore exactly what was live (no REVOKE
-- here — this task doesn't touch the function's access posture, only its
-- return shape). PUBLIC EXECUTE is Postgres's function-create default and
-- matches what was already live on this function.
GRANT EXECUTE ON FUNCTION public.admin_client_documents(uuid) TO authenticated;
