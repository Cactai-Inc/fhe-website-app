-- DASHBOARDBUILD §3 — CJ's dashboard: the business desk, same envelope.
--
-- Same contract as the trainer readers: { "count": n, "items": [ … ] }, count is
-- the true total, a zero count means the zone does not render, and no URL is
-- built in SQL.
--
-- B2 IS THE ONE THAT MATTERS ARCHITECTURALLY. The plan says the mirror reads
-- "same zone readers, aggregated" — so `dash_claires_plate()` CALLS
-- `dash_money_waiting()`, `dash_people_waiting()` and `dash_notes_loop()`
-- instead of re-deriving their numbers. That is D18 applied to a dashboard: two
-- surfaces showing the same fact must be reading the same function, or they will
-- eventually show different facts and the barn will believe the wrong one.
--
-- And the mirror is SELECTIVE, per the plan's own rule: money items and SLA
-- breaches mirror; her routine execution does not, unless it has gone overdue.
-- A second pair of eyes on the money is help. A second pair of eyes on whether
-- she has written up Tuesday's lesson is surveillance, and the plan says so.

-- ── B1 · MONEY HEALTH (the zone under the revenue KPI) ──────────────────────
-- Revenue itself is `revenue_summary` (migration 1) and is a KPI, not a list.
-- What belongs in a LIST is the money that has not landed: declared and
-- unconfirmed, unpaid and ageing, and receipts that failed to send.
CREATE OR REPLACE FUNCTION public.dash_money_health()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_org  uuid := current_org();
  v_rows jsonb;
BEGIN
  IF NOT coalesce(has_staff_access(), false) THEN
    RAISE EXCEPTION 'operator access required';
  END IF;

  SELECT coalesce(jsonb_agg(x ORDER BY (x->>'rank')::int, (x->>'since')::timestamptz), '[]'::jsonb)
    INTO v_rows
  FROM (
    SELECT jsonb_build_object(
             'kind',         'declared',
             'id',           p.id,
             'purchase_id',  p.id,
             'display_code', p.display_code,
             'amount',       coalesce(p.amount, 0),
             'who',          coalesce(nullif(btrim(concat_ws(' ', ct.first_name, ct.last_name)), ''), ct.email),
             'method',       coalesce(p.client_reported_method, p.payment_method),
             'since',        coalesce(p.client_reported_at, p.created_at),
             'age_days',     floor(extract(epoch FROM now() - coalesce(p.client_reported_at, p.created_at)) / 86400)::int,
             'rank',         1) AS x
      FROM purchases p
      LEFT JOIN contacts ct ON ct.id = p.buyer_contact_id
     WHERE p.org_id = v_org AND p.deleted_at IS NULL
       AND p.client_claim_status = 'pending'

    UNION ALL
    -- Unpaid and ageing: a week is the line, because below it the order is
    -- simply new and there is nothing to chase.
    SELECT jsonb_build_object(
             'kind',         'unpaid_aging',
             'id',           p.id,
             'purchase_id',  p.id,
             'display_code', p.display_code,
             'amount',       coalesce(p.amount, 0),
             'who',          coalesce(nullif(btrim(concat_ws(' ', ct.first_name, ct.last_name)), ''), ct.email),
             'since',        p.created_at,
             'age_days',     floor(extract(epoch FROM now() - p.created_at) / 86400)::int,
             'rank',         2)
      FROM purchases p
      LEFT JOIN contacts ct ON ct.id = p.buyer_contact_id
     WHERE p.org_id = v_org AND p.deleted_at IS NULL
       AND p.payment_status <> 'paid' AND p.status <> 'draft'
       AND coalesce(p.client_claim_status, 'none') <> 'pending'
       AND p.created_at < now() - interval '7 days'

    UNION ALL
    -- A receipt is provable and single (`receipt_sends`, one row per attempt).
    -- A failed one is money that landed and a client who was never told.
    SELECT jsonb_build_object(
             'kind',        'receipt_failed',
             'id',          rs.id,
             'purchase_id', rs.purchase_id,
             'who',         rs.recipient_email,
             'detail',      left(coalesce(rs.error, 'send failed'), 160),
             'since',       rs.attempted_at,
             'age_days',    floor(extract(epoch FROM now() - rs.attempted_at) / 86400)::int,
             'rank',        3)
      FROM receipt_sends rs
     WHERE rs.org_id = v_org AND NOT rs.succeeded
       AND rs.attempted_at > now() - interval '30 days'
       AND NOT EXISTS (SELECT 1 FROM receipt_sends ok
                        WHERE ok.purchase_id = rs.purchase_id AND ok.succeeded
                          AND ok.attempted_at > rs.attempted_at)
  ) s;

  RETURN jsonb_build_object('count', jsonb_array_length(v_rows), 'items', v_rows);
END;
$function$;

-- ── B2 · CLAIRE'S PLATE (the selective mirror) ──────────────────────────────
CREATE OR REPLACE FUNCTION public.dash_claires_plate()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_money   jsonb;
  v_people  jsonb;
  v_notes   jsonb;
  v_rows    jsonb := '[]'::jsonb;
  v_overdue integer;
BEGIN
  IF NOT coalesce(has_staff_access(), false) THEN
    RAISE EXCEPTION 'operator access required';
  END IF;

  v_money  := dash_money_waiting();
  v_people := dash_people_waiting();
  v_notes  := dash_notes_loop();

  -- MONEY MIRRORS, always.
  IF (v_money->>'count')::int > 0 THEN
    v_rows := v_rows || jsonb_build_array(jsonb_build_object(
      'kind',   'money',
      'label',  'orders awaiting payment or confirmation',
      'count',  (v_money->>'count')::int,
      'oldest_days', coalesce((SELECT max((i->>'age_days')::int)
                                 FROM jsonb_array_elements(v_money->'items') i), 0),
      'amount', coalesce((SELECT sum((i->>'amount')::numeric)
                            FROM jsonb_array_elements(v_money->'items') i), 0),
      'breach', false));
  END IF;

  -- A PERSON WAITING MIRRORS, and past 24 hours it is an SLA breach rather than
  -- a queue length. The barn answers people the same day or it does not.
  IF (v_people->>'count')::int > 0 THEN
    v_rows := v_rows || jsonb_build_array(jsonb_build_object(
      'kind',   'people',
      'label',  'people waiting on a reply',
      'count',  (v_people->>'count')::int,
      'oldest_hours', coalesce((SELECT max((i->>'age_hours')::int)
                                  FROM jsonb_array_elements(v_people->'items') i), 0),
      'breach', coalesce((SELECT max((i->>'age_hours')::int)
                            FROM jsonb_array_elements(v_people->'items') i), 0) > 24));
  END IF;

  -- ROUTINE EXECUTION DOES NOT MIRROR — UNLESS OVERDUE. A lesson written up
  -- three days late is the barn's problem; one written up this afternoon is
  -- Claire's own workflow and is none of this dashboard's business.
  SELECT count(*) INTO v_overdue
    FROM jsonb_array_elements(v_notes->'items') i
   WHERE i->>'kind' = 'write_up' AND (i->>'age_days')::int >= 3;

  IF v_overdue > 0 THEN
    v_rows := v_rows || jsonb_build_array(jsonb_build_object(
      'kind',   'notes_overdue',
      'label',  'sessions written up more than three days late',
      'count',  v_overdue,
      'breach', true));
  END IF;

  RETURN jsonb_build_object('count', jsonb_array_length(v_rows), 'items', v_rows);
END;
$function$;

-- ── B3 · DEALS & CONTRACTS ──────────────────────────────────────────────────
-- `mine_to_sign` uses the SAME carve-out `record_signature` and DEALAUTO's
-- `contract_signing_set` use: a seat held by the org's own COMPANY contact is
-- completable by any staff member of that org, because the company is a faceless
-- entity and a human signs on its behalf. On the commonest lease FHE writes, the
-- lessor IS French Heritage Equestrian — so without that branch, the barn's own
-- signature queue would read empty.
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
    SELECT jsonb_build_object(
             'kind',         'deal_open',
             'id',           dl.id,
             'deal_id',      dl.id,
             'title',        coalesce(dl.title, dl.deal_type),
             'display_code', dl.display_code,
             'deal_type',    dl.deal_type,
             'status',       dl.status,
             'since',        dl.created_at,
             'age_days',     floor(extract(epoch FROM now() - dl.created_at) / 86400)::int,
             'rank',         4)
      FROM deals dl
     WHERE dl.org_id = v_org AND dl.deleted_at IS NULL
       AND dl.status <> 'complete'
  ) s;

  RETURN jsonb_build_object('count', jsonb_array_length(v_rows), 'items', v_rows);
END;
$function$;

-- ── B6 · ACTIVITY READ-BACK ─────────────────────────────────────────────────
-- D19's corollary, answered: *"four ledgers are written and none is ever read
-- back to a human, so no staff member can answer 'what does this client see?'"*
-- Five here, because `receipt_sends` is a fifth. This is the read surface those
-- tables never had.
--
-- `audit_logs` HAS NO org_id (verified 2026-08-22) — the only one of the five
-- that doesn't. It is scoped through its actor's profile instead, which is the
-- honest available boundary; rows written by a service role with no actor are
-- therefore not shown here, and that is stated rather than silently dropped.
CREATE OR REPLACE FUNCTION public.dash_activity_readback(p_limit integer DEFAULT 40)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_org  uuid := current_org();
  v_lim   integer := least(greatest(coalesce(p_limit, 40), 1), 200);
  v_share integer := greatest(v_lim / 5, 2);
  v_rows  jsonb;
BEGIN
  IF NOT coalesce(has_staff_access(), false) THEN
    RAISE EXCEPTION 'operator access required';
  END IF;

  -- A FAIR SHARE PER LEDGER, then ordered by time. Straight "most recent 40"
  -- looked right and was useless: `audit_logs` writes ~3,200 rows a month where
  -- `receipt_sends` writes 2, so the read-back rendered forty identical
  -- "UPDATE documents" lines and the four ledgers a person actually wants to see
  -- never appeared. Each ledger contributes at most a fifth of the window.
  SELECT coalesce(jsonb_agg(to_jsonb(t) - 'at' || jsonb_build_object('at', t.at)
                            ORDER BY t.at DESC), '[]'::jsonb)
    INTO v_rows
  FROM (
    (SELECT 'status'::text AS ledger, se.created_at AS at, se.entity_type AS subject,
            se.entity_id AS subject_id, se.status AS what, se.detail AS detail
       FROM status_events se
      WHERE se.org_id = v_org AND se.created_at > now() - interval '14 days'
      ORDER BY se.created_at DESC LIMIT v_share)

    UNION ALL
    (SELECT 'notification', n.created_at, coalesce(n.category, n.kind),
            n.user_id, n.title, left(coalesce(n.body, ''), 160)
       FROM notifications n
      WHERE n.org_id = v_org AND n.created_at > now() - interval '14 days'
      ORDER BY n.created_at DESC LIMIT v_share)

    UNION ALL
    (SELECT 'delivery', dd.created_at, 'document',
            dd.document_id, coalesce(dd.channel, 'delivered'),
            CASE WHEN dd.is_mirror THEN 'copy to the barn' ELSE 'to the recipient' END
       FROM document_deliveries dd
      WHERE dd.deleted_at IS NULL AND dd.created_at > now() - interval '14 days'
        AND EXISTS (SELECT 1 FROM documents d WHERE d.id = dd.document_id AND d.org_id = v_org)
      ORDER BY dd.created_at DESC LIMIT v_share)

    UNION ALL
    (SELECT 'receipt', rs.attempted_at, 'purchase',
            rs.purchase_id, CASE WHEN rs.succeeded THEN 'receipt sent' ELSE 'receipt FAILED' END,
            coalesce(rs.recipient_email, '')
       FROM receipt_sends rs
      WHERE rs.org_id = v_org AND rs.attempted_at > now() - interval '14 days'
      ORDER BY rs.attempted_at DESC LIMIT v_share)

    UNION ALL
    (SELECT 'audit', al.occurred_at, coalesce(al.table_name, 'record'),
            al.record_id, al.action,
            (SELECT coalesce(pr.display_name,
                    nullif(btrim(concat_ws(' ', pr.first_name, pr.last_name)), ''))
               FROM profiles pr WHERE pr.user_id = al.actor_user_id)
       FROM audit_logs al
      WHERE al.occurred_at > now() - interval '14 days'
        AND EXISTS (SELECT 1 FROM profiles pr
                     WHERE pr.user_id = al.actor_user_id AND pr.org_id = v_org)
      ORDER BY al.occurred_at DESC LIMIT v_share)
  ) t;

  -- `count` is what this surface is showing, not the size of fourteen days of
  -- ledger. A read-back stream is never "empty because there is nothing to do" —
  -- it renders when there is history, which there always is.
  RETURN jsonb_build_object('count', jsonb_array_length(v_rows), 'items', v_rows);
END;
$function$;

-- ── B8 · TENANT ADMIN & CATALOG HYGIENE ─────────────────────────────────────
-- Config gaps that are ACTIONABLE — each one names the setting that fixes it.
-- The plan's own examples ("5 tiles with zero SKUs, 11 tiles without images")
-- were re-verified against production 2026-08-22 and are real: `service_types`
-- is the tile table, and it carries `cover_image_url`.
--
-- INDEPENDENT_CONTRACTOR and ONBOARDING are excluded from the zero-SKU check on
-- purpose: they are internal service types and are not supposed to be sold.
CREATE OR REPLACE FUNCTION public.dash_catalog_hygiene()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_org  uuid := current_org();
  v_rows jsonb;
BEGIN
  IF NOT coalesce(has_staff_access(), false) THEN
    RAISE EXCEPTION 'operator access required';
  END IF;

  SELECT coalesce(jsonb_agg(x ORDER BY (x->>'rank')::int, x->>'label'), '[]'::jsonb)
    INTO v_rows
  FROM (
    SELECT jsonb_build_object(
             'kind',  'tile_no_skus',
             'id',    st.code, 'label', st.display_name,
             'detail','Nothing is buyable under this service',
             'rank',  1) AS x
      FROM service_types st
     WHERE st.active
       AND st.code NOT IN ('INDEPENDENT_CONTRACTOR', 'ONBOARDING')
       AND NOT EXISTS (SELECT 1 FROM offerings o
                        WHERE o.org_id = v_org AND o.active AND o.service_type = st.code)

    UNION ALL
    SELECT jsonb_build_object(
             'kind',  'tile_no_image',
             'id',    st.code, 'label', st.display_name,
             'detail','No cover image — the card renders bare',
             'rank',  2)
      FROM service_types st
     WHERE st.active AND st.cover_image_url IS NULL
       AND EXISTS (SELECT 1 FROM offerings o
                    WHERE o.org_id = v_org AND o.active AND o.service_type = st.code)

    UNION ALL
    SELECT jsonb_build_object(
             'kind',  'offering_no_config',
             'id',    o.id::text, 'label', o.name,
             'detail','No booking configuration — it cannot be scheduled',
             'rank',  1)
      FROM offerings o
     WHERE o.org_id = v_org AND o.active AND o.config_kind IS NULL

    UNION ALL
    SELECT jsonb_build_object(
             'kind',  'offering_no_price',
             'id',    o.id::text, 'label', o.name,
             'detail','No price and no price model',
             'rank',  1)
      FROM offerings o
     WHERE o.org_id = v_org AND o.active
       AND o.price_amount IS NULL
       AND coalesce(o.price_model, '{}'::jsonb) = '{}'::jsonb

    UNION ALL
    SELECT jsonb_build_object(
             'kind',  'staff_no_title',
             'id',    p.user_id::text,
             'label', coalesce(p.display_name, nullif(btrim(concat_ws(' ', p.first_name, p.last_name)), ''), p.email),
             'detail','No title on the team roster',
             'rank',  3)
      FROM profiles p
     WHERE p.org_id = v_org AND p.role IN ('ADMIN', 'MANAGER', 'EMPLOYEE')
       AND coalesce(btrim(p.title), '') = ''
  ) s;

  RETURN jsonb_build_object('count', jsonb_array_length(v_rows), 'items', v_rows);
END;
$function$;

-- ── B9 · ONBOARDING PIPELINE ────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.dash_onboarding_pipeline()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_org  uuid := current_org();
  v_rows jsonb;
BEGIN
  IF NOT coalesce(has_staff_access(), false) THEN
    RAISE EXCEPTION 'operator access required';
  END IF;

  SELECT coalesce(jsonb_agg(x ORDER BY (x->>'rank')::int, (x->>'since')::timestamptz), '[]'::jsonb)
    INTO v_rows
  FROM (
    -- An invitation that failed to send is a person who never heard from us.
    SELECT jsonb_build_object(
             'kind',   'invite_failed',
             'id',     i.id,
             'who',    coalesce(nullif(btrim(concat_ws(' ', i.first_name, i.last_name)), ''), i.email),
             'detail', left(coalesce(i.failure_reason, 'send failed'), 160),
             'since',  i.created_at,
             'rank',   1) AS x
      FROM invitations i
     WHERE i.org_id = v_org AND i.deleted_at IS NULL
       AND i.failure_reason IS NOT NULL
       AND i.redeemed_at IS NULL
       AND i.status NOT IN ('superseded', 'revoked')

    UNION ALL
    -- Sent, still open, and getting old.
    SELECT jsonb_build_object(
             'kind',   'invite_open',
             'id',     i.id,
             'who',    coalesce(nullif(btrim(concat_ws(' ', i.first_name, i.last_name)), ''), i.email),
             'expires_at', i.expires_at,
             'since',  i.created_at,
             'age_days', floor(extract(epoch FROM now() - i.created_at) / 86400)::int,
             'rank',   2)
      FROM invitations i
     WHERE i.org_id = v_org AND i.deleted_at IS NULL
       AND i.status = 'sent' AND i.redeemed_at IS NULL

    UNION ALL
    -- D8 §3 PENDING: the account exists, the documents were assigned, nothing is
    -- signed, and service features stay locked until they are.
    SELECT jsonb_build_object(
             'kind',   'account_pending',
             'id',     p.user_id,
             'contact_id', p.contact_id,
             'who',    coalesce(p.display_name,
                                nullif(btrim(concat_ws(' ', p.first_name, p.last_name)), ''), p.email),
             'unsigned', (SELECT count(*) FROM contact_required_documents crd
                           WHERE crd.contact_id = p.contact_id AND crd.org_id = v_org
                             AND crd.skipped_at IS NULL
                             AND NOT contact_document_satisfied(p.contact_id, crd.template_key)),
             'since',  p.created_at,
             'age_days', floor(extract(epoch FROM now() - p.created_at) / 86400)::int,
             'rank',   3)
      FROM profiles p
     WHERE p.org_id = v_org AND coalesce(p.role, 'USER') = 'USER'
       AND p.contact_id IS NOT NULL
       AND EXISTS (SELECT 1 FROM contact_required_documents crd
                    WHERE crd.contact_id = p.contact_id AND crd.org_id = v_org
                      AND crd.skipped_at IS NULL
                      AND NOT contact_document_satisfied(p.contact_id, crd.template_key))
  ) s;

  RETURN jsonb_build_object('count', jsonb_array_length(v_rows), 'items', v_rows);
END;
$function$;

-- ── THE BUSINESS KPI RIBBON ─────────────────────────────────────────────────
-- REVENUE IS DELIBERATELY NOT IN HERE, and that is the §7.4 acceptance test
-- rather than an omission. The test is that the dashboard tile and the calendar
-- tile *show the identical number*. If this function computed its own week and
-- month boundaries while `CalendarPage` computed its own, the two would agree
-- only for as long as the database's timezone and the viewer's happened to match
-- — and X6 records that this tenant has no timezone of its own.
--
-- So the WINDOW is computed once, on the client, in `lib/dashboard/windows.ts`,
-- and both surfaces pass it to `revenue_summary`. One function, one window, one
-- number. This function keeps the four figures that have no such twin.
CREATE OR REPLACE FUNCTION public.dash_business_kpis()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_org      uuid := current_org();
  v_mo_from  timestamptz := date_trunc('month', now());
  v_new      integer;
  v_leads    integer;
  v_conv     integer;
  v_pipeline numeric;
  v_declared numeric;
BEGIN
  IF NOT coalesce(has_staff_access(), false) THEN
    RAISE EXCEPTION 'operator access required';
  END IF;

  SELECT count(*) INTO v_new
    FROM clients cl
   WHERE cl.org_id = v_org AND cl.deleted_at IS NULL
     AND coalesce(cl.client_since, cl.customer_since, cl.created_at) >= v_mo_from;

  -- Lead → client, over 90 days: inquiries received, and how many of those
  -- people now hold a client record. Two numbers, so the ratio can be shown
  -- with its denominator instead of as a bare percentage nobody can check.
  SELECT count(*),
         count(*) FILTER (WHERE EXISTS (
           SELECT 1 FROM clients cl
            WHERE cl.contact_id = r.contact_id AND cl.deleted_at IS NULL
              AND cl.client_since IS NOT NULL))
    INTO v_leads, v_conv
    FROM requests r
   WHERE r.org_id = v_org AND r.created_at > now() - interval '90 days';

  SELECT coalesce(sum(coalesce(p.amount, 0)), 0) INTO v_pipeline
    FROM purchases p
   WHERE p.org_id = v_org AND p.deleted_at IS NULL
     AND p.payment_status <> 'paid' AND p.status <> 'draft';

  SELECT coalesce(sum(coalesce(p.amount, 0)), 0) INTO v_declared
    FROM purchases p
   WHERE p.org_id = v_org AND p.deleted_at IS NULL
     AND p.client_claim_status = 'pending';

  RETURN jsonb_build_object(
    'new_clients_month', v_new,
    'leads_90d',     v_leads,
    'converted_90d', v_conv,
    'open_pipeline', v_pipeline,
    'declared_unconfirmed', v_declared);
END;
$function$;

DO $$
DECLARE fn text;
BEGIN
  FOREACH fn IN ARRAY ARRAY[
    'dash_money_health()', 'dash_claires_plate()', 'dash_deals_contracts()',
    'dash_activity_readback(integer)', 'dash_catalog_hygiene()',
    'dash_onboarding_pipeline()', 'dash_business_kpis()'
  ] LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION public.%s FROM public, anon', fn);
    EXECUTE format('GRANT EXECUTE ON FUNCTION public.%s TO authenticated, service_role', fn);
  END LOOP;
END$$;
