-- TASK REVIEWQ M4 — R3: refusal (and the delete button) stops destroying
-- evidence.
--
-- delete_calendar_item hard-DELETEd every row (verified live: `delete from
-- bookings`, no deleted_at) — the only refusal mechanism before this task,
-- per FLOWTRACE item 11, and what orphaned the owner's own two test bookings'
-- audit events and left spent credits pointing at rows that no longer exist.
--
-- Now: any row carrying a client, a purchase, a credit debit, or a request
-- (booking_change_requests referencing it) is retired — deleted_at/
-- deleted_by stamped, status flipped to 'cancelled' (which calendar_free_
-- busy already excludes) — never destroyed (D11). A debited credit is
-- refunded via the same _refund_booking_credit helper decide_booking_
-- change's decline path uses (M3), so removing a booking from the calendar
-- can never silently keep a client's paid-for credit. Any open companion
-- change-request row is withdrawn, not left dangling.
--
-- status_events was considered as a fourth history signal and DROPPED after
-- verifying live: trg_status_bookings inserts one on every single booking
-- INSERT unconditionally, including a plain 'available' slot nobody ever
-- claimed (proven: all 280 of prod's untouched available slots already carry
-- one). It is not evidence of engagement — it fires before any client ever
-- sees the slot — so treating it as "history" would make every delete a
-- retire and defeat the legitimate hard-delete case below entirely. Verified
-- live against the exact scenario this migration's own test exercises.
--
-- A row with none of the four real signals above (an unused 'available'/
-- 'draft'/'unavailable' slot, or a 'block' nobody ever claimed) is still
-- hard-deleted — the legitimate case this function exists for, unchanged.
--
-- Reworked from a single-row DELETE (with a scope-wide bulk DELETE for
-- 'future'/'all') into a loop over every affected id so scope='future'/'all'
-- on a series with a mix of claimed and unclaimed occurrences retires the
-- claimed ones and hard-deletes the rest, rather than silently skipping any
-- row the original bulk-DELETE's WHERE clause didn't happen to match.
CREATE OR REPLACE FUNCTION public.delete_calendar_item(p_id uuid, p_scope text DEFAULT 'one'::text)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_org    uuid := current_org();
  v_row    bookings%ROWTYPE;
  v_ids    uuid[];
  v_id     uuid;
  v_target bookings%ROWTYPE;
  v_has_history boolean;
  v_n      integer := 0;
BEGIN
  IF NOT has_staff_access() THEN RAISE EXCEPTION 'operator access required'; END IF;
  SELECT * INTO v_row FROM bookings WHERE id = p_id AND org_id = v_org;
  IF NOT FOUND THEN RAISE EXCEPTION 'item not found in this org'; END IF;

  IF p_scope = 'one' OR v_row.series_id IS NULL THEN
    v_ids := ARRAY[p_id];
  ELSIF p_scope = 'future' THEN
    SELECT array_agg(id) INTO v_ids FROM bookings WHERE series_id = v_row.series_id AND starts_at >= v_row.starts_at;
  ELSE
    SELECT array_agg(id) INTO v_ids FROM bookings WHERE series_id = v_row.series_id;
  END IF;

  FOREACH v_id IN ARRAY coalesce(v_ids, ARRAY[]::uuid[]) LOOP
    SELECT * INTO v_target FROM bookings WHERE id = v_id;
    v_has_history := v_target.client_id IS NOT NULL OR v_target.purchase_id IS NOT NULL
      OR v_target.credit_id IS NOT NULL
      OR EXISTS (SELECT 1 FROM booking_change_requests WHERE booking_id = v_target.id);

    IF v_has_history THEN
      IF v_target.status <> 'cancelled' AND v_target.credit_id IS NOT NULL THEN
        PERFORM _refund_booking_credit(v_target);
      END IF;
      UPDATE bookings SET deleted_at = now(), deleted_by = auth.uid(),
          status = 'cancelled', updated_at = now()
        WHERE id = v_id;
      UPDATE booking_change_requests SET status='withdrawn', decided_by=auth.uid(), decided_at=now()
        WHERE booking_id = v_id AND status='pending';
    ELSE
      DELETE FROM bookings WHERE id = v_id;
    END IF;
    v_n := v_n + 1;
  END LOOP;

  RETURN v_n;
END;
$function$;
