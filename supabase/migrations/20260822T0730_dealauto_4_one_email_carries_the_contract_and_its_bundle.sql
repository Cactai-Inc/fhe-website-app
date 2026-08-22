-- DEALAUTO §3 — one email carries the executed contract AND every bundle
-- document, through the delivery path that already exists.
--
-- Owner, 2026-08-22: "the whole document set, contract + bundle are sent in one
-- email and captured as a deal."
--
-- NOTHING NEW IS BUILT. `deliver_executed_document_set` already batches many
-- documents into one `/api/deliver-documents` call, and that endpoint already
-- renders every document once and sends each recipient a single email with all
-- the PDFs (D25, proven). The hold machinery
-- (`document_delivery_is_held` -> `delivery_held_at` -> flush) already exists
-- for exactly this purpose. Two gaps, both in WHAT counts as "still
-- outstanding", and both closed here.
--
-- WHAT DECIDES THE SEND — and why it is neither of the two candidates the task
-- offered. It is NOT `deal_completion_state`'s `can_complete`: that gates on
-- the governing document alone (owner ruling, and correctly so), which means it
-- is satisfied the instant the lease executes — the exact moment the bundle
-- does not yet exist. Using it would send the contract alone and leave the
-- bundle to a second email, which is the behaviour being removed. Nor is it
-- "the bundle for a given party is complete", because delivery is not
-- per-party: the endpoint groups by recipient across a document SET, so the
-- unit has to be a set. The unit is therefore **the contract's signing set** —
-- every document on the contract carrying a `sign_sequence`. When none of them
-- is still awaiting a signature, the deal's paperwork is finished and it goes
-- out as one email. `sign_sequence IS NOT NULL` is load-bearing: it counts the
-- sequenced set and ignores an unrelated draft parked on the same contract,
-- so the hold cannot become open-ended for a document nobody is waiting on.

-- ── gap 1: the hold was contact-scoped, and the bundle may not be theirs ────
-- Rule (a) holds a contact's executed document while that CONTACT still has
-- paperwork in front of them. On a two-party contract that is the wrong axis:
-- the lease's anchor contact is the lessee, so a LESSOR bundle still awaiting
-- signature does not hold the lease, and the lease mails immediately — the two
-- separate emails, again. Rule (c) below holds on the axis the owner named:
-- the contract.
CREATE OR REPLACE FUNCTION public.document_delivery_is_held(p_document_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_contact  uuid;
  v_email    text;
  v_contract uuid;
BEGIN
  SELECT d.contact_id, d.contract_id INTO v_contact, v_contract
    FROM documents d WHERE d.id = p_document_id;

  -- (c) DEALAUTO: the contract's sequenced set is not finished. Checked before
  -- the contact rules because it does not need a contact anchor at all — a
  -- multi-party instrument with contact_id NULL is held by this too.
  IF v_contract IS NOT NULL AND EXISTS (
    SELECT 1 FROM documents d2
     WHERE d2.contract_id = v_contract
       AND d2.id <> p_document_id
       AND d2.deleted_at IS NULL
       AND d2.sign_sequence IS NOT NULL
       AND d2.status NOT IN ('EXECUTED', 'VOID')
       AND coalesce(d2.workflow_state, '') <> 'void'
  ) THEN
    RETURN true;
  END IF;

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

-- ── gap 1b: a multi-party instrument skipped the hold entirely ──────────────
-- `documents_send_executed_email` sent a contact_id-less document immediately
-- via the single-document path, without ever consulting the hold. With rule (c)
-- there is now a reason to hold such a document, so it must be asked. When it
-- is not held, the single-document path is unchanged.
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
      IF document_delivery_is_held(NEW.id) THEN
        -- Mailing now is exactly what produced one email per document. Hold it;
        -- the end of the run flushes the whole set together.
        UPDATE documents SET delivery_held_at = coalesce(delivery_held_at, now())
         WHERE id = NEW.id;
      ELSIF NEW.contact_id IS NULL THEN
        -- No contact anchor (multi-party instruments): unchanged single-document path.
        PERFORM send_executed_document_email(NEW.id);
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

-- ── gap 2: the flush was contact-scoped too ─────────────────────────────────
-- When the LAST document of the set executes, the flush runs against that
-- document's own anchor contact. The lease, held under a different anchor, was
-- not in the batch — so it would have gone out later, alone, from the hourly
-- sweep. That is the second email, moved rather than removed.
--
-- The selection now reaches across the contract: whenever a document being
-- delivered belongs to a contract, every other undelivered executed document of
-- that same contract joins the same batch, and the endpoint attaches them all
-- to the one email. `p_include`/`delivery_held_at` still bound the set, so
-- nothing already delivered is re-sent and nothing unheld is swept in.
--
-- ⚠️ FLAGGED, NOT DECIDED HERE: the endpoint's untargeted mode sends ALL the
-- attachments to the union of ALL the documents' parties. On a contract where
-- both parties owe a bundle, each therefore receives the other's signed release
-- as well as the shared contract. That follows the owner's wording ("the whole
-- document set... sent in one email") and matches how `deal_detail` already
-- exposes every document on a contract to every contract party — but it is a
-- disclosure decision, not a technical one, and it is raised in the report.
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

-- ── the sweep is the backstop for rule (c) ──────────────────────────────────
-- Rule (c) can hold indefinitely if a party simply never signs their bundle.
-- That is the same open-endedness rule (a) has always had, and it already has
-- an answer: flush_held_executed_document_emails, run hourly by
-- /api/delivery-sweep (vercel.json), releases anything held longer than its
-- window. A document held under rule (c) with NO contact anchor was invisible
-- to that loop (`d.contact_id IS NOT NULL`), which would have stranded a
-- multi-party instrument forever. It now falls back to the single-document
-- path, which is exactly what it used to get before rule (c) existed.
CREATE OR REPLACE FUNCTION public.flush_held_executed_document_emails(p_hold_minutes integer DEFAULT 30)
 RETURNS TABLE(contact_id uuid, documents integer)
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

  -- DEALAUTO: an anchor-less document held by rule (c) has no contact to batch
  -- under. Send it on its own rather than leave it held for good.
  FOR r IN
    SELECT d.id AS did
      FROM documents d
     WHERE d.delivery_held_at IS NOT NULL
       AND d.executed_email_sent_at IS NULL
       AND d.deleted_at IS NULL
       AND d.status = 'EXECUTED'
       AND d.contact_id IS NULL
       AND d.delivery_held_at < now() - make_interval(mins => greatest(p_hold_minutes, 1))
  LOOP
    v_out := send_executed_document_email(r.did);
    IF coalesce((v_out->>'sent')::boolean, false) THEN
      UPDATE documents SET delivery_held_at = NULL WHERE id = r.did;
      contact_id := NULL;
      documents  := 1;
      RETURN NEXT;
    END IF;
  END LOOP;
END;
$function$;
