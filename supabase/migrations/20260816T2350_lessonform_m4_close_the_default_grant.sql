-- TASK LESSONFORM m4 — close the two grants the defaults left open.
--
-- m1–m3 revoked PUBLIC and anon on everything new, and has_function_privilege()
-- confirms anon is FALSE on all nine objects. But `authenticated` still came out
-- TRUE on the two INTERNAL writers, because this project has
-- ALTER DEFAULT PRIVILEGES … GRANT EXECUTE ON FUNCTIONS TO authenticated — a
-- DIRECT grant, which is exactly the trap TASK-SECFIX named: revoking from
-- PUBLIC does not remove a direct grant, and the revoke silently no-ops.
--
-- _ensure_booking_form() is SECURITY DEFINER and inserts a booking_forms row for
-- whatever booking id it is handed. Nothing leaks through it, but a signed-in
-- member should not be able to mint form instances on other people's bookings.
-- It is only ever called from save_booking_form() and from the trigger, both of
-- which run as the owner, so nothing legitimate loses access.
--
-- The pure predicates (booking_form_key, _booking_form_is_blank,
-- booking_form_applies) keep their authenticated grant: they read nothing and
-- write nothing.
REVOKE EXECUTE ON FUNCTION public._ensure_booking_form(bookings)     FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.trg_booking_form_lifecycle()       FROM authenticated;
