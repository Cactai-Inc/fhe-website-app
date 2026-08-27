-- The board stops being organised by department (owner, 2026-08-26)
--
-- "I dont need a section dedicated to contracts and deals, or anything specific
--  like that, I need to just have visibility over what is happening and what is
--  waiting for a next action by me or a client. Then i need kpi's. Thats it."
--
-- The business view had six domain zones -- money, Claire's plate, deals &
-- contracts, onboarding pipeline, catalog setup, activity. Every one of them
-- answered "what is going on in THIS subsystem", and none of them answered the
-- only question the owner actually asks: WHOSE MOVE IS IT.
--
-- So the department zones collapse into two, split by whose move it is, and one
-- classifier decides. `_waiting_items()` returns every open thread with a `side`
-- of 'you' or 'client'; the two readers are thin filters over it, so a row can
-- never appear on both lists or fall off both.
--
-- ⚠️ NO DISPLAY CODES. Owner, same message, on the card this replaces: "shows an
-- obscure string of characters that are undoubtedly an id number that is
-- completely fucking useless to me". `display_code` is gone from every row here.
-- What a row carries instead is WHO it concerns and WHAT the next act is, which
-- is what a person needs to decide whether to open it.
--
-- ⚠️ AND "YOURS TO SIGN" IS NOW MEASURED, NOT ASSUMED. The B3 zone called a
-- document "Yours to sign" whenever a company party had no signature row --
-- true of a document that has never been sent to anybody. `sent_at IS NULL` and
-- `workflow_state = 'in_review'` now mean "not ready", and the row says so on
-- the correct side: getting it ready is YOUR move, not the client's.

-- ── the classifier ─────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public._waiting_items()
 RETURNS TABLE (
   side       text,
   kind       text,
   id         text,
   title      text,
   who        text,
   detail     text,
   link_kind  text,
   link_id    text,
   since      timestamptz,
   rank       int
 )
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  WITH org AS (SELECT current_org() AS id),
       me  AS (SELECT current_contact_id() AS id, company_contact_id() AS co)

  -- ══ YOUR MOVE ════════════════════════════════════════════════════════════

  -- Money a client says they sent. Confirming it governs whether the lesson
  -- happens (D23) -- the client is already unblocked, so this is purely ours.
  SELECT 'you', 'payment_declared', p.id::text,
         'Confirm ' || to_char(coalesce(p.amount,0), 'FM$999,999') || ' '
           || coalesce(p.client_reported_method, p.payment_method, 'payment'),
         coalesce(nullif(btrim(concat_ws(' ', ct.first_name, ct.last_name)), ''), ct.email),
         'They say it is sent. It is not confirmed.',
         'purchase', p.id::text, coalesce(p.client_reported_at, p.created_at), 1
    FROM purchases p LEFT JOIN contacts ct ON ct.id = p.buyer_contact_id CROSS JOIN org
   WHERE p.org_id = org.id AND p.deleted_at IS NULL
     AND p.client_claim_status = 'pending'

  UNION ALL
  -- Money landed and the client was never told.
  SELECT 'you', 'receipt_failed', rs.id::text,
         'Receipt never reached them', rs.recipient_email,
         left(coalesce(rs.error, 'send failed'), 120),
         'purchase', rs.purchase_id::text, rs.attempted_at, 2
    FROM receipt_sends rs, org
   WHERE rs.org_id = org.id AND NOT rs.succeeded
     AND rs.attempted_at > now() - interval '30 days'
     AND NOT EXISTS (SELECT 1 FROM receipt_sends ok
                      WHERE ok.purchase_id = rs.purchase_id AND ok.succeeded
                        AND ok.attempted_at > rs.attempted_at)

  UNION ALL
  -- D29: a proposal is not true yet and needs an explicit disposition.
  SELECT 'you', 'proposal', a.id::text,
         'Accept or reject a proposed change',
         (SELECT d.title FROM documents d WHERE d.id = a.document_id),
         left(coalesce(a.body, ''), 120),
         'document', a.document_id::text, a.created_at, 3
    FROM contract_addenda a, org
   WHERE a.org_id = org.id AND a.status = 'pending'

  UNION ALL
  SELECT 'you', 'change_open', cr.id::text,
         'An open change on a live document',
         (SELECT d.title FROM documents d WHERE d.id = cr.document_id),
         left(coalesce(cr.body, ''), 120),
         'document', cr.document_id::text, coalesce(cr.submitted_at, cr.created_at), 3
    FROM contract_change_requests cr, org
   WHERE cr.org_id = org.id AND cr.resolved_at IS NULL AND cr.submitted_at IS NOT NULL

  UNION ALL
  -- ⚠️ A DOCUMENT NOBODY HAS BEEN SENT IS YOUR MOVE, NOT THEIRS. This is the
  -- row that used to read "Yours to sign" on a document that was never sent.
  SELECT 'you', 'doc_not_sent', d.id::text,
         'Not sent to anyone yet',
         d.title,
         CASE WHEN coalesce(d.workflow_state,'') = 'in_review'
              THEN 'Still in review — finish it and send it'
              ELSE 'Ready to go out' END,
         'document', d.id::text, coalesce(d.generated_at, d.created_at), 4
    FROM documents d, org
   WHERE d.org_id = org.id AND d.deleted_at IS NULL
     AND d.status = 'AWAITING_SIGNATURE' AND d.sent_at IS NULL

  UNION ALL
  -- Genuinely yours to sign: it HAS gone out, and the signature missing is ours.
  SELECT 'you', 'doc_to_sign', d.id::text,
         'Yours to sign', d.title,
         'Everyone else is waiting on your signature',
         'document', d.id::text, coalesce(d.sent_at, d.generated_at, d.created_at), 1
    FROM documents d, org, me
   WHERE d.org_id = org.id AND d.deleted_at IS NULL
     AND d.status = 'AWAITING_SIGNATURE' AND d.sent_at IS NOT NULL
     AND EXISTS (SELECT 1 FROM document_parties dp
                  WHERE dp.document_id = d.id AND dp.is_signer
                    AND (dp.contact_id = me.id OR (me.co IS NOT NULL AND dp.contact_id = me.co))
                    AND NOT EXISTS (SELECT 1 FROM signatures sg
                                     WHERE sg.document_id = d.id AND sg.deleted_at IS NULL
                                       AND sg.signer_contact_id = dp.contact_id))

  UNION ALL
  -- An invitation that failed to send is a person who never heard from us.
  SELECT 'you', 'invite_failed', i.id::text,
         'Invitation never sent',
         coalesce(nullif(btrim(concat_ws(' ', i.first_name, i.last_name)), ''), i.email),
         left(coalesce(i.failure_reason, 'send failed'), 120),
         'contact', i.contact_id::text, i.created_at, 2
    FROM invitations i, org
   WHERE i.org_id = org.id AND i.deleted_at IS NULL
     AND i.failure_reason IS NOT NULL AND i.redeemed_at IS NULL
     AND i.status NOT IN ('superseded', 'revoked')

  UNION ALL
  -- A deal wanting something that is not a signable document (see the B3 rule).
  SELECT 'you', 'deal_open', dl.id::text,
         CASE WHEN deal_governing_document(dl.id) IS NULL
              THEN 'Nothing drafted for this deal yet'
              WHEN (deal_status(dl.id) ->> 'code') = 'complete'
              THEN 'Signed by everyone — ready to close'
              ELSE 'This deal needs a party named' END,
         coalesce(dl.title, dl.deal_type),
         NULL,
         'deal', dl.id::text, dl.created_at, 5
    FROM deals dl, org
   WHERE dl.org_id = org.id AND dl.deleted_at IS NULL AND dl.status <> 'complete'
     AND (
       deal_governing_document(dl.id) IS NULL
       OR (deal_status(dl.id) ->> 'code') = 'complete'
       OR NOT EXISTS (SELECT 1 FROM contract_parties cp
                       WHERE cp.contract_id = dl.contract_id
                         AND cp.party_role = (deal_party_roles(dl.deal_type))[1])
       OR NOT EXISTS (SELECT 1 FROM contract_parties cp
                       WHERE cp.contract_id = dl.contract_id
                         AND cp.party_role = (deal_party_roles(dl.deal_type))[2])
     )

  UNION ALL
  -- Catalog gaps, but ONLY the ones that stop money: a service nobody can buy.
  -- Cover images and staff titles are tidiness, not a next action, and they are
  -- what made the old zone nine rows long.
  SELECT 'you', 'blocks_selling', st.code,
         'Nothing is buyable under ' || st.display_name, NULL,
         'No active offering, so the service cannot be sold',
         'catalog', NULL, now(), 6
    FROM service_types st, org
   WHERE st.active AND st.code NOT IN ('INDEPENDENT_CONTRACTOR', 'ONBOARDING')
     AND NOT EXISTS (SELECT 1 FROM offerings o
                      WHERE o.org_id = org.id AND o.active AND o.service_type = st.code)

  -- ══ THEIR MOVE ═══════════════════════════════════════════════════════════

  UNION ALL
  -- Out for signature, and the signature missing is theirs.
  SELECT 'client', 'awaiting_signature', d.id::text,
         'Waiting on their signature', d.title,
         NULL,
         'document', d.id::text, coalesce(d.sent_at, d.generated_at, d.created_at), 1
    FROM documents d, org, me
   WHERE d.org_id = org.id AND d.deleted_at IS NULL
     AND d.status = 'AWAITING_SIGNATURE' AND d.sent_at IS NOT NULL
     AND EXISTS (SELECT 1 FROM document_parties dp
                  WHERE dp.document_id = d.id AND dp.is_signer
                    AND dp.contact_id IS DISTINCT FROM me.id
                    AND (me.co IS NULL OR dp.contact_id IS DISTINCT FROM me.co)
                    AND NOT EXISTS (SELECT 1 FROM signatures sg
                                     WHERE sg.document_id = d.id AND sg.deleted_at IS NULL
                                       AND sg.signer_contact_id = dp.contact_id))

  UNION ALL
  -- Invited and has not come in yet.
  SELECT 'client', 'invite_open', i.id::text,
         'Invited, has not opened it',
         coalesce(nullif(btrim(concat_ws(' ', i.first_name, i.last_name)), ''), i.email),
         CASE WHEN i.expires_at IS NOT NULL
              THEN 'Link expires ' || to_char(i.expires_at, 'Mon FMDD') END,
         'contact', i.contact_id::text, i.created_at, 2
    FROM invitations i, org
   WHERE i.org_id = org.id AND i.deleted_at IS NULL
     AND i.status = 'sent' AND i.redeemed_at IS NULL

  UNION ALL
  -- D8 §3 PENDING: in, but their paperwork is not done.
  SELECT 'client', 'account_pending', p.user_id::text,
         'Paperwork not finished',
         coalesce(p.display_name, nullif(btrim(concat_ws(' ', p.first_name, p.last_name)), ''), p.email),
         (SELECT count(*)::text FROM contact_required_documents crd
           WHERE crd.contact_id = p.contact_id AND crd.org_id = org.id
             AND crd.skipped_at IS NULL
             AND NOT contact_document_satisfied(p.contact_id, crd.template_key))
           || ' document(s) still unsigned',
         'contact', p.contact_id::text, p.created_at, 3
    FROM profiles p, org
   WHERE p.org_id = org.id AND coalesce(p.role, 'USER') = 'USER'
     AND p.contact_id IS NOT NULL
     AND EXISTS (SELECT 1 FROM contact_required_documents crd
                  WHERE crd.contact_id = p.contact_id AND crd.org_id = org.id
                    AND crd.skipped_at IS NULL
                    AND NOT contact_document_satisfied(p.contact_id, crd.template_key))

  UNION ALL
  -- Ordered, not paid, and old enough that it is no longer simply new.
  SELECT 'client', 'unpaid_aging', p.id::text,
         'Unpaid ' || to_char(coalesce(p.amount,0), 'FM$999,999'),
         coalesce(nullif(btrim(concat_ws(' ', ct.first_name, ct.last_name)), ''), ct.email),
         'Ordered, never paid',
         'purchase', p.id::text, p.created_at, 4
    FROM purchases p LEFT JOIN contacts ct ON ct.id = p.buyer_contact_id CROSS JOIN org
   WHERE p.org_id = org.id AND p.deleted_at IS NULL
     AND p.payment_status <> 'paid' AND p.status <> 'draft'
     AND coalesce(p.client_claim_status, 'none') <> 'pending'
     AND p.created_at < now() - interval '7 days'
$function$;

-- ── the two readers ────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.dash_waiting_on_you()
 RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE v_rows jsonb;
BEGIN
  IF NOT coalesce(has_staff_access(), false) THEN
    RAISE EXCEPTION 'operator access required';
  END IF;
  SELECT coalesce(jsonb_agg(to_jsonb(w) - 'side' ORDER BY w.rank, w.since), '[]'::jsonb)
    INTO v_rows FROM _waiting_items() w WHERE w.side = 'you';
  RETURN jsonb_build_object('count', jsonb_array_length(v_rows), 'items', v_rows);
END;
$function$;

CREATE OR REPLACE FUNCTION public.dash_waiting_on_clients()
 RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE v_rows jsonb;
BEGIN
  IF NOT coalesce(has_staff_access(), false) THEN
    RAISE EXCEPTION 'operator access required';
  END IF;
  SELECT coalesce(jsonb_agg(to_jsonb(w) - 'side' ORDER BY w.rank, w.since), '[]'::jsonb)
    INTO v_rows FROM _waiting_items() w WHERE w.side = 'client';
  RETURN jsonb_build_object('count', jsonb_array_length(v_rows), 'items', v_rows);
END;
$function$;

REVOKE ALL ON FUNCTION public._waiting_items() FROM public, anon;
REVOKE ALL ON FUNCTION public.dash_waiting_on_you() FROM public, anon;
REVOKE ALL ON FUNCTION public.dash_waiting_on_clients() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.dash_waiting_on_you() TO authenticated;
GRANT EXECUTE ON FUNCTION public.dash_waiting_on_clients() TO authenticated;
