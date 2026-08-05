/*
  A15 — truthful monitoring, part 1: fix the false-timeout source.

  send_executed_document_email fires net.http_post with NO timeout_milliseconds,
  so pg_net's 5000ms default applies. /api/deliver-documents legitimately takes
  6-8s (PDF render + SMTP), so net._http_response records FALSE timeouts on real
  successes (proven twice on 2026-08-05, requests 4 and 5; both sends actually
  succeeded). Any failure-detection built on net._http_response or on retrying
  based on it would false-alarm on every normal send — this must land BEFORE the
  sweep (part 2), which is why it's its own migration.

  Live body carried forward unchanged; the only change is the added
  timeout_milliseconds argument on the net.http_post call. Signature verified
  live: net.http_post(url text, body jsonb, params jsonb, headers jsonb,
  timeout_milliseconds integer DEFAULT 5000) — named-argument syntax below
  matches the installed pg_net version exactly.
*/
CREATE OR REPLACE FUNCTION public.send_executed_document_email(p_document_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_doc     documents%ROWTYPE;
  v_unsigned int;
  v_base    text;
  v_req     bigint;
BEGIN
  SELECT * INTO v_doc FROM documents WHERE id = p_document_id AND deleted_at IS NULL;
  IF NOT FOUND THEN RAISE EXCEPTION 'document not found'; END IF;

  -- every signer must have signed: any NULL signature means do not send
  SELECT count(*) INTO v_unsigned
    FROM signatures s
   WHERE s.document_id = p_document_id AND s.deleted_at IS NULL AND s.signed_at IS NULL;
  IF v_doc.status <> 'EXECUTED' OR v_unsigned > 0 THEN
    RETURN jsonb_build_object('sent', false, 'reason', 'not fully signed');
  END IF;

  IF v_doc.executed_email_sent_at IS NOT NULL THEN
    RETURN jsonb_build_object('sent', false, 'reason', 'already sent',
                              'sent_at', v_doc.executed_email_sent_at);
  END IF;

  SELECT value_text INTO v_base FROM config_values
   WHERE org_id = v_doc.org_id AND namespace='SYSTEM' AND key='APP_BASE_URL';
  IF coalesce(btrim(v_base),'') = '' THEN
    UPDATE documents SET executed_email_error = 'APP_BASE_URL not configured'
     WHERE id = p_document_id;
    RETURN jsonb_build_object('sent', false, 'reason', 'no base url');
  END IF;

  -- fire-and-forget POST; the endpoint renders the PDFs, unions the parties,
  -- brands per tenant and writes document_deliveries rows idempotently.
  -- A15: 15000ms timeout — the endpoint legitimately takes 6-8s (PDF + SMTP);
  -- pg_net's 5000ms default was recording false timeouts on real successes.
  SELECT net.http_post(
           url     := v_base || '/api/deliver-documents',
           body    := jsonb_build_object('documentIds', jsonb_build_array(p_document_id::text)),
           headers := '{"Content-Type": "application/json"}'::jsonb,
           timeout_milliseconds := 15000
         ) INTO v_req;

  UPDATE documents
     SET executed_email_sent_at = now(), executed_email_error = NULL
   WHERE id = p_document_id;

  RETURN jsonb_build_object('sent', true, 'request_id', v_req);
END;
$function$;
