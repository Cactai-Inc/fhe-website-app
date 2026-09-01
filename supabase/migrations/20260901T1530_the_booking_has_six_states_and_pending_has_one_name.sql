-- TASK-LIFECYCLE · A — THE SIX STATES, AND ONE SPELLING OF "PENDING"
--
-- Owner, 2026-09-01: *"the stages/status dont function, a block is either booked
-- or open. it should have at least, requested, approved, pending, scheduled,
-- moved, cancelled."*
--
-- ⚠️ THE SPEC SAID TWO VALUES WERE MISSING FROM THE CHECK. THREE ARE.
-- `TASK-LIFECYCLE` §2b reads the constraint and concludes *"`approved` and
-- `moved` are NOT [legal] — the constraint must be widened for exactly two
-- values, and no others."* It did not check `requested`, which is not there
-- either — and `requested` is the FIRST of the owner's six states, the state the
-- `/sign/*` funnel (TASK-SIGNBOOK) submits into and the one the staff request
-- card (TASK-REQCARDS) renders. Widening for two would have left the machine
-- unable to write its own first state.
--
-- `pending_slot` and `pending_payment` leave in the same breath. Trap 5: three
-- names for one idea, six live functions testing the triple together, and
-- `pending_slot` is the column DEFAULT that has never once been written. D32 is
-- not engaged — retiring a value no row carries removes no data — and the
-- guard below refuses the migration outright if that stops being true.

-- ── 1 · the guard. Prove it before you retire it. ────────────────────────────
DO $$
DECLARE v_n int;
BEGIN
  SELECT count(*) INTO v_n FROM bookings WHERE status IN ('pending_slot','pending_payment');
  IF v_n > 0 THEN
    RAISE EXCEPTION 'refusing to retire pending_slot/pending_payment: % booking(s) still carry one', v_n;
  END IF;
END $$;

-- ── 2 · the default moves first, or the CHECK cannot lose the value ─────────
-- Nothing depends on it: every insert path names its own status, which is why
-- zero rows carry `pending_slot`. `requested` is the honest default — a booking
-- nobody has approved yet is a request.
ALTER TABLE bookings ALTER COLUMN status SET DEFAULT 'requested';

ALTER TABLE bookings DROP CONSTRAINT bookings_status_check;
ALTER TABLE bookings ADD CONSTRAINT bookings_status_check CHECK (status = ANY (ARRAY[
  -- the calendar's own furniture, untouched (CR-03/CR-06 — Trap 4)
  'draft'::text, 'available'::text, 'unavailable'::text,
  -- ⚠️ THE OWNER'S SIX
  'requested'::text, 'approved'::text, 'pending'::text, 'scheduled'::text,
  'moved'::text, 'cancelled'::text,
  -- and the ones the machine already ends on
  'confirmed'::text, 'expired'::text, 'completed'::text, 'no_show'::text]));

-- ── 3 · the collapse to four codes, with no silent ELSE for a new state ─────
-- Trap 2: a status this function has not been taught falls into `ELSE 'pending'`
-- and `trg_status_bookings` writes that into `status_events` — the row looks
-- right and the timeline lies. All three new states are named explicitly here.
-- `moved` collapses to `pending`, NOT to `cancelled`: the slot is still held.
CREATE OR REPLACE FUNCTION public.booking_status_code(p_status text)
 RETURNS text
 LANGUAGE sql
 IMMUTABLE
AS $function$
  SELECT CASE
    WHEN p_status IN ('completed') THEN 'completed'
    WHEN p_status IN ('cancelled','expired') THEN 'cancelled'
    -- asked for · approved and awaiting payment · payment declared · held while
    -- a move is decided. None of these is a session anyone can rely on yet.
    WHEN p_status IN ('requested','approved','pending','moved') THEN 'pending'
    WHEN p_status IN ('scheduled','confirmed') THEN 'scheduled'
    ELSE 'pending' END;
$function$;

-- ── 4 · the other five that tested the triple ───────────────────────────────
-- Each one asked "is this booking not yet firm?" by listing the three spellings.
-- The answer is now the three real stages before firm: requested, approved, pending.

CREATE OR REPLACE FUNCTION public.booking_form_applies(p_booking bookings)
 RETURNS boolean
 LANGUAGE sql
 IMMUTABLE
AS $function$
  SELECT p_booking.kind IN ('lesson', 'care')
     AND p_booking.client_id IS NOT NULL
     AND p_booking.deleted_at IS NULL
     AND p_booking.status IN ('requested', 'approved', 'pending', 'moved',
                              'confirmed', 'scheduled', 'completed', 'no_show')
$function$;

-- ⚠️ `confirm_booking` ALSO tested the triple, and it is NOT here: it is
-- defined once, in full, in the migration that owns the transitions
-- (`20260901T1640_*`), because the same edit that renames its guard also
-- teaches it `approved`. Two partial definitions of one function across two
-- files is how a repo ends up with two of everything.

-- ⚠️ TWO FIXES BESIDE THE RENAME, both found by reading it:
--   (a) it set 'confirmed' for a LESSON too, where every other transition in
--       this codebase sets 'scheduled' for kind='lesson';
--   (b) it carried 'scheduled' in its own WHERE, so settling a purchase could
--       DOWNGRADE an already-scheduled lesson to 'confirmed'.
CREATE OR REPLACE FUNCTION public.confirm_booking_for_purchase(p_purchase_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  -- the calendar owns scheduling now; on payment we just confirm any booking
  -- already linked to this purchase.
  UPDATE bookings
     SET status = CASE WHEN kind = 'lesson' THEN 'scheduled' ELSE 'confirmed' END,
         updated_at = now()
   WHERE purchase_id = p_purchase_id
     AND status IN ('requested','approved','pending');
END;
$function$;

CREATE OR REPLACE FUNCTION public.my_lesson_sessions()
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT coalesce(jsonb_agg(jsonb_build_object(
      'id', s.id, 'starts_at', s.starts_at, 'ends_at', s.ends_at,
      -- ⚠️ DELIBERATELY still 'PENDING' for all four pre-firm states.
      -- `MyLessonsContent.tsx:147` filters the member's upcoming list to
      -- SCHEDULED|PENDING; emitting 'REQUESTED' here would delete the client's
      -- own session from their own page. The member surface already renders
      -- PENDING with the word "REQUESTED" (:193).
      'status', CASE
        WHEN s.status IN ('requested','approved','pending','moved') THEN 'PENDING'
        WHEN s.status IN ('scheduled','confirmed') THEN 'SCHEDULED'
        WHEN s.status IN ('cancelled','expired') THEN 'CANCELLED'
        WHEN s.status = 'completed' THEN 'COMPLETED'
        WHEN s.status = 'no_show' THEN 'NO_SHOW'
        ELSE upper(s.status) END,
      'location', s.location, 'notes', s.notes)
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
$function$;

CREATE OR REPLACE FUNCTION public.calendar_money_items(p_from timestamp with time zone, p_to timestamp with time zone)
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT coalesce(jsonb_agg(x ORDER BY x->>'at'), '[]'::jsonb) FROM (
    -- payment due
    SELECT jsonb_build_object(
      'kind','payment','at', p.created_at, 'label',
      'Payment due · $' || round(coalesce(p.amount,0))::text,
      'ref', p.id, 'status', p.payment_status) AS x
      FROM purchases p
     WHERE p.deleted_at IS NULL AND p.payment_status <> 'paid' AND p.status <> 'void'
       AND p.created_at BETWEEN p_from AND p_to
       AND (has_staff_access() OR p.buyer_user_id = auth.uid() OR p.buyer_contact_id = current_contact_id())
    UNION ALL
    -- gift expirations
    SELECT jsonb_build_object(
      'kind','expiration','at', g.expires_at, 'label',
      'Gift expires · ' || coalesce(g.item_label,'gift'), 'ref', g.id, 'status', g.status)
      FROM gifts g
     WHERE g.expires_at BETWEEN p_from AND p_to AND g.status <> 'redeemed'
       AND (has_staff_access() OR g.buyer_user_id = auth.uid()
            OR lower(g.recipient_email) = lower((SELECT email FROM auth.users WHERE id = auth.uid())))
    UNION ALL
    -- confirmations pending: the three real stages before a session is firm,
    -- dated by starts_at (bookings never carry hold_expires_at).
    SELECT jsonb_build_object(
      'kind','confirmation','at', b.starts_at, 'label',
      'Confirm your booking', 'ref', b.id, 'status', b.status)
      FROM bookings b
     WHERE b.starts_at BETWEEN p_from AND p_to
       AND b.status IN ('requested','approved','pending')
       AND (has_staff_access() OR b.account_user_id = auth.uid() OR b.account_contact_id = current_contact_id())
  ) s;
$function$;
