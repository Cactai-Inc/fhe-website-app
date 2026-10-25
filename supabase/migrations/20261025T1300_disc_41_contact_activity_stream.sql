-- disc_41 (fix round item 2e): Activity is one dated stream, newest first, each
-- entry linking to its source. Built from document events (sent, viewed, signed,
-- executed, delivered), invitation events (sent, redeemed/account created),
-- bookings, orders, payments, posts, and evaluation records where they exist.
-- Notifications stay their own list (not here). The detailed Upcoming / Past /
-- Orders / standing-slot blocks stay as they are — this is the chronological index
-- beside them, not a replacement.
--
-- Each row is uniform: when it happened, a kind, a one-line title and detail, and
-- the source it links to (source_type + source_id), so the UI builds one link per
-- row without a second read.
--
-- Also removes the unused activity (audit_logs) fetch from contact_dossier — it
-- was fetched and rendered nowhere on the client record.

CREATE OR REPLACE FUNCTION public.contact_activity_stream(p_contact_id uuid, p_limit int DEFAULT 100)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_org  uuid := current_org();
  v_user uuid;
  v_out  jsonb;
BEGIN
  IF NOT has_staff_access() THEN
    RAISE EXCEPTION 'staff access required';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM contacts WHERE id = p_contact_id AND org_id = v_org) THEN
    RAISE EXCEPTION 'contact not found in this organisation';
  END IF;

  SELECT p.user_id INTO v_user FROM profiles p WHERE p.contact_id = p_contact_id;

  WITH ev AS (
    -- ── DOCUMENT: sent ──────────────────────────────────────────────────────
    SELECT d.sent_at AS occurred_at, 'document_sent' AS kind,
           coalesce(d.title, d.display_code, 'Document') AS title,
           'Sent for signature' AS detail, 'document' AS source_type, d.id AS source_id
      FROM documents d
     WHERE d.deleted_at IS NULL AND d.sent_at IS NOT NULL
       AND (d.contact_id = p_contact_id
         OR EXISTS (SELECT 1 FROM document_parties dp WHERE dp.document_id = d.id AND dp.contact_id = p_contact_id))

    -- ── DOCUMENT: viewed ────────────────────────────────────────────────────
    UNION ALL
    SELECT o.opened_at, 'document_viewed',
           coalesce(d.title, d.display_code, 'Document'),
           'Opened' || coalesce(' as ' || nullif(o.opened_label, ''), ''),
           'document', d.id
      FROM document_opened o
      JOIN documents d ON d.id = o.document_id AND d.deleted_at IS NULL
     WHERE o.contact_id = p_contact_id

    -- ── DOCUMENT: signed ────────────────────────────────────────────────────
    UNION ALL
    SELECT s.signed_at, 'document_signed',
           coalesce(d.title, d.display_code, 'Document'),
           'Signed' || coalesce(' as ' || nullif(s.party_role, ''), ''),
           'document', d.id
      FROM signatures s
      JOIN documents d ON d.id = s.document_id AND d.deleted_at IS NULL
     WHERE s.signer_contact_id = p_contact_id AND s.deleted_at IS NULL AND s.signed_at IS NOT NULL

    -- ── DOCUMENT: executed ──────────────────────────────────────────────────
    UNION ALL
    SELECT (d.effective_date::timestamptz), 'document_executed',
           coalesce(d.title, d.display_code, 'Document'),
           'Executed — in force', 'document', d.id
      FROM documents d
     WHERE d.deleted_at IS NULL AND d.status = 'EXECUTED' AND d.effective_date IS NOT NULL
       AND (d.contact_id = p_contact_id
         OR EXISTS (SELECT 1 FROM document_parties dp WHERE dp.document_id = d.id AND dp.contact_id = p_contact_id))

    -- ── DOCUMENT: delivered ─────────────────────────────────────────────────
    UNION ALL
    SELECT dd.delivered_at, 'document_delivered',
           coalesce(d.title, d.display_code, 'Document'),
           'Delivered' || coalesce(' via ' || nullif(dd.channel, ''), ''),
           'document', d.id
      FROM document_deliveries dd
      JOIN documents d ON d.id = dd.document_id AND d.deleted_at IS NULL
     WHERE dd.recipient_contact_id = p_contact_id AND dd.deleted_at IS NULL AND dd.delivered_at IS NOT NULL

    -- ── INVITATION: sent ────────────────────────────────────────────────────
    UNION ALL
    SELECT i.created_at, 'invitation_sent', 'Invitation',
           'Invitation sent', 'invitation', i.id
      FROM invitations i
     WHERE i.contact_id = p_contact_id

    -- ── INVITATION: redeemed (account claimed) ──────────────────────────────
    UNION ALL
    SELECT i.redeemed_at, 'invitation_redeemed', 'Invitation',
           'Redeemed — account created', 'invitation', i.id
      FROM invitations i
     WHERE i.contact_id = p_contact_id AND i.redeemed_at IS NOT NULL

    -- ── BOOKINGS ────────────────────────────────────────────────────────────
    UNION ALL
    SELECT b.created_at, 'booking', coalesce(o.name, 'Session'),
           'Booked for ' || to_char(b.starts_at, 'Mon DD, YYYY'), 'booking', b.id
      FROM bookings b
      LEFT JOIN offerings o ON o.id = b.offering_id
     WHERE b.account_contact_id = p_contact_id

    -- ── ORDERS ──────────────────────────────────────────────────────────────
    UNION ALL
    SELECT pu.created_at, 'order',
           coalesce(pu.display_code, 'Order'),
           'Order placed — $' || to_char(coalesce(pu.amount, 0), 'FM999990.00'),
           'order', pu.id
      FROM purchases pu
     WHERE pu.buyer_contact_id = p_contact_id

    -- ── PAYMENTS ────────────────────────────────────────────────────────────
    UNION ALL
    SELECT pu.paid_at, 'payment',
           coalesce(pu.display_code, 'Order'),
           'Payment received — $' || to_char(coalesce(pu.amount, 0), 'FM999990.00')
             || coalesce(' (' || nullif(pu.payment_method, '') || ')', ''),
           'order', pu.id
      FROM purchases pu
     WHERE pu.buyer_contact_id = p_contact_id AND pu.paid_at IS NOT NULL

    -- ── POSTS (account only) ────────────────────────────────────────────────
    UNION ALL
    SELECT f.created_at, 'post',
           coalesce(nullif(left(f.body, 80), ''), '(' || f.post_type || ')'),
           CASE WHEN f.pulled_down THEN 'Post (pulled down)'
                WHEN f.published THEN 'Post published' ELSE 'Post drafted' END,
           'post', f.id
      FROM feed_posts f
     WHERE v_user IS NOT NULL AND f.author_id = v_user

    -- ── EVALUATION RECORDS, where they exist ────────────────────────────────
    UNION ALL
    SELECT coalesce(e.delivered_at, e.created_at), 'evaluation',
           coalesce(e.title, 'Evaluation'),
           CASE WHEN e.delivered_at IS NOT NULL THEN 'Evaluation delivered' ELSE 'Evaluation created' END
             || coalesce(' — ' || nullif(e.horse_label, ''), ''),
           'evaluation', e.id
      FROM evaluation_reports e
     WHERE e.contact_id = p_contact_id AND e.deleted_at IS NULL
  )
  SELECT coalesce(jsonb_agg(jsonb_build_object(
           'occurred_at', occurred_at, 'kind', kind, 'title', title,
           'detail', detail, 'source_type', source_type, 'source_id', source_id)
           ORDER BY occurred_at DESC), '[]'::jsonb)
    INTO v_out
    FROM (SELECT * FROM ev WHERE occurred_at IS NOT NULL
           ORDER BY occurred_at DESC LIMIT p_limit) s;

  RETURN v_out;
END
$function$;

GRANT EXECUTE ON FUNCTION public.contact_activity_stream(uuid, int) TO authenticated;
