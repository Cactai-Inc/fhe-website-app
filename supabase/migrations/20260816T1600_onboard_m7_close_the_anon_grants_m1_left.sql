-- TASK ONBOARD — closing the anon grants M1 left open, and the one function that
-- had no internal guard behind them.
--
-- CAUGHT BY THIS TASK'S OWN VERIFICATION PASS, not by review. M1 wrote
-- `REVOKE ALL … FROM PUBLIC` on its new functions — which is exactly the move the
-- repo's own trap list says does not work, and which M2 then documented correctly
-- two hours later. This database has ALTER DEFAULT PRIVILEGES granting EXECUTE on
-- new functions to `anon` as a DIRECT grant (anon=X/postgres in proacl), so
-- revoking from PUBLIC leaves it untouched. has_function_privilege('anon', …)
-- returned true for all six of M1's and M5's new functions.
--
-- Five of the six were harmless in practice — they refuse a caller who is not
-- service_role or staff, or raise on a null auth.uid(). ONE WAS NOT:
--
--   deliver_executed_document_set(contact, include) had NO authorization check at
--   all. It was written to be called from a trigger and from the sweep, and both
--   of those are already privileged, so no guard was written. Reachable by anon it
--   is an unauthenticated way to make the system email a stranger's signed
--   documents to that stranger's parties, given only a contact uuid. It is given a
--   guard here as well as a revoke, so the fix does not depend on the ACL alone.
--
-- REVOKING FROM `anon` BY NAME IS THE FIX, and has_function_privilege is the proof.

-- The one that needed a guard, not just an ACL.
CREATE OR REPLACE FUNCTION public.deliver_executed_document_set(
  p_contact_id uuid,
  p_include    uuid DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_ids  uuid[];
  v_org  uuid;
  v_base text;
  v_req  bigint;
BEGIN
  -- Callers are the execution trigger (SECURITY DEFINER, runs as the definer),
  -- the sweep (service_role) and staff. Never a browser.
  IF NOT (coalesce(auth.role(), '') = 'service_role'
          OR coalesce(has_staff_access(), false)
          OR auth.uid() IS NULL AND auth.role() IS NULL) THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  IF p_contact_id IS NULL THEN
    RETURN jsonb_build_object('sent', false, 'reason', 'no contact');
  END IF;

  SELECT array_agg(d.id ORDER BY d.generated_at, d.created_at)
    INTO v_ids
    FROM documents d
   WHERE d.contact_id = p_contact_id
     AND d.deleted_at IS NULL
     AND d.status = 'EXECUTED'
     AND d.executed_email_sent_at IS NULL
     AND (d.delivery_held_at IS NOT NULL OR d.id = p_include)
     AND NOT EXISTS (
       SELECT 1 FROM signatures s
        WHERE s.document_id = d.id AND s.deleted_at IS NULL AND s.signed_at IS NULL);

  IF v_ids IS NULL OR array_length(v_ids, 1) IS NULL THEN
    RETURN jsonb_build_object('sent', false, 'reason', 'nothing to deliver');
  END IF;

  SELECT d.org_id INTO v_org FROM documents d WHERE d.id = v_ids[1];

  SELECT value_text INTO v_base FROM config_values
   WHERE org_id = v_org AND namespace = 'SYSTEM' AND key = 'APP_BASE_URL';
  IF coalesce(btrim(v_base), '') = '' THEN
    UPDATE documents SET executed_email_error = 'APP_BASE_URL not configured'
     WHERE id = ANY(v_ids);
    RETURN jsonb_build_object('sent', false, 'reason', 'no base url',
                              'documents', array_length(v_ids, 1));
  END IF;

  SELECT net.http_post(
           url     := v_base || '/api/deliver-documents',
           body    := jsonb_build_object(
                        'documentIds',
                        (SELECT jsonb_agg(x::text) FROM unnest(v_ids) x)),
           headers := '{"Content-Type": "application/json"}'::jsonb,
           timeout_milliseconds := 15000
         ) INTO v_req;

  UPDATE documents
     SET executed_email_sent_at = now(),
         executed_email_error   = NULL,
         delivery_held_at       = NULL
   WHERE id = ANY(v_ids);

  UPDATE document_delivery_holds SET released_at = now()
   WHERE released_at IS NULL AND contact_id = p_contact_id;
  UPDATE document_delivery_holds h SET released_at = now()
   WHERE h.released_at IS NULL
     AND h.email IS NOT NULL
     AND lower(h.email) = (SELECT lower(c.email) FROM contacts c WHERE c.id = p_contact_id);

  RETURN jsonb_build_object(
    'sent', true, 'request_id', v_req, 'documents', array_length(v_ids, 1));
END;
$function$;

REVOKE ALL ON FUNCTION public.deliver_executed_document_set(uuid, uuid)        FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.flush_held_executed_document_emails(integer)     FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.mark_document_set_delivered(uuid[])              FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.open_document_delivery_hold(uuid, uuid, text, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.my_executed_delivery_state()                     FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.contact_profile_complete(uuid)                   FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.flush_held_executed_document_emails(integer)     TO service_role;
GRANT EXECUTE ON FUNCTION public.mark_document_set_delivered(uuid[])              TO service_role;
GRANT EXECUTE ON FUNCTION public.open_document_delivery_hold(uuid, uuid, text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.my_executed_delivery_state()                     TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.contact_profile_complete(uuid)                   TO authenticated, service_role;
