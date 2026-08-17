-- TASK-LESSONREQUEST §L4 — a booking made BEFORE the account exists must still
-- find its account when one appears.
--
-- THIS IS A GAP §L3 CREATES, so it is closed here rather than reported. The
-- whole point of the one act is that the lesson is booked at the moment staff
-- agree it on the phone — which is *before* the client has clicked anything.
-- At that instant there is no `auth.users` row, so `schedule_lesson_session`'s
--
--     SELECT p.user_id INTO v_user FROM profiles p WHERE p.contact_id = v_contact;
--
-- correctly finds nothing and the booking lands with `account_user_id` NULL.
-- Nothing anywhere filled it in afterwards: `promote_contact_to_account`
-- re-anchors documents, parties and signatures, but never bookings.
--
-- WHAT THAT COSTS, precisely — it is not cosmetic. The member's own calendar and
-- My Lessons both read `client_id = current_client_id()`, so THE LESSON IS
-- VISIBLE either way (checked: `calendar_free_busy` and `my_lesson_sessions`).
-- What breaks is NOTIFICATION: `confirm_booking`, `decide_booking_change`,
-- `cancel_lesson_session`, `propose_booking_time` and `apply_booking_fee` all
-- address the member through `account_user_id`, and every one of them is
-- written as `IF v.account_user_id IS NOT NULL THEN … notify`. So a staff
-- reschedule or cancellation of a client's VERY FIRST lesson would silently
-- reach nobody — the one lesson they are most likely to need telling about.
--
-- A TRIGGER, NOT AN EDIT TO THE PROMOTION SPINE. `promote_contact_to_account` is
-- the sole writer of `profiles.contact_id` and carries a structural denylist;
-- reissuing 200 lines of it to add one UPDATE is a far larger risk than this,
-- and it would only cover the one path. A trigger on the link itself covers
-- every way a profile ever comes to point at a contact — promotion, invitation
-- redemption, or a repair — and cannot be bypassed by whichever one runs.
--
-- Deliberately narrow: it fills a BLANK and never overwrites a value, so it can
-- never move somebody else's booking onto a new account.

CREATE OR REPLACE FUNCTION public.bookings_claim_on_account_link()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.contact_id IS NULL OR NEW.user_id IS NULL THEN
    RETURN NEW;
  END IF;

  UPDATE bookings b
     SET account_user_id = NEW.user_id
   WHERE b.account_contact_id = NEW.contact_id
     AND b.account_user_id IS NULL;

  RETURN NEW;
END;
$function$;

-- ALTER DEFAULT PRIVILEGES in this database hands `anon` a DIRECT EXECUTE grant
-- on every new function, and `REVOKE … FROM PUBLIC` does not remove a direct
-- grant — so both are named. Postgres refuses to call a trigger function
-- outside a trigger ("trigger functions can only be called as triggers"), so
-- nothing was reachable either way; the grant was still wrong.
REVOKE ALL ON FUNCTION public.bookings_claim_on_account_link() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS bookings_claim_on_account_link_trg ON public.profiles;
CREATE TRIGGER bookings_claim_on_account_link_trg
  AFTER INSERT OR UPDATE OF contact_id ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION bookings_claim_on_account_link();

-- No backfill statement, on purpose: prod holds 5 bookings with an
-- `account_contact_id`, and ZERO of them have a linked profile whose user_id is
-- missing from the booking (checked). There is nothing to repair, and a blind
-- UPDATE over a table this trigger already covers would be a write with no
-- reason to exist.
