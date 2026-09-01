-- SLICE 5 — per-lesson progress notes. The operator (trainer or admin) writes a
-- note on a rider's lesson session; the rider reads it in two views (the lesson
-- history card, which already surfaces lesson_sessions.notes via my_lesson_sessions,
-- and a new aggregated "progress" view). We keep the note on lesson_sessions.notes —
-- one field, already rider-visible — and add:
--   set_lesson_progress_note()  — staff writes/updates the note (any operator kind)
--   my_lesson_progress()        — the rider's aggregated notes across sessions
--
-- No new table: the note is intrinsically per-session and already flows to the rider.

-- ── staff writes the rider-visible progress note on one session ──
CREATE OR REPLACE FUNCTION public.set_lesson_progress_note(
  p_session_id uuid,
  p_note       text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NOT has_staff_access() THEN
    RAISE EXCEPTION 'operator access required';
  END IF;

  UPDATE lesson_sessions
     SET notes = NULLIF(btrim(p_note), ''),
         updated_at = now()
   WHERE id = p_session_id
     AND org_id = current_org()
     AND deleted_at IS NULL;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'session not found in this org';
  END IF;
END;
$$;

-- ── the rider's aggregated progress: every session that carries a note, newest
-- first, with the note + when/status. RLS on lesson_sessions already restricts to
-- the caller's own rows; this is the "second view" the spec calls for. ──
CREATE OR REPLACE FUNCTION public.my_lesson_progress()
RETURNS TABLE (
  session_id uuid,
  starts_at  timestamptz,
  status     text,
  location   text,
  note       text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT s.id, s.starts_at, s.status, s.location, s.notes
  FROM lesson_sessions s
  WHERE s.client_id = current_client_id()
    AND s.deleted_at IS NULL
    AND s.notes IS NOT NULL
    AND btrim(s.notes) <> ''
  ORDER BY s.starts_at DESC
$$;

GRANT EXECUTE ON FUNCTION public.set_lesson_progress_note(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.my_lesson_progress() TO authenticated;
