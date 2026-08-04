-- TASK B — lead/inbound notifications. Public intake (submit_public_request)
-- already fires notify_staff + api/request-received email. Support requests
-- (submit_support_request) fired neither. This migration:
--   1. Adds notify_staff + a pg_net email dispatch to submit_support_request,
--      following the same fire-and-forget dispatch shape as
--      send_executed_document_email (20260804050000): resolve APP_BASE_URL,
--      net.http_post to an /api endpoint, never let a mail hiccup block the
--      caller's write.
--   2. Adds inbound_open_count() — staff-only unread badge source for the
--      Inbound nav item: open requests ('new') + open support (status <>
--      'resolved', matching the existing admin_oversight() open_support
--      definition so "open" means the same thing everywhere in this app).

CREATE OR REPLACE FUNCTION public.submit_support_request(
  p_subject text,
  p_body    text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_org  uuid := current_org();
  v_id   uuid;
  v_base text;
  v_req  bigint;
BEGIN
  IF v_org IS NULL THEN
    RAISE EXCEPTION 'no org context';
  END IF;
  IF p_subject IS NULL OR btrim(p_subject) = '' OR p_body IS NULL OR btrim(p_body) = '' THEN
    RAISE EXCEPTION 'subject and message are required';
  END IF;

  INSERT INTO support_requests (org_id, user_id, subject, body)
  VALUES (v_org, auth.uid(), btrim(p_subject), btrim(p_body))
  RETURNING id INTO v_id;

  -- alert the barn: in-app to every staff/owner, mirroring how
  -- submit_public_request notifies on a new inquiry.
  PERFORM notify_staff(
    v_org, 'support_new',
    'New support request: ' || btrim(p_subject),
    '/app/ops/support');

  -- email the ops inbox (best-effort; never blocks the member's submission).
  BEGIN
    SELECT value_text INTO v_base FROM config_values
     WHERE org_id = v_org AND namespace = 'SYSTEM' AND key = 'APP_BASE_URL';
    IF coalesce(btrim(v_base), '') <> '' THEN
      SELECT net.http_post(
               url     := v_base || '/api/support-received',
               body    := jsonb_build_object('requestId', v_id::text),
               headers := '{"Content-Type": "application/json"}'::jsonb
             ) INTO v_req;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    -- never let a mail-dispatch failure roll back the support request itself
    NULL;
  END;

  RETURN v_id;
END;
$$;

-- ── Inbound nav badge source: staff-only count of open inbound work. ──
CREATE OR REPLACE FUNCTION public.inbound_open_count()
RETURNS int
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NOT has_staff_access() THEN
    RAISE EXCEPTION 'staff access required';
  END IF;
  RETURN
    (SELECT count(*) FROM requests
      WHERE org_id = current_org() AND status = 'new')
    +
    (SELECT count(*) FROM support_requests
      WHERE org_id = current_org() AND status <> 'resolved');
END;
$$;

REVOKE ALL ON FUNCTION public.inbound_open_count() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.inbound_open_count() TO authenticated;
