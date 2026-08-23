-- DASHBOARDBUILD §3 — Claire's dashboard: one reader per zone.
--
-- DASHBOARDS-GROUND-UP-PLAN §7: *"One reader per zone — each zone's RPC returns
-- its rows + count in one call; the dashboard issues them in parallel."* Every
-- function here returns the same envelope so the zone framework can render any
-- of them without knowing which one it has:
--
--     { "count": <int>, "items": [ … ] }
--
-- `count` is the TRUE total; `items` may be capped. A zone with count 0 does not
-- render at all (plan §1, principle 1) — that is why the count is separate from
-- the array rather than being `items.length`.
--
-- WHAT IS NOT HERE, AND WHY: no zone builds a URL. THE REACH is decided once, in
-- `src/lib/dashboard/registry.ts`, because the route table lives in the app and a
-- link built in SQL goes stale silently the next time a page moves (D17's
-- `pageRegistry` reasoning, applied one level down).
--
-- D25 IS OBSERVED BY RETURNING CODES, NOT PROSE: these functions return
-- `service_type` ('RIDING_LESSON', 'HORSE_CLIPPING'), and `serviceCatalog.ts` —
-- already the single source of service wording — turns it into "Riding Lesson"
-- or "clipping appointment". The word "booking" appears in this file only as the
-- name of a table, which is exactly what D25 says it is.

-- ── C1 · TODAY'S PLAN ───────────────────────────────────────────────────────
-- Reuses `lesson_plans_for_day()` wholesale (D18). That function already joins
-- the plan, the client, the service type and the "progress recorded" flag, and
-- already encodes which bookings are real work via `booking_form_applies`. The
-- only thing added here is whether the client left a note before the session —
-- the one signal Claire wants before she walks out to the arena.
CREATE OR REPLACE FUNCTION public.dash_today_plan()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE v_rows jsonb;
BEGIN
  IF NOT coalesce(has_staff_access(), false) THEN
    RAISE EXCEPTION 'operator access required';
  END IF;

  SELECT coalesce(jsonb_agg(jsonb_build_object(
           'booking_id',    d.booking_id,
           'starts_at',     d.starts_at,
           'ends_at',       d.ends_at,
           'client_id',     d.client_id,
           'client_name',   d.client_name,
           'service_type',  d.service_type,
           'status',        d.booking_status,
           'plan_id',       d.plan_id,
           'plan_version',  d.plan_version,
           'focus',         d.focus,
           'next_up',       d.next_up,
           'has_plan',      d.plan_id IS NOT NULL,
           'progress_recorded', d.progress_recorded,
           'client_note',   EXISTS (SELECT 1 FROM booking_forms bf
                                     WHERE bf.booking_id = d.booking_id
                                       AND bf.retired_at IS NULL
                                       AND bf.submitted_at IS NOT NULL
                                       AND coalesce(bf.answers, '{}'::jsonb) <> '{}'::jsonb),
           'horse_name',    (SELECT coalesce(h.nickname, h.registered_name)
                               FROM bookings b JOIN horses h ON h.id = b.horse_id
                              WHERE b.id = d.booking_id)
         ) ORDER BY d.starts_at), '[]'::jsonb)
    INTO v_rows
    FROM lesson_plans_for_day(current_date) d;

  RETURN jsonb_build_object('count', jsonb_array_length(v_rows), 'items', v_rows);
END;
$function$;

-- ── C2 · WEEK STRIP ─────────────────────────────────────────────────────────
-- Seven days from today: what is committed, what is still open, and the two
-- things that turn a quiet day into a busy one — a vet/farrier due date and a
-- lease running out. `available` bookings are the barn's OPEN slots, not work
-- (272 of this tenant's 317 rows are open slots), so they are counted as
-- capacity and never as items.
CREATE OR REPLACE FUNCTION public.dash_week_strip()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_org  uuid := current_org();
  v_days jsonb;
  v_book integer;
BEGIN
  IF NOT coalesce(has_staff_access(), false) THEN
    RAISE EXCEPTION 'operator access required';
  END IF;

  SELECT coalesce(jsonb_agg(x ORDER BY (x->>'day')::date), '[]'::jsonb), coalesce(sum(booked), 0)
    INTO v_days, v_book
  FROM (
    SELECT jsonb_build_object(
             'day',       g.day,
             'is_today',  g.day = current_date,
             'booked',    b.booked,
             'open',      b.open_slots,
             'items',     coalesce(b.items, '[]'::jsonb),
             'care_due',  (SELECT count(*) FROM horse_health_events he
                             JOIN horses h ON h.id = he.horse_id
                            WHERE he.org_id = v_org AND he.deleted_at IS NULL
                              AND h.deleted_at IS NULL AND he.next_due = g.day),
             'lease_ends',(SELECT count(*) FROM horses h
                            WHERE h.org_id = v_org AND h.deleted_at IS NULL
                              AND h.lease_end = g.day)
           ) AS x,
           b.booked
      FROM (SELECT (current_date + i)::date AS day FROM generate_series(0, 6) AS i) g
      CROSS JOIN LATERAL (
        SELECT
          count(*) FILTER (WHERE bk.status = 'scheduled')                      AS booked,
          count(*) FILTER (WHERE bk.status = 'available' AND bk.kind='lesson') AS open_slots,
          jsonb_agg(jsonb_build_object(
              'booking_id',   bk.id,
              'starts_at',    bk.starts_at,
              'service_type', booking_service_type(bk),
              'client_name',  (SELECT nullif(btrim(concat_ws(' ', ct.first_name, ct.last_name)), '')
                                 FROM clients cl JOIN contacts ct ON ct.id = cl.contact_id
                                WHERE cl.id = bk.client_id))
            ORDER BY bk.starts_at) FILTER (WHERE bk.status = 'scheduled')      AS items
        FROM bookings bk
       WHERE bk.org_id = v_org AND bk.deleted_at IS NULL
         AND bk.starts_at >= g.day::timestamptz
         AND bk.starts_at <  (g.day + 1)::timestamptz
      ) b
  ) s;

  -- The strip is about the week, so it stays visible whenever the week holds
  -- anything at all; `count` is the week's committed work.
  RETURN jsonb_build_object('count', v_book, 'items', v_days);
END;
$function$;

-- ── C3 · MONEY WAITING ──────────────────────────────────────────────────────
-- Three things, one queue, ordered by how long they have been sitting:
--   claim  — a client declared Zelle/cash and staff have not confirmed it. D23:
--            the declaration already unblocked them; confirming governs whether
--            the lesson happens. One click, through `mark_purchase_paid` (D18 —
--            CASHCONFIRM and ZELLECLOSE both converged on that function).
--   order  — placed, nothing declared, nothing paid.
--   aging  — the same orders once they are more than a week old, surfaced with
--            their age rather than as a separate list.
CREATE OR REPLACE FUNCTION public.dash_money_waiting()
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

  SELECT coalesce(jsonb_agg(x ORDER BY (x->>'sort_at')::timestamptz), '[]'::jsonb)
    INTO v_rows
  FROM (
    SELECT jsonb_build_object(
      'kind',        CASE WHEN p.client_claim_status = 'pending' THEN 'claim' ELSE 'order' END,
      'purchase_id', p.id,
      'display_code',p.display_code,
      'amount',      coalesce(p.amount, 0),
      'buyer_name',  coalesce(nullif(btrim(concat_ws(' ', ct.first_name, ct.last_name)), ''), ct.email),
      'buyer_contact_id', p.buyer_contact_id,
      'method',      coalesce(p.client_reported_method, p.payment_method),
      'reference',   p.client_reported_reference,
      'declared_at', p.client_reported_at,
      'created_at',  p.created_at,
      'sort_at',     coalesce(p.client_reported_at, p.created_at),
      'age_days',    floor(extract(epoch FROM now() - coalesce(p.client_reported_at, p.created_at)) / 86400)::int,
      'items',       (SELECT coalesce(jsonb_agg(pi.label ORDER BY pi.created_at), '[]'::jsonb)
                        FROM purchase_items pi
                       WHERE pi.purchase_id = p.id AND pi.voided_at IS NULL)
    ) AS x
      FROM purchases p
      LEFT JOIN contacts ct ON ct.id = p.buyer_contact_id
     WHERE p.org_id = v_org
       AND p.deleted_at IS NULL
       AND p.payment_status <> 'paid'
       AND p.status <> 'draft'
  ) s;

  RETURN jsonb_build_object('count', jsonb_array_length(v_rows), 'items', v_rows);
END;
$function$;

-- ── C4 · PEOPLE WAITING ─────────────────────────────────────────────────────
-- Every place a person is waiting on a human answer, in one queue with one age.
-- The four sources are deliberately NOT normalised into a table: each already
-- has an owner surface, and copying them would create the second write path D18
-- exists to prevent.
CREATE OR REPLACE FUNCTION public.dash_people_waiting()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_org  uuid := current_org();
  v_me   uuid := auth.uid();
  v_rows jsonb;
BEGIN
  IF NOT coalesce(has_staff_access(), false) THEN
    RAISE EXCEPTION 'operator access required';
  END IF;

  SELECT coalesce(jsonb_agg(x ORDER BY (x->>'since')::timestamptz), '[]'::jsonb)
    INTO v_rows
  FROM (
    -- An inquiry nobody has answered yet.
    SELECT jsonb_build_object(
             'kind',    'inquiry',
             'id',      r.id,
             'who',     coalesce(nullif(btrim(concat_ws(' ', r.contact_first_name, r.contact_last_name)), ''),
                                 r.contact_name, r.contact_email),
             'subject', coalesce(r.subject, r.category, 'New inquiry'),
             'detail',  left(coalesce(r.notes, ''), 160),
             'since',   r.created_at,
             'age_hours', floor(extract(epoch FROM now() - r.created_at) / 3600)::int,
             'status',  r.status,
             'contact_id', r.contact_id) AS x
      FROM requests r
     WHERE r.org_id = v_org AND r.status IN ('new', 'contacted')

    UNION ALL
    -- Someone asked to move or cancel a session and is waiting on the answer.
    SELECT jsonb_build_object(
             'kind',    'reschedule',
             'id',      cr.id,
             'who',     (SELECT nullif(btrim(concat_ws(' ', pr.first_name, pr.last_name)), '')
                           FROM profiles pr WHERE pr.user_id = cr.requested_by),
             'subject', CASE cr.request_kind WHEN 'cancel' THEN 'Cancellation request'
                                             ELSE 'Reschedule request' END,
             'detail',  coalesce(cr.note, ''),
             'since',   cr.created_at,
             'age_hours', floor(extract(epoch FROM now() - cr.created_at) / 3600)::int,
             'status',  cr.status,
             'booking_id', cr.booking_id)
      FROM booking_change_requests cr
     WHERE cr.org_id = v_org AND cr.status = 'pending'

    UNION ALL
    -- A direct message to me that I have not opened.
    SELECT jsonb_build_object(
             'kind',    'message',
             'id',      dm.id,
             'who',     (SELECT coalesce(pr.display_name,
                                 nullif(btrim(concat_ws(' ', pr.first_name, pr.last_name)), ''))
                           FROM profiles pr WHERE pr.user_id = dm.sender_id),
             'subject', 'Direct message',
             'detail',  left(dm.body, 160),
             'since',   dm.created_at,
             'age_hours', floor(extract(epoch FROM now() - dm.created_at) / 3600)::int,
             'sender_id', dm.sender_id)
      FROM direct_messages dm
     WHERE dm.org_id = v_org AND dm.deleted_at IS NULL
       AND dm.read_at IS NULL AND dm.recipient_id = v_me

    UNION ALL
    -- A comment on a contract that the barn has not replied under.
    SELECT jsonb_build_object(
             'kind',    'contract_note',
             'id',      m.id,
             'who',     m.author_label,
             'subject', 'Contract comment',
             'detail',  left(m.body, 160),
             'since',   m.created_at,
             'age_hours', floor(extract(epoch FROM now() - m.created_at) / 3600)::int,
             'note_id', m.note_id,
             'document_id', (SELECT n.document_id FROM contract_notes n WHERE n.id = m.note_id))
      FROM contract_note_messages m
     WHERE m.org_id = v_org AND m.deleted_at IS NULL
       AND m.author_contact_id IS DISTINCT FROM current_contact_id()
       AND NOT EXISTS (SELECT 1 FROM contract_note_messages later
                        WHERE later.note_id = m.note_id
                          AND later.deleted_at IS NULL
                          AND later.created_at > m.created_at
                          AND later.author_contact_id = current_contact_id())
  ) s;

  RETURN jsonb_build_object('count', jsonb_array_length(v_rows), 'items', v_rows);
END;
$function$;

-- ── C6 · NOTES LOOP ─────────────────────────────────────────────────────────
-- Two halves of one habit: sessions that happened and were never written up, and
-- what the client wrote that nobody has read (the seen marker from migration 3).
-- The write-up half is capped at 30 days: a lesson from March is not a to-do,
-- it is history, and a queue that never empties stops being read.
CREATE OR REPLACE FUNCTION public.dash_notes_loop()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_org  uuid := current_org();
  v_me   uuid := current_contact_id();
  v_rows jsonb;
BEGIN
  IF NOT coalesce(has_staff_access(), false) THEN
    RAISE EXCEPTION 'operator access required';
  END IF;

  SELECT coalesce(jsonb_agg(x ORDER BY (x->>'since')::timestamptz DESC), '[]'::jsonb)
    INTO v_rows
  FROM (
    SELECT jsonb_build_object(
             'kind',        'write_up',
             'id',          b.id,
             'booking_id',  b.id,
             'starts_at',   b.starts_at,
             'since',       b.starts_at,
             'age_days',    floor(extract(epoch FROM now() - b.starts_at) / 86400)::int,
             'client_id',   b.client_id,
             'client_name', (SELECT nullif(btrim(concat_ws(' ', ct.first_name, ct.last_name)), '')
                               FROM clients cl JOIN contacts ct ON ct.id = cl.contact_id
                              WHERE cl.id = b.client_id),
             'service_type', booking_service_type(b)) AS x
      FROM bookings b
     WHERE b.org_id = v_org AND b.deleted_at IS NULL
       AND b.status = 'scheduled'
       AND b.starts_at < now()
       AND b.starts_at > now() - interval '30 days'
       AND booking_form_applies(b)
       AND NOT EXISTS (SELECT 1 FROM booking_notes bn
                        WHERE bn.booking_id = b.id
                          AND bn.author_role <> 'client'
                          AND bn.phase = 'after')

    UNION ALL

    SELECT jsonb_build_object(
             'kind',        'unread_note',
             'id',          bn.id,
             'note_id',     bn.id,
             'booking_id',  bn.booking_id,
             'since',       bn.created_at,
             'age_days',    floor(extract(epoch FROM now() - bn.created_at) / 86400)::int,
             'author_name', bn.author_name,
             'phase',       bn.phase,
             'body',        left(bn.body, 200),
             'starts_at',   (SELECT b2.starts_at FROM bookings b2 WHERE b2.id = bn.booking_id))
      FROM booking_notes bn
     WHERE bn.org_id = v_org
       AND bn.author_role = 'client'
       AND v_me IS NOT NULL
       AND NOT EXISTS (SELECT 1 FROM booking_note_seen s
                        WHERE s.note_id = bn.id AND s.contact_id = v_me)
  ) s;

  RETURN jsonb_build_object('count', jsonb_array_length(v_rows), 'items', v_rows);
END;
$function$;

-- ── C7 · STABLE BOARD ───────────────────────────────────────────────────────
-- One row per horse that WANTS SOMETHING, with the reasons it wants it. A horse
-- with nothing due is absent — the same rule as a zone with nothing in it.
CREATE OR REPLACE FUNCTION public.dash_stable_board()
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

  SELECT coalesce(jsonb_agg(x ORDER BY (x->>'urgency')::int, x->>'name'), '[]'::jsonb)
    INTO v_rows
  FROM (
    SELECT jsonb_build_object(
             'horse_id', h.id,
             'name',     coalesce(h.nickname, h.registered_name, 'Unnamed horse'),
             'reasons',  r.reasons,
             'urgency',  r.urgency,
             'rides_this_week', (SELECT count(*) FROM bookings b
                                  WHERE b.org_id = v_org AND b.deleted_at IS NULL
                                    AND b.horse_id = h.id AND b.status = 'scheduled'
                                    AND b.starts_at >= date_trunc('week', now())
                                    AND b.starts_at <  date_trunc('week', now()) + interval '7 days')
           ) AS x
      FROM horses h
      CROSS JOIN LATERAL (
        SELECT jsonb_agg(z.reason ORDER BY z.rank) AS reasons, min(z.rank) AS urgency
          FROM (
            SELECT 1 AS rank,
                   jsonb_build_object('kind','health_overdue','label', he.event_type,
                                      'due', he.next_due, 'event_id', he.id) AS reason
              FROM horse_health_events he
             WHERE he.horse_id = h.id AND he.deleted_at IS NULL AND he.org_id = v_org
               AND he.next_due IS NOT NULL AND he.next_due < current_date
            UNION ALL
            SELECT 2,
                   jsonb_build_object('kind','health_due','label', he.event_type,
                                      'due', he.next_due, 'event_id', he.id)
              FROM horse_health_events he
             WHERE he.horse_id = h.id AND he.deleted_at IS NULL AND he.org_id = v_org
               AND he.next_due BETWEEN current_date AND current_date + 14
            UNION ALL
            SELECT 3,
                   jsonb_build_object('kind','lease_ending','label','Lease ends',
                                      'due', h.lease_end)
             WHERE h.lease_end IS NOT NULL
               AND h.lease_end BETWEEN current_date AND current_date + 30
            UNION ALL
            SELECT 4,
                   jsonb_build_object('kind','medication','label', hm.name,
                                      'detail', hm.instructions, 'med_id', hm.id)
              FROM horse_medications hm
             WHERE hm.horse_id = h.id AND hm.deleted_at IS NULL AND hm.org_id = v_org
          ) z
      ) r
     WHERE h.org_id = v_org AND h.deleted_at IS NULL
       AND r.reasons IS NOT NULL
  ) s;

  RETURN jsonb_build_object('count', jsonb_array_length(v_rows), 'items', v_rows);
END;
$function$;

-- ── C9 · DOCUMENTS & ONBOARDING ─────────────────────────────────────────────
-- The one that has a deadline attached: an unsigned required document matters
-- most when the person it belongs to is on the calendar this week. `blocks_at`
-- carries that date so the zone can say "release unsigned, lesson Saturday"
-- rather than listing paperwork.
--
-- Reuses `contact_document_satisfied()` — the same predicate the onboarding wall
-- and the client's own document list read, so the three can never disagree.
CREATE OR REPLACE FUNCTION public.dash_documents_onboarding()
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

  SELECT coalesce(jsonb_agg(x ORDER BY (x->>'rank')::int, x->>'who'), '[]'::jsonb)
    INTO v_rows
  FROM (
    -- D8 §3: an account with assigned-but-unsigned documents is PENDING.
    SELECT jsonb_build_object(
             'kind',      'unsigned',
             'id',        ct.id,
             'contact_id',ct.id,
             'who',       coalesce(nullif(btrim(concat_ws(' ', ct.first_name, ct.last_name)), ''), ct.email),
             'templates', u.keys,
             'blocks_at', u.next_service,
             'rank',      CASE WHEN u.next_service IS NOT NULL THEN 1 ELSE 3 END) AS x
      FROM contacts ct
      CROSS JOIN LATERAL (
        SELECT array_agg(crd.template_key ORDER BY crd.template_key) AS keys,
               (SELECT min(b.starts_at)
                  FROM bookings b
                  JOIN clients cl ON cl.id = b.client_id
                 WHERE cl.contact_id = ct.id AND b.org_id = v_org
                   AND b.deleted_at IS NULL AND b.status = 'scheduled'
                   AND b.starts_at >= now()) AS next_service
          FROM contact_required_documents crd
         WHERE crd.contact_id = ct.id AND crd.org_id = v_org
           AND crd.skipped_at IS NULL
           AND NOT contact_document_satisfied(ct.id, crd.template_key)
      ) u
     WHERE ct.org_id = v_org AND u.keys IS NOT NULL

    UNION ALL
    -- An invitation that is about to stop working.
    SELECT jsonb_build_object(
             'kind',      'invitation_expiring',
             'id',        i.id,
             'who',       coalesce(nullif(btrim(concat_ws(' ', i.first_name, i.last_name)), ''), i.email),
             'expires_at',i.expires_at,
             'contact_id',i.contact_id,
             'rank',      2)
      FROM invitations i
     WHERE i.org_id = v_org AND i.deleted_at IS NULL
       AND i.status = 'sent' AND i.redeemed_at IS NULL
       AND i.expires_at IS NOT NULL
       AND i.expires_at <= now() + interval '3 days'
  ) s;

  RETURN jsonb_build_object('count', jsonb_array_length(v_rows), 'items', v_rows);
END;
$function$;

-- ── C11 · COMMUNITY PULSE ───────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.dash_community_pulse()
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

  SELECT coalesce(jsonb_agg(x ORDER BY (x->>'since')::timestamptz DESC), '[]'::jsonb)
    INTO v_rows
  FROM (
    SELECT jsonb_build_object(
             'kind',   CASE WHEN fp.pulled_down THEN 'pulled_down'
                            WHEN fp.reported_reason IS NOT NULL THEN 'reported'
                            ELSE 'scan_pending' END,
             'id',     fp.id,
             'body',   left(coalesce(fp.body, ''), 160),
             'reason', fp.reported_reason,
             'since',  fp.created_at,
             'author_id', fp.author_id) AS x
      FROM feed_posts fp
     WHERE fp.org_id = v_org
       AND (fp.pulled_down OR fp.reported_reason IS NOT NULL
            OR fp.scan_state::text NOT IN ('clean', 'skipped'))

    UNION ALL
    SELECT jsonb_build_object(
             'kind',   'event_upcoming',
             'id',     e.id,
             'title',  e.title,
             'since',  e.starts_at,
             'starts_at', e.starts_at,
             'rsvps',  (SELECT count(*) FROM event_rsvps rs
                         WHERE rs.event_id = e.id AND rs.status = 'going'),
             'capacity', e.capacity)
      FROM events e
     WHERE e.org_id = v_org AND e.published
       AND e.starts_at BETWEEN now() AND now() + interval '30 days'
  ) s;

  RETURN jsonb_build_object('count', jsonb_array_length(v_rows), 'items', v_rows);
END;
$function$;

-- ── C12 · EVALUATIONS DUE ───────────────────────────────────────────────────
-- D27: the evaluation is "the initial entry after creation of the account and
-- used as reference for downstream actions" — for a rider AND for a horse. So
-- both are listed here, and neither is a document or a deal.
CREATE OR REPLACE FUNCTION public.dash_evaluations_due()
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

  SELECT coalesce(jsonb_agg(x ORDER BY (x->>'since')::timestamptz DESC), '[]'::jsonb)
    INTO v_rows
  FROM (
    SELECT jsonb_build_object(
             'kind',       'rider',
             'id',         cl.id,
             'contact_id', cl.contact_id,
             'who',        coalesce(nullif(btrim(concat_ws(' ', ct.first_name, ct.last_name)), ''), ct.email),
             'since',      coalesce(cl.client_since, cl.created_at)) AS x
      FROM clients cl
      JOIN contacts ct ON ct.id = cl.contact_id
     WHERE cl.org_id = v_org AND cl.deleted_at IS NULL
       AND cl.client_since IS NOT NULL
       AND NOT EXISTS (SELECT 1 FROM evaluation_reports er
                        WHERE er.contact_id = cl.contact_id
                          AND er.deleted_at IS NULL AND er.horse_id IS NULL)

    UNION ALL
    SELECT jsonb_build_object(
             'kind',     'horse',
             'id',       h.id,
             'horse_id', h.id,
             'who',      coalesce(h.nickname, h.registered_name, 'Unnamed horse'),
             'since',    h.created_at)
      FROM horses h
     WHERE h.org_id = v_org AND h.deleted_at IS NULL
       AND NOT EXISTS (SELECT 1 FROM evaluation_reports er
                        WHERE er.horse_id = h.id AND er.deleted_at IS NULL)
  ) s;

  RETURN jsonb_build_object('count', jsonb_array_length(v_rows), 'items', v_rows);
END;
$function$;

-- ── C13 · GIFTS ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.dash_gifts()
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

  SELECT coalesce(jsonb_agg(jsonb_build_object(
           'gift_id',    g.id,
           'code',       g.code,
           'item_label', g.item_label,
           'amount',     g.amount,
           'buyer',      g.buyer_name,
           'recipient',  g.recipient_name,
           'deliver_on', g.deliver_on,
           'opened_at',  g.opened_at,
           'status',     g.status,
           'since',      g.created_at) ORDER BY g.created_at DESC), '[]'::jsonb)
    INTO v_rows
    FROM gifts g
   WHERE g.org_id = v_org
     AND g.redeemed_at IS NULL
     AND coalesce(g.status, '') <> 'cancelled';

  RETURN jsonb_build_object('count', jsonb_array_length(v_rows), 'items', v_rows);
END;
$function$;

-- ── THE TRAINER KPI RIBBON ──────────────────────────────────────────────────
-- Plan §2's four numbers. Each is derived here and nowhere else; the zones below
-- them read the same functions, so a ribbon and a zone cannot disagree (D18).
CREATE OR REPLACE FUNCTION public.dash_trainer_kpis()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_org      uuid := current_org();
  v_today    integer;
  v_booked   integer;
  v_open     integer;
  v_money    numeric;
  v_people   jsonb;
BEGIN
  IF NOT coalesce(has_staff_access(), false) THEN
    RAISE EXCEPTION 'operator access required';
  END IF;

  SELECT (dash_today_plan()->>'count')::int INTO v_today;

  SELECT count(*) FILTER (WHERE b.status = 'scheduled'),
         count(*) FILTER (WHERE b.status = 'available' AND b.kind = 'lesson')
    INTO v_booked, v_open
    FROM bookings b
   WHERE b.org_id = v_org AND b.deleted_at IS NULL
     AND b.starts_at >= current_date::timestamptz
     AND b.starts_at <  (current_date + 7)::timestamptz;

  -- Money DECLARED and awaiting confirmation. Not revenue (see revenue_summary):
  -- it is the number that says how much of the week is sitting on a human.
  SELECT coalesce(sum(coalesce(p.amount, 0)), 0) INTO v_money
    FROM purchases p
   WHERE p.org_id = v_org AND p.deleted_at IS NULL
     AND p.client_claim_status = 'pending';

  SELECT jsonb_build_object(
           'count', (w->>'count')::int,
           'oldest_hours', coalesce((SELECT max((i->>'age_hours')::int)
                                       FROM jsonb_array_elements(w->'items') i), 0))
    INTO v_people
    FROM (SELECT dash_people_waiting() AS w) q;

  RETURN jsonb_build_object(
    'today_lessons',  v_today,
    'week_booked',    v_booked,
    'week_capacity',  v_booked + v_open,
    'awaiting_confirmation', v_money,
    'people_waiting', v_people->'count',
    'people_oldest_hours', v_people->'oldest_hours');
END;
$function$;

DO $$
DECLARE fn text;
BEGIN
  FOREACH fn IN ARRAY ARRAY[
    'dash_today_plan()', 'dash_week_strip()', 'dash_money_waiting()',
    'dash_people_waiting()', 'dash_notes_loop()', 'dash_stable_board()',
    'dash_documents_onboarding()', 'dash_community_pulse()',
    'dash_evaluations_due()', 'dash_gifts()', 'dash_trainer_kpis()'
  ] LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION public.%s FROM public, anon', fn);
    EXECUTE format('GRANT EXECUTE ON FUNCTION public.%s TO authenticated, service_role', fn);
  END LOOP;
END$$;
