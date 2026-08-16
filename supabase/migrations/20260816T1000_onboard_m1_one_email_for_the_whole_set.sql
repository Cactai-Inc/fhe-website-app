-- TASK ONBOARD §4 — ONE email with ALL the signed documents.
--
-- THE BUG (measured on prod, not inferred). The AFTER-UPDATE trigger
-- `documents_send_executed_email_trg` fires once per document as it becomes
-- EXECUTED, and `send_executed_document_email` POSTs /api/deliver-documents with
-- a SINGLE-ELEMENT array:
--     jsonb_build_object('documentIds', jsonb_build_array(p_document_id::text))
-- so an N-document signing run produced N separate emails (plus N separate
-- company mirrors). Proven in prod:
--   Rachel Engelhorn — 4 executed docs, 4 distinct executed_email_sent_at stamps
--     (15:19:51 / 15:20:25 / 15:22:22 / 15:22:49) and 8 document_deliveries rows.
--   Claire Bourdon  — 12 executed docs, 12 distinct stamps across 65 seconds.
--
-- api/deliver-documents.ts was never the culprit: it batches correctly. The
-- batched call the clients make when the LAST document is signed
-- (Onboarding.tsx:558, DocsParticipantFlow.tsx:212 — both POST the full id list)
-- simply arrives after the trigger has already written a document_deliveries row
-- for every (document, recipient) pair, so it skips every recipient and returns
-- an empty `delivered` array. The database out-raced the fix that was already
-- there.
--
-- THE FIX — hold, then flush once. A document whose signer is in the middle of a
-- signing run is HELD instead of mailed; the run's end flushes the whole held set
-- through ONE POST to the same endpoint. Two independent signals say "a run is in
-- progress", because the two live flows have opposite shapes:
--
--   (a) documents generated UP FRONT and signed one by one (Onboarding.tsx via
--       generate_my_onboarding_documents — Mary Richardson's 6 DRAFT rows share
--       one generated_at). Signal: the signer still has another non-executed
--       document anchored to them.
--   (b) documents CREATED AT SIGNING TIME, one per step (DocsParticipantFlow via
--       sign_release — Rachel's 4 rows each have generated_at = signed_at). There
--       is nothing to look at, so the flow DECLARES the run: /api/sign-release
--       opens a delivery hold (service-role) before the first signature.
--
-- HISTORY IS NOT TOUCHED. Only documents this mechanism itself held
-- (`delivery_held_at IS NOT NULL`) plus the one that just executed are ever
-- flushed. Prod holds 20+ executed documents with a NULL send stamp from before
-- this machinery existed (Madeline Do 8, Serena Lee 4, …); none are swept into a
-- surprise mail-out.

-- ── 1. the hold stamp + the declared-run table ───────────────────────────────
ALTER TABLE documents ADD COLUMN IF NOT EXISTS delivery_held_at timestamptz;

COMMENT ON COLUMN documents.delivery_held_at IS
  'ONBOARD §4: set when an executed document is deliberately NOT emailed yet because '
  'its signer is mid-signing-run. Cleared when the set goes out as one email. NULL on '
  'every pre-existing row, which is what keeps the flush away from history.';

CREATE TABLE IF NOT EXISTS document_delivery_holds (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id      uuid REFERENCES organizations(id),
  contact_id  uuid REFERENCES contacts(id),
  email       text,
  source      text NOT NULL,
  opened_at   timestamptz NOT NULL DEFAULT now(),
  released_at timestamptz,
  CONSTRAINT document_delivery_holds_subject CHECK (contact_id IS NOT NULL OR email IS NOT NULL)
);

COMMENT ON TABLE document_delivery_holds IS
  'ONBOARD §4: an open row means "this person is mid-signing-run — hold their executed '
  'document emails so the run ends in ONE email". Opened by the flow that knows a run is '
  'starting, released when the set is delivered (or by the backstop sweep). Keyed by '
  'contact when known and by email otherwise, because /api/sign-release opens the hold '
  'before the contact row exists.';

CREATE INDEX IF NOT EXISTS document_delivery_holds_open_idx
  ON document_delivery_holds (contact_id, released_at);
CREATE INDEX IF NOT EXISTS document_delivery_holds_email_idx
  ON document_delivery_holds (lower(email), released_at);

ALTER TABLE document_delivery_holds ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS document_delivery_holds_staff ON document_delivery_holds;
CREATE POLICY document_delivery_holds_staff ON document_delivery_holds
  FOR SELECT USING (has_staff_access());

-- ── 2. open / release a declared run ─────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.open_document_delivery_hold(
  p_org uuid, p_contact_id uuid, p_email text, p_source text
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE v_id uuid;
BEGIN
  IF NOT (coalesce(auth.role(), '') = 'service_role' OR has_staff_access()) THEN
    RAISE EXCEPTION 'not authorized';
  END IF;
  IF p_contact_id IS NULL AND coalesce(btrim(p_email), '') = '' THEN
    RAISE EXCEPTION 'a contact or an email is required';
  END IF;

  -- one open hold per subject; re-declaring an in-flight run is a no-op
  SELECT h.id INTO v_id FROM document_delivery_holds h
   WHERE h.released_at IS NULL
     AND h.opened_at > now() - interval '6 hours'
     AND ((p_contact_id IS NOT NULL AND h.contact_id = p_contact_id)
       OR (p_email IS NOT NULL AND lower(h.email) = lower(btrim(p_email))))
   LIMIT 1;
  IF v_id IS NOT NULL THEN RETURN v_id; END IF;

  INSERT INTO document_delivery_holds (org_id, contact_id, email, source)
    VALUES (p_org, p_contact_id, nullif(lower(btrim(p_email)), ''), p_source)
    RETURNING id INTO v_id;
  RETURN v_id;
END;
$function$;

/** Is this person mid-run? Either they declared it, or they still have another
 *  document anchored to them that is neither executed nor void. */
CREATE OR REPLACE FUNCTION public.document_delivery_is_held(p_document_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_contact uuid;
  v_email   text;
BEGIN
  SELECT d.contact_id INTO v_contact FROM documents d WHERE d.id = p_document_id;
  IF v_contact IS NULL THEN RETURN false; END IF;
  SELECT c.email INTO v_email FROM contacts c WHERE c.id = v_contact;

  -- (b) declared run
  IF EXISTS (
    SELECT 1 FROM document_delivery_holds h
     WHERE h.released_at IS NULL
       AND h.opened_at > now() - interval '6 hours'
       AND (h.contact_id = v_contact
         OR (v_email IS NOT NULL AND lower(h.email) = lower(v_email)))
  ) THEN
    RETURN true;
  END IF;

  -- (a) more paperwork still sitting in front of them
  RETURN EXISTS (
    SELECT 1 FROM documents d2
     WHERE d2.contact_id = v_contact
       AND d2.id <> p_document_id
       AND d2.deleted_at IS NULL
       AND d2.status NOT IN ('EXECUTED', 'VOID')
  );
END;
$function$;

-- ── 3. deliver a whole held set as ONE email ─────────────────────────────────
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
  IF p_contact_id IS NULL THEN
    RETURN jsonb_build_object('sent', false, 'reason', 'no contact');
  END IF;

  -- The set = everything this mechanism held for this person, plus the document
  -- that just executed. Deliberately NOT "every unsent executed document" — that
  -- would sweep in pre-existing history.
  SELECT array_agg(d.id ORDER BY d.generated_at, d.created_at)
    INTO v_ids
    FROM documents d
   WHERE d.contact_id = p_contact_id
     AND d.deleted_at IS NULL
     AND d.status = 'EXECUTED'
     AND d.executed_email_sent_at IS NULL
     AND (d.delivery_held_at IS NOT NULL OR d.id = p_include)
     -- every signer must have signed: the same guard send_executed_document_email uses
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

  -- ONE POST carrying the WHOLE set. deliver-documents renders each PDF, unions
  -- the parties, and sends each distinct signer a single email with every
  -- attachment — which is what it was always written to do.
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

COMMENT ON FUNCTION public.deliver_executed_document_set(uuid, uuid) IS
  'ONBOARD §4: POST the contact''s held executed documents to /api/deliver-documents '
  'as ONE request, so each signer receives a single email carrying every PDF. Only '
  'documents held by this mechanism (delivery_held_at) plus p_include are included, '
  'so pre-existing unsent history is never swept in.';

-- ── 4. the trigger: hold while the run is still going ────────────────────────
CREATE OR REPLACE FUNCTION public.documents_send_executed_email()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.status = 'EXECUTED' AND OLD.status IS DISTINCT FROM 'EXECUTED'
     AND NEW.executed_email_sent_at IS NULL THEN
    BEGIN
      IF NEW.contact_id IS NULL THEN
        -- No contact anchor (multi-party instruments): unchanged single-document path.
        PERFORM send_executed_document_email(NEW.id);
      ELSIF document_delivery_is_held(NEW.id) THEN
        -- Mailing now is exactly what produced one email per document. Hold it;
        -- the end of the run flushes the whole set together.
        UPDATE documents SET delivery_held_at = coalesce(delivery_held_at, now())
         WHERE id = NEW.id;
      ELSE
        PERFORM deliver_executed_document_set(NEW.contact_id, NEW.id);
      END IF;
    EXCEPTION WHEN OTHERS THEN
      -- never let a mail failure roll back an executed instrument; record it
      UPDATE documents SET executed_email_error = SQLERRM WHERE id = NEW.id;
    END;
  END IF;
  RETURN NEW;
END;
$function$;

-- ── 5. the endpoint closes the loop ──────────────────────────────────────────
-- /api/deliver-documents calls this after a successful, non-targeted send: the
-- set it just delivered is stamped, unheld, and the run's hold is released. Without
-- it a client-flushed set would still look "held" and the backstop would mail it
-- a second time.
CREATE OR REPLACE FUNCTION public.mark_document_set_delivered(p_document_ids uuid[])
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE v_n integer;
BEGIN
  IF NOT (coalesce(auth.role(), '') = 'service_role' OR has_staff_access()) THEN
    RAISE EXCEPTION 'not authorized';
  END IF;
  IF p_document_ids IS NULL OR array_length(p_document_ids, 1) IS NULL THEN RETURN 0; END IF;

  WITH upd AS (
    UPDATE documents
       SET executed_email_sent_at = coalesce(executed_email_sent_at, now()),
           delivery_held_at       = NULL,
           executed_email_error   = NULL
     WHERE id = ANY(p_document_ids)
    RETURNING contact_id)
  SELECT count(*) INTO v_n FROM upd;

  UPDATE document_delivery_holds h SET released_at = now()
   WHERE h.released_at IS NULL
     AND (h.contact_id IN (SELECT d.contact_id FROM documents d WHERE d.id = ANY(p_document_ids))
       OR lower(h.email) IN (SELECT lower(c.email) FROM documents d
                               JOIN contacts c ON c.id = d.contact_id
                              WHERE d.id = ANY(p_document_ids) AND c.email IS NOT NULL));
  RETURN v_n;
END;
$function$;

-- ── 6. backstop: a held document is never stranded ───────────────────────────
-- If someone signs three of four documents and walks away, the three signed ones
-- still owe them a copy. Called from /api/delivery-sweep (the existing hourly
-- cron), alongside the undelivered-alert sweep.
CREATE OR REPLACE FUNCTION public.flush_held_executed_document_emails(
  p_hold_minutes integer DEFAULT 30
) RETURNS TABLE(contact_id uuid, documents integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  r     RECORD;
  v_out jsonb;
BEGIN
  IF NOT (coalesce(auth.role(), '') = 'service_role' OR has_staff_access()) THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  -- an abandoned run stops holding anything
  UPDATE document_delivery_holds SET released_at = now()
   WHERE released_at IS NULL
     AND opened_at < now() - make_interval(mins => greatest(p_hold_minutes, 1));

  FOR r IN
    SELECT DISTINCT d.contact_id AS cid
      FROM documents d
     WHERE d.delivery_held_at IS NOT NULL
       AND d.executed_email_sent_at IS NULL
       AND d.deleted_at IS NULL
       AND d.status = 'EXECUTED'
       AND d.contact_id IS NOT NULL
       AND d.delivery_held_at < now() - make_interval(mins => greatest(p_hold_minutes, 1))
  LOOP
    v_out := deliver_executed_document_set(r.cid, NULL);
    IF coalesce((v_out->>'sent')::boolean, false) THEN
      contact_id := r.cid;
      documents  := coalesce((v_out->>'documents')::int, 0);
      RETURN NEXT;
    END IF;
  END LOOP;
END;
$function$;

COMMENT ON FUNCTION public.flush_held_executed_document_emails(integer) IS
  'ONBOARD §4 backstop: deliver document sets that were held for a signature that never '
  'came. Abandoning a signing run must not cost someone the copies of what they DID sign.';

-- ── 7. the member can see the real delivery state (no second sender) ─────────
-- Onboarding.tsx used to POST /api/deliver-documents itself to learn the outcome.
-- With the trigger batching, that POST is a duplicate sender racing the database.
-- It is replaced by this READ: the client polls for the delivery rows the endpoint
-- writes, so the confirmation screen still refuses to claim a delivery that did not
-- happen (the 2026-07-29 truthful-delivery rule) without sending anything itself.
CREATE OR REPLACE FUNCTION public.my_executed_delivery_state()
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_contact uuid;
  v_total   int;
  v_done    int;
  v_held    int;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'authentication required'; END IF;
  v_contact := current_contact_id();
  IF v_contact IS NULL THEN
    RETURN jsonb_build_object('total', 0, 'delivered', 0, 'held', 0);
  END IF;

  SELECT count(*) INTO v_total
    FROM documents d
   WHERE d.contact_id = v_contact AND d.deleted_at IS NULL AND d.status = 'EXECUTED';

  SELECT count(*) INTO v_done
    FROM documents d
   WHERE d.contact_id = v_contact AND d.deleted_at IS NULL AND d.status = 'EXECUTED'
     AND EXISTS (
       SELECT 1 FROM document_deliveries dd
        WHERE dd.document_id = d.id
          AND dd.recipient_contact_id = v_contact
          AND dd.channel = 'EMAIL'
          AND dd.deleted_at IS NULL);

  SELECT count(*) INTO v_held
    FROM documents d
   WHERE d.contact_id = v_contact AND d.deleted_at IS NULL AND d.status = 'EXECUTED'
     AND d.delivery_held_at IS NOT NULL AND d.executed_email_sent_at IS NULL;

  RETURN jsonb_build_object('total', v_total, 'delivered', v_done, 'held', v_held);
END;
$function$;

REVOKE ALL ON FUNCTION public.deliver_executed_document_set(uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.flush_held_executed_document_emails(integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.mark_document_set_delivered(uuid[]) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.open_document_delivery_hold(uuid, uuid, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.flush_held_executed_document_emails(integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.mark_document_set_delivered(uuid[]) TO service_role;
GRANT EXECUTE ON FUNCTION public.open_document_delivery_hold(uuid, uuid, text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.my_executed_delivery_state() TO authenticated;
