-- INBOUNDALERT — an inbound lead's alert email becomes PROVABLE.
--
-- The defect: /api/request-received is called fire-and-forget by the public
-- intake form and returns 200 { emailed:false } on every failure, writing the
-- provider's error to a serverless log nobody reads. So "was the owner told
-- about this lead?" had no answer anywhere — not in the app, not in SQL.
--
-- The fix is the discipline already used for receipts (CLAUDE.md: "receipt_sends
-- (one row per attempt; a receipt is provable and single)"). This file is
-- receipt_sends' shape applied to request alerts:
--
--   request_alert_sends            <- receipt_sends (same columns, same order)
--   claim_request_alert_send()     <- claim_receipt_send()
--   log_request_alert_send()       <- log_receipt_send()
--
-- Two deliberate departures from that precedent:
--   1. GRANTS ARE TIGHTER. claim_receipt_send/log_receipt_send are still
--      executable by PUBLIC (anon + authenticated), which lets anyone forge
--      receipt evidence. These two are service_role-only, the posture
--      sweep_undelivered_executed_documents already uses. (The receipt_sends
--      grant hole is reported, not changed here — it is not this task's.)
--   2. NO CASCADE ON THE REQUEST. receipt_sends cascades from purchases;
--      BOOKWRITE has since disarmed exactly that kind of cascade. Evidence that
--      an alert was attempted must not evaporate with the row it is about, so
--      the FK is ON DELETE RESTRICT — the same posture document_deliveries
--      already takes toward documents.
--
-- The absence of a row is itself a finding: it means the endpoint never ran at
-- all (the browser aborted the un-awaited fetch on navigation, or never sent
-- it). inbound_queue reports that as 'not_attempted', distinct from 'failed'.

-- ── 1. The attempt record ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS request_alert_sends (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id          uuid NOT NULL,
  request_id      uuid NOT NULL REFERENCES requests(id) ON DELETE RESTRICT,
  idempotency_key text NOT NULL,
  recipient_email text,
  succeeded       boolean NOT NULL,
  error           text,
  message_id      text,
  attempted_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (idempotency_key)
);

CREATE INDEX IF NOT EXISTS request_alert_sends_request_idx
  ON request_alert_sends (request_id);

ALTER TABLE request_alert_sends ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS request_alert_sends_staff ON request_alert_sends;
-- has_staff_access() already COALESCEs to false, so this cannot go NULL-open
-- for the platform owner (D1a).
CREATE POLICY request_alert_sends_staff ON request_alert_sends
  FOR SELECT USING (has_staff_access());

COMMENT ON TABLE request_alert_sends IS
  'INBOUNDALERT: one row per attempt to email the ops inbox about an inbound '
  'request — success or failure, with the provider''s error verbatim. Mirrors '
  'receipt_sends. No row at all means the endpoint never ran.';

-- ── 2. Claim / log, mirroring the receipt pair ───────────────────────────────

/** Claim the right to alert exactly once for (request, key). Returns true when
 *  THIS caller may send; false when an alert already succeeded for the request.
 *  Failed attempts stay as evidence and do not block a retry. */
CREATE OR REPLACE FUNCTION public.claim_request_alert_send(p_request_id uuid, p_key text)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
BEGIN
  IF EXISTS (SELECT 1 FROM request_alert_sends
              WHERE request_id = p_request_id AND succeeded) THEN
    RETURN false;                                   -- provable and single
  END IF;
  RETURN NOT EXISTS (SELECT 1 FROM request_alert_sends WHERE idempotency_key = p_key);
END;
$function$;

CREATE OR REPLACE FUNCTION public.log_request_alert_send(
  p_request_id uuid, p_key text, p_recipient text,
  p_succeeded boolean, p_error text DEFAULT NULL, p_message_id text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE v_org uuid;
BEGIN
  SELECT org_id INTO v_org FROM requests WHERE id = p_request_id;
  IF v_org IS NULL THEN RETURN; END IF;   -- no such request: nothing to anchor to
  INSERT INTO request_alert_sends (org_id, request_id, idempotency_key, recipient_email,
                                   succeeded, error, message_id)
  VALUES (v_org, p_request_id, p_key, p_recipient, p_succeeded, p_error, p_message_id)
  ON CONFLICT (idempotency_key) DO NOTHING;
END;
$function$;

-- REVOKE FROM PUBLIC ALONE IS A NO-OP HERE. This project has ALTER DEFAULT
-- PRIVILEGES granting EXECUTE on every new public function to anon and
-- authenticated, so those arrive as EXPLICIT grants that a PUBLIC-only revoke
-- leaves untouched (verified: after the first apply, proacl still read
-- anon=X, authenticated=X). Name every role.
REVOKE ALL ON FUNCTION public.claim_request_alert_send(uuid, text)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.log_request_alert_send(uuid, text, text, boolean, text, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_request_alert_send(uuid, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.log_request_alert_send(uuid, text, text, boolean, text, text) TO service_role;

-- ── 3. inbound_queue carries the verdict ─────────────────────────────────────
-- One definition, in the view the dashboard already reads (COUNTFIX's rule: a
-- number/verdict is computed once, in the place that already owns it). Columns
-- are APPENDED — CREATE OR REPLACE VIEW allows nothing else — and the view keeps
-- security_invoker, so request_alert_sends' own RLS still fences these reads.
--
-- alert_state:
--   'sent'          — an attempt succeeded
--   'failed'        — attempts exist, none succeeded (alert_error carries why)
--   'not_attempted' — no attempt row: the endpoint never ran for this request
--   'unknown'       — the request predates this table; we genuinely cannot say
CREATE OR REPLACE VIEW inbound_queue
WITH (security_invoker = true) AS
 SELECT r.id,
    r.org_id,
    r.status,
    r.channel,
    r.category,
    r.created_at,
    r.contact_first_name,
    r.contact_last_name,
    r.contact_email,
    r.contact_phone,
    r.subject,
    r.notes,
    r.staff_notes,
    r.proposed_times,
    r.booking_eligible,
    now()::date - r.created_at::date AS days_open,
    c.id AS contact_id,
    c.contact_type,
    c.contact_type = 'CONTACT'::text AS already_converted,
    r.status = 'new'::text AND COALESCE(c.contact_type, ''::text) <> 'CONTACT'::text AND (now()::date - r.created_at::date) >= 2 AS overdue,
    CASE
      WHEN a.succeeded_at IS NOT NULL THEN 'sent'
      WHEN r.created_at < timestamptz '2026-08-12 21:36:00+00' THEN 'unknown'
      WHEN a.attempts = 0 THEN 'not_attempted'
      ELSE 'failed'
    END AS alert_state,
    COALESCE(a.succeeded_at, a.last_attempt_at) AS alert_attempted_at,
    a.last_recipient AS alert_recipient,
    CASE WHEN a.succeeded_at IS NULL THEN a.last_error END AS alert_error
   FROM requests r
     LEFT JOIN LATERAL ( SELECT c2.id,
            c2.contact_type
           FROM contacts c2
          WHERE c2.deleted_at IS NULL AND c2.org_id = r.org_id AND (r.contact_id IS NOT NULL AND c2.id = r.contact_id OR r.contact_id IS NULL AND lower(c2.email) = lower(r.contact_email))
          ORDER BY c2.created_at
         LIMIT 1) c ON true
     LEFT JOIN LATERAL ( SELECT count(*) AS attempts,
            max(s.attempted_at) FILTER (WHERE s.succeeded) AS succeeded_at,
            max(s.attempted_at) AS last_attempt_at,
            (array_agg(s.recipient_email ORDER BY s.attempted_at DESC))[1] AS last_recipient,
            (array_agg(s.error ORDER BY s.attempted_at DESC))[1] AS last_error
           FROM request_alert_sends s
          WHERE s.request_id = r.id) a ON true;

COMMENT ON VIEW inbound_queue IS
  'The inbound lead queue: the request, how long it has waited, whether its '
  'person was ever captured (already_converted), and — INBOUNDALERT — whether '
  'the ops inbox was actually told about it (alert_state/alert_error). Rows '
  'created before 2026-08-12 21:36Z report alert_state ''unknown'': no attempt '
  'record existed then, so silence is not evidence either way.';
