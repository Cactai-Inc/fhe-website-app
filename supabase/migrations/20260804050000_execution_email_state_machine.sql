-- A8 (owner design, 2026-08-04): the executed-copy email fires WHEN THE
-- SIGNATURE COMPLETES EXECUTION, from the database, not from a browser and not
-- from a cleanup cron.
--
-- Owner's state machine, implemented literally:
--   any signature still NULL            -> email_sent = no   (nothing sent)
--   all signatures present, sent = no   -> SEND, set sent = yes
--   sent = yes                          -> UI shows RESEND
--   sent = no                           -> UI shows SEND
--
-- The previous design triggered delivery from ContractPage when a viewer
-- happened to see status EXECUTED, so a party who signed on a phone and closed
-- the tab was emailed nothing (39 executed documents had zero delivery rows).

ALTER TABLE documents ADD COLUMN IF NOT EXISTS executed_email_sent_at timestamptz;
ALTER TABLE documents ADD COLUMN IF NOT EXISTS executed_email_error text;
COMMENT ON COLUMN documents.executed_email_sent_at IS
  'When the executed-copy email was dispatched. NULL = not sent (UI offers SEND); set = sent (UI offers RESEND).';
COMMENT ON COLUMN documents.executed_email_error IS
  'Last dispatch failure, surfaced to staff so a silent non-delivery is impossible.';

-- Where to reach the app''s delivery endpoint. Stored as org config so it is
-- not hard-coded in a function body.
INSERT INTO config_values (org_id, namespace, key, value_text, category)
SELECT o.id, 'SYSTEM', 'APP_BASE_URL', 'https://www.frenchheritageequestrian.com', 'system'
  FROM organizations o
 WHERE NOT EXISTS (SELECT 1 FROM config_values c
                    WHERE c.org_id = o.id AND c.namespace='SYSTEM' AND c.key='APP_BASE_URL');

/* Dispatch the executed copy for one document. Idempotent by the owner's rule:
   returns without sending when already sent. Safe to call from anywhere. */
CREATE OR REPLACE FUNCTION public.send_executed_document_email(p_document_id uuid)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
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
  SELECT net.http_post(
           url     := v_base || '/api/deliver-documents',
           body    := jsonb_build_object('documentIds', jsonb_build_array(p_document_id::text)),
           headers := '{"Content-Type": "application/json"}'::jsonb
         ) INTO v_req;

  UPDATE documents
     SET executed_email_sent_at = now(), executed_email_error = NULL
   WHERE id = p_document_id;

  RETURN jsonb_build_object('sent', true, 'request_id', v_req);
END;
$function$;

REVOKE ALL ON FUNCTION public.send_executed_document_email(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.send_executed_document_email(uuid) TO authenticated, service_role;

/* Staff/party RESEND: clears the sent stamp and dispatches again. This is what
   the UI's Resend button calls. */
CREATE OR REPLACE FUNCTION public.resend_executed_document_email(p_document_id uuid)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'authentication required'; END IF;
  IF NOT (has_staff_access() OR EXISTS (
        SELECT 1 FROM document_parties dp
         WHERE dp.document_id = p_document_id AND dp.contact_id = current_contact_id()))
  THEN RAISE EXCEPTION 'not authorized for this document'; END IF;

  UPDATE documents SET executed_email_sent_at = NULL WHERE id = p_document_id;
  RETURN send_executed_document_email(p_document_id);
END;
$function$;
REVOKE ALL ON FUNCTION public.resend_executed_document_email(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.resend_executed_document_email(uuid) TO authenticated, service_role;

/* The trigger: the moment a document becomes EXECUTED, dispatch. */
CREATE OR REPLACE FUNCTION public.documents_send_executed_email()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.status = 'EXECUTED' AND OLD.status IS DISTINCT FROM 'EXECUTED'
     AND NEW.executed_email_sent_at IS NULL THEN
    BEGIN
      PERFORM send_executed_document_email(NEW.id);
    EXCEPTION WHEN OTHERS THEN
      -- never let a mail failure roll back an executed instrument; record it
      UPDATE documents SET executed_email_error = SQLERRM WHERE id = NEW.id;
    END;
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS documents_send_executed_email_trg ON public.documents;
CREATE TRIGGER documents_send_executed_email_trg
  AFTER UPDATE OF status ON public.documents
  FOR EACH ROW EXECUTE FUNCTION public.documents_send_executed_email();
