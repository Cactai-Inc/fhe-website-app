-- Notifications must not outlive the thing they point at. Two fixes:
--   1. my_notifications VALIDATES each notification before returning it — a
--      notification linked to a contract document (/app/contracts/<id>) is hidden
--      once that document no longer exists (hard-deleted or soft-deleted). This is
--      the defensive guard: it clears stale notifications on the parties' screens
--      regardless of which deletion path removed the underlying item.
--   2. hard_delete_contract proactively deletes the contract's notifications so the
--      rows don't linger at all.

-- 1. defensive read: skip notifications whose linked contract is gone -------------
CREATE OR REPLACE FUNCTION public.my_notifications(p_limit integer DEFAULT 20)
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT coalesce(jsonb_agg(jsonb_build_object(
      'id', n.id, 'kind', n.kind, 'title', n.title, 'body', n.body,
      'link', n.link, 'read_at', n.read_at, 'created_at', n.created_at)
      ORDER BY n.created_at DESC, n.id DESC), '[]'::jsonb)
  FROM (
    SELECT * FROM notifications
    WHERE user_id = auth.uid()
      -- a contract-linked notification is only valid while its document exists and
      -- is not soft-deleted; non-contract notifications are unaffected.
      AND (
        link IS NULL
        -- only validate links of the exact form /app/contracts/<uuid>; anything else
        -- (other links, or a malformed contract link) is left untouched, and the cast
        -- is only reached for a well-formed uuid so it can never raise.
        OR link !~ '^/app/contracts/[0-9a-fA-F-]{36}$'
        OR EXISTS (
          SELECT 1 FROM documents d
          WHERE d.id = regexp_replace(link, '^/app/contracts/', '')::uuid
            AND d.deleted_at IS NULL
        )
      )
    ORDER BY created_at DESC, id DESC
    LIMIT greatest(coalesce(p_limit, 20), 1)
  ) n
$function$;

-- 2. proactive cleanup: delete a contract's notifications when it's hard-deleted ---
CREATE OR REPLACE FUNCTION public.hard_delete_contract(p_document_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE v_org uuid; v_state text; v_contract uuid;
BEGIN
  SELECT org_id, workflow_state, contract_id INTO v_org, v_state, v_contract
    FROM documents WHERE id = p_document_id;
  IF v_org IS NULL THEN RAISE EXCEPTION 'unknown document'; END IF;
  IF NOT (has_staff_access() AND v_org = current_org()) THEN RAISE EXCEPTION 'staff access required'; END IF;
  IF v_state = 'executed' THEN RAISE EXCEPTION 'an executed document cannot be deleted'; END IF;

  DELETE FROM notifications WHERE link = '/app/contracts/' || p_document_id::text;
  DELETE FROM contract_fields WHERE document_id = p_document_id;
  DELETE FROM document_parties WHERE document_id = p_document_id;
  DELETE FROM document_change_requests WHERE document_id = p_document_id;
  DELETE FROM contract_addenda WHERE document_id = p_document_id;
  DELETE FROM documents WHERE id = p_document_id;
  IF v_contract IS NOT NULL
     AND NOT EXISTS (SELECT 1 FROM documents WHERE contract_id = v_contract) THEN
    DELETE FROM contract_parties WHERE contract_id = v_contract;
    DELETE FROM contracts WHERE id = v_contract;
  END IF;
END;
$function$;
