-- DEALAUTO §3 (root cause, pre-existing) — the execution trigger was never
-- allowed to send.
--
-- `deliver_executed_document_set` opens with:
--
--   IF NOT (auth.role() = 'service_role' OR has_staff_access()
--           OR auth.uid() IS NULL AND auth.role() IS NULL) THEN
--     RAISE EXCEPTION 'not authorized';
--
-- and its own comment names the callers it means to admit: "the execution
-- trigger (SECURITY DEFINER, runs as the definer), the sweep (service_role) and
-- staff. Never a browser."
--
-- The first of those three never matched. SECURITY DEFINER changes the
-- executing ROLE; it does not change `auth.uid()` or `auth.role()`, which read
-- request GUCs and keep reporting the signed-in human. When a CLIENT signs the
-- last document of their run, the trigger reaches this function as
-- ('authenticated', a non-staff uid) and is refused. `documents_send_executed_email`
-- catches the exception (correctly — a mail failure must never roll back an
-- executed instrument) and files it in `executed_email_error`. Silent.
--
-- THE EVIDENCE, production, 2026-08-22, before this migration:
--
--   template_key            | mailed | held | executed_email_error
--   HUMAN_EMERGENCY_MEDICAL |   f    |  f   | not authorized      <- the flush
--   COMPANY_POLICIES        |   f    |  t   |                     <- its batch,
--   FACILITY_RULES          |   f    |  t   |                        still held
--   RELEASE_PARTICIPANT     |   f    |  t   |
--
-- Three complete onboarding runs, 2026-08-20/21/22, in exactly that shape:
-- every run's final document says "not authorized" and every document it was
-- supposed to carry is still sitting held. `executed_email_sent_at` is NULL on
-- all of them. This is ORCHESTRATOR §3 in its purest form — a guard whose
-- condition was never true, reporting nothing, for as long as clients have been
-- signing their own documents.
--
-- The guard is kept: EXECUTE on this function IS granted to `authenticated`, so
-- it is a real boundary and not decoration. One caller is added, and it is the
-- one the comment always claimed: a call made from inside a trigger.
-- pg_trigger_depth() is 0 for any direct RPC from a browser and >= 1 only
-- underneath a firing trigger, which is precisely the distinction the original
-- condition was reaching for and could not express.
CREATE OR REPLACE FUNCTION public.deliver_executed_document_set(p_contact_id uuid, p_include uuid DEFAULT NULL::uuid)
 RETURNS jsonb
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
  -- Callers are the execution trigger, the sweep (service_role) and staff.
  -- Never a browser: pg_trigger_depth() = 0 on a direct RPC.
  IF NOT (pg_trigger_depth() > 0
          OR coalesce(auth.role(), '') = 'service_role'
          OR coalesce(has_staff_access(), false)
          OR auth.uid() IS NULL AND auth.role() IS NULL) THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  IF p_contact_id IS NULL THEN
    RETURN jsonb_build_object('sent', false, 'reason', 'no contact');
  END IF;

  WITH deliverable AS (
    SELECT d.id, d.contract_id, d.contact_id, d.generated_at, d.created_at
      FROM documents d
     WHERE d.deleted_at IS NULL
       AND d.status = 'EXECUTED'
       AND d.executed_email_sent_at IS NULL
       AND (d.delivery_held_at IS NOT NULL OR d.id = p_include)
       AND NOT EXISTS (
         SELECT 1 FROM signatures s
          WHERE s.document_id = d.id AND s.deleted_at IS NULL AND s.signed_at IS NULL)
  ), anchored AS (
    SELECT * FROM deliverable WHERE contact_id = p_contact_id
  )
  SELECT array_agg(x.id ORDER BY x.generated_at, x.created_at)
    INTO v_ids
    FROM (
      SELECT * FROM anchored
      UNION
      -- DEALAUTO §3: the rest of the same contract's undelivered set
      SELECT dl.* FROM deliverable dl
       WHERE dl.contract_id IS NOT NULL
         AND dl.contract_id IN (SELECT a.contract_id FROM anchored a WHERE a.contract_id IS NOT NULL)
    ) x;

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
