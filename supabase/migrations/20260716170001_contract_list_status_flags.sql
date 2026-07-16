-- Surface sent_at / archived_at / cancelled_at on my_contract_documents so the
-- Documents list can show sent / archived / cancelled status.

CREATE OR REPLACE FUNCTION public.my_contract_documents()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_me    uuid := current_contact_id();
  v_staff boolean := has_staff_access();
  v_org   uuid := current_org();
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'authentication required';
  END IF;

  IF v_staff AND v_org IS NOT NULL THEN
    RETURN coalesce((
      SELECT jsonb_agg(row_to_json(t) ORDER BY t.generated_at DESC)
      FROM (
        SELECT DISTINCT
          d.id AS document_id, d.title, d.status, d.workflow_state,
          d.recipient_editing, d.execution_hash, d.generated_at, d.sent_at, d.archived_at, d.cancelled_at,
          (d.originator_contact_id = v_me) AS is_originator,
          (SELECT string_agg(dp.party_role, ',' ORDER BY dp.party_role)
             FROM document_parties dp
             WHERE dp.document_id = d.id AND dp.contact_id = v_me) AS my_roles,
          (SELECT count(*) FROM document_change_requests cr
             WHERE cr.document_id = d.id AND cr.status = 'open') AS open_change_requests
        FROM documents d
        WHERE d.deleted_at IS NULL
          AND d.org_id = v_org
          AND EXISTS (SELECT 1 FROM contract_fields cf WHERE cf.document_id = d.id)
      ) t
    ), '[]'::jsonb);
  END IF;

  IF v_me IS NULL THEN
    RETURN '[]'::jsonb;
  END IF;

  RETURN coalesce((
    SELECT jsonb_agg(row_to_json(t) ORDER BY t.generated_at DESC)
    FROM (
      SELECT DISTINCT
        d.id AS document_id, d.title, d.status, d.workflow_state,
        d.recipient_editing, d.execution_hash, d.generated_at, d.sent_at, d.archived_at, d.cancelled_at,
        (d.originator_contact_id = v_me) AS is_originator,
        (SELECT string_agg(dp.party_role, ',' ORDER BY dp.party_role)
           FROM document_parties dp
           WHERE dp.document_id = d.id AND dp.contact_id = v_me) AS my_roles,
        (SELECT count(*) FROM document_change_requests cr
           WHERE cr.document_id = d.id AND cr.status = 'open') AS open_change_requests
      FROM documents d
      JOIN document_parties dp2 ON dp2.document_id = d.id
      WHERE d.deleted_at IS NULL
        AND dp2.contact_id = v_me
        AND EXISTS (SELECT 1 FROM contract_fields cf WHERE cf.document_id = d.id)
    ) t
  ), '[]'::jsonb);
END;
$function$;
