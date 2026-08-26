-- TWO CALENDAR EMAILS, AND ADMIN GETS NEITHER.
--
-- Owner, 2026-08-26: "I dont want admin getting calendar update or notification
-- emails, and we only need the daily one at the start of the day and then the one
-- that is sent 1 hour prior to start time. they go to hello@fhequestrian.com, and
-- the client gets the 1 hour prior notification only."
--
-- ⚠️ NOTHING OF THIS HAD SHIPPED. TASK-DAYSHEET was a specification; what runs in
-- production is the original behaviour, and it is louder than he thinks:
--
--   • BOTH a 2-hour and a 1-hour reminder fire for every booking.
--   • Each one calls notify_staff, which writes to EVERY profile whose role is
--     ADMIN/MANAGER/EMPLOYEE/OWNER/SUPERADMIN — that is BOTH
--     admin@fhequestrian.com and hello@fhequestrian.com. So admin@ has been
--     receiving a personal notification, and an email, for every session.
--   • On top of that a consolidated copy already goes to the ops inbox, so the
--     shared address was getting the same information twice.
--   • There is no start-of-day rundown at all.
--
-- ⚠️ ALSO SUPERSEDED: the 09:00 client email in the earlier DAYSHEET spec. The
-- ruling above gives the client the 1-hour notice ONLY.
--
-- What this migration changes:
--   1. The 2-hour reminder is retired. The column and the stamp stay (D32) so the
--      history of what was sent survives; nothing writes them any more.
--   2. notify_staff is NOT called for reminders. The shared inbox is served by the
--      consolidated ops copy the endpoint already sends — one address, one email —
--      and no individual staff account is notified at all.
--   3. ops_day_sheet() is added: today's sessions, Pacific, for the start-of-day
--      email to the shared inbox.

BEGIN;

CREATE OR REPLACE FUNCTION public.calendar_reminder_sweep()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_n1 int := 0; b bookings%ROWTYPE; v_title text;
BEGIN
  IF NOT (coalesce(auth.role(),'') = 'service_role' OR has_staff_access()) THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  -- ⚠️ THE 2-HOUR REMINDER IS RETIRED (owner, 2026-08-26: "we only need the daily
  -- one at the start of the day and then the one that is sent 1 hour prior").
  -- `bookings.reminder_2h_sent_at` is deliberately left in place and left alone —
  -- it records what was already sent, and clearing it would make an old reminder
  -- look like it never happened.

  FOR b IN
    SELECT * FROM bookings
    WHERE status IN ('scheduled','confirmed','pending') AND kind IN ('lesson','care')
      AND reminder_1h_sent_at IS NULL
      AND starts_at BETWEEN now() AND now() + interval '1 hour'
  LOOP
    v_title := 'Starting soon: session at ' || to_char(b.starts_at, 'HH12:MI AM');
    -- THE CLIENT. Their one and only calendar email.
    IF b.account_user_id IS NOT NULL THEN
      INSERT INTO notifications (org_id, user_id, kind, title, link)
        VALUES (b.org_id, b.account_user_id, 'booking_reminder_1h', v_title, '/app/calendar');
    END IF;
    -- ⚠️ NO notify_staff. It fans out to every ADMIN profile, which is how
    -- admin@fhequestrian.com came to be emailed about every session. The shared
    -- inbox is served by the endpoint's single consolidated ops copy instead.
    UPDATE bookings SET reminder_1h_sent_at = now() WHERE id = b.id;
    v_n1 := v_n1 + 1;
  END LOOP;

  RETURN jsonb_build_object('reminders_2h', 0, 'reminders_1h', v_n1);
END;
$function$;

-- ── THE START-OF-DAY RUNDOWN ────────────────────────────────────────────────
-- Read-only. The endpoint decides WHEN (07:00 Pacific) and WHO (the shared ops
-- inbox); this only answers "what is on today".
CREATE OR REPLACE FUNCTION public.ops_day_sheet(p_org uuid DEFAULT NULL)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE v_org uuid; v_day date;
BEGIN
  IF NOT (coalesce(auth.role(),'') = 'service_role' OR has_staff_access()) THEN
    RAISE EXCEPTION 'not authorized';
  END IF;
  v_org := coalesce(p_org, current_org());
  -- "Today" is the BARN's today, not the server's (D: America/Los_Angeles).
  v_day := (now() AT TIME ZONE 'America/Los_Angeles')::date;

  RETURN jsonb_build_object(
    'day', v_day,
    'items', coalesce((
      SELECT jsonb_agg(jsonb_build_object(
               'at',    to_char(b.starts_at AT TIME ZONE 'America/Los_Angeles', 'HH12:MI AM'),
               'what',  coalesce(nullif(btrim(o.name), ''), initcap(b.kind)),
               'who',   coalesce(nullif(btrim(concat_ws(' ', c.first_name, c.last_name)), ''), '—'),
               'horse', coalesce(nullif(btrim(h.nickname), ''), h.registered_name),
               'status', b.status)
             ORDER BY b.starts_at)
        FROM bookings b
        LEFT JOIN contacts c ON c.id = b.account_contact_id
        LEFT JOIN offerings o ON o.id = b.offering_id
        LEFT JOIN horses   h ON h.id = b.horse_id
       WHERE b.org_id = v_org
         AND b.deleted_at IS NULL
         AND b.kind IN ('lesson','care')
         -- ⚠️ 'available' is EXCLUDED: 494 of the calendar's rows are published
         -- open slots, not sessions. A day sheet listing them would be unreadable.
         AND b.status IN ('scheduled','confirmed','pending')
         AND (b.starts_at AT TIME ZONE 'America/Los_Angeles')::date = v_day
    ), '[]'::jsonb));
END;
$function$;

REVOKE ALL ON FUNCTION public.ops_day_sheet(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ops_day_sheet(uuid) TO authenticated;

COMMIT;
