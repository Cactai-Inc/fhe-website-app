-- TASK LESSONPLAN m4 — THE RECORD. Photos on a lesson, an activity log everyone
-- can read at their own level, and the one narrow way content is destroyed.
--
-- §3 "Capture what actually happened … notes, photos/video."
-- §5 "An activity log is the minimum; clicking an entry opens the content."
-- §7 "how a mistaken entry is corrected or scrubbed."
-- D27 "NEVER LOCKED, ALWAYS LOGGED" + the one scrub exception.
--
-- ── PHOTOS REUSE THE FILES SPINE, WHICH ALREADY HAD THE SUBJECT ─────────────
-- file_links.subject_type already admits 'booking'. Nothing new is needed to
-- ATTACH a photo to a lesson — staff already hold files_staff_rw and
-- file_links_staff_rw. What was missing is the other half: the RIDER could not
-- see it. An org-owned file is readable by a member only through a PUBLISHED
-- content_resources row (files_org_published_read), which is the catalogue path
-- and has nothing to do with a photo of their own lesson. Two policies below fix
-- exactly that, scoped to "a live link to a booking that is mine" — no new table,
-- no second file model, and no widening of the catalogue rule.

-- ════════════════════════════════════════════════════════════════════════════
-- 1. THE RIDER CAN SEE THE PHOTOS OF THEIR OWN LESSON
-- ════════════════════════════════════════════════════════════════════════════
/** True when this file is live-linked to a booking belonging to the caller's
 *  client record. One definition, used by both the row policy and the storage
 *  policy, so the two can never drift into disagreeing about what a rider may
 *  see. SECURITY DEFINER because a member has no read on file_links for a file
 *  they do not already own — the whole point is that this file is not theirs. */
CREATE OR REPLACE FUNCTION public._file_is_on_my_booking(p_file_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1
      FROM file_links fl
      JOIN bookings b ON b.id = fl.subject_id
     WHERE fl.file_id = p_file_id
       AND fl.subject_type = 'booking'
       AND fl.deleted_at IS NULL
       AND b.client_id IS NOT NULL
       AND b.client_id = current_client_id())
$function$;

REVOKE ALL ON FUNCTION public._file_is_on_my_booking(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public._file_is_on_my_booking(uuid) TO authenticated;

DROP POLICY IF EXISTS files_my_lesson_read ON files;
CREATE POLICY files_my_lesson_read ON files FOR SELECT TO authenticated
  USING (deleted_at IS NULL AND _file_is_on_my_booking(files.id));

-- The storage half. The path grammar is
-- {org_id}/{owner_kind}/{owner_id}/{file_id}-{filename}, so the file id is the
-- part of segment 4 before the first '-' … which is itself a uuid containing
-- '-'. Matching on the whole object name against the files row is exact and
-- cheap, and avoids parsing a uuid out of a filename that may contain dashes.
DROP POLICY IF EXISTS files_my_lesson_object_read ON storage.objects;
CREATE POLICY files_my_lesson_object_read ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'facility-files'
    AND try_cast_uuid(split_part(name, '/', 1)) = current_org()
    AND EXISTS (
      SELECT 1 FROM public.files f
       WHERE f.storage_path = storage.objects.name
         AND f.deleted_at IS NULL
         AND public._file_is_on_my_booking(f.id))
  );

-- ════════════════════════════════════════════════════════════════════════════
-- 2. THE MEDIA ON ONE LESSON
-- ════════════════════════════════════════════════════════════════════════════
-- Returns rows, not URLs: the signed URL is minted browser-side by
-- fileDownloadUrl(), which is how every other file surface in this app works.
CREATE OR REPLACE FUNCTION public.lesson_media(p_booking_id uuid)
RETURNS TABLE (
  file_id      uuid,
  bucket_id    text,
  storage_path text,
  filename     text,
  mime_type    text,
  title        text,
  byte_size    bigint,
  created_at   timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT f.id, f.bucket_id, f.storage_path, f.filename, f.mime_type, f.title,
         f.byte_size, fl.created_at
    FROM file_links fl
    JOIN files f    ON f.id = fl.file_id AND f.deleted_at IS NULL
    JOIN bookings b ON b.id = fl.subject_id
   WHERE fl.subject_type = 'booking'
     AND fl.subject_id = p_booking_id
     AND fl.deleted_at IS NULL
     AND (coalesce(has_staff_access() AND b.org_id = current_org(), false)
          OR (b.client_id IS NOT NULL AND b.client_id = current_client_id()))
   ORDER BY fl.created_at
$function$;

-- ════════════════════════════════════════════════════════════════════════════
-- 3. THE ACTIVITY LOG (§5, D27)
-- ════════════════════════════════════════════════════════════════════════════
-- "An activity log is the minimum; clicking an entry opens the content." One
-- entry per lesson that has something on it, carrying enough to render a row and
-- the booking id to open it with. Staff see the instructor log; the rider does
-- not — the same split booking_report() already enforces, restated here in the
-- one place a rider-visible list is built rather than left to the caller.
CREATE OR REPLACE FUNCTION public.lesson_activity(
  p_client_id uuid DEFAULT NULL,
  p_horse_id  uuid DEFAULT NULL,
  p_limit     integer DEFAULT 100)
RETURNS TABLE (
  booking_id     uuid,
  starts_at      timestamptz,
  ends_at        timestamptz,
  client_id      uuid,
  client_name    text,
  horse_id       uuid,
  horse_name     text,
  service_type   text,
  booking_status text,
  activities     jsonb,
  report         text,
  log_text       text,
  plan_version   integer,
  plan_focus     text,
  media_count    integer,
  form_status    text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  WITH scope AS (
    SELECT coalesce(has_staff_access() AND current_org() IS NOT NULL, false) AS is_staff,
           current_client_id() AS me
  )
  SELECT b.id, b.starts_at, b.ends_at, b.client_id,
         nullif(btrim(coalesce(ct.first_name, '') || ' ' || coalesce(ct.last_name, '')), ''),
         b.horse_id,
         (SELECT coalesce(h.nickname, h.registered_name, h.display_code)
            FROM horses h WHERE h.id = b.horse_id),
         coalesce(bf.service_type, booking_service_type(b)),
         upper(b.status),
         coalesce(b.activity_log -> 'activities', '[]'::jsonb),
         b.notes,
         -- THE STAFF LANE. NULL for a rider reading their own log, by
         -- construction rather than by a caller remembering to drop it.
         CASE WHEN s.is_staff THEN b.activity_log ->> 'text' END,
         pl.version, pl.focus,
         (SELECT count(*)::int FROM file_links fl
           WHERE fl.subject_type = 'booking' AND fl.subject_id = b.id
             AND fl.deleted_at IS NULL),
         bf.status
    FROM scope s
    CROSS JOIN bookings b
    LEFT JOIN booking_forms bf ON bf.booking_id = b.id
    LEFT JOIN clients cl       ON cl.id = b.client_id
    LEFT JOIN contacts ct      ON ct.id = cl.contact_id
    LEFT JOIN lesson_plans pl  ON pl.id = bf.plan_id
   WHERE b.deleted_at IS NULL
     AND b.kind IN ('lesson', 'care')
     AND (
       (s.is_staff AND b.org_id = current_org())
       OR (s.me IS NOT NULL AND b.client_id = s.me)
     )
     AND (p_client_id IS NULL OR b.client_id = p_client_id)
     AND (p_horse_id  IS NULL OR b.horse_id  = p_horse_id)
     -- "has something on it": a write-up, a checked activity, a photo, or a
     -- finished form. An empty future lesson is on the schedule, not in the log.
     AND (
       nullif(btrim(coalesce(b.notes, '')), '') IS NOT NULL
       OR jsonb_array_length(coalesce(b.activity_log -> 'activities', '[]'::jsonb)) > 0
       OR nullif(btrim(coalesce(b.activity_log ->> 'text', '')), '') IS NOT NULL
       OR bf.status = 'submitted'
       OR EXISTS (SELECT 1 FROM file_links fl
                   WHERE fl.subject_type = 'booking' AND fl.subject_id = b.id
                     AND fl.deleted_at IS NULL)
     )
   ORDER BY b.starts_at DESC
   LIMIT greatest(1, least(coalesce(p_limit, 100), 500))
$function$;

-- ════════════════════════════════════════════════════════════════════════════
-- 4. THE SCRUB — D27's one exception, and nothing wider
-- ════════════════════════════════════════════════════════════════════════════
-- Owner: "If something sensitive is accidentally captured like maybe the wrong
-- photo is added or the wrong text is pasted into a note and saved, we need to
-- have the ability to fully scrub it so we remove liability over that content."
--
-- This is the ONLY function in this task that destroys anything. It is narrow by
-- construction:
--   * it takes exactly three kinds — a photo on a lesson, one text answer on a
--     lesson's form, or one objective's note across a client's plan history;
--   * it REQUIRES a reason, which is stored (the reason, never the content);
--   * it logs the scrub, so the record shows that something was removed and why,
--     which is what keeps an audit honest when the content itself is gone.
-- It does NOT weaken D11 (accounts archive), D15 (a linked file survives its
-- owner's "remove") or the rule that executed documents are evidence. A photo of
-- a lesson is not an executed document, and this path is for content that should
-- never have been captured at all.
--
-- The storage OBJECT is removed by the caller after this returns (it hands back
-- the path). That is not a loose end: the bytes live in Supabase Storage, which
-- has no SQL-side delete, and every other file path in this app removes objects
-- the same way. scrub_lesson_content is what makes it legal and logged.
CREATE OR REPLACE FUNCTION public.scrub_lesson_content(
  p_kind    text,
  p_subject uuid,
  p_reason  text,
  p_key     text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_reason text := nullif(btrim(coalesce(p_reason, '')), '');
  v_f      files%ROWTYPE;
  v_b      bookings%ROWTYPE;
  v_plan   lesson_plans%ROWTYPE;
  v_count  integer := 0;
  v_path   text;
BEGIN
  IF NOT has_staff_access() THEN RAISE EXCEPTION 'operator access required'; END IF;
  IF v_reason IS NULL THEN
    RAISE EXCEPTION 'a scrub needs a reason — it is the only thing left once the content is gone';
  END IF;

  -- ── a photo or video on a lesson ─────────────────────────────────────────
  IF p_kind = 'media' THEN
    SELECT * INTO v_f FROM files WHERE id = p_subject AND org_id = current_org();
    IF NOT FOUND THEN RAISE EXCEPTION 'file not found in this org'; END IF;
    IF EXISTS (SELECT 1 FROM content_resources cr WHERE cr.file_id = v_f.id) THEN
      RAISE EXCEPTION 'this file is published in the content catalogue — unpublish it there first';
    END IF;
    -- the link this scrub is being requested from, for the log
    SELECT b.* INTO v_b FROM file_links fl JOIN bookings b ON b.id = fl.subject_id
      WHERE fl.file_id = v_f.id AND fl.subject_type = 'booking' LIMIT 1;

    v_path := v_f.storage_path;
    DELETE FROM file_links WHERE file_id = v_f.id;
    DELETE FROM files WHERE id = v_f.id;
    v_count := 1;

    IF v_b.id IS NOT NULL THEN
      PERFORM log_status_event('offering', v_b.id, 'progress_recorded',
                'Media scrubbed for liability: ' || v_reason, v_b.org_id);
    END IF;

    RETURN jsonb_build_object('kind', 'media', 'scrubbed', v_count,
                              'storage_path', v_path, 'bucket_id', v_f.bucket_id);
  END IF;

  -- ── one text answer on a lesson's form ───────────────────────────────────
  IF p_kind = 'answer' THEN
    IF p_key IS NULL OR btrim(p_key) = '' THEN
      RAISE EXCEPTION 'name the field to scrub';
    END IF;
    SELECT * INTO v_b FROM bookings WHERE id = p_subject AND org_id = current_org();
    IF NOT FOUND THEN RAISE EXCEPTION 'lesson not found in this org'; END IF;

    -- The answers row AND its projection on bookings, together — leaving the
    -- projection behind is leaving the content in the system, which is the whole
    -- thing this call exists to prevent.
    UPDATE booking_forms
       SET answers = answers - btrim(p_key), updated_at = now()
     WHERE booking_id = p_subject;
    GET DIAGNOSTICS v_count = ROW_COUNT;

    IF btrim(p_key) = 'report' THEN
      UPDATE bookings SET notes = NULL WHERE id = p_subject;
    ELSIF btrim(p_key) = 'log_text' THEN
      UPDATE bookings SET activity_log = coalesce(activity_log, '{}'::jsonb)
                            || jsonb_build_object('text', NULL)
       WHERE id = p_subject;
    END IF;

    PERFORM log_status_event('offering', p_subject, 'progress_recorded',
              'Field "' || btrim(p_key) || '" scrubbed for liability: ' || v_reason,
              v_b.org_id);
    RETURN jsonb_build_object('kind', 'answer', 'scrubbed', v_count, 'key', btrim(p_key));
  END IF;

  -- ── one objective's note, across EVERY retained version of the plan ──────
  -- Scrubbing only the current version would leave the text sitting in the
  -- history the rest of this task works hard to retain. The objective itself
  -- stays; only the note is destroyed.
  IF p_kind = 'objective_note' THEN
    IF p_key IS NULL OR btrim(p_key) = '' THEN
      RAISE EXCEPTION 'name the objective to scrub';
    END IF;
    SELECT * INTO v_plan FROM lesson_plans WHERE id = p_subject AND org_id = current_org();
    IF NOT FOUND THEN RAISE EXCEPTION 'plan version not found in this org'; END IF;

    UPDATE lesson_plans p
       SET objectives = (
         SELECT coalesce(jsonb_agg(
                  CASE WHEN e.v ->> 'id' = btrim(p_key)
                       THEN e.v || jsonb_build_object('note', NULL) ELSE e.v END
                  ORDER BY e.n), '[]'::jsonb)
           FROM jsonb_array_elements(p.objectives) WITH ORDINALITY AS e(v, n))
     WHERE p.client_id = v_plan.client_id
       AND EXISTS (SELECT 1 FROM jsonb_array_elements(p.objectives) AS y
                    WHERE y ->> 'id' = btrim(p_key) AND y ->> 'note' IS NOT NULL);
    GET DIAGNOSTICS v_count = ROW_COUNT;

    PERFORM log_status_event('lesson_plan', v_plan.id, 'scrubbed',
              'An objective note was scrubbed for liability across ' || v_count
              || ' version(s): ' || v_reason, v_plan.org_id);
    RETURN jsonb_build_object('kind', 'objective_note', 'scrubbed', v_count);
  END IF;

  RAISE EXCEPTION 'unknown scrub kind: % (media | answer | objective_note)', p_kind;
END;
$function$;

-- ════════════════════════════════════════════════════════════════════════════
-- 5. GRANTS
-- ════════════════════════════════════════════════════════════════════════════
REVOKE ALL ON FUNCTION public.lesson_media(uuid)                        FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.lesson_activity(uuid, uuid, integer)      FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.scrub_lesson_content(text, uuid, text, text) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.lesson_media(uuid)                        TO authenticated;
GRANT EXECUTE ON FUNCTION public.lesson_activity(uuid, uuid, integer)      TO authenticated;
GRANT EXECUTE ON FUNCTION public.scrub_lesson_content(text, uuid, text, text) TO authenticated;
