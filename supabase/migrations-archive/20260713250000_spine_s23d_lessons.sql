/*
  # Spine Refactor — Slice 2.3d: lessons fold onto the ONE booking table

  no-parallel-systems: lesson_sessions was a SECOND booking table living beside the
  spine `bookings`. This slice folds lessons INTO bookings (kind='lesson') and drops
  lesson_sessions. Both tables are 0 rows, so this is a clean cutover — no data move.

  A. bookings gains the lesson columns (client_id, instructor_user_id, credit_id,
     request_id) + a `kind` discriminator + the lesson status labels
     ('scheduled','no_show'). A lesson booking carries NO purchase/slot; a purchase
     booking carries NO client/credit — one table, two shapes, disjoint by `kind`.
  B. the four lesson RPCs + the two progress RPCs are rewritten verbatim-of-behavior
     onto bookings. Signatures + JSON return shapes are UNCHANGED so the TS wrappers
     and pages keep working; p_engagement_id is kept as an ignored echo (engagements
     retire in S2.3e). Lesson status is stored lowercase and surfaced UPPER to match
     the existing 'SCHEDULED'/'COMPLETED'/'CANCELLED'/'NO_SHOW' contract.
  C. admin_client_overview + admin_client_bookings read bookings(kind='lesson'); the
     overview's document count also moves off engagements onto documents.contact_id.
  D. drop lesson_sessions.
*/

-- ── A. bookings gains the lesson shape ───────────────────────────────────────
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS client_id          uuid REFERENCES clients(id) ON DELETE RESTRICT;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS instructor_user_id uuid REFERENCES profiles(user_id) ON DELETE SET NULL;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS credit_id          uuid REFERENCES lesson_credits(id) ON DELETE SET NULL;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS request_id         uuid REFERENCES requests(id) ON DELETE SET NULL;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS kind               text NOT NULL DEFAULT 'purchase';

ALTER TABLE bookings DROP CONSTRAINT IF EXISTS bookings_kind_check;
ALTER TABLE bookings ADD  CONSTRAINT bookings_kind_check CHECK (kind IN ('purchase','lesson'));

ALTER TABLE bookings DROP CONSTRAINT IF EXISTS bookings_status_check;
ALTER TABLE bookings ADD  CONSTRAINT bookings_status_check
  CHECK (status IN ('pending_slot','pending_payment','confirmed','cancelled','expired','completed','scheduled','no_show'));

CREATE INDEX IF NOT EXISTS bookings_client_start_idx ON bookings (client_id, starts_at) WHERE kind = 'lesson';

-- ── B. lesson RPCs rebuilt on bookings ───────────────────────────────────────

-- 2a. schedule_lesson_session — staff confirm a real lesson date/time (kind='lesson')
CREATE OR REPLACE FUNCTION schedule_lesson_session(
  p_client_id     uuid,
  p_starts_at     timestamptz,
  p_ends_at       timestamptz,
  p_engagement_id uuid DEFAULT NULL,   -- ignored (engagements retire S2.3e); echoed for shape
  p_request_id    uuid DEFAULT NULL,
  p_location      text DEFAULT NULL,
  p_notes         text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $fn$
DECLARE
  v_org     uuid;
  v_contact uuid;
  v_id      uuid;
  v_user    uuid;
BEGIN
  IF NOT (coalesce(auth.role(), '') = 'service_role' OR has_staff_access()) THEN
    RAISE EXCEPTION 'not authorized to schedule lessons';
  END IF;
  IF p_starts_at IS NULL OR p_ends_at IS NULL OR p_ends_at <= p_starts_at THEN
    RAISE EXCEPTION 'a lesson needs a start and an end, and the end must be after the start';
  END IF;

  -- org from the CLIENT row (explicit stamp — DEFAULT current_org() is NULL for
  -- service-role callers); staff may only book inside their own tenant.
  SELECT cl.org_id, cl.contact_id INTO v_org, v_contact
    FROM clients cl WHERE cl.id = p_client_id AND cl.deleted_at IS NULL;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'unknown client: %', p_client_id;
  END IF;
  IF coalesce(auth.role(), '') <> 'service_role' AND v_org IS DISTINCT FROM current_org() THEN
    RAISE EXCEPTION 'client % is not in your organization', p_client_id;
  END IF;

  -- no double-booking: reject an overlap with another live (scheduled) lesson for
  -- the same client in the same org.
  IF EXISTS (
    SELECT 1 FROM bookings b
    WHERE b.kind = 'lesson' AND b.client_id = p_client_id AND b.org_id = v_org
      AND b.status = 'scheduled'
      AND b.starts_at < p_ends_at AND b.ends_at > p_starts_at
  ) THEN
    RAISE EXCEPTION 'this client already has a lesson scheduled that overlaps % – %',
      to_char(p_starts_at, 'FMMonth FMDD, HH12:MI AM'), to_char(p_ends_at, 'HH12:MI AM');
  END IF;

  -- the member's app user, if any (clients.contact_id → profiles.contact_id)
  SELECT p.user_id INTO v_user FROM profiles p WHERE p.contact_id = v_contact;

  INSERT INTO bookings
      (org_id, kind, client_id, account_contact_id, account_user_id, request_id,
       starts_at, ends_at, location, notes, status)
    VALUES
      (v_org, 'lesson', p_client_id, v_contact, v_user, p_request_id,
       p_starts_at, p_ends_at,
       NULLIF(trim(coalesce(p_location, '')), ''), NULLIF(trim(coalesce(p_notes, '')), ''),
       'scheduled')
    RETURNING id INTO v_id;

  -- a booked lesson closes the request-inbox loop: the request is converted.
  IF p_request_id IS NOT NULL THEN
    UPDATE requests SET status = 'converted' WHERE id = p_request_id;
  END IF;

  IF v_user IS NOT NULL THEN
    INSERT INTO notifications (org_id, user_id, kind, title, link)
      VALUES (v_org, v_user, 'lesson_scheduled',
              'Your lesson is booked — ' || to_char(p_starts_at, 'FMMonth FMDD, HH12:MI AM'),
              '/app/schedule');
  END IF;

  RETURN jsonb_build_object(
    'session_id',    v_id,
    'client_id',     p_client_id,
    'starts_at',     p_starts_at,
    'ends_at',       p_ends_at,
    'status',        'SCHEDULED',
    'location',      NULLIF(trim(coalesce(p_location, '')), ''),
    'engagement_id', p_engagement_id,
    'request_id',    p_request_id
  );
END;
$fn$;

REVOKE ALL ON FUNCTION schedule_lesson_session(uuid, timestamptz, timestamptz, uuid, uuid, text, text) FROM public, anon;
GRANT EXECUTE ON FUNCTION schedule_lesson_session(uuid, timestamptz, timestamptz, uuid, uuid, text, text) TO authenticated, service_role;

-- 2b. complete_lesson_session — mark taught + debit the punch card
CREATE OR REPLACE FUNCTION complete_lesson_session(
  p_session_id   uuid,
  p_debit_credit boolean DEFAULT true
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $fn$
DECLARE
  v_b         bookings%ROWTYPE;
  v_credit    uuid;
  v_remaining integer;
BEGIN
  IF NOT (coalesce(auth.role(), '') = 'service_role' OR has_staff_access()) THEN
    RAISE EXCEPTION 'not authorized to complete lessons';
  END IF;

  SELECT * INTO v_b FROM bookings
    WHERE id = p_session_id AND kind = 'lesson'
    FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'unknown lesson session: %', p_session_id;
  END IF;
  IF coalesce(auth.role(), '') <> 'service_role' AND v_b.org_id IS DISTINCT FROM current_org() THEN
    RAISE EXCEPTION 'lesson session % is not in your organization', p_session_id;
  END IF;
  IF v_b.status <> 'scheduled' THEN
    RAISE EXCEPTION 'only a SCHEDULED lesson can be completed (this one is %)', upper(v_b.status);
  END IF;

  UPDATE bookings SET status = 'completed' WHERE id = p_session_id;

  IF p_debit_credit THEN
    -- atomically decrement the OLDEST live credit row with balance (row-locked
    -- SELECT ... FOR UPDATE — two concurrent completes can never double-spend).
    UPDATE lesson_credits lc
       SET credits_remaining = lc.credits_remaining - 1
     WHERE lc.id = (
        SELECT id FROM lesson_credits
        WHERE client_id = v_b.client_id AND org_id = v_b.org_id
          AND deleted_at IS NULL AND credits_remaining > 0
        ORDER BY purchased_at, created_at
        LIMIT 1
        FOR UPDATE
      )
     RETURNING lc.id INTO v_credit;

    IF v_credit IS NOT NULL THEN
      UPDATE bookings SET credit_id = v_credit WHERE id = p_session_id;
    END IF;

    SELECT coalesce(sum(credits_remaining), 0)::int INTO v_remaining
      FROM lesson_credits
      WHERE client_id = v_b.client_id AND org_id = v_b.org_id AND deleted_at IS NULL;
  END IF;

  RETURN jsonb_build_object(
    'session_id',        p_session_id,
    'status',            'COMPLETED',
    'debited',           v_credit IS NOT NULL,
    'credit_id',         v_credit,
    'credits_remaining', v_remaining
  );
END;
$fn$;

REVOKE ALL ON FUNCTION complete_lesson_session(uuid, boolean) FROM public, anon;
GRANT EXECUTE ON FUNCTION complete_lesson_session(uuid, boolean) TO authenticated, service_role;

-- 2c. cancel_lesson_session — CANCELLED (member notified) or NO_SHOW
CREATE OR REPLACE FUNCTION cancel_lesson_session(
  p_session_id uuid,
  p_no_show    boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $fn$
DECLARE
  v_b      bookings%ROWTYPE;
  v_status text := CASE WHEN p_no_show THEN 'no_show' ELSE 'cancelled' END;
  v_user   uuid;
BEGIN
  IF NOT (coalesce(auth.role(), '') = 'service_role' OR has_staff_access()) THEN
    RAISE EXCEPTION 'not authorized to cancel lessons';
  END IF;

  SELECT * INTO v_b FROM bookings
    WHERE id = p_session_id AND kind = 'lesson'
    FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'unknown lesson session: %', p_session_id;
  END IF;
  IF coalesce(auth.role(), '') <> 'service_role' AND v_b.org_id IS DISTINCT FROM current_org() THEN
    RAISE EXCEPTION 'lesson session % is not in your organization', p_session_id;
  END IF;
  IF v_b.status <> 'scheduled' THEN
    RAISE EXCEPTION 'only a SCHEDULED lesson can be cancelled (this one is %)', upper(v_b.status);
  END IF;

  UPDATE bookings SET status = v_status WHERE id = p_session_id;

  -- a cancellation is news the member needs; a no-show is a staff record.
  IF v_status = 'cancelled' AND v_b.account_user_id IS NOT NULL THEN
    INSERT INTO notifications (org_id, user_id, kind, title, link)
      VALUES (v_b.org_id, v_b.account_user_id, 'lesson_cancelled',
              'Your lesson on ' || to_char(v_b.starts_at, 'FMMonth FMDD, HH12:MI AM') || ' was cancelled',
              '/app/schedule');
  END IF;

  RETURN jsonb_build_object('session_id', p_session_id, 'status', upper(v_status));
END;
$fn$;

REVOKE ALL ON FUNCTION cancel_lesson_session(uuid, boolean) FROM public, anon;
GRANT EXECUTE ON FUNCTION cancel_lesson_session(uuid, boolean) TO authenticated, service_role;

-- 2d. my_lesson_sessions — the member's own lessons (upcoming first), status UPPER
CREATE OR REPLACE FUNCTION my_lesson_sessions()
RETURNS jsonb
LANGUAGE sql SECURITY DEFINER SET search_path = public STABLE
AS $fn$
  SELECT coalesce(jsonb_agg(jsonb_build_object(
      'id', s.id, 'starts_at', s.starts_at, 'ends_at', s.ends_at,
      'status', upper(s.status), 'location', s.location, 'notes', s.notes)
      ORDER BY s.ord), '[]'::jsonb)
  FROM (
    SELECT b.*, row_number() OVER (
        ORDER BY (b.starts_at >= now()) DESC,
                 CASE WHEN b.starts_at >= now() THEN b.starts_at END ASC,
                 CASE WHEN b.starts_at <  now() THEN b.starts_at END DESC
      ) AS ord
    FROM bookings b
    WHERE b.kind = 'lesson'
      AND b.client_id = current_client_id()
      AND has_module('mod.lessons')
    ORDER BY (b.starts_at >= now()) DESC,
             CASE WHEN b.starts_at >= now() THEN b.starts_at END ASC,
             CASE WHEN b.starts_at <  now() THEN b.starts_at END DESC
    LIMIT 50
  ) s
$fn$;

REVOKE ALL ON FUNCTION my_lesson_sessions() FROM public, anon;
GRANT EXECUTE ON FUNCTION my_lesson_sessions() TO authenticated;

-- progress note (Slice 5) — write onto the lesson booking's notes
CREATE OR REPLACE FUNCTION public.set_lesson_progress_note(
  p_session_id uuid,
  p_note       text
)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
BEGIN
  IF NOT has_staff_access() THEN
    RAISE EXCEPTION 'operator access required';
  END IF;

  UPDATE bookings
     SET notes = NULLIF(btrim(p_note), '')
   WHERE id = p_session_id
     AND kind = 'lesson'
     AND org_id = current_org();

  IF NOT FOUND THEN
    RAISE EXCEPTION 'session not found in this org';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.my_lesson_progress()
RETURNS TABLE (
  session_id uuid,
  starts_at  timestamptz,
  status     text,
  location   text,
  note       text
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT b.id, b.starts_at, upper(b.status), b.location, b.notes
  FROM bookings b
  WHERE b.kind = 'lesson'
    AND b.client_id = current_client_id()
    AND b.notes IS NOT NULL
    AND btrim(b.notes) <> ''
  ORDER BY b.starts_at DESC
$$;

GRANT EXECUTE ON FUNCTION public.set_lesson_progress_note(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.my_lesson_progress() TO authenticated;

-- ── C. admin account readers off lesson_sessions ─────────────────────────────
CREATE OR REPLACE FUNCTION admin_client_bookings(p_user_id uuid)
RETURNS TABLE (id uuid, starts_at timestamptz, ends_at timestamptz, status text, location text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT b.id, b.starts_at, b.ends_at, upper(b.status), b.location
  FROM bookings b
  JOIN clients c ON c.id = b.client_id
  JOIN profiles p ON p.contact_id = c.contact_id
  WHERE is_admin() AND b.kind = 'lesson' AND p.user_id = p_user_id
  ORDER BY b.starts_at DESC
$$;
GRANT EXECUTE ON FUNCTION admin_client_bookings(uuid) TO authenticated;

-- admin_client_overview: bookings count off bookings(kind='lesson'); documents
-- count off documents.contact_id (new v11 docs have engagement_id NULL).
CREATE OR REPLACE FUNCTION admin_client_overview(p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $fn$
DECLARE
  v_org uuid := current_org();
  v jsonb;
BEGIN
  IF NOT is_admin() THEN
    RAISE EXCEPTION 'admin access required';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM profiles WHERE user_id = p_user_id AND org_id = v_org) THEN
    RAISE EXCEPTION 'account not found in your organization';
  END IF;

  SELECT jsonb_build_object(
    'profile', (SELECT jsonb_build_object(
        'user_id', p.user_id, 'email', p.email, 'first_name', p.first_name,
        'last_name', p.last_name, 'display_name', p.display_name,
        'phone', p.phone, 'mobile', p.mobile, 'whatsapp', p.whatsapp,
        'riding_level', p.riding_level, 'bio', p.bio, 'role', p.role,
        'is_suspended', p.is_suspended, 'created_at', p.created_at,
        'contact_id', p.contact_id,
        'client_id', (SELECT c.id FROM clients c WHERE c.contact_id = p.contact_id AND c.deleted_at IS NULL))
      FROM profiles p WHERE p.user_id = p_user_id),
    'login', (SELECT jsonb_build_object(
        'providers', coalesce((SELECT jsonb_agg(DISTINCT i.provider)
          FROM auth.identities i WHERE i.user_id = p_user_id), '[]'::jsonb),
        'last_sign_in_at', u.last_sign_in_at,
        'created_at', u.created_at,
        'email_confirmed_at', u.email_confirmed_at)
      FROM auth.users u WHERE u.id = p_user_id),
    'membership', (SELECT jsonb_build_object('tier', m.tier, 'status', m.status,
        'started_at', m.started_at)
      FROM memberships m WHERE m.user_id = p_user_id LIMIT 1),
    'counts', jsonb_build_object(
      'orders',    (SELECT count(*) FROM purchases WHERE buyer_user_id = p_user_id AND deleted_at IS NULL),
      'posts',     (SELECT count(*) FROM feed_posts WHERE author_id = p_user_id),
      'documents', (SELECT count(*) FROM documents d
                     JOIN profiles p ON p.contact_id = d.contact_id
                     WHERE p.user_id = p_user_id AND d.deleted_at IS NULL),
      'bookings',  (SELECT count(*) FROM bookings b
                     JOIN clients c ON c.id = b.client_id
                     JOIN profiles p ON p.contact_id = c.contact_id
                     WHERE b.kind = 'lesson' AND p.user_id = p_user_id))
  ) INTO v;
  RETURN v;
END;
$fn$;

-- ── D. drop the second booking table ─────────────────────────────────────────
DROP TABLE IF EXISTS lesson_sessions CASCADE;
