-- TASK REVIEWQ M1 — schema for "a booking is REQUESTED until the company says
-- otherwise" (docs/tasks/TASK-REVIEWQ-pending-bookings-and-the-company-queue.md).
--
-- booking_change_requests gains request_kind='new': a client-made booking
-- (book_open_slot / request_open_time, wired in M2) inserts a companion row
-- here at creation time, the same shape reschedule/cancel/defer already use.
-- decide_booking_change (extended in M3) and the existing open_change_
-- requests()/my_pending_changes() readers pick it up without a second queue —
-- the incumbent request machinery, extended, not duplicated.
--
-- awaiting_client flips the decision direction on a row: false (default,
-- today's only shape) = the client raised it, staff decides. true = staff
-- proposed a counter-time (R2's "propose another time"), and the booking's
-- own client decides. staff_note is a staff-authored note (a decline reason,
-- or a note on a counter-offer) — kept separate from the existing client-
-- authored `note` column so neither overwrites the other.
--
-- booking_change_requests has 0 rows in prod today (verified live), so
-- dropping/re-adding the CHECK is instant — no NOT VALID needed.
alter table booking_change_requests
  drop constraint booking_change_requests_request_kind_check;
alter table booking_change_requests
  add constraint booking_change_requests_request_kind_check
  check (request_kind = any (array['reschedule','cancel','defer','flex_move','new']));

alter table booking_change_requests
  add column if not exists awaiting_client boolean not null default false;
alter table booking_change_requests
  add column if not exists staff_note text;

comment on column booking_change_requests.awaiting_client is
  'REVIEWQ R2: true when staff proposed a counter-time and the booking''s own client must accept/decline it; false (default) is the existing client-raises/staff-decides direction.';
comment on column booking_change_requests.staff_note is
  'REVIEWQ R2/R3: staff-authored note — a decline reason or a note on a proposed counter-time. Separate from the client-authored `note` column so neither overwrites the other.';

-- REVIEWQ R3 — bookings gain the soft-retire columns delete_calendar_item
-- (fixed in M4) needs so it can stop hard-deleting rows that carry client/
-- purchase/credit/audit history (D11: nothing is purged, retire behind a
-- boolean). NULL deleted_at = live (every row in prod today); non-null =
-- retired. A retired row also gets status='cancelled', which calendar_free_
-- busy already excludes (`WHERE b.status NOT IN ('cancelled','expired')`),
-- so retirement needs no separate read-path filter.
alter table bookings add column if not exists deleted_at timestamptz;
alter table bookings add column if not exists deleted_by uuid references profiles(user_id) on delete set null;

comment on column bookings.deleted_at is
  'REVIEWQ R3/D11: set by delete_calendar_item when a row carrying client/purchase/credit/audit history is retired instead of hard-deleted. NULL = live.';
