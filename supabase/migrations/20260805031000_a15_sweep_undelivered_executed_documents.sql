/*
  A15 — truthful monitoring, part 2: sweep + alert for silently-failed delivery.

  documents.executed_email_error is set only by send_executed_document_email's
  own exception path (sync failures at/before queue time) — async failures
  (HTTP error, endpoint crash, SMTP reject inside /api/deliver-documents) never
  reach it; the stamp is written regardless of what happens after the
  net.http_post fires. The durable success signal is document_deliveries: the
  endpoint inserts a row per recipient ONLY after sendViaProvider returns ok.
  Stamp set + a party with no delivery row = something failed downstream.

  REUSE, not extend/replace: undelivered_executed_documents() (2026-08-04) is
  called here as the candidate generator, unmodified. Its shape (document_id +
  missing_recipients count) already matches what a document-level check needs;
  it is called with p_grace_minutes := 0 so its own updated_at-based grace never
  excludes a real candidate — this sweep applies its OWN, more precise gate
  (executed_email_sent_at, the actual send-attempt timestamp) on top, which is
  the timing signal the locked design specifies. A generous p_limit (500, well
  above the 39-document backlog found at A8 audit time) avoids truncation; nothing
  in current volume approaches it.

  Per candidate this sweep additionally requires, beyond the finder's own
  filter:
   - executed_email_sent_at IS NOT NULL (docs stamped before the trigger
     existed have a NULL stamp and must NOT alert — this is what makes "no
     delivery" mean "the send was attempted and something downstream failed"
     rather than "email was never queued at all", which is a different, already
     known condition);
   - executed_email_sent_at < now() - interval '10 minutes' (the locked design's
     grace window, independent of undelivered_executed_documents()'s own
     updated_at-based grace, called with 0 above so it never double-gates);
   - executed_email_error IS NULL (the sweep's own idempotency: once alerted,
     the column carries the alert marker and is skipped forever after — the
     column is free for this because async failures never populate it).

  Minor exclusion: undelivered_executed_documents() joins document_parties to
  contacts requiring a non-empty contacts.email. The C10 guard trigger
  (20260804150000_minor_delivery_guard.sql) makes it a hard invariant that a
  minor contact never carries a direct email — so this join transitively
  excludes EVERY minor party from the missing-recipient set, both the
  guardian-addressed ones (delivered under the minor's own contact_id per C10 —
  correctly not "missing") and the no-guardian-skipped ones (never delivered,
  but already alerted once via notify_minor_delivery_skipped at send time —
  counting them here would double-alert). No extra minor-specific filtering is
  needed in this migration; it falls out of the email-non-empty join already in
  the reused finder.

  True mailbox-level bounces (SMTP accepted, bounced later) are OUT OF SCOPE —
  Gmail SMTP gives no webhook to observe them. Known limitation, not built.
*/
CREATE OR REPLACE FUNCTION public.sweep_undelivered_executed_documents(
  p_limit integer DEFAULT 500)
RETURNS TABLE(document_id uuid, org_id uuid, missing_count bigint, notified boolean)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  r RECORD;
  v_doc documents%ROWTYPE;
  v_names text;
  v_link text;
BEGIN
  FOR r IN
    SELECT u.document_id, u.missing_recipients
    FROM undelivered_executed_documents(p_limit, 0) u
  LOOP
    SELECT * INTO v_doc FROM documents WHERE id = r.document_id AND deleted_at IS NULL;
    IF NOT FOUND THEN CONTINUE; END IF;

    -- only genuinely-stamped-but-undelivered docs alert (stamp NULL = email
    -- was never queued at all — a different, already-known condition).
    IF v_doc.executed_email_sent_at IS NULL THEN CONTINUE; END IF;
    IF v_doc.executed_email_sent_at >= now() - interval '10 minutes' THEN CONTINUE; END IF;
    -- already alerted once for this document — never repeat.
    IF v_doc.executed_email_error IS NOT NULL THEN CONTINUE; END IF;

    -- recompute the missing-recipient names with the identical join predicate
    -- the finder used for its count, for a title that names who is missing.
    SELECT string_agg(
             coalesce(nullif(btrim(coalesce(c.first_name,'') || ' ' || coalesce(c.last_name,'')), ''), c.email)
               || ' (' || dp.party_role || ')',
             ', ' ORDER BY c.first_name)
      INTO v_names
      FROM document_parties dp
      JOIN contacts c ON c.id = dp.contact_id AND coalesce(btrim(c.email), '') <> ''
      LEFT JOIN document_deliveries dd
             ON dd.document_id = dp.document_id
            AND dd.recipient_contact_id = dp.contact_id
            AND dd.channel = 'EMAIL'
            AND dd.deleted_at IS NULL
     WHERE dp.document_id = v_doc.id
       AND dd.id IS NULL;

    IF coalesce(btrim(v_names), '') = '' THEN CONTINUE; END IF; -- recompute found nothing (race) — skip, don't alert on stale data

    v_link := '/app/ops/documents/' || v_doc.id;
    PERFORM notify_staff(
      v_doc.org_id, 'delivery_failure',
      coalesce(v_doc.title, 'Document') ||
        coalesce(' (' || v_doc.display_code || ')', '') ||
        ' — delivery failed for: ' || v_names,
      v_link);

    UPDATE documents
       SET executed_email_error = 'ALERT RAISED ' || now()::text || ': no delivery for ' || v_names
     WHERE id = v_doc.id;

    document_id := v_doc.id;
    org_id := v_doc.org_id;
    missing_count := r.missing_recipients;
    notified := true;
    RETURN NEXT;
  END LOOP;
END;
$function$;

REVOKE ALL ON FUNCTION public.sweep_undelivered_executed_documents(integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.sweep_undelivered_executed_documents(integer) TO service_role;
