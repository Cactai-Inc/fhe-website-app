-- my_notifications: 'awaiting archive' (cancelled-contract) notifications are
-- hidden once no cancelled-but-unarchived document remains in the org.
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
      -- an "awaiting archive/delete" notification (a cancelled contract) is only valid
      -- while a cancelled-but-unarchived document still exists in the org.
      AND (
        title NOT ILIKE '%awaiting archive%'
        OR EXISTS (SELECT 1 FROM documents d
                   WHERE d.org_id = notifications.org_id
                     AND d.cancelled_at IS NOT NULL AND d.archived_at IS NULL AND d.deleted_at IS NULL)
      )
    ORDER BY created_at DESC, id DESC
    LIMIT greatest(coalesce(p_limit, 20), 1)
  ) n
$function$;
