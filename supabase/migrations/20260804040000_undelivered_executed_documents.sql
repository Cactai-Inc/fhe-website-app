-- A8: server-side delivery guarantee (2026-08-04).
--
-- Executed-document email was triggered ONLY from the browser: ContractPage
-- fires /api/deliver-documents when someone has the page open and sees status
-- EXECUTED. A party who signed on a phone and closed the tab, or a contract
-- executed while nobody had it open, was emailed nothing. Live audit at the
-- time of writing: 39 EXECUTED documents with zero delivery rows.
--
-- This is the finder the hourly sweep uses. Delivery becomes a property of the
-- document being executed rather than of anyone's browser being open.
CREATE OR REPLACE FUNCTION public.undelivered_executed_documents(
  p_limit integer DEFAULT 10,
  p_grace_minutes integer DEFAULT 5)
RETURNS TABLE(document_id uuid, title text, executed_at timestamptz, missing_recipients bigint)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT d.id,
         coalesce(d.title, 'Document'),
         d.updated_at,
         count(*) FILTER (WHERE dd.id IS NULL) AS missing_recipients
    FROM documents d
    JOIN document_parties dp ON dp.document_id = d.id
    JOIN contacts c ON c.id = dp.contact_id
                   AND coalesce(btrim(c.email), '') <> ''
    LEFT JOIN document_deliveries dd
           ON dd.document_id = d.id
          AND dd.recipient_contact_id = dp.contact_id
          AND dd.channel = 'EMAIL'
          AND dd.deleted_at IS NULL
   WHERE d.status = 'EXECUTED'
     AND d.deleted_at IS NULL
     -- grace: let the browser path deliver first in the common case
     AND d.updated_at < now() - make_interval(mins => greatest(p_grace_minutes, 0))
   GROUP BY d.id, d.title, d.updated_at
  HAVING count(*) FILTER (WHERE dd.id IS NULL) > 0
   ORDER BY d.updated_at
   LIMIT greatest(p_limit, 1);
$function$;

REVOKE ALL ON FUNCTION public.undelivered_executed_documents(integer, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.undelivered_executed_documents(integer, integer) TO service_role;
