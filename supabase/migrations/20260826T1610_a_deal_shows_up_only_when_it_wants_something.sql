-- Deals & contracts picks ONE row per thing (owner, 2026-08-26)
--
-- "the deals and contracts section needs to pick only one I dont need to see the
--  deal unless there is something to do for it that isnt involving a signable
--  document like a contract, in the case of the deal with pamela i just need to
--  monitor the contract for her signature. I'm not sure what this section is
--  intended to do for me as a business owner."
--
-- The zone listed EVERY deal with status <> 'complete', unconditionally, beside
-- the documents belonging to those same deals. Pamela's lease was therefore two
-- cards for one fact: "Horse Lease Agreement — Standard · Yours to sign" and
-- "LEASE · FHE-000042 · Deal in motion" -- the document row and the envelope
-- around it, linked by documents.contract_id = deals.contract_id.
--
-- THE RULE: a deal earns a row only when it is waiting on something that is NOT
-- the signable document already listed here. The reasons are the ones
-- `deal_completion_state` already computes, so the two surfaces cannot drift:
--
--   * a party has not been named yet              -> SHOW ("No lessee named")
--   * no governing document has been started      -> SHOW
--   * the document exists but was never sent      -> SHOW
--   * everyone has signed, the deal is still open -> SHOW ("ready to close")
--   * the document is out for signature, or has
--     an open proposal or change request          -> HIDE. It is its own row.
--
-- AND THE ROW NOW SAYS WHY. "Deal in motion" told the owner nothing, which is
-- what prompted "I'm not sure what this section is intended to do for me": the
-- reason goes in `detail`, so a deal card is always a thing to act on.

CREATE OR REPLACE FUNCTION public.dash_deals_contracts()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_org  uuid := current_org();
  v_me   uuid := current_contact_id();
  v_co   uuid := company_contact_id();
  v_rows jsonb;
BEGIN
  IF NOT coalesce(has_staff_access(), false) THEN
    RAISE EXCEPTION 'operator access required';
  END IF;

  SELECT coalesce(jsonb_agg(x ORDER BY (x->>'rank')::int, (x->>'since')::timestamptz), '[]'::jsonb)
    INTO v_rows
  FROM (
    -- D29: a PROPOSAL is not true yet and needs an explicit disposition.
    SELECT jsonb_build_object(
             'kind',        'proposal',
             'id',          a.id,
             'document_id', a.document_id,
             'title',       (SELECT d.title FROM documents d WHERE d.id = a.document_id),
             'detail',      left(coalesce(a.body, ''), 160),
             'who',         a.proposed_by_role,
             'since',       a.created_at,
             'rank',        1) AS x
      FROM contract_addenda a
     WHERE a.org_id = v_org AND a.status = 'pending'

    UNION ALL
    -- D29: a CHANGE is already true and is approved by being seen — but an
    -- unresolved one is still an open thread on a live instrument.
    SELECT jsonb_build_object(
             'kind',        'change_request',
             'id',          cr.id,
             'document_id', cr.document_id,
             'title',       (SELECT d.title FROM documents d WHERE d.id = cr.document_id),
             'detail',      left(coalesce(cr.body, ''), 160),
             'who',         cr.author_label,
             'since',       coalesce(cr.submitted_at, cr.created_at),
             'rank',        2)
      FROM contract_change_requests cr
     WHERE cr.org_id = v_org AND cr.resolved_at IS NULL
       AND cr.submitted_at IS NOT NULL

    UNION ALL
    SELECT jsonb_build_object(
             'kind',         'awaiting_signature',
             'id',           d.id,
             'document_id',  d.id,
             'title',        d.title,
             'display_code', d.display_code,
             'since',        coalesce(d.sent_at, d.generated_at, d.created_at),
             'age_days',     floor(extract(epoch FROM now() - coalesce(d.sent_at, d.generated_at, d.created_at)) / 86400)::int,
             'mine_to_sign', EXISTS (
                 SELECT 1 FROM document_parties dp
                  WHERE dp.document_id = d.id AND dp.is_signer
                    AND (dp.contact_id = v_me OR (v_co IS NOT NULL AND dp.contact_id = v_co))
                    AND NOT EXISTS (SELECT 1 FROM signatures sg
                                     WHERE sg.document_id = d.id
                                       AND sg.deleted_at IS NULL
                                       AND sg.signer_contact_id = dp.contact_id)),
             'rank',         3)
      FROM documents d
     WHERE d.org_id = v_org AND d.deleted_at IS NULL
       AND d.status = 'AWAITING_SIGNATURE'

    UNION ALL
    -- ⚠️ ONLY THE DEALS THAT WANT SOMETHING THIS ZONE IS NOT ALREADY SAYING.
    SELECT jsonb_build_object(
             'kind',         'deal_open',
             'id',           q.id,
             'deal_id',      q.id,
             'title',        q.title,
             'display_code', q.display_code,
             'deal_type',    q.deal_type,
             'status',       q.status,
             'detail',       array_to_string(q.reasons, ' · '),
             'since',        q.created_at,
             'age_days',     floor(extract(epoch FROM now() - q.created_at) / 86400)::int,
             'rank',         4)
      FROM (
        SELECT dl.id, coalesce(dl.title, dl.deal_type) AS title, dl.display_code,
               dl.deal_type, dl.status, dl.created_at,
               array_remove(ARRAY[
                 CASE WHEN NOT EXISTS (
                        SELECT 1 FROM contract_parties cp
                         WHERE cp.contract_id = dl.contract_id
                           AND cp.party_role = (deal_party_roles(dl.deal_type))[1])
                      THEN 'No ' || lower(initcap((deal_party_roles(dl.deal_type))[1])) || ' named' END,
                 CASE WHEN NOT EXISTS (
                        SELECT 1 FROM contract_parties cp
                         WHERE cp.contract_id = dl.contract_id
                           AND cp.party_role = (deal_party_roles(dl.deal_type))[2])
                      THEN 'No ' || lower(initcap((deal_party_roles(dl.deal_type))[2])) || ' named' END,
                 CASE
                   -- nothing opened yet
                   WHEN deal_governing_document(dl.id) IS NULL
                     THEN CASE dl.deal_type WHEN 'SALE' THEN 'No bill of sale started'
                                            ELSE 'No lease agreement started' END
                   -- everyone signed and it is still sitting open: closing it is
                   -- a real act, and not one any document row performs.
                   WHEN (deal_status(dl.id) ->> 'code') = 'complete'
                     THEN 'Signed by everyone — ready to close'
                   -- ⚠️ THE DOCUMENT IS ALREADY A ROW IN THIS ZONE. Say nothing.
                   WHEN EXISTS (SELECT 1 FROM documents d
                                 WHERE d.id = deal_governing_document(dl.id)
                                   AND d.status = 'AWAITING_SIGNATURE')
                     OR EXISTS (SELECT 1 FROM contract_addenda a
                                 WHERE a.document_id = deal_governing_document(dl.id)
                                   AND a.status = 'pending')
                     OR EXISTS (SELECT 1 FROM contract_change_requests cr
                                 WHERE cr.document_id = deal_governing_document(dl.id)
                                   AND cr.resolved_at IS NULL AND cr.submitted_at IS NOT NULL)
                     THEN NULL
                   ELSE 'Not sent for signature yet'
                 END
               ], NULL) AS reasons
          FROM deals dl
         WHERE dl.org_id = v_org AND dl.deleted_at IS NULL
           AND dl.status <> 'complete'
      ) q
     WHERE coalesce(array_length(q.reasons, 1), 0) > 0
  ) s;

  RETURN jsonb_build_object('count', jsonb_array_length(v_rows), 'items', v_rows);
END;
$function$;
