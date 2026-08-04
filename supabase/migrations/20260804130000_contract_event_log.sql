-- A14: contract-scoped event log, staff-only read RPC.
-- Unifies status_events, document_deliveries, signatures, contract_change_log,
-- and document_opened (existing "opened" tracking, found during characterization)
-- into one reverse-chronological feed for a document. Guard copied verbatim from
-- publish_open_slots (20260803030000_publish_open_slots.sql:95).

CREATE OR REPLACE FUNCTION public.contract_event_log(p_document_id uuid)
RETURNS TABLE (
  occurred_at timestamptz,
  kind        text,
  actor       text,
  detail      text
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT has_staff_access() THEN RAISE EXCEPTION 'staff access required'; END IF;

  RETURN QUERY
  WITH status AS (
    SELECT
      se.created_at AS occurred_at,
      'STATUS'::text AS kind,
      coalesce(nullif(btrim(coalesce(p.first_name,'') || ' ' || coalesce(p.last_name,'')), ''), p.display_name, 'Unknown') AS actor,
      initcap(replace(se.status, '_', ' ')) AS detail
    FROM status_events se
    LEFT JOIN profiles p ON p.user_id = se.actor_user_id
    WHERE se.entity_type = 'document' AND se.entity_id = p_document_id
  ),
  sent AS (
    SELECT
      dd.delivered_at AS occurred_at,
      'SENT'::text AS kind,
      coalesce(nullif(btrim(coalesce(c.first_name,'') || ' ' || coalesce(c.last_name,'')), ''), 'Unknown') AS actor,
      (coalesce(nullif(btrim(coalesce(c.first_name,'') || ' ' || coalesce(c.last_name,'')), ''), 'Unknown')
        || ' via ' || dd.channel
        || CASE WHEN dd.is_mirror THEN ' (mirror copy)' ELSE '' END) AS detail
    FROM document_deliveries dd
    LEFT JOIN contacts c ON c.id = dd.recipient_contact_id
    WHERE dd.document_id = p_document_id AND dd.deleted_at IS NULL
  ),
  signed AS (
    SELECT
      s.signed_at AS occurred_at,
      'SIGNED'::text AS kind,
      coalesce(nullif(btrim(coalesce(c.first_name,'') || ' ' || coalesce(c.last_name,'')), ''), 'Unknown') AS actor,
      initcap(replace(s.party_role, '_', ' ')) AS detail
    FROM signatures s
    LEFT JOIN contacts c ON c.id = s.signer_contact_id
    WHERE s.document_id = p_document_id AND s.signed_at IS NOT NULL AND s.deleted_at IS NULL
  ),
  opened AS (
    SELECT
      do_.opened_at AS occurred_at,
      'OPENED'::text AS kind,
      coalesce(do_.opened_label, 'Unknown') AS actor,
      coalesce(initcap(replace(do_.opened_role, '_', ' ')), 'Viewed') AS detail
    FROM document_opened do_
    WHERE do_.document_id = p_document_id
  ),
  edits AS (
    SELECT
      max(ccl.created_at) AS occurred_at,
      'EDITS'::text AS kind,
      coalesce(nullif(btrim(ccl.actor_label), ''), 'Unknown') AS actor,
      (count(*)::text || ' field edit' || CASE WHEN count(*) = 1 THEN '' ELSE 's' END) AS detail
    FROM contract_change_log ccl
    WHERE ccl.document_id = p_document_id
    GROUP BY ccl.actor_label, (ccl.created_at AT TIME ZONE 'America/Los_Angeles')::date
  )
  SELECT * FROM status
  UNION ALL SELECT * FROM sent
  UNION ALL SELECT * FROM signed
  UNION ALL SELECT * FROM opened
  UNION ALL SELECT * FROM edits
  ORDER BY occurred_at DESC;
END;
$function$;
