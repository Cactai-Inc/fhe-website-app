/*
  # Fix the hold reaper — release_expired_holds() was dropped 2026-07-13

  reap_expired_holds() has called release_expired_holds() since 2026-07-08
  (20260708130000_spine_approval_reaper.sql), a function that was dropped the
  same slice cutover — 20260713180000_spine_s22_orders_retire.sql, comment
  "orders-based and unused (the live reaper is reap_expired_holds)" — and that
  comment was wrong: it WAS the live reaper's own housekeeping call. Every
  invocation since has raised "function release_expired_holds() does not
  exist", rolling back the UPDATE along with it. Nothing has been reaped in
  seven weeks (TASK-REAPER).

  Verified 2026-09-01, before touching this function: the order/booking/slot
  housekeeping release_expired_holds() performed has no live counterpart to
  preserve. The day after it was dropped, 20260714140000_calendar_cleanup.sql
  retired the whole slot-booking system it operated on — availability_slots
  (DROP TABLE), hold_slot / release_booking_hold (DROP FUNCTION), and
  bookings.slot_id (DROP COLUMN). Confirmed still gone in prod today:
  `to_regclass('public.availability_slots')` is NULL, `bookings.slot_id` is
  not a column, and `bookings.hold_expires_at` / `status = 'pending_slot'`
  are read and written nowhere in the current codebase. There is no second
  task hiding here — the reaper is the UPDATE alone.

  Uses CREATE OR REPLACE (same name, same signature, same body otherwise) so
  the function's ACL is preserved, not reset.
*/

CREATE OR REPLACE FUNCTION reap_expired_holds()
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $fn$
DECLARE v_count integer := 0;
BEGIN
  -- lapse line items past their 48h hold (approval preserved; re-offer resets)
  UPDATE request_selections SET state = 'lapsed'
   WHERE state = 'approved_awaiting_claim'
     AND hold_expires_at IS NOT NULL
     AND hold_expires_at < now();
  GET DIAGNOSTICS v_count = ROW_COUNT;

  RETURN v_count;
END;
$fn$;
